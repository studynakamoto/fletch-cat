"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useApiTrades, fmtUsd, type ApiTrade } from "@/lib/api";
import { activeChain } from "@/lib/config";
import { fmtNum, shortAddr } from "@/lib/format";

type ActivityFilter = "all" | "mine" | "dev";

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const BUY_TYPES = new Set(["buy", "swap_buy"]);

function tradeLabel(type: string): string {
  if (BUY_TYPES.has(type)) return "Buy";
  if (type === "sell" || type === "swap_sell") return "Sell";
  return "Swap";
}

function isBuy(type: string): boolean {
  return BUY_TYPES.has(type);
}

function isDevTrade(trader: string, creator: string): boolean {
  return trader.toLowerCase() === creator.toLowerCase();
}

function isMineTrade(trader: string, wallet?: string): boolean {
  return !!wallet && trader.toLowerCase() === wallet.toLowerCase();
}

function matchesFilter(
  trade: ApiTrade,
  filter: ActivityFilter,
  wallet: string | undefined,
  creator: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return isMineTrade(trade.trader, wallet);
  if (filter === "dev") return isDevTrade(trade.trader, creator);
  return true;
}

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "dev", label: "Dev" },
];

export function TradeHistory({
  token,
  symbol,
  creator,
}: {
  token: `0x${string}`;
  symbol: string;
  creator: `0x${string}`;
}) {
  const { address } = useAccount();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const { data, isLoading } = useApiTrades(token, 100);
  const trades = data?.trades ?? [];
  const explorer = activeChain.blockExplorers?.default.url;

  const filtered = useMemo(
    () => trades.filter((t) => matchesFilter(t, filter, address, creator)),
    [trades, filter, address, creator],
  );

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-sm font-semibold">Activity</div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                filter === f.id
                  ? "bg-pump-green text-black"
                  : "bg-pump-bg text-white/60 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filter === "mine" && !address && (
        <p className="text-white/40 text-sm mb-3">Connect your wallet to see your trades.</p>
      )}

      {isLoading ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40 text-sm">
          {filter === "all"
            ? "No trades indexed yet."
            : filter === "mine"
              ? "You haven't traded this token yet."
              : "No dev trades yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs text-left">
                <th className="pb-2 font-normal">Time</th>
                <th className="pb-2 font-normal">Type</th>
                <th className="pb-2 font-normal text-right">ETH</th>
                <th className="pb-2 font-normal text-right">{symbol}</th>
                <th className="pb-2 font-normal text-right hidden sm:table-cell">Price</th>
                <th className="pb-2 font-normal text-right">Trader</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const buy = isBuy(t.type);
                const sell = t.type === "sell" || t.type === "swap_sell";
                const dev = isDevTrade(t.trader, creator);
                const mine = isMineTrade(t.trader, address);
                return (
                  <tr
                    key={t.id}
                    className={`border-t border-pump-border/50 ${
                      dev ? "bg-amber-500/10" : mine ? "bg-pump-green/5" : ""
                    }`}
                  >
                    <td className="py-1.5 text-white/50 whitespace-nowrap">
                      {explorer ? (
                        <a
                          className="hover:text-white"
                          href={`${explorer}/tx/${t.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {timeAgo(t.timestamp)}
                        </a>
                      ) : (
                        timeAgo(t.timestamp)
                      )}
                    </td>
                    <td
                      className={`py-1.5 font-semibold ${
                        buy ? "text-pump-green" : sell ? "text-pump-red" : "text-white/60"
                      }`}
                    >
                      {tradeLabel(t.type)}
                    </td>
                    <td className="py-1.5 text-right">{fmtNum(t.ethAmount, 4)}</td>
                    <td className="py-1.5 text-right">{fmtNum(t.tokenAmount, 0)}</td>
                    <td className="py-1.5 text-right text-white/60 hidden sm:table-cell">
                      {fmtUsd(t.priceUsd)}
                    </td>
                    <td className="py-1.5 text-right">
                      <span className={dev ? "text-amber-400 font-semibold" : "text-white/50"}>
                        {shortAddr(t.trader)}
                      </span>
                      {dev && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded">
                          Dev
                        </span>
                      )}
                      {mine && !dev && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-pump-green bg-pump-green/15 px-1.5 py-0.5 rounded">
                          You
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
