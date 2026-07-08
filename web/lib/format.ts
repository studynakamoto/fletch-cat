import { formatEther, isAddress, zeroAddress } from "viem";

export function fmtEth(wei: bigint, dp = 4): string {
  const n = Number(formatEther(wei));
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function fmtNum(n: number, dp = 2): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function fmtTokens(wei: bigint): string {
  const n = Number(formatEther(wei));
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function shortAddr(addr?: string): string {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function isImageSrc(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/");
}

export function isZeroAddress(addr?: string | null): boolean {
  if (!addr) return true;
  if (!isAddress(addr)) return true;
  return addr.toLowerCase() === zeroAddress.toLowerCase();
}
