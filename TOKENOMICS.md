# Fletch Cat ($FLETCH) — Tokenomics Report

**Version:** 0.1 (draft)  
**Date:** July 2026  
**Chain:** Robinhood Chain mainnet (chainId 4663)  
**Product:** [fletch.cat](https://fletch.cat) — launchpad + AMM infrastructure  

**Contributors (this phase)**  
| Role | Person | Focus |
|------|--------|--------|
| Advisor | **pepedrt** | Tokenomics, launch strategy, narrative |
| Site / product build | **DragonmasterETH** | Frontend, backend integration, fletch.cat |
| Protocol / contracts | Core team | Smart contracts, deploy, LP bootstrap |

This document separates **what is live on-chain today** from **what we should formalize** before public messaging. pepedrt should treat the “Proposed model” section as the working doc to stress-test.

---

## 1. Executive summary

$FLETCH is the **platform token** for fletch.cat: a pump.fun-style fair-launch pad on Robinhood Chain, with bonding curves that graduate into our AMM (PumpSwap) and optional routing via Uniswap (primary DEX on RH Chain).

**Design intent:** **low circulating float, high fully diluted valuation (FDV)** at launch, with **fee-funded buy pressure** as the launchpad scales. The token is not a governance wrapper today — value accrual is meant to come from:

1. **Scarcity of float** (tiny LP vs huge treasury)
2. **ETH fees** from every token that graduates the launchpad
3. **Manual (later: automated) buybacks** of $FLETCH from the market
4. **Brand / distribution** as the default “ape first” asset on the platform

**Honest caveat:** Supply is **centralized in treasury wallets** today. Until allocations are locked, vested, or burned on a public schedule, **FDV is a headline number**, not proof of decentralization. The tokenomics story only works if we **publish a clear allocation + unlock plan** and follow it.

---

## 2. Live on-chain state (as deployed)

### 2.1 $FLETCH token

| Item | Value |
|------|--------|
| Name / symbol | Fletch Cat / **FLETCH** |
| Contract | `0x60977e96F4173A81674F8D4D636d55D43377e1A7` |
| Total supply | **1,000,000,000** (fixed; no mint function) |
| Decimals | 18 |
| Explorer | [Blockscout](https://robinhoodchain.blockscout.com/address/0x60977e96F4173A81674F8D4D636d55D43377e1A7) |

### 2.2 Supply distribution (approximate, mainnet)

| Bucket | Tokens | % of supply | Notes |
|--------|--------|-------------|--------|
| Treasury / deployer wallet | ~**929,000,000** | ~**92.9%** | `0x9da9…1dd6` — holds bulk of supply after LP seeds |
| PumpSwap LP | **1,000,000** | **0.10%** | Pair `0x5635…76Ba` — 0.1 ETH + 1M FLETCH |
| Uniswap v2 LP | **900,000** | **0.09%** | Pair `0x6169…8ee5` — 0.09 ETH + 900K FLETCH |
| **Circulating in pools** | **~1.9M** | **~0.19%** | Only float immediately tradeable without treasury selling |

**Implied price (pool math):** ~1e-7 ETH per FLETCH → **~$0.00018** at $1,800/ETH → **FDV ~$180K** (1B × price).  
Low float + thin pools = **high slippage** and **volatile chart** on small buys.

### 2.3 Infrastructure contracts

| Contract | Address |
|----------|---------|
| LaunchpadFactory | `0x345f727b2C919789C991d96865505BD654d1F8F0` |
| PumpSwapFactory | `0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9` |
| Fee treasury (`FEE_RECIPIENT`) | `0xCFc622Af7E71C78d9e5672F4033C6225A6A36234` |

**Important:** Fee ETH goes to **`0xCFc6…`**, while most **FLETCH supply** sits on **`0x9da9…`**. These should be documented as distinct roles (or consolidated + multisig) before marketing “treasury.”

### 2.4 What is *not* deployed yet

- Our **Uniswap v2 clone** (`contracts/src/dex`) — built & tested, **not on mainnet**
- Launchpad **user tokens** — factory live, **zero** `TokenCreated` events so far
- Automated buyback bot / scheduled burns
- Vesting contracts for team/advisors

---

## 3. Platform economics (how money moves)

### 3.1 Launchpad user tokens (meme coins)

Each launch is a **separate ERC20** with its own bonding curve:

| Parameter | Default | Meaning |
|-----------|---------|---------|
| Total supply | 1B | Minted to curve at create |
| Sale on curve | 800M (80%) | Bought with ETH along curve |
| Migration reserve | 200M (20%) | Seeded into PumpSwap at graduation |
| Graduation fee | **1%** of raised ETH | Sent to `FEE_RECIPIENT` treasury |
| Curve trade fee | **0%** | No per-buy/sell fee on curve (MVP) |
| PumpSwap swap fee | **0.30%** | To LPs after graduation |

**Platform revenue today (v1 live) = graduation fees only** (1% × ETH raised per completed curve).

### 3.1b Fee model v2 (in repo — **not deployed**)

`LaunchpadFactoryV2` implements the next economics (see [docs/FACTORIES.md](./docs/FACTORIES.md)):

| Mechanism | Value |
|-----------|-------|
| Platform token skim | **2%** of every launch → treasury |
| Curve supply | **98%** (784M sold / 196M migration at 1B total) |
| Graduation fee | **5%** at launch → decays **0.5% per graduation** → **1%** floor |
| Fee ETH split | **70%** thickens Uniswap v2 LP · **30%** treasury |

Example (v2, first graduation, 10 ETH raised):

- Total fee: 0.5 ETH (5%)
- Treasury: 0.15 ETH (30% of fee)
- Extra LP depth: 0.35 ETH (70% of fee) — on top of base liquidity

**v1 mainnet unchanged** until explicit v2 deploy after wallet migration.

### 3.2 $FLETCH flywheel (intended)

```
User launches token → curve fills → graduation fee (ETH) → treasury wallet
                                                      ↓
                              manual buyback script buys FLETCH on DEX
                                                      ↓
                                              burn (0xdead) or hold
```

- Buybacks are **manual** (`npm run buyback:mainnet`) from the wallet that holds fee ETH.
- No on-chain enforcement that fees *must* be used for buybacks — **trust + transparency** until automated.

### 3.3 Liquidity strategy (current vs ideal)

| Pool | Purpose | Status |
|------|---------|--------|
| Uniswap v2 ETH/FLETCH | Aggregators, Uniswap app, “real” DEX depth | **Live** — primary for traders |
| PumpSwap ETH/FLETCH | Legacy bootstrap; site can route here | **Live** — same price target; risks arb if ratios diverge |
| PumpSwap v2 (our router) | Own branded DEX, graduation destination | **Not deployed** |

**pepedrt / team decision:** Consolidate liquidity into **one canonical pool** (likely Uniswap on RH Chain) and treat PumpSwap pool as migration-only for *other* tokens, not FLETCH — avoids split liquidity and confused FDV.

---

## 4. Proposed formal allocation ($FLETCH)

*Not yet executed on-chain — for advisor review.*

Starting point: **1,000,000,000 FLETCH** fixed.

| Category | % | Tokens | Vesting / lock | Rationale |
|----------|---|--------|----------------|-----------|
| **Public liquidity** | 0.5–2.0% | 5M–20M | LP tokens locked or burned | Tradeable float; depth scales with ETH paired |
| **Community / airdrop / points** | 5–10% | 50M–100M | Campaign-based unlock | Robinhood Chain natives, early apes, creators |
| **Launchpad incentives** | 5–10% | 50M–100M | Emission schedule TBD | Reward creators, volume, graduation milestones |
| **Advisors** | 1–3% | 10M–30M | **12mo cliff, 24mo vest** | pepedrt + any future advisors |
| **Builders (incl. DragonmasterETH)** | 2–5% | 20M–50M | **6mo cliff, 18mo vest** | Site, backend, ongoing maintenance |
| **Core team** | 10–15% | 100M–150M | **12mo cliff, 36mo vest** | Protocol, ops, treasury management |
| **Treasury / buyback reserve** | 55–75% | 550M–750M | Multisig; buyback policy public | Fees + strategic LP; **not** discretionary dumps |

**Targets this supports:**
- **Float:** 0.5–2% in LP + gradual community unlocks (still “low float” vs typical memecoins)
- **FDV:** Set by LP ratio at seed + buybacks; don’t claim $10M+ FDV on $150 pool depth without disclosure
- **Trust:** Vest team/advisor/builder wallets on-chain (e.g. Sablier, Hedgey, or simple vesting contract)

### 4.1 Advisor: pepedrt

**Suggested scope (to align in writing):**
- Finalize float / FDV launch parameters for next LP add
- Meme narrative, ticker visibility, launch timing
- Review buyback cadence and public reporting (weekly ETH in / FLETCH burned)
- Stress-test “what happens if treasury sells X%” scenarios

**Compensation (pick one or hybrid — decide with pepedrt):**
- **Advisor allocation:** 1–2% of supply, vested 12/24 (recommended for alignment)
- **Cash + token:** Smaller % + paid advisory fee in ETH/USDC
- **Performance:** Bonus tranche tied to launchpad graduation count or fee ETH

*No allocation is minted yet — FLETCH supply is fixed; advisor shares must **transfer from treasury** with vesting.*

### 4.2 Builder: DragonmasterETH

**Scope:** fletch.cat product — frontend, API integration, charts, wallet flows, deploy pipeline.

**Compensation (pick one or hybrid):**
- **Builder allocation:** 2–4% vested 6/18 (if long-term alignment desired)
- **Paid sprint:** Fixed ETH/USDC for MVP site + Vercel/domain; smaller token kicker
- **Ongoing:** Retainer + token for maintenance post-launch

*Repo access: [github.com/studynakamoto/fletch-cat](https://github.com/studynakamoto/fletch-cat) — collaborator invite sent.*

---

## 5. Fee & buyback policy (draft)

Publish this as a simple public policy once agreed:

| Rule | Proposal (v1 live) | v2 (repo, not deployed) |
|------|-------------------|-------------------------|
| **Fee source** | 1% of raised ETH on graduation | 5%→1% decaying; 2% token skim on create |
| **Destination** | 100% treasury | 30% of fee ETH treasury; 70% thickens LP |
| **Buyback** | ≥ **50–80%** of *net* fee ETH used for market buybacks weekly | Same policy on treasury portion |
| **Burn** | Default: send bought FLETCH to `0xdead` (or hold in treasury with disclosure) |
| **Ops reserve** | 20–50% of fees for gas, LP adds, listings, audits |
| **Reporting** | Weekly tweet/dashboard: fees in, FLETCH bought, burned, treasury balance |

**Upgrade path:** Small keeper contract or Gelato job that swaps ETH→FLETCH on Uniswap router when balance > threshold — still **no new minting**.

---

## 6. Launchpad tokenomics (user coins)

Users who launch via fletch.cat get **standard curve economics** (not customizable in MVP):

- 80% sold on curve, 20% to LP at graduation  
- Creator can **dev-buy** in same tx as create  
- No platform token fee on curve trades (could add 0.5–1% later → more ETH to treasury)

**Optional future platform features (revenue + FLETCH utility):**
- Pay **FLETCH** to boost listing on homepage
- Pay **FLETCH** to reduce graduation fee
- **Stake FLETCH** for creator fee rebates (advanced)

*None of these are live — document as roadmap, not current utility.*

---

## 7. Risks & disclosures (must be in public materials)

1. **Centralized supply** — ~93%+ in one wallet until allocated/vested.  
2. **Thin liquidity** — Small buys move price; treasury sale crushes chart.  
3. **Manual buybacks** — Not trustless; policy compliance is social until automated.  
4. **Unaudited contracts** — Launchpad + AMM not professionally audited.  
5. **Dual pools** — PumpSwap + Uniswap FLETCH pools can arb if mispriced.  
6. **No SEC/legal opinion** — Not investment advice; meme/platform token risks.  
7. **Robinhood Chain** — Young L2; bridge/RPC/explorer dependency.

---

## 8. Decisions needed (action list)

| # | Decision | Owner | Urgency |
|---|----------|-------|---------|
| 1 | Final **allocation %** and vesting schedules | Core + **pepedrt** | High |
| 2 | **Multisig** for treasury + fee wallet | Core | High |
| 3 | Canonical **FLETCH pool** (Uniswap only vs both) | pepedrt + core | High |
| 4 | **Next LP add** — how much ETH + tokens at what target FDV | pepedrt | High |
| 5 | DragonmasterETH **comp model** (vest vs paid) | Core | Medium |
| 6 | Public **buyback policy** + first weekly report | Core | Medium |
| 7 | Deploy **PumpSwap v2** + point graduations there | Core / dev | Medium |
| 8 | Vesting contracts + on-chain transfers to advisors/builders | Core | Medium |
| 9 | Optional **curve fee** (e.g. 0.5%) for more ETH revenue | pepedrt | Low |

---

## 9. Recommended narrative (external)

**One-liner:**  
*Fletch Cat is the hood’s launchpad mascot — tiny float, launchpad fees feed the cat.*

**Three bullets:**
- Launch memes on Robinhood Chain with bonding curves that graduate to real liquidity.  
- $FLETCH: most supply treasury-held; float in LP; fees buy back and burn.  
- Built for Robinhood Chain’s Uniswap-native liquidity — fletch.cat is home base.

**Do not claim** until true: “deflationary,” “community-owned,” “fair launch” (treasury concentration contradicts without vesting transparency).

---

## 10. Appendix — math cheat sheet

**FDV (USD)** ≈ `(ETH_in_pool / FLETCH_in_pool) × 1,000,000,000 × ETH_USD`

**Float %** ≈ `FLETCH_in_all_pools / 1,000,000,000`

**Example targets (0.1 ETH in pool, ETH = $1,800):**

| FLETCH in LP | Float | FDV |
|--------------|-------|-----|
| 1,000,000 | 0.10% | ~$180K |
| 144,000 | 0.014% | ~$1.25M |
| 28,800 | 0.003% | ~$6.25M |

---

## 11. Document history

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | Jul 2026 | Initial draft from live mainnet deploy + product plan |
| 0.2 | Jul 2026 | Added fee model v2 spec (contracts in repo, not mainnet) |

**Next review:** With pepedrt — finalize Section 4 allocations and Section 5 buyback policy before site goes fully public.
