import { useQuery } from "@tanstack/react-query";

// Base URL of the backend indexer (Fastify, see ../backend). Optional —
// the app works without it, it just loses charts/trades/USD stats.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const hasApi = API_URL.length > 0;

export interface ApiTokenListItem {
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

export interface ApiTokenDetail extends ApiTokenListItem {
  curveAddress: string;
  pairAddress: string | null;
  creator: string;
  description: string;
  twitter: string;
  telegram: string;
  website: string;
  reserveEth: number;
  reserveToken: number;
  holdersCount: number;
}

export interface ApiTrade {
  id: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: string; // "buy" | "sell" | "swap_buy" | "swap_sell"
  trader: string;
  ethAmount: number;
  tokenAmount: number;
  priceEth: number;
  priceUsd: number;
}

export interface ApiCandle {
  time: number; // unix seconds (bucket open)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleInterval = "1m" | "5m" | "1h";

async function getJson<T>(path: string): Promise<T | null> {
  if (!hasApi) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // indexer offline — degrade gracefully, on-chain reads still work
    return null;
  }
}

export function useApiTokens(sort: "new" | "volume" | "mcap" = "new") {
  return useQuery({
    queryKey: ["api-tokens", sort],
    queryFn: () =>
      getJson<{ tokens: ApiTokenListItem[] }>(`/tokens?sort=${sort}&limit=200`),
    enabled: hasApi,
    refetchInterval: 10_000,
  });
}

export function useApiToken(address?: string) {
  return useQuery({
    queryKey: ["api-token", address?.toLowerCase()],
    queryFn: () => getJson<ApiTokenDetail>(`/tokens/${address}`),
    enabled: hasApi && !!address,
    refetchInterval: 10_000,
  });
}

export function useApiCandles(address?: string, interval: CandleInterval = "5m") {
  return useQuery({
    queryKey: ["api-candles", address?.toLowerCase(), interval],
    queryFn: () =>
      getJson<{ candles: ApiCandle[] }>(
        `/tokens/${address}/candles?interval=${interval}&limit=500`,
      ),
    enabled: hasApi && !!address,
    refetchInterval: 10_000,
  });
}

export function useApiTrades(address?: string, limit = 50) {
  return useQuery({
    queryKey: ["api-trades", address?.toLowerCase(), limit],
    queryFn: () => getJson<{ trades: ApiTrade[] }>(`/tokens/${address}/trades?limit=${limit}`),
    enabled: hasApi && !!address,
    refetchInterval: 8_000,
  });
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n < 0.01) return `$${n.toPrecision(2)}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
