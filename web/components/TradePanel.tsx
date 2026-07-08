"use client";

import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  bondingCurveAbi,
  erc20Abi,
  pumpSwapFactoryAbi,
  pumpSwapPairAbi,
  uniswapV2FactoryAbi,
  uniswapV2RouterAbi,
} from "@/lib/abis";
import { DEX_FACTORY, DEX_ROUTER, PUMPSWAP_FACTORY, WETH, hasV2Dex } from "@/lib/config";
import { fmtEth, fmtTokens, isZeroAddress } from "@/lib/format";

const MAX_UINT = (2n ** 256n - 1n) as bigint;

const SLIPPAGE_PRESETS = [0.5, 1, 2];
const DEFAULT_SLIPPAGE = 1;
/** ETH left in wallet for gas when clicking Max on a buy. */
const GAS_BUFFER = parseEther("0.002");

function formatInputAmount(wei: bigint): string {
  if (wei <= 0n) return "";
  const s = formatEther(wei);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function maxBuyEth(balance: bigint): bigint {
  return balance > GAS_BUFFER ? balance - GAS_BUFFER : 0n;
}

/** quote minus slippage tolerance (slippagePct e.g. 1 = 1%) */
function applySlippage(quote: bigint, slippagePct: number): bigint {
  const bps = BigInt(Math.round(slippagePct * 100));
  if (bps >= 10000n) return 0n;
  return (quote * (10000n - bps)) / 10000n;
}

export function TradePanel({
  token,
  curve,
  symbol,
  graduated,
  forceAmm = false,
}: {
  token: `0x${string}`;
  curve: `0x${string}`;
  symbol: string;
  graduated: boolean;
  /** FletchSwap page — always route through the AMM, never the bonding curve. */
  forceAmm?: boolean;
}) {
  const { address } = useAccount();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          className={`btn ${side === "buy" ? "bg-pump-green text-black" : "bg-pump-bg text-white/70"}`}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          className={`btn ${side === "sell" ? "bg-pump-red text-white" : "bg-pump-bg text-white/70"}`}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

      {graduated || forceAmm ? (
        <AmmTrade
          token={token}
          symbol={symbol}
          side={side}
          amount={amount}
          setAmount={setAmount}
          slippage={slippage}
          owner={address}
        />
      ) : (
        <CurveTrade
          token={token}
          curve={curve}
          symbol={symbol}
          side={side}
          amount={amount}
          setAmount={setAmount}
          slippage={slippage}
          owner={address}
        />
      )}

      <SlippageControl slippage={slippage} setSlippage={setSlippage} />
    </div>
  );
}

function SlippageControl({
  slippage,
  setSlippage,
}: {
  slippage: number;
  setSlippage: (v: number) => void;
}) {
  const [custom, setCustom] = useState("");

  function pickCustom(v: string) {
    setCustom(v);
    const n = Number(v);
    if (Number.isFinite(n) && n > 0 && n < 50) setSlippage(n);
  }

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-pump-border/50 text-xs">
      <span className="text-white/50">Slippage</span>
      {SLIPPAGE_PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => {
            setSlippage(p);
            setCustom("");
          }}
          className={`px-2 py-0.5 rounded ${
            slippage === p && custom === ""
              ? "bg-pump-green text-black font-semibold"
              : "bg-pump-bg text-white/60"
          }`}
        >
          {p}%
        </button>
      ))}
      <div className="relative w-16">
        <input
          className="input py-0.5 px-2 text-xs pr-5"
          placeholder="…"
          inputMode="decimal"
          value={custom}
          onChange={(e) => pickCustom(e.target.value)}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40">%</span>
      </div>
    </div>
  );
}

function AmountInput({
  amount,
  setAmount,
  unit,
  onMax,
  maxDisabled,
}: {
  amount: string;
  setAmount: (v: string) => void;
  unit: string;
  onMax?: () => void;
  maxDisabled?: boolean;
}) {
  return (
    <div className="relative mb-3">
      <input
        className={`input ${onMax ? "pr-28" : "pr-16"}`}
        placeholder="0.0"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {onMax && (
          <button
            type="button"
            onClick={onMax}
            disabled={maxDisabled}
            className="text-xs font-semibold text-pump-green hover:text-green-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Max
          </button>
        )}
        <span className="text-white/50 text-sm">{unit}</span>
      </div>
    </div>
  );
}

function parseAmount(a: string): bigint {
  try {
    if (!a || Number(a) <= 0) return 0n;
    return parseEther(a);
  } catch {
    return 0n;
  }
}

// ---------------------------------------------------------------- curve

function CurveTrade({
  token,
  curve,
  symbol,
  side,
  amount,
  setAmount,
  slippage,
  owner,
}: {
  token: `0x${string}`;
  curve: `0x${string}`;
  symbol: string;
  side: "buy" | "sell";
  amount: string;
  setAmount: (v: string) => void;
  slippage: number;
  owner?: `0x${string}`;
}) {
  const wei = parseAmount(amount);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining } = useWaitForTransactionReceipt({ hash });

  const { data: ethBalance } = useBalance({
    address: owner,
    query: { enabled: !!owner },
  });

  const { data: tokenBalance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });

  const { data: buyQuote } = useReadContract({
    address: curve,
    abi: bondingCurveAbi,
    functionName: "getBuyQuote",
    args: [wei],
    query: { enabled: side === "buy" && wei > 0n },
  });

  const { data: sellQuote } = useReadContract({
    address: curve,
    abi: bondingCurveAbi,
    functionName: "getSellQuote",
    args: [wei],
    query: { enabled: side === "sell" && wei > 0n },
  });

  const { data: allowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, curve] : undefined,
    query: { enabled: !!owner && side === "sell" },
  });

  const needsApproval = side === "sell" && wei > 0n && ((allowance as bigint) ?? 0n) < wei;

  const tokensOut = buyQuote ? (buyQuote as [bigint, bigint])[0] : 0n;
  const ethOut = (sellQuote as bigint) ?? 0n;

  function fillMax() {
    if (side === "buy") {
      const bal = ethBalance?.value ?? 0n;
      setAmount(formatInputAmount(maxBuyEth(bal)));
    } else {
      const bal = (tokenBalance as bigint) ?? 0n;
      setAmount(formatInputAmount(bal));
    }
  }

  const maxDisabled =
    side === "buy"
      ? maxBuyEth(ethBalance?.value ?? 0n) === 0n
      : ((tokenBalance as bigint) ?? 0n) === 0n;

  function act() {
    if (!owner || isZeroAddress(curve)) return;
    if (side === "buy") {
      writeContract({
        address: curve,
        abi: bondingCurveAbi,
        functionName: "buy",
        args: [applySlippage(tokensOut, slippage), owner],
        value: wei,
      });
    } else if (needsApproval) {
      writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [curve, MAX_UINT],
      });
    } else {
      writeContract({
        address: curve,
        abi: bondingCurveAbi,
        functionName: "sell",
        args: [wei, applySlippage(ethOut, slippage), owner],
      });
    }
  }

  const out =
    side === "buy"
      ? buyQuote
        ? `${fmtTokens(tokensOut)} ${symbol}`
        : "—"
      : sellQuote
        ? `${fmtEth(ethOut)} ETH`
        : "—";

  const minOut =
    side === "buy"
      ? buyQuote
        ? `${fmtTokens(applySlippage(tokensOut, slippage))} ${symbol}`
        : null
      : sellQuote
        ? `${fmtEth(applySlippage(ethOut, slippage))} ETH`
        : null;

  return (
    <>
      <AmountInput
        amount={amount}
        setAmount={setAmount}
        unit={side === "buy" ? "ETH" : symbol}
        onMax={owner ? fillMax : undefined}
        maxDisabled={maxDisabled}
      />
      <div className="text-sm text-white/60 mb-1">
        You receive ≈ <span className="text-white">{out}</span>
      </div>
      {minOut && (
        <div className="text-xs text-white/40 mb-3">
          Min after {slippage}% slippage: {minOut}
        </div>
      )}
      {error && <p className="text-pump-red text-xs mb-2 break-words">{error.message}</p>}
      <button
        className={side === "buy" ? "btn-green w-full" : "btn-red w-full"}
        disabled={!owner || wei === 0n || isZeroAddress(curve) || isPending || mining}
        onClick={act}
      >
        {!owner
          ? "Connect wallet"
          : isZeroAddress(curve)
            ? "Invalid curve"
            : isPending || mining
            ? "Confirming…"
            : side === "buy"
              ? `Buy ${symbol}`
              : needsApproval
                ? `Approve ${symbol}`
                : `Sell ${symbol}`}
      </button>
    </>
  );
}

// ---------------------------------------------------------------- AMM

function AmmTrade({
  token,
  symbol,
  side,
  amount,
  setAmount,
  slippage,
  owner,
}: {
  token: `0x${string}`;
  symbol: string;
  side: "buy" | "sell";
  amount: string;
  setAmount: (v: string) => void;
  slippage: number;
  owner?: `0x${string}`;
}) {
  const wei = parseAmount(amount);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining } = useWaitForTransactionReceipt({ hash });

  const { data: ethBalance } = useBalance({
    address: owner,
    query: { enabled: !!owner },
  });

  const { data: tokenBalance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });

  // Preferred venue: a standard Uniswap v2 WETH/token pool (DEXScreener-visible).
  const { data: v2Pair } = useReadContract({
    address: DEX_FACTORY,
    abi: uniswapV2FactoryAbi,
    functionName: "getPair",
    args: [token, WETH],
    query: { enabled: hasV2Dex },
  });
  const useV2 = hasV2Dex && !isZeroAddress(v2Pair as string | undefined);

  // Fallback venue: legacy PumpSwap ETH pair.
  const { data: pair } = useReadContract({
    address: PUMPSWAP_FACTORY,
    abi: pumpSwapFactoryAbi,
    functionName: "getPair",
    args: [token],
    query: { enabled: !isZeroAddress(PUMPSWAP_FACTORY) },
  });
  const pairAddr = !isZeroAddress(pair as string | undefined) ? (pair as `0x${string}`) : undefined;
  const hasVenue = useV2 || !!pairAddr;

  const { data: reserves } = useReadContract({
    address: pairAddr,
    abi: pumpSwapPairAbi,
    functionName: "getReserves",
    query: { enabled: !useV2 && !!pairAddr, refetchInterval: 5000 },
  });

  const path = useMemo<`0x${string}`[]>(
    () => (side === "buy" ? [WETH, token] : [token, WETH]),
    [side, token],
  );

  const { data: v2Amounts } = useReadContract({
    address: DEX_ROUTER,
    abi: uniswapV2RouterAbi,
    functionName: "getAmountsOut",
    args: [wei, path],
    query: { enabled: useV2 && wei > 0n, refetchInterval: 5000 },
  });

  const spender = useV2 ? DEX_ROUTER : pairAddr;
  const { data: allowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender && side === "sell" },
  });

  const quote = useMemo(() => {
    if (wei === 0n) return 0n;
    if (useV2) {
      const amounts = v2Amounts as bigint[] | undefined;
      return amounts ? amounts[amounts.length - 1] : 0n;
    }
    if (!reserves) return 0n;
    const [rEth, rTok] = reserves as [bigint, bigint];
    const feeIn = wei * 997n;
    if (side === "buy") return (feeIn * rTok) / (rEth * 1000n + feeIn);
    return (feeIn * rEth) / (rTok * 1000n + feeIn);
  }, [reserves, v2Amounts, useV2, wei, side]);

  const needsApproval = side === "sell" && wei > 0n && ((allowance as bigint) ?? 0n) < wei;

  function fillMax() {
    if (side === "buy") {
      const bal = ethBalance?.value ?? 0n;
      setAmount(formatInputAmount(maxBuyEth(bal)));
    } else {
      const bal = (tokenBalance as bigint) ?? 0n;
      setAmount(formatInputAmount(bal));
    }
  }

  const maxDisabled =
    side === "buy"
      ? maxBuyEth(ethBalance?.value ?? 0n) === 0n
      : ((tokenBalance as bigint) ?? 0n) === 0n;

  function act() {
    if (!owner || !hasVenue) return;
    const amountOutMin = applySlippage(quote, slippage);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const spender = useV2 ? DEX_ROUTER : pairAddr;
    if (!spender || isZeroAddress(spender)) return;
    if (needsApproval) {
      writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, MAX_UINT] });
      return;
    }
    if (useV2) {
      if (side === "buy") {
        writeContract({
          address: DEX_ROUTER,
          abi: uniswapV2RouterAbi,
          functionName: "swapExactETHForTokens",
          args: [amountOutMin, path, owner, deadline],
          value: wei,
        });
      } else {
        writeContract({
          address: DEX_ROUTER,
          abi: uniswapV2RouterAbi,
          functionName: "swapExactTokensForETH",
          args: [wei, amountOutMin, path, owner, deadline],
        });
      }
      return;
    }
    if (!pairAddr) return;
    if (side === "buy") {
      writeContract({
        address: pairAddr,
        abi: pumpSwapPairAbi,
        functionName: "swapExactETHForTokens",
        args: [amountOutMin, owner],
        value: wei,
      });
    } else {
      writeContract({
        address: pairAddr,
        abi: pumpSwapPairAbi,
        functionName: "swapExactTokensForETH",
        args: [wei, amountOutMin, owner],
      });
    }
  }

  return (
    <>
      <div className="text-xs text-pump-accent mb-2">
        {useV2 ? "Trading on Uniswap v2 (FletchSwap route) 🎓" : "Trading on FletchSwap 🎓"}
      </div>
      <AmountInput
        amount={amount}
        setAmount={setAmount}
        unit={side === "buy" ? "ETH" : symbol}
        onMax={owner ? fillMax : undefined}
        maxDisabled={maxDisabled}
      />
      <div className="text-sm text-white/60 mb-1">
        You receive ≈{" "}
        <span className="text-white">
          {side === "buy" ? `${fmtTokens(quote)} ${symbol}` : `${fmtEth(quote)} ETH`}
        </span>
      </div>
      {quote > 0n && (
        <div className="text-xs text-white/40 mb-3">
          Min after {slippage}% slippage:{" "}
          {side === "buy"
            ? `${fmtTokens(applySlippage(quote, slippage))} ${symbol}`
            : `${fmtEth(applySlippage(quote, slippage))} ETH`}
        </div>
      )}
      {!hasVenue && (
        <p className="text-pump-red text-xs mb-2">
          No liquidity pool found for this token. It may not have graduated yet.
        </p>
      )}
      {error && <p className="text-pump-red text-xs mb-2 break-words">{error.message}</p>}
      <button
        className={side === "buy" ? "btn-green w-full" : "btn-red w-full"}
        disabled={!owner || wei === 0n || !hasVenue || isPending || mining}
        onClick={act}
      >
        {!owner
          ? "Connect wallet"
          : !hasVenue
            ? "No pool available"
          : isPending || mining
            ? "Confirming…"
            : side === "buy"
              ? `Buy ${symbol}`
              : needsApproval
                ? `Approve ${symbol}`
                : `Sell ${symbol}`}
      </button>
    </>
  );
}
