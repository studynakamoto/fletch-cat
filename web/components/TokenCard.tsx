"use client";

import Link from "next/link";
import { useReadContracts } from "wagmi";
import { bondingCurveAbi } from "@/lib/abis";
import { fmtUsd, type ApiTokenListItem } from "@/lib/api";
import { fmtEth, isImageSrc, shortAddr } from "@/lib/format";

export type TokenInfo = {
  token: `0x${string}`;
  curve: `0x${string}`;
  name: string;
  symbol: string;
  description: string;
  image: string;
  twitter: string;
  telegram: string;
  website: string;
  creator: `0x${string}`;
  createdAt: bigint;
};

export function TokenCard({ info, stats }: { info: TokenInfo; stats?: ApiTokenListItem }) {
  const { data } = useReadContracts({
    contracts: [
      { address: info.curve, abi: bondingCurveAbi, functionName: "ethReserve" },
      { address: info.curve, abi: bondingCurveAbi, functionName: "graduationEth" },
      { address: info.curve, abi: bondingCurveAbi, functionName: "graduated" },
    ],
  });

  const raised = (data?.[0]?.result as bigint) ?? 0n;
  const goal = (data?.[1]?.result as bigint) ?? 1n;
  const graduated = (data?.[2]?.result as boolean) ?? false;
  const pct = graduated ? 100 : Math.min(100, Number((raised * 10000n) / goal) / 100);

  return (
    <Link href={`/token/${info.token}`} className="card p-4 hover:border-pump-accent transition-colors block">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-lg bg-pump-bg border border-pump-border flex items-center justify-center text-2xl overflow-hidden shrink-0">
          {isImageSrc(info.image) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.image} alt={info.symbol} className="w-full h-full object-cover" />
          ) : (
            <span>{info.image || "🪙"}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {info.name} <span className="text-white/50">${info.symbol}</span>
          </div>
          <div className="text-xs text-white/50">by {shortAddr(info.creator)}</div>
          <p className="text-sm text-white/70 line-clamp-2 mt-1">{info.description}</p>
        </div>
      </div>

      {stats && (
        <div className="flex gap-4 mt-3 text-xs text-white/60">
          <span>
            MC <span className="text-white font-semibold">{fmtUsd(stats.marketCapUsd)}</span>
          </span>
          <span>
            24h vol <span className="text-white font-semibold">{fmtUsd(stats.volume24hUsd)}</span>
          </span>
        </div>
      )}

      <div className="mt-3">
        <div className="flex justify-between text-xs text-white/60 mb-1">
          <span>{graduated ? "Graduated 🎓" : "Bonding curve"}</span>
          <span>{fmtEth(raised)} / {fmtEth(goal)} ETH</span>
        </div>
        <div className="h-2 bg-pump-bg rounded-full overflow-hidden">
          <div
            className={`h-full ${graduated ? "bg-pump-accent" : "bg-pump-green"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
