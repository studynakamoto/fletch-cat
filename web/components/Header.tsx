"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="border-b border-pump-border sticky top-0 z-10 bg-pump-bg/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={36} />
          <div className="leading-tight">
            <span className="font-bold text-lg block">
              fletch<span className="text-pump-green">.cat</span>
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Robinhood Chain</span>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-white/70 hover:text-white">
            FletchPad
          </Link>
          <Link href="/swap" className="text-white/70 hover:text-white">
            FletchSwap
          </Link>
          <ConnectButton showBalance={false} />
        </nav>
      </div>
    </header>
  );
}
