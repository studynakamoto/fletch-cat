"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { bondingCurveAbi, erc20Abi, launchpadFactoryAbi } from "@/lib/abis";
import { LAUNCHPAD_FACTORY, activeChain } from "@/lib/config";
import { TradePanel } from "@/components/TradePanel";
import { fmtEth, fmtTokens, shortAddr } from "@/lib/format";
import type { TokenInfo } from "@/components/TokenCard";

function isUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

export default function TokenPage() {
  const params = useParams();
  const token = params.address as `0x${string}`;
  const { address } = useAccount();

  const { data: info } = useReadContract({
    address: LAUNCHPAD_FACTORY,
    abi: launchpadFactoryAbi,
    functionName: "getToken",
    args: [token],
  });

  const t = info as TokenInfo | undefined;
  const curve = t?.curve;

  const { data: stats } = useReadContracts({
    contracts: curve
      ? [
          { address: curve, abi: bondingCurveAbi, functionName: "ethReserve" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationEth" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduated" },
          { address: curve, abi: bondingCurveAbi, functionName: "tokensSold" },
          { address: curve, abi: bondingCurveAbi, functionName: "saleSupply" },
          { address: curve, abi: bondingCurveAbi, functionName: "currentPrice" },
        ]
      : [],
    query: { enabled: !!curve, refetchInterval: 5000 },
  });

  const { data: bal } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  if (!t) {
    return <p className="text-white/50">Loading token…</p>;
  }

  const raised = (stats?.[0]?.result as bigint) ?? 0n;
  const goal = (stats?.[1]?.result as bigint) ?? 1n;
  const graduated = (stats?.[2]?.result as boolean) ?? false;
  const sold = (stats?.[3]?.result as bigint) ?? 0n;
  const saleSupply = (stats?.[4]?.result as bigint) ?? 1n;
  const price = (stats?.[5]?.result as bigint) ?? 0n;
  const pct = graduated ? 100 : Math.min(100, Number((raised * 10000n) / goal) / 100);

  return (
    <div>
      <Link href="/" className="text-white/50 hover:text-white text-sm">← Board</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 flex gap-4">
            <div className="w-20 h-20 rounded-xl bg-pump-bg border border-pump-border flex items-center justify-center text-4xl overflow-hidden shrink-0">
              {isUrl(t.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image} alt={t.symbol} className="w-full h-full object-cover" />
              ) : (
                <span>{t.image || "🪙"}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">
                {t.name} <span className="text-white/50">${t.symbol}</span>
              </h1>
              <p className="text-white/70 mt-1">{t.description}</p>
              <div className="flex gap-3 mt-2 text-sm text-pump-accent">
                {t.twitter && <a href={t.twitter} target="_blank" rel="noreferrer">Twitter</a>}
                {t.telegram && <a href={t.telegram} target="_blank" rel="noreferrer">Telegram</a>}
                {t.website && <a href={t.website} target="_blank" rel="noreferrer">Website</a>}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex justify-between text-sm text-white/60 mb-2">
              <span>{graduated ? "Graduated to PumpSwap 🎓" : "Bonding curve progress"}</span>
              <span>{fmtEth(raised)} / {fmtEth(goal)} ETH</span>
            </div>
            <div className="h-3 bg-pump-bg rounded-full overflow-hidden">
              <div className={`h-full ${graduated ? "bg-pump-accent" : "bg-pump-green"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
              <Stat label="Price" value={`${fmtEth(price, 8)} ETH`} />
              <Stat label="Sold" value={`${fmtTokens(sold)} / ${fmtTokens(saleSupply)}`} />
              <Stat label="Your balance" value={`${fmtTokens((bal as bigint) ?? 0n)} ${t.symbol}`} />
              <Stat label="Status" value={graduated ? "Live on AMM" : "On curve"} />
            </div>
          </div>

          <div className="card p-4 text-xs text-white/50 space-y-1">
            <div>Token: <a className="text-pump-accent" href={`${activeChain.blockExplorers?.default.url}/address/${t.token}`} target="_blank" rel="noreferrer">{shortAddr(t.token)}</a></div>
            <div>Curve: <a className="text-pump-accent" href={`${activeChain.blockExplorers?.default.url}/address/${t.curve}`} target="_blank" rel="noreferrer">{shortAddr(t.curve)}</a></div>
            <div>Creator: {shortAddr(t.creator)}</div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {curve && <TradePanel token={t.token} curve={curve} symbol={t.symbol} graduated={graduated} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-white/50">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
