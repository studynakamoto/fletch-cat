"use client";

import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { bondingCurveAbi, erc20Abi, pumpSwapFactoryAbi, pumpSwapPairAbi } from "@/lib/abis";
import { PUMPSWAP_FACTORY } from "@/lib/config";
import { fmtEth, fmtTokens } from "@/lib/format";

const MAX_UINT = (2n ** 256n - 1n) as bigint;

export function TradePanel({
  token,
  curve,
  symbol,
  graduated,
}: {
  token: `0x${string}`;
  curve: `0x${string}`;
  symbol: string;
  graduated: boolean;
}) {
  const { address } = useAccount();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          className={`btn ${side === "buy" ? "bg-pump-green text-black" : "bg-pump-bg text-white/70"}`}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          className={`btn ${side === "sell" ? "bg-pump-red text-white" : "bg-pump-bg text-white/70"}`}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </div>

      {graduated ? (
        <AmmTrade token={token} symbol={symbol} side={side} amount={amount} setAmount={setAmount} owner={address} />
      ) : (
        <CurveTrade token={token} curve={curve} symbol={symbol} side={side} amount={amount} setAmount={setAmount} owner={address} />
      )}
    </div>
  );
}

function AmountInput({
  amount,
  setAmount,
  unit,
}: {
  amount: string;
  setAmount: (v: string) => void;
  unit: string;
}) {
  return (
    <div className="relative mb-3">
      <input
        className="input pr-16"
        placeholder="0.0"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">{unit}</span>
    </div>
  );
}

function parseAmount(a: string): bigint {
  try {
    if (!a || Number(a) <= 0) return 0n;
    return parseEther(a);
  } catch {
    return 0n;
  }
}

// ---------------------------------------------------------------- curve

function CurveTrade({
  token,
  curve,
  symbol,
  side,
  amount,
  setAmount,
  owner,
}: {
  token: `0x${string}`;
  curve: `0x${string}`;
  symbol: string;
  side: "buy" | "sell";
  amount: string;
  setAmount: (v: string) => void;
  owner?: `0x${string}`;
}) {
  const wei = parseAmount(amount);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining } = useWaitForTransactionReceipt({ hash });

  const { data: buyQuote } = useReadContract({
    address: curve,
    abi: bondingCurveAbi,
    functionName: "getBuyQuote",
    args: [wei],
    query: { enabled: side === "buy" && wei > 0n },
  });

  const { data: sellQuote } = useReadContract({
    address: curve,
    abi: bondingCurveAbi,
    functionName: "getSellQuote",
    args: [wei],
    query: { enabled: side === "sell" && wei > 0n },
  });

  const { data: allowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, curve] : undefined,
    query: { enabled: !!owner && side === "sell" },
  });

  const needsApproval = side === "sell" && wei > 0n && ((allowance as bigint) ?? 0n) < wei;

  function act() {
    if (!owner) return;
    if (side === "buy") {
      writeContract({
        address: curve,
        abi: bondingCurveAbi,
        functionName: "buy",
        args: [0n, owner],
        value: wei,
      });
    } else if (needsApproval) {
      writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [curve, MAX_UINT],
      });
    } else {
      writeContract({
        address: curve,
        abi: bondingCurveAbi,
        functionName: "sell",
        args: [wei, 0n, owner],
      });
    }
  }

  const out =
    side === "buy"
      ? buyQuote
        ? `${fmtTokens((buyQuote as [bigint, bigint])[0])} ${symbol}`
        : "—"
      : sellQuote
        ? `${fmtEth(sellQuote as bigint)} ETH`
        : "—";

  return (
    <>
      <AmountInput amount={amount} setAmount={setAmount} unit={side === "buy" ? "ETH" : symbol} />
      <div className="text-sm text-white/60 mb-3">
        You receive ≈ <span className="text-white">{out}</span>
      </div>
      {error && <p className="text-pump-red text-xs mb-2 break-words">{error.message}</p>}
      <button
        className={side === "buy" ? "btn-green w-full" : "btn-red w-full"}
        disabled={!owner || wei === 0n || isPending || mining}
        onClick={act}
      >
        {!owner
          ? "Connect wallet"
          : isPending || mining
            ? "Confirming…"
            : side === "buy"
              ? `Buy ${symbol}`
              : needsApproval
                ? `Approve ${symbol}`
                : `Sell ${symbol}`}
      </button>
    </>
  );
}

// ---------------------------------------------------------------- AMM

function AmmTrade({
  token,
  symbol,
  side,
  amount,
  setAmount,
  owner,
}: {
  token: `0x${string}`;
  symbol: string;
  side: "buy" | "sell";
  amount: string;
  setAmount: (v: string) => void;
  owner?: `0x${string}`;
}) {
  const wei = parseAmount(amount);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: mining } = useWaitForTransactionReceipt({ hash });

  const { data: pair } = useReadContract({
    address: PUMPSWAP_FACTORY,
    abi: pumpSwapFactoryAbi,
    functionName: "getPair",
    args: [token],
  });
  const pairAddr = pair as `0x${string}` | undefined;

  const { data: reserves } = useReadContract({
    address: pairAddr,
    abi: pumpSwapPairAbi,
    functionName: "getReserves",
    query: { enabled: !!pairAddr },
  });

  const { data: allowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner && pairAddr ? [owner, pairAddr] : undefined,
    query: { enabled: !!owner && !!pairAddr && side === "sell" },
  });

  const quote = useMemo(() => {
    if (!reserves || wei === 0n) return 0n;
    const [rEth, rTok] = reserves as [bigint, bigint];
    const feeIn = wei * 997n;
    if (side === "buy") return (feeIn * rTok) / (rEth * 1000n + feeIn);
    return (feeIn * rEth) / (rTok * 1000n + feeIn);
  }, [reserves, wei, side]);

  const needsApproval = side === "sell" && wei > 0n && ((allowance as bigint) ?? 0n) < wei;

  function act() {
    if (!owner || !pairAddr) return;
    if (side === "buy") {
      writeContract({
        address: pairAddr,
        abi: pumpSwapPairAbi,
        functionName: "swapExactETHForTokens",
        args: [0n, owner],
        value: wei,
      });
    } else if (needsApproval) {
      writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [pairAddr, MAX_UINT] });
    } else {
      writeContract({
        address: pairAddr,
        abi: pumpSwapPairAbi,
        functionName: "swapExactTokensForETH",
        args: [wei, 0n, owner],
      });
    }
  }

  return (
    <>
      <div className="text-xs text-pump-accent mb-2">Trading on PumpSwap 🎓</div>
      <AmountInput amount={amount} setAmount={setAmount} unit={side === "buy" ? "ETH" : symbol} />
      <div className="text-sm text-white/60 mb-3">
        You receive ≈{" "}
        <span className="text-white">
          {side === "buy" ? `${fmtTokens(quote)} ${symbol}` : `${fmtEth(quote)} ETH`}
        </span>
      </div>
      {error && <p className="text-pump-red text-xs mb-2 break-words">{error.message}</p>}
      <button
        className={side === "buy" ? "btn-green w-full" : "btn-red w-full"}
        disabled={!owner || wei === 0n || isPending || mining}
        onClick={act}
      >
        {!owner
          ? "Connect wallet"
          : isPending || mining
            ? "Confirming…"
            : side === "buy"
              ? `Buy ${symbol}`
              : needsApproval
                ? `Approve ${symbol}`
                : `Sell ${symbol}`}
      </button>
    </>
  );
}
