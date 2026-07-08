"use client";

import { useApiTrades, fmtUsd } from "@/lib/api";
import { activeChain } from "@/lib/config";
import { fmtNum, shortAddr } from "@/lib/format";

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const BUY_TYPES = new Set(["buy", "swap_buy"]);

export function TradeHistory({ token, symbol }: { token: `0x${string}`; symbol: string }) {
  const { data, isLoading } = useApiTrades(token, 50);
  const trades = data?.trades ?? [];
  const explorer = activeChain.blockExplorers?.default.url;

  return (
    <div className="card p-4">
      <div className="text-sm text-white/60 mb-3">Recent trades</div>
      {isLoading ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : trades.length === 0 ? (
        <p className="text-white/40 text-sm">No trades indexed yet.</p>
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
              {trades.map((t) => {
                const isBuy = BUY_TYPES.has(t.type);
                return (
                  <tr key={t.id} className="border-t border-pump-border/50">
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
                    <td className={`py-1.5 font-semibold ${isBuy ? "text-pump-green" : "text-pump-red"}`}>
                      {isBuy ? "Buy" : "Sell"}
                    </td>
                    <td className="py-1.5 text-right">{fmtNum(t.ethAmount, 4)}</td>
                    <td className="py-1.5 text-right">{fmtNum(t.tokenAmount, 0)}</td>
                    <td className="py-1.5 text-right text-white/60 hidden sm:table-cell">
                      {fmtUsd(t.priceUsd)}
                    </td>
                    <td className="py-1.5 text-right text-white/50">{shortAddr(t.trader)}</td>
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
