"use client";

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { launchpadFactoryAbi } from "@/lib/abis";
import { LAUNCHPAD_FACTORY, PLATFORM_TOKEN, hasPlatformToken } from "@/lib/config";
import { TradePanel } from "@/components/TradePanel";
import { hasApi, useApiTokens } from "@/lib/api";
import type { TokenInfo } from "@/components/TokenCard";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export default function SwapPage() {
  const { data } = useReadContract({
    address: LAUNCHPAD_FACTORY,
    abi: launchpadFactoryAbi,
    functionName: "getTokens",
    args: [0n, 100n],
    query: { refetchInterval: 15_000 },
  });
  const { data: apiData } = useApiTokens("volume");

  // Tokens tradeable on FletchSwap: the flagship + graduated launchpad tokens.
  const options = useMemo(() => {
    const graduatedSet = new Set(
      (apiData?.tokens ?? []).filter((t) => t.graduated).map((t) => t.address.toLowerCase()),
    );
    const list: { address: `0x${string}`; label: string }[] = [];
    if (hasPlatformToken) {
      list.push({ address: PLATFORM_TOKEN, label: "Fletch Cat ($FLETCH)" });
    }
    for (const t of (data as TokenInfo[] | undefined) ?? []) {
      if (t.token.toLowerCase() === PLATFORM_TOKEN.toLowerCase()) continue;
      // Only list graduated launchpad tokens (indexer). Without the API, skip them —
      // otherwise buys can target a missing pool and send ETH to address(0).
      if (hasApi && graduatedSet.has(t.token.toLowerCase())) {
        list.push({ address: t.token, label: `${t.name} ($${t.symbol})` });
      }
    }
    return list;
  }, [data, apiData]);

  const [selected, setSelected] = useState<`0x${string}` | "">("");
  const active = selected || options[0]?.address || "";
  const activeLabel = options.find((o) => o.address === active)?.label ?? "";
  const symbol = activeLabel.match(/\$(\w+)/)?.[1] ?? "TOKEN";

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold">
        FletchSwap <span className="text-pump-green">⇄</span>
      </h1>
      <p className="text-white/60 mt-1 mb-6">
        Swap ETH for any graduated token. 0.30% fee to liquidity providers.
      </p>

      {options.length === 0 ? (
        <div className="card p-8 text-center text-white/50">
          No tokens with liquidity yet. Graduate one on{" "}
          <a href="/" className="text-pump-accent">
            FletchPad
          </a>
          !
        </div>
      ) : (
        <>
          <select
            className="input mb-4 w-full"
            value={active}
            onChange={(e) => setSelected(e.target.value as `0x${string}`)}
          >
            {options.map((o) => (
              <option key={o.address} value={o.address}>
                {o.label}
              </option>
            ))}
          </select>

          {active && (
            <TradePanel
              token={active as `0x${string}`}
              curve={ZERO}
              symbol={symbol}
              graduated={true}
              forceAmm
            />
          )}
        </>
      )}
    </div>
  );
}
