# Overnight hardening report — fletch.cat

**Date:** July 12, 2026  
**Repo:** [studynakamoto/fletch-cat](https://github.com/studynakamoto/fletch-cat)  
**Branch:** `main`

---

## Summary

Overnight work focused on **fee model v2 contracts** (built + tested, **not mainnet deployed**),
**factory documentation**, **coordination guide for DragonmasterETH**, and deploy runbook updates.
All contract tests pass. No secrets committed. **No mainnet deploys** were run (wallet migration in progress).

---

## Completed

### P0 — Documentation

| Item | Status | Link |
|------|--------|------|
| Factory reference (all factories, addresses, diagrams, frontend cheat sheet) | ✅ Complete | [docs/FACTORIES.md](./FACTORIES.md) |
| Overnight report | ✅ This file | [docs/OVERNIGHT_REPORT.md](./OVERNIGHT_REPORT.md) |

### P1 — Fee model v2 (contracts only)

| Feature | Implementation |
|---------|----------------|
| 2% platform token skim on `createToken` | `LaunchpadFactoryV2.platformTokenBps = 200` → treasury |
| Decaying graduation fee (5% → 1%) | `currentGraduationFeeBps()`, `-50 bps` per graduation |
| Fee ETH split (70% LP / 30% treasury) | `BondingCurveV2.feeToLpBps = 7000` |
| Graduation venue | Uniswap v2 Router02 (DEXScreener-visible) |
| Deploy script | `contracts/scripts/deployV2.ts` |
| Tests | **25/25 passing** |

**Files changed:**

- `contracts/src/v2/LaunchpadFactoryV2.sol`
- `contracts/src/v2/BondingCurveV2.sol`
- `contracts/src/v2/ILaunchpadFactoryV2.sol` (new)
- `contracts/test/launchpadV2.test.ts`
- `contracts/scripts/deployV2.ts`

### P2 — Coordination

| Item | Status |
|------|--------|
| DragonmasterETH merge guide, env vars, API endpoints | ✅ [COORDINATION.md](../COORDINATION.md) |
| v1 mainnet addresses preserved in docs | ✅ |

### P3 — Backend

| Item | Status |
|------|--------|
| `npm run build` in `backend/` | ✅ Passes |
| Railway/Render notes in DEPLOY.md | ✅ Added |
| `NEXT_PUBLIC_API_URL` documented | ✅ DEPLOY.md, COORDINATION.md, FACTORIES.md |

### P4 — Frontend

| Item | Status |
|------|--------|
| `web/lib/api.ts` optional backend fetch + on-chain fallback | ✅ Already in repo (additive, non-breaking) |

### P6 — Tokenomics

| Item | Status |
|------|--------|
| v2 fee model documented | ✅ [TOKENOMICS.md](../TOKENOMICS.md) v0.2 |

---

## Test results

```text
cd contracts && npm run build && npm test
→ 25 passing (includes 6 LaunchpadV2 fee model tests)

cd backend && npm run build
→ tsc OK
```

---

## Ready for AM deploy (no user keys required)

| Component | Ready? | Notes |
|-----------|--------|-------|
| v1 site (existing factories) | ✅ | Addresses unchanged; fletch.cat can keep current env |
| Backend indexer | ✅ build | Needs hosting + env vars (Railway/Render) |
| Reference `web/` app | ✅ | Optional `NEXT_PUBLIC_API_URL` |
| Docs for DragonmasterETH | ✅ | COORDINATION.md + FACTORIES.md |

---

## Needs user action

| # | Action | Who |
|---|--------|-----|
| 1 | **Wallet migration** — move funds off deployer `0x9da9…` to new wallet | User |
| 2 | **Mainnet deploy v2** — `ROUTER_ADDRESS=0x89e5… npm run deploy:v2:mainnet` after new key funded | User |
| 3 | **WalletConnect project ID** → `NEXT_PUBLIC_WALLETCONNECT_ID` on Vercel | User / DragonmasterETH |
| 4 | **Vercel env** — confirm fletch.cat has v1 addresses (see COORDINATION.md) | DragonmasterETH |
| 5 | **Backend host** — deploy `backend/`, set `NEXT_PUBLIC_API_URL` | User or DragonmasterETH |
| 6 | **Treasury multisig** — migrate fee recipient from EOA | User + pepedrt |

**Explicitly NOT done:** mainnet contract deploys, private keys in git, force-push.

---

## Blockers / notes

- Shell on Windows/PowerShell: use `;` instead of `&&` between commands.
- SQLite on some hosts may need persistent disk (documented in DEPLOY.md).
- v1 and v2 launchpads can coexist; production should stay on v1 until v2 is deployed and env updated.

---

## New / updated docs

- [docs/FACTORIES.md](./FACTORIES.md) — factory reference + v2 section
- [COORDINATION.md](../COORDINATION.md) — DragonmasterETH integration
- [DEPLOY.md](../DEPLOY.md) — backend hosting (Railway/Render)
- [TOKENOMICS.md](../TOKENOMICS.md) — v2 fee model (v0.2)

---

## Git

Commits pushed to `origin/main` on `studynakamoto/fletch-cat` after secret scan on staged files.
