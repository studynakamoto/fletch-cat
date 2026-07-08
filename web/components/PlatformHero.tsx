"use client";

import { useMemo, useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi, pumpSwapPairAbi } from "@/lib/abis";
import { PLATFORM_PAIR, PLATFORM_TOKEN, TREASURY, activeChain } from "@/lib/config";
import { fmtEth, fmtTokens } from "@/lib/format";
import { Logo } from "@/components/Logo";

function parseAmount(a: string): bigint {
  try {
    if (!a || Number(a) <= 0) return 0n;
    return parseEther(a);
  } catch {
    return 0n;
  }
}

export function PlatformHero() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const wei = parseAmount(amount);

  const { data: meta } = useReadContracts({
    contracts: [
      { address: PLATFORM_TOKEN, abi: erc20Abi, functionName: "symbol" },
      { address: PLATFORM_PAIR, abi: pumpSwapPairAbi, functionName: "getReserves" },
    ],
    query: { refetchInterval: 5000 },
  });

  const { data: treasuryBal } = useBalance({
    address: TREASURY !== "0x0000000000000000000000000000000000000000" ? TREASURY : undefined,
    query: { refetchInterval: 5000 },
  });

  const symbol = (meta?.[0]?.result as string) ?? "FLETCH";
  const reserves = meta?.[1]?.result as [bigint, bigint] | undefined;

  const price = useMemo(() => {
    if (!reserves || reserves[1] === 0n) return 0n;
    return (reserves[0] * 10n ** 18n) / reserves[1];
  }, [reserves]);

  const estOut = useMemo(() => {
    if (!reserves || wei === 0n) return 0n;
    const [rEth, rTok] = reserves;
    const feeIn = wei * 997n;
    return (feeIn * rTok) / (rEth * 1000n + feeIn);
  }, [reserves, wei]);

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining } = useWaitForTransactionReceipt({ hash });

  function buy() {
    if (!address) return;
    writeContract({
      address: PLATFORM_PAIR,
      abi: pumpSwapPairAbi,
      functionName: "swapExactETHForTokens",
      args: [0n, address],
      value: wei,
    });
  }

  return (
    <div className="card p-6 mb-8 bg-gradient-to-br from-pump-card to-[#0e1a14] border-pump-green/40 overflow-hidden relative">
      <div className="absolute -right-8 -top-8 w-48 h-48 opacity-10 pointer-events-none">
        <Logo size={192} className="rounded-full" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 relative">
        <div className="flex gap-4 flex-1">
          <Logo size={80} className="shrink-0 hidden sm:block ring-2 ring-pump-green/30" />
          <div className="flex-1 min-w-0">
            <div className="inline-block text-xs font-semibold text-black bg-pump-green rounded-full px-3 py-1 mb-3">
              FLAGSHIP · APE FIRST
            </div>
            <h2 className="text-3xl font-bold">
              Fletch Cat <span className="text-pump-green">${symbol}</span>
            </h2>
            <p className="text-white/70 mt-2 max-w-xl">
              99.9% treasury-controlled, 0.1% floating in PumpSwap. Launchpad fees accumulate in the
              treasury — used to <span className="text-pump-green font-semibold">buy back &amp; burn</span>{" "}
              ${symbol} on demand.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
              <Metric label="Price" value={`${fmtEth(price, 9)} ETH`} />
              <Metric label="Treasury fees" value={`${fmtEth(treasuryBal?.value ?? 0n)} ETH`} accent />
              <Metric label="LP float" value="0.1%" />
            </div>
            <a
              className="text-xs text-pump-accent mt-3 inline-block"
              href={`${activeChain.blockExplorers?.default.url}/address/${PLATFORM_TOKEN}`}
              target="_blank"
              rel="noreferrer"
            >
              View contract ↗
            </a>
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-pump-bg border border-pump-border rounded-xl p-4">
            <div className="text-sm text-white/60 mb-2">Buy ${symbol} with ETH</div>
            <div className="relative mb-2">
              <input
                className="input pr-14"
                placeholder="0.0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">ETH</span>
            </div>
            <div className="text-xs text-white/60 mb-3">
              ≈ {fmtTokens(estOut)} {symbol}
            </div>
            {error && <p className="text-pump-red text-xs mb-2 break-words">{error.message}</p>}
            <button
              className="btn-green w-full"
              disabled={!address || wei === 0n || isPending || mining}
              onClick={buy}
            >
              {!address ? "Connect wallet" : isPending || mining ? "Aping…" : `Ape ${symbol}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-white/50">{label}</div>
      <div className={`font-bold ${accent ? "text-pump-green" : ""}`}>{value}</div>
    </div>
  );
}
