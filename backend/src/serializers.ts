import type { TokenRow } from "./db.js";
import { config } from "./config.js";
import { curveProgress, ethToUsd, marketCapEth, weiToEth } from "./utils.js";
import { getVolume24h } from "./db.js";

export interface TokenListItem {
  address: string;
  name: string;
  symbol: string;
  image: string;
  priceEth: number;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number;
  volume24hEth: number;
  volume24hUsd: number;
  graduated: boolean;
  curveProgress: number;
  createdAt: number;
}

export interface TokenDetail extends TokenListItem {
  curveAddress: string;
  pairAddress: string | null;
  creator: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  reserveEth: number;
  reserveToken: number;
  tokensSold: string;
  saleSupply: string;
  totalSupply: string;
  holdersCount: number;
}

export function serializeTokenListItem(row: TokenRow): TokenListItem {
  const priceEthWei = BigInt(row.price_eth || "0");
  const totalSupply = BigInt(row.total_supply || "0");
  const priceEth = weiToEth(priceEthWei);
  const priceUsd = ethToUsd(priceEth, config.ethUsd);
  const mcapEth = weiToEth(marketCapEth(priceEthWei, totalSupply));
  const mcapUsd = ethToUsd(mcapEth, config.ethUsd);
  const vol24 = getVolume24h(row.address);

  return {
    address: row.address,
    name: row.name,
    symbol: row.symbol,
    image: row.image,
    priceEth,
    priceUsd,
    marketCapUsd: mcapUsd,
    fdvUsd: mcapUsd,
    volume24hEth: weiToEth(vol24),
    volume24hUsd: ethToUsd(weiToEth(vol24), config.ethUsd),
    graduated: row.graduated === 1,
    curveProgress: curveProgress(
      BigInt(row.tokens_sold || "0"),
      BigInt(row.sale_supply || "1"),
    ),
    createdAt: row.created_at,
  };
}

export function serializeTokenDetail(
  row: TokenRow,
  holdersCount: number,
): TokenDetail {
  return {
    ...serializeTokenListItem(row),
    curveAddress: row.curve_address,
    pairAddress: row.pair_address,
    creator: row.creator,
    description: row.description,
    twitter: row.twitter,
    telegram: row.telegram,
    website: row.website,
    reserveEth: weiToEth(BigInt(row.reserve_eth || "0")),
    reserveToken: weiToEth(BigInt(row.reserve_token || "0")),
    tokensSold: row.tokens_sold,
    saleSupply: row.sale_supply,
    totalSupply: row.total_supply,
    holdersCount,
  };
}

export function serializeTrade(row: {
  id: string;
  tx_hash: string;
  block_number: number;
  timestamp: number;
  trade_type: string;
  trader_address: string;
  eth_amount: string;
  token_amount: string;
  price_eth: string;
}) {
  const priceEth = weiToEth(BigInt(row.price_eth || "0"));
  return {
    id: row.id,
    txHash: row.tx_hash,
    blockNumber: row.block_number,
    timestamp: row.timestamp,
    type: row.trade_type,
    trader: row.trader_address,
    ethAmount: weiToEth(BigInt(row.eth_amount)),
    tokenAmount: weiToEth(BigInt(row.token_amount)),
    priceEth,
    priceUsd: ethToUsd(priceEth, config.ethUsd),
  };
}

export function serializeCandle(row: {
  open_time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume_eth: string;
}) {
  return {
    time: row.open_time,
    open: weiToEth(BigInt(row.open)),
    high: weiToEth(BigInt(row.high)),
    low: weiToEth(BigInt(row.low)),
    close: weiToEth(BigInt(row.close)),
    volume: weiToEth(BigInt(row.volume_eth)),
  };
}
