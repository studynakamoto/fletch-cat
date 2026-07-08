"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { launchpadFactoryAbi } from "@/lib/abis";
import { LAUNCHPAD_FACTORY } from "@/lib/config";

export function CreateTokenModal({ onClose }: { onClose: () => void }) {
  const { isConnected } = useAccount();
  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    image: "",
    twitter: "",
    telegram: "",
    website: "",
    devBuy: "",
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining, isSuccess } = useWaitForTransactionReceipt({ hash });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit() {
    writeContract({
      address: LAUNCHPAD_FACTORY,
      abi: launchpadFactoryAbi,
      functionName: "createToken",
      args: [
        form.name,
        form.symbol,
        form.description,
        form.image,
        form.twitter,
        form.telegram,
        form.website,
      ],
      value: form.devBuy ? parseEther(form.devBuy) : 0n,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Launch a new token</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">✕</button>
        </div>

        {isSuccess ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-semibold">Token launched!</p>
            <button className="btn-green mt-4" onClick={onClose}>Back to board</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              <input className="input" placeholder="Ticker (e.g. DOGE)" value={form.symbol} onChange={(e) => set("symbol", e.target.value)} />
            </div>
            <textarea className="input" placeholder="Description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
            <input className="input" placeholder="Image URL or emoji 🐕" value={form.image} onChange={(e) => set("image", e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Twitter" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
              <input className="input" placeholder="Telegram" value={form.telegram} onChange={(e) => set("telegram", e.target.value)} />
              <input className="input" placeholder="Website" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-white/60">Optional dev buy (ETH)</label>
              <input className="input mt-1" placeholder="0.0" value={form.devBuy} onChange={(e) => set("devBuy", e.target.value)} />
            </div>

            {error && <p className="text-pump-red text-sm break-words">{error.message}</p>}

            <button
              className="btn-green w-full"
              disabled={!isConnected || !form.name || !form.symbol || isPending || mining}
              onClick={submit}
            >
              {!isConnected ? "Connect wallet first" : isPending || mining ? "Launching…" : "Launch token"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
