# DEXScreener — status & listing plan

**Verified July 8, 2026 via the DEXScreener API.**

## Where we stand today

✅ **Robinhood Chain is already supported** on DEXScreener (chainId `robinhood`).

✅ **$FLETCH is already listed and charting** — via the Uniswap v2 ETH/FLETCH
pair:

> https://dexscreener.com/robinhood/0x616936b685b5fca6fafb7c795ab97b8edad38ee5

(At time of writing: ~$0.0003, FDV ~$302K, ~$416 pool liquidity, 14 trades/24h.)

❌ **FletchSwap (our PumpSwap AMM) is NOT indexed.** Our `PumpSwapPair` is a
custom ETH-pair design — its events (`Swap`, `Sync` with ETH/token reserves)
don't match the Uniswap v2 interface DEXScreener auto-indexes, so trades on it
are invisible to aggregators.

❌ **FletchPad launches are invisible until graduation** for the same reason
(bonding-curve trades are custom events).

## How listings actually work (from docs.dexscreener.com)

- DEXScreener **automatically tracks DEXes on supported chains** when they use
  known protocols (Uniswap v2/v3 interfaces).
- New DEX / launchpad listings are requested **through their Discord**:
  https://discord.gg/TZXMbztSG8 (no web form).
- Evaluation criteria (from `docs.dexscreener.com/dex-listing.md`):
  1. Significant liquidity **and daily volume** ("DEXes with low liquidity and
     volume may not be listed at all")
  2. **Open-sourced** and audited smart contracts ✅ repo is public:
     https://github.com/studynakamoto/fletch-cat — ⚠️ audit still missing
  3. Active community and user base

## The plan (in order)

1. ✅ **BUILT: V2 launchpad with DEXScreener-visible graduations**
   (`contracts/src/v2/`). `LaunchpadFactoryV2` curves graduate straight into
   **canonical Uniswap v2 pools** on Robinhood Chain — the exact pool type
   DEXScreener already indexes (the FLETCH pair proves it). Every token that
   graduates charts automatically, zero integration needed. Fully tested
   (`test/launchpadV2.test.ts`, 25/25 suite green). **Deploy (needs user
   go-ahead — gas only):**

   ```bash
   cd contracts
   ROUTER_ADDRESS=0x89e5db8b5aa49aa85ac63f691524311aeb649eba npm run deploy:v2:mainnet
   # then set the printed NEXT_PUBLIC_* vars in Vercel
   ```

2. **(Optional) Deploy our own FletchSwap v2 fork** (`contracts/src/dex`) for a
   branded DEX and pass its router as `ROUTER_ADDRESS` instead — same standard
   events, but DEXScreener must map our factory before pairs chart, which
   needs the Discord application + volume. Recommended sequencing: launch on
   the canonical Uniswap router first (instant charts), migrate to the
   FletchSwap router once listed.

   ```bash
   WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 npm run deploy:dex:mainnet
   ```

3. **Verify the contracts on Blockscout** (free, no API key) — "open-sourced"
   should be true on-chain, not just on GitHub.

4. **Build real volume.** This is the gating factor for a *named launchpad
   listing* — grow launches + trading first, then apply.

5. **Apply in their Discord** (template below) for FletchPad launchpad
   attribution + FletchSwap dexId.

6. Optional, immediate: **enhance the FLETCH token profile** (logo, socials,
   description) on the existing chart via DEXScreener's paid Token Info /
   marketplace — that's per-token and independent of DEX listing.

## Paste-ready application (Discord → listing request)

> **Launchpad + DEX listing request — FletchPad / FletchSwap (Robinhood Chain)**
>
> - **Chain:** Robinhood Chain (chainId 4663 — already supported as `robinhood`)
> - **Launchpad:** FletchPad — pump.fun-style bonding curves, live on mainnet:
>   `LaunchpadFactory 0x345f727b2C919789C991d96865505BD654d1F8F0`
>   (`TokenCreated` / `Buy` / `Sell` / `Graduated` events). Graduations seed
>   liquidity pools with **LP burned to 0xdead**. We'd love launchpad
>   attribution like pumpfun/moonshot get on Solana.
> - **DEX (FletchSwap):** live mainnet AMM factory
>   `0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9` (ETH/token pairs, 0.30% fee);
>   a Uniswap v2-compatible factory+router fork ships next (standard v2
>   events) — addresses will follow in this thread once deployed.
> - **V2 pipeline:** new `LaunchpadFactoryV2` graduates tokens straight into
>   canonical Uniswap v2 pools on RH Chain, so graduated pairs chart on
>   DEXScreener automatically.
> - **Website:** https://fletch.cat
> - **Source (public):** https://github.com/studynakamoto/fletch-cat
> - **Explorer:** robinhoodchain.blockscout.com
> - **Flagship pair already charting on your platform:**
>   https://dexscreener.com/robinhood/0x616936b685b5fca6fafb7c795ab97b8edad38ee5
> - **Contact:** max@soul.bond

## Reality check

DEXScreener explicitly deprioritizes low-liquidity DEXes. Expect the
application to succeed only after FletchPad launches are generating real
daily volume in v2-clone pools. Until then, everything that graduates to the
**Uniswap** pools on Robinhood Chain charts automatically — that's the
zero-effort visibility path in the meantime.
