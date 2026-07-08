import { PLATFORM_TOKEN, activeChain } from "@/lib/config";

const REPO = "https://github.com/studynakamoto/fletch-cat";

export function Footer() {
  const explorer = activeChain.blockExplorers?.default.url;
  return (
    <footer className="border-t border-pump-border mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-white/40">
        <span>
          fletch<span className="text-pump-green">.cat</span> — FletchPad + FletchSwap on Robinhood
          Chain
        </span>
        <nav className="flex flex-wrap gap-4">
          <a className="hover:text-white" href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            className="hover:text-white"
            href={`${REPO}/blob/main/CONTRACTS.md`}
            target="_blank"
            rel="noreferrer"
          >
            How it works
          </a>
          <a
            className="hover:text-white"
            href={`${REPO}/blob/main/TOKENOMICS.md`}
            target="_blank"
            rel="noreferrer"
          >
            Tokenomics
          </a>
          {explorer && (
            <a
              className="hover:text-white"
              href={`${explorer}/address/${PLATFORM_TOKEN}`}
              target="_blank"
              rel="noreferrer"
            >
              $FLETCH contract
            </a>
          )}
          <a
            className="hover:text-white"
            href="https://dexscreener.com/robinhood/0x616936b685b5fca6fafb7c795ab97b8edad38ee5"
            target="_blank"
            rel="noreferrer"
          >
            DEXScreener
          </a>
        </nav>
      </div>
    </footer>
  );
}
