import {
  createPublicClient,
  decodeEventLog,
  http,
  type AbiEvent,
  type Address,
  type Log,
  type PublicClient,
} from "viem";
import { updateCandlesFromTrade } from "./candles.js";
import { config } from "./config.js";
import {
  getAllCurveAddresses,
  getAllPairAddresses,
  getDb,
  getLastIndexedBlock,
  getTokenByCurve,
  getTokenByPair,
  insertTrade,
  mapCurveToToken,
  mapPairToToken,
  markGraduated,
  setLastIndexedBlock,
  updateHolderBalance,
  updateTokenState,
  upsertToken,
} from "./db.js";
import { pairPriceEth, sleep, tradeId, tradePriceEth } from "./utils.js";

const robinhoodChain = {
  id: config.chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
} as const;

export const publicClient: PublicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(config.rpcUrl, { batch: true }),
});

async function getBlockTimestamp(blockNumber: bigint): Promise<number> {
  const block = await publicClient.getBlock({ blockNumber });
  return Number(block.timestamp);
}

const timestampCache = new Map<string, number>();

async function timestampForBlock(blockNumber: bigint): Promise<number> {
  const key = blockNumber.toString();
  const cached = timestampCache.get(key);
  if (cached !== undefined) return cached;
  const ts = await getBlockTimestamp(blockNumber);
  timestampCache.set(key, ts);
  return ts;
}

async function fetchLogsInChunks(params: {
  address?: Address | Address[];
  event: AbiEvent;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<Log[]> {
  const logs: Log[] = [];
  let from = params.fromBlock;

  while (from <= params.toBlock) {
    const to =
      from + BigInt(config.blockChunkSize) - 1n > params.toBlock
        ? params.toBlock
        : from + BigInt(config.blockChunkSize) - 1n;

    const chunk = await publicClient.getLogs({
      address: params.address,
      event: params.event,
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...chunk);
    from = to + 1n;
  }

  return logs;
}

async function enrichTokenFromChain(token: Address): Promise<boolean> {
  try {
    const info = await publicClient.readContract({
      address: config.contracts.launchpadFactory,
      abi: config.abis.launchpadFactory,
      functionName: "getToken",
      args: [token],
    });

    const [saleSupply, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: config.contracts.launchpadFactory,
        abi: config.abis.launchpadFactory,
        functionName: "saleSupply",
      }),
      publicClient.readContract({
        address: config.contracts.launchpadFactory,
        abi: config.abis.launchpadFactory,
        functionName: "totalSupply_",
      }),
    ]);

    upsertToken({
      address: info.token,
      curveAddress: info.curve,
      creator: info.creator,
      name: info.name,
      symbol: info.symbol,
      description: info.description,
      image: info.image,
      twitter: info.twitter,
      telegram: info.telegram,
      website: info.website,
      saleSupply,
      totalSupply,
      createdAt: Number(info.createdAt),
    });
    return true;
  } catch {
    return false;
  }
}

async function refreshTokenPrice(tokenAddress: string): Promise<void> {
  const token = tokenAddress as Address;
  const row = getDb()
    .prepare("SELECT curve_address, pair_address, graduated FROM tokens WHERE address = ?")
    .get(tokenAddress.toLowerCase()) as
    | { curve_address: string; pair_address: string | null; graduated: number }
    | undefined;

  if (!row) return;

  if (row.graduated && row.pair_address) {
    const [reserveEth, reserveToken] = await publicClient.readContract({
      address: row.pair_address as Address,
      abi: config.abis.pumpSwapPair,
      functionName: "getReserves",
    });
    const price = pairPriceEth(BigInt(reserveEth), BigInt(reserveToken));
    updateTokenState(tokenAddress, {
      reserveEth: BigInt(reserveEth),
      reserveToken: BigInt(reserveToken),
      priceEth: price,
      graduated: true,
    });
    return;
  }

  const [price, tokensSold] = await Promise.all([
    publicClient.readContract({
      address: row.curve_address as Address,
      abi: config.abis.bondingCurve,
      functionName: "currentPrice",
    }),
    publicClient.readContract({
      address: row.curve_address as Address,
      abi: config.abis.bondingCurve,
      functionName: "tokensSold",
    }),
  ]);

  updateTokenState(tokenAddress, {
    tokensSold,
    priceEth: price,
  });
}

async function processTokenCreatedLogs(logs: Log[]): Promise<void> {
  for (const log of logs) {
    const decoded = decodeEventLog({
      abi: config.abis.launchpadFactory,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName !== "TokenCreated") continue;

    const { token, curve, creator, name, symbol, index } = decoded.args;
    const blockNumber = Number(log.blockNumber);
    const timestamp = await timestampForBlock(log.blockNumber!);

    await enrichTokenFromChain(token);

    upsertToken({
      address: token,
      curveAddress: curve,
      creator,
      name,
      symbol,
      indexNum: Number(index),
      createdAt: timestamp,
      createdBlock: blockNumber,
    });
  }
}

async function processPairCreatedLogs(logs: Log[]): Promise<void> {
  for (const log of logs) {
    const decoded = decodeEventLog({
      abi: config.abis.pumpSwapFactory,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== "PairCreated") continue;
    mapPairToToken(decoded.args.pair, decoded.args.token);
  }
}

async function recordTrade(params: {
  log: Log;
  tokenAddress: string;
  tradeType: "buy" | "sell" | "swap";
  traderAddress: string;
  ethAmount: bigint;
  tokenAmount: bigint;
}): Promise<void> {
  const { log, tokenAddress, tradeType, traderAddress, ethAmount, tokenAmount } =
    params;
  const blockNumber = Number(log.blockNumber);
  const timestamp = await timestampForBlock(log.blockNumber!);
  const priceEth = tradePriceEth(ethAmount, tokenAmount);
  const id = tradeId(log.transactionHash!, log.logIndex!);

  const inserted = insertTrade({
    id,
    txHash: log.transactionHash!,
    logIndex: log.logIndex!,
    blockNumber,
    timestamp,
    tokenAddress,
    tradeType,
    traderAddress,
    ethAmount,
    tokenAmount,
    priceEth,
  });

  if (!inserted) return;

  updateCandlesFromTrade(tokenAddress, timestamp, priceEth, ethAmount);
  updateTokenState(tokenAddress, { priceEth });

  if (tradeType === "buy") {
    updateHolderBalance(tokenAddress, traderAddress, tokenAmount);
  } else if (tradeType === "sell" || (tradeType === "swap" && tokenAmount > 0n)) {
    // swap ethIn=true: trader receives tokens; ethIn=false: trader sends tokens
  }
}

async function processCurveLogs(logs: Log[]): Promise<void> {
  for (const log of logs) {
    const curveAddress = log.address!.toLowerCase();
    let tokenAddress = getTokenByCurve(curveAddress);

    if (!tokenAddress) {
      try {
        const token = await publicClient.readContract({
          address: log.address as Address,
          abi: config.abis.bondingCurve,
          functionName: "token",
        });
        tokenAddress = token.toLowerCase();
        mapCurveToToken(curveAddress, tokenAddress);
        await enrichTokenFromChain(token);
      } catch {
        continue;
      }
    }

    const decoded = decodeEventLog({
      abi: config.abis.bondingCurve,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName === "Buy") {
      const { buyer, ethIn, tokensOut, newTokensSold } = decoded.args;
      updateTokenState(tokenAddress, { tokensSold: newTokensSold });
      await recordTrade({
        log,
        tokenAddress,
        tradeType: "buy",
        traderAddress: buyer,
        ethAmount: ethIn,
        tokenAmount: tokensOut,
      });
      updateHolderBalance(tokenAddress, buyer, tokensOut);
    } else if (decoded.eventName === "Sell") {
      const { seller, tokensIn, ethOut, newTokensSold } = decoded.args;
      updateTokenState(tokenAddress, { tokensSold: newTokensSold });
      await recordTrade({
        log,
        tokenAddress,
        tradeType: "sell",
        traderAddress: seller,
        ethAmount: ethOut,
        tokenAmount: tokensIn,
      });
      updateHolderBalance(tokenAddress, seller, -tokensIn);
    } else if (decoded.eventName === "Graduated") {
      const { pair, ethLiquidity, tokenLiquidity } = decoded.args;
      markGraduated(tokenAddress, pair, ethLiquidity, tokenLiquidity);
      const price = pairPriceEth(ethLiquidity, tokenLiquidity);
      updateTokenState(tokenAddress, {
        graduated: true,
        pairAddress: pair,
        reserveEth: ethLiquidity,
        reserveToken: tokenLiquidity,
        priceEth: price,
      });
    }
  }
}

async function processSwapLogs(logs: Log[]): Promise<void> {
  for (const log of logs) {
    const pairAddress = log.address!.toLowerCase();
    let tokenAddress = getTokenByPair(pairAddress);

    if (!tokenAddress) {
      try {
        const token = await publicClient.readContract({
          address: log.address as Address,
          abi: config.abis.pumpSwapPair,
          functionName: "token",
        });
        tokenAddress = token.toLowerCase();
        mapPairToToken(pairAddress, tokenAddress);
      } catch {
        continue;
      }
    }

    const decoded = decodeEventLog({
      abi: config.abis.pumpSwapPair,
      data: log.data,
      topics: log.topics,
    });

    if (decoded.eventName === "Swap") {
      const { sender, ethIn, amountIn, amountOut, to } = decoded.args;
      const ethAmount = ethIn ? amountIn : amountOut;
      const tokenAmount = ethIn ? amountOut : amountIn;
      const trader = ethIn ? to : sender;

      await recordTrade({
        log,
        tokenAddress,
        tradeType: "swap",
        traderAddress: trader,
        ethAmount,
        tokenAmount,
      });

      if (ethIn) {
        updateHolderBalance(tokenAddress, to, tokenAmount);
      } else {
        updateHolderBalance(tokenAddress, sender, -amountIn);
      }
    } else if (decoded.eventName === "Sync") {
      const { reserveETH, reserveToken } = decoded.args;
      const price = pairPriceEth(BigInt(reserveETH), BigInt(reserveToken));
      updateTokenState(tokenAddress, {
        reserveEth: BigInt(reserveETH),
        reserveToken: BigInt(reserveToken),
        priceEth: price,
      });
    }
  }
}

async function indexBlockRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
  console.log(`Indexing blocks ${fromBlock} → ${toBlock}`);

  const tokenCreated = await fetchLogsInChunks({
    address: config.contracts.launchpadFactory,
    event: config.abis.launchpadFactory[0] as AbiEvent,
    fromBlock,
    toBlock,
  });
  await processTokenCreatedLogs(tokenCreated);

  const pairCreated = await fetchLogsInChunks({
    address: config.contracts.pumpSwapFactory,
    event: config.abis.pumpSwapFactory[0] as AbiEvent,
    fromBlock,
    toBlock,
  });
  await processPairCreatedLogs(pairCreated);

  const curves = getAllCurveAddresses();
  if (curves.length > 0) {
    const curveLogs = await fetchLogsInChunks({
      address: curves as Address[],
      event: config.abis.bondingCurve[0] as AbiEvent,
      fromBlock,
      toBlock,
    });
    const sellLogs = await fetchLogsInChunks({
      address: curves as Address[],
      event: config.abis.bondingCurve[1] as AbiEvent,
      fromBlock,
      toBlock,
    });
    const gradLogs = await fetchLogsInChunks({
      address: curves as Address[],
      event: config.abis.bondingCurve[2] as AbiEvent,
      fromBlock,
      toBlock,
    });
    const allCurveLogs = [...curveLogs, ...sellLogs, ...gradLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber! - b.blockNumber!);
      }
      return a.logIndex! - b.logIndex!;
    });
    await processCurveLogs(allCurveLogs);
  }

  const pairs = [
    ...new Set([
      ...getAllPairAddresses(),
      config.contracts.platformPair.toLowerCase(),
    ]),
  ];
  if (pairs.length > 0) {
    const swapLogs = await fetchLogsInChunks({
      address: pairs as Address[],
      event: config.abis.pumpSwapPair[0] as AbiEvent,
      fromBlock,
      toBlock,
    });
    const syncLogs = await fetchLogsInChunks({
      address: pairs as Address[],
      event: config.abis.pumpSwapPair[1] as AbiEvent,
      fromBlock,
      toBlock,
    });
    const allPairLogs = [...swapLogs, ...syncLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber! - b.blockNumber!);
      }
      return a.logIndex! - b.logIndex!;
    });
    await processSwapLogs(allPairLogs);
  }

  setLastIndexedBlock(Number(toBlock));
}

async function seedPlatformToken(): Promise<void> {
  const token = config.contracts.platformToken;
  const pair = config.contracts.platformPair;
  const tokenAddr = token.toLowerCase();

  mapPairToToken(pair, token);

  let seeded = await enrichTokenFromChain(token);

  if (!seeded) {
    try {
      const [name, symbol, totalSupply] = await Promise.all([
        publicClient.readContract({
          address: token,
          abi: config.abis.erc20,
          functionName: "name",
        }),
        publicClient.readContract({
          address: token,
          abi: config.abis.erc20,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: token,
          abi: config.abis.erc20,
          functionName: "totalSupply",
        }),
      ]);

      upsertToken({
        address: tokenAddr,
        curveAddress: tokenAddr,
        creator: config.contracts.treasury,
        name,
        symbol,
        totalSupply,
        saleSupply: totalSupply,
      });
      console.log(`Seeded platform token ${symbol} from ERC20 metadata`);
    } catch (err) {
      console.warn("Could not seed platform token from ERC20:", err);
    }
  }

  try {
    const [reserveEth, reserveToken] = await publicClient.readContract({
      address: pair,
      abi: config.abis.pumpSwapPair,
      functionName: "getReserves",
    });
    const price = pairPriceEth(BigInt(reserveEth), BigInt(reserveToken));
    updateTokenState(tokenAddr, {
      graduated: true,
      pairAddress: pair,
      reserveEth: BigInt(reserveEth),
      reserveToken: BigInt(reserveToken),
      priceEth: price,
    });
  } catch (err) {
    console.warn("Could not read platform pair reserves:", err);
  }
}

export async function runIndexer(options: { watch?: boolean; fromBlock?: bigint } = {}): Promise<void> {
  getDb();
  await seedPlatformToken();

  let fromBlock = options.fromBlock ?? BigInt(getLastIndexedBlock() + 1);

  if (fromBlock <= 0n && config.startBlock === 0) {
    try {
      const deployBlock = await findFactoryDeployBlock();
      fromBlock = deployBlock;
      console.log(`Auto-detected factory deploy block: ${deployBlock}`);
    } catch (err) {
      console.warn("Could not auto-detect deploy block, starting from 0:", err);
      fromBlock = 0n;
    }
  } else if (fromBlock < BigInt(config.startBlock)) {
    fromBlock = BigInt(config.startBlock);
  }

  const head = await publicClient.getBlockNumber();

  if (fromBlock <= head) {
    await indexBlockRange(fromBlock, head);
    console.log(`Backfill complete through block ${head}`);
  } else {
    console.log(`Already indexed through block ${head}`);
  }

  if (!options.watch) return;

  console.log("Watching for new blocks...");
  let lastProcessed = head;

  while (true) {
    try {
      const current = await publicClient.getBlockNumber();
      if (current > lastProcessed) {
        await indexBlockRange(lastProcessed + 1n, current);
        lastProcessed = current;
      }
    } catch (err) {
      console.error("Indexer watch error:", err);
    }
    await sleep(3000);
  }
}

export async function findFactoryDeployBlock(): Promise<bigint> {
  const explorerBase =
    process.env.BLOCKSCOUT_API_URL ??
    "https://robinhoodchain.blockscout.com/api/v2";

  try {
    const res = await fetch(
      `${explorerBase}/addresses/${config.contracts.launchpadFactory}`,
    );
    if (res.ok) {
      const data = (await res.json()) as {
        creation_transaction_hash?: string;
      };
      if (data.creation_transaction_hash) {
        const txRes = await fetch(
          `${explorerBase}/transactions/${data.creation_transaction_hash}`,
        );
        if (txRes.ok) {
          const tx = (await txRes.json()) as { block_number?: number };
          if (tx.block_number) {
            return BigInt(tx.block_number);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Blockscout deploy block lookup failed:", err);
  }

  const code = await publicClient.getBytecode({
    address: config.contracts.launchpadFactory,
  });
  if (!code || code === "0x") {
    throw new Error("LaunchpadFactory has no bytecode on this RPC");
  }

  let lo = 0n;
  let hi = await publicClient.getBlockNumber();

  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    try {
      const midCode = await publicClient.getBytecode({
        address: config.contracts.launchpadFactory,
        blockNumber: mid,
      });
      if (midCode && midCode !== "0x") {
        hi = mid;
      } else {
        lo = mid + 1n;
      }
    } catch {
      lo = mid + 1n;
    }
  }

  return lo;
}
