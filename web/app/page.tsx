"use client";

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { launchpadFactoryAbi } from "@/lib/abis";
import { LAUNCHPAD_FACTORY, hasPlatformToken } from "@/lib/config";
import { TokenCard, type TokenInfo } from "@/components/TokenCard";
import { CreateTokenModal } from "@/components/CreateTokenModal";
import { PlatformHero } from "@/components/PlatformHero";
import { useApiTokens, type ApiTokenListItem } from "@/lib/api";

export default function Home() {
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, refetch } = useReadContract({
    address: LAUNCHPAD_FACTORY,
    abi: launchpadFactoryAbi,
    functionName: "getTokens",
    args: [0n, 100n],
    query: { refetchInterval: 8000 },
  });

  // USD stats from the indexer (optional; board works without it)
  const { data: apiData } = useApiTokens("new");
  const apiStats = useMemo(() => {
    const map = new Map<string, ApiTokenListItem>();
    for (const t of apiData?.tokens ?? []) map.set(t.address.toLowerCase(), t);
    return map;
  }, [apiData]);

  const tokens = (data as TokenInfo[] | undefined) ?? [];
  const configured = LAUNCHPAD_FACTORY !== "0x0000000000000000000000000000000000000000";

  return (
    <div>
      {hasPlatformToken && <PlatformHero />}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            FletchPad <span className="text-white/40 font-normal">— Launch. Pump. Graduate.</span>
          </h1>
          <p className="text-white/60 mt-1">
            Fair-launch tokens on a bonding curve. Steal the pump — graduate to FletchSwap.
          </p>
        </div>
        <button className="btn-green whitespace-nowrap" onClick={() => setShowCreate(true)}>
          + Create token
        </button>
      </div>

      {!configured && (
        <div className="card p-4 mb-6 border-yellow-600/50 text-yellow-300 text-sm">
          No factory address configured. Deploy the contracts and set{" "}
          <code>NEXT_PUBLIC_LAUNCHPAD_FACTORY</code> in <code>web/.env.local</code>.
        </div>
      )}

      {isLoading ? (
        <p className="text-white/50">Loading tokens…</p>
      ) : tokens.length === 0 ? (
        <div className="card p-10 text-center text-white/50">
          No tokens yet. Be the first to launch one!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map((t) => (
            <TokenCard key={t.token} info={t} stats={apiStats.get(t.token.toLowerCase())} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTokenModal
          onClose={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
