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

1. **Deploy our Uniswap v2 clone** (`contracts/src/dex`) to mainnet — it emits
   **standard Uniswap v2 events** (`PairCreated`, `Mint`, `Burn`, `Swap`,
   `Sync`), which makes every FletchSwap v2 pool auto-indexable the moment
   DEXScreener maps our factory. Command (needs funded deploy key + gas):

   ```bash
   cd contracts
   WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 npm run deploy:dex:mainnet
   ```

2. **Verify the contracts on Blockscout** (free, no API key) — "open-sourced"
   should be true on-chain, not just on GitHub.

3. **Point graduations / new liquidity at the v2 clone** so volume concentrates
   in indexable pools (also fixes the split-liquidity issue in TOKENOMICS §3.3).

4. **Build real volume.** This is the gating factor — a few hundred dollars of
   liquidity won't clear their bar. Grow launches + trading first, then apply.

5. **Apply in their Discord** (template below).

6. Optional, immediate: **enhance the FLETCH token profile** (logo, socials,
   description) on the existing chart via DEXScreener's paid Token Info /
   marketplace — that's per-token and independent of DEX listing.

## Paste-ready application (Discord → listing request)

> **DEX listing request — FletchSwap (Robinhood Chain)**
>
> - **Chain:** Robinhood Chain (chainId 4663 — already supported as `robinhood`)
> - **DEX:** FletchSwap — Uniswap v2-compatible AMM (factory + router fork,
>   standard v2 events)
> - **Factory:** `<address after dex deploy>`
> - **Router:** `<address after dex deploy>`
> - **Launchpad:** FletchPad (pump.fun-style bonding curves that graduate into
>   FletchSwap pools with burned LP) — we'd love launchpad attribution like
>   pumpfun/moonshot get on Solana
> - **Website:** https://fletch.cat
> - **Source (public):** https://github.com/studynakamoto/fletch-cat
> - **Contracts verified on Blockscout:** yes (robinhoodchain.blockscout.com)
> - **Flagship pair already charting on your platform:**
>   https://dexscreener.com/robinhood/0x616936b685b5fca6fafb7c795ab97b8edad38ee5
> - **Contact:** max@soul.bond / @<telegram>

## Reality check

DEXScreener explicitly deprioritizes low-liquidity DEXes. Expect the
application to succeed only after FletchPad launches are generating real
daily volume in v2-clone pools. Until then, everything that graduates to the
**Uniswap** pools on Robinhood Chain charts automatically — that's the
zero-effort visibility path in the meantime.
