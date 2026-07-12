# Coordination — fletch.cat production site & protocol repo

How **DragonmasterETH** (production site at [fletch.cat](https://fletch.cat)) and this
repo ([studynakamoto/fletch-cat](https://github.com/studynakamoto/fletch-cat)) work
together without breaking live mainnet.

---

## Roles

| Party | Owns | Does not own |
|-------|------|--------------|
| **DragonmasterETH** | [fletch.cat](https://fletch.cat) UI/UX, Vercel deploy, domain, branding tweaks | Contract deploy keys, treasury wallet |
| **studynakamoto / core team** | Smart contracts, backend indexer, protocol docs, mainnet addresses | Production Vercel project (unless shared) |
| **pepedrt** | Tokenomics advisory (see [TOKENOMICS.md](./TOKENOMICS.md)) | — |

**Source of truth:**

- **Contracts + addresses (v1 live):** this repo + [docs/FACTORIES.md](./docs/FACTORIES.md)
- **Production frontend:** DragonmasterETH’s Vercel project → fletch.cat
- **Reference frontend:** `web/` in this repo (can be forked or cherry-picked)

---

## Live mainnet (v1) — do not change in docs without deploy

These are **already on Robinhood Chain (4663)**. DragonmasterETH’s site should keep
using them until a deliberate v2 migration:

| Variable | Address |
|----------|---------|
| `NEXT_PUBLIC_LAUNCHPAD_FACTORY` | `0x345f727b2C919789C991d96865505BD654d1F8F0` |
| `NEXT_PUBLIC_PUMPSWAP_FACTORY` | `0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9` |
| `NEXT_PUBLIC_PLATFORM_TOKEN` | `0x60977e96F4173A81674F8D4D636d55D43377e1A7` |
| `NEXT_PUBLIC_PLATFORM_PAIR` | `0x5635c0a6633E2c79ceB1f450DbE464FA8F0E76Ba` |
| `NEXT_PUBLIC_TREASURY` | `0xCFc622Af7E71C78d9e5672F4033C6225A6A36234` |

Uniswap (RH Chain canonical):

| | Address |
|--|---------|
| Router02 | `0x89e5db8b5aa49aa85ac63f691524311aeb649eba` |
| Factory | `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f` |
| WETH9 | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |

**Not deployed yet:** `LaunchpadFactoryV2`, our Uniswap v2 clone — see [docs/FACTORIES.md](./docs/FACTORIES.md).

---

## How to merge changes

### Frontend (DragonmasterETH → or ← repo)

1. **Additive changes preferred** — new files (`web/lib/api.ts`), optional env vars,
   new hooks that fall back to on-chain reads when `NEXT_PUBLIC_API_URL` is unset.
2. **Do not** change v1 factory addresses in production env without coordination.
3. Suggested flow:
   - Core team merges protocol fixes to `main` on GitHub.
   - DragonmasterETH pulls / cherry-picks `web/` changes into his Vercel-connected branch.
   - Or: point Vercel at this repo with **Root Directory = `web`** (if switching to monorepo deploy).

### Contracts

1. All contract changes land in `contracts/` here first.
2. `npm run build && npm test` must pass before any mainnet deploy.
3. **No mainnet deploy** until deployer wallet migration is complete (user action).
4. After deploy, update:
   - `web/lib/addresses.<chainId>.json` or `launchpad-v2.<chainId>.json`
   - [docs/FACTORIES.md](./docs/FACTORIES.md)
   - Production Vercel env vars (both parties)

### Backend

1. Backend lives in `backend/` — deploy separately (Railway / Render).
2. DragonmasterETH sets `NEXT_PUBLIC_API_URL` on fletch.cat to the public backend URL.
3. Frontend works **without** the backend (on-chain reads only); API adds charts/trades/USD stats.

---

## Environment variables (production site)

### Required (v1)

```env
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_LAUNCHPAD_FACTORY=0x345f727b2C919789C991d96865505BD654d1F8F0
NEXT_PUBLIC_PUMPSWAP_FACTORY=0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9
NEXT_PUBLIC_PLATFORM_TOKEN=0x60977e96F4173A81674F8D4D636d55D43377e1A7
NEXT_PUBLIC_PLATFORM_PAIR=0x5635c0a6633E2c79ceB1f450DbE464FA8F0E76Ba
NEXT_PUBLIC_TREASURY=0xCFc622Af7E71C78d9e5672F4033C6225A6A36234
NEXT_PUBLIC_WALLETCONNECT_ID=<from cloud.walletconnect.com>
```

### Optional (recommended)

```env
NEXT_PUBLIC_API_URL=https://<your-backend-host>
NEXT_PUBLIC_DEX_ROUTER=0x89e5db8b5aa49aa85ac63f691524311aeb649eba
NEXT_PUBLIC_DEX_FACTORY=0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f
NEXT_PUBLIC_WETH=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
```

### V2 (after deploy only)

```env
NEXT_PUBLIC_LAUNCHPAD_FACTORY_V2=0x...
```

---

## Backend API (for fletch.cat)

Base URL: whatever you deploy (e.g. `https://fletch-api.up.railway.app`).  
CORS is open for browser access.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | `{ ok, chainId, lastIndexedBlock }` |
| `/stats` | GET | Platform stats (volume, token count, ETH price) |
| `/tokens?sort=new\|volume\|mcap&limit=200` | GET | Token board list |
| `/tokens/:address` | GET | Token detail + curve progress |
| `/tokens/:address/candles?interval=5m&limit=500` | GET | OHLCV for charts |
| `/tokens/:address/trades?limit=50` | GET | Recent trades |

**Frontend integration:** `web/lib/api.ts` — React Query hooks; no-op when `NEXT_PUBLIC_API_URL` unset.

**Indexer env** (`backend/.env`, never commit):

```env
RPC_URL=https://rpc.mainnet.chain.robinhood.com
CHAIN_ID=4663
LAUNCHPAD_FACTORY=0x345f727b2C919789C991d96865505BD654d1F8F0
PUMPSWAP_FACTORY=0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9
PLATFORM_TOKEN=0x60977e96F4173A81674F8D4D636d55D43377e1A7
PLATFORM_PAIR=0x5635c0a6633E2c79ceB1f450DbE464FA8F0E76Ba
PORT=3001
```

---

## Communication checklist

- [ ] DragonmasterETH has GitHub collaborator access on `studynakamoto/fletch-cat`
- [ ] Share backend public URL when deployed
- [ ] Share `NEXT_PUBLIC_WALLETCONNECT_ID` (or he creates his own WC project)
- [ ] Announce v2 factory address **only after** mainnet deploy + user sign-off
- [ ] Treasury multisig migration — separate from site work

---

## Quick links

- Repo: https://github.com/studynakamoto/fletch-cat
- Production site: https://fletch.cat
- Factory reference: [docs/FACTORIES.md](./docs/FACTORIES.md)
- Deploy runbook: [DEPLOY.md](./DEPLOY.md)
- Tokenomics: [TOKENOMICS.md](./TOKENOMICS.md)
