# fletch.cat — Dev Handoff

Monorepo for the Fletch Cat launchpad (pump.fun-style) + PumpSwap AMM + our own
Uniswap v2-style DEX, on **Robinhood Chain** (EVM L2, chainId **4663**).

## Repo layout

| Folder | What it is | Run |
|--------|-----------|-----|
| `contracts/` | Hardhat: launchpad, bonding curve, PumpSwap (ETH-only) + `src/dex` full Uniswap v2 clone | `npm i && npm run build && npm test` |
| `web/` | Next.js 14 + wagmi/viem/RainbowKit frontend | `npm i && npm run dev` |
| `backend/` | Fastify + SQLite + viem indexer (token list, prices, candles, trades) | `npm i && npm run build && npm run index && npm run dev` |

## Live deployment (Robinhood Chain mainnet, chainId 4663)

| Contract | Address |
|----------|---------|
| **FLETCH (Fletch Cat) token** | `0x60977e96F4173A81674F8D4D636d55D43377e1A7` |
| PumpSwap pair (ETH/FLETCH) | `0x5635c0a6633E2c79ceB1f450DbE464FA8F0E76Ba` |
| **Uniswap v2 pair (ETH/FLETCH)** | `0x616936b685b5fca6fafB7C795aB97B8EdAd38ee5` |
| LaunchpadFactory | `0x345f727b2C919789C991d96865505BD654d1F8F0` |
| PumpSwapFactory | `0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9` |
| Treasury (fees) | `0xCFc622Af7E71C78d9e5672F4033C6225A6A36234` |

### Robinhood Chain / Uniswap infra (mainnet 4663)
- RPC: `https://rpc.mainnet.chain.robinhood.com`
- Explorer: `https://robinhoodchain.blockscout.com`
- WETH9: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- Uniswap V2 Factory: `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f`
- Uniswap V2 Router02: `0x89e5db8b5aa49aa85ac63f691524311aeb649eba`

## Frontend env (`web/.env.local`)

```env
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_LAUNCHPAD_FACTORY=0x345f727b2C919789C991d96865505BD654d1F8F0
NEXT_PUBLIC_PUMPSWAP_FACTORY=0x4B167BE628c8Bfb60FCEE215a9f3A68FC6f500B9
NEXT_PUBLIC_PLATFORM_TOKEN=0x60977e96F4173A81674F8D4D636d55D43377e1A7
NEXT_PUBLIC_PLATFORM_PAIR=0x5635c0a6633E2c79ceB1f450DbE464FA8F0E76Ba
NEXT_PUBLIC_TREASURY=0xCFc622Af7E71C78d9e5672F4033C6225A6A36234
# get a free id at cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_ID=
```

## Backend env (`backend/.env`) — copy from `backend/.env.example`
Points at the same addresses; `ETH_USD` stubs the ETH price for USD math.

## Notes / open items
- **Secrets:** never commit `.env`. Deploy keys live only in `contracts/.env` locally.
- The FLETCH token was deployed directly (not via the launchpad), so the indexer
  seeds it from `PLATFORM_TOKEN`/`PLATFORM_PAIR`. New launchpad tokens are picked
  up automatically via `TokenCreated` events.
- **Branding:** product names are **FletchPad** (launchpad) and **FletchSwap**
  (AMM); on-chain contract names remain `Launchpad*`/`PumpSwap*`.
- ✅ Slippage controls are live in the UI (curve + AMM + hero).
- ✅ Charts/trades/USD stats ship with the site once `NEXT_PUBLIC_API_URL`
  points at a deployed backend (`backend/README.md` has the Docker runbook).
- $FLETCH already charts on DEXScreener via the Uniswap v2 pair — full DEX
  listing plan in `DEXSCREENER.md`.
- Our Uniswap v2 clone (`contracts/src/dex`) is built + tested but **not yet
  deployed** — deploy with `WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 npm run deploy:dex:mainnet`.
- **NEW: LaunchpadFactoryV2** (`contracts/src/v2`) — graduations seed canonical
  **Uniswap v2** pools (auto-charting on DEXScreener). Built + tested, not yet
  deployed: `ROUTER_ADDRESS=0x89e5db8b5aa49aa85ac63f691524311aeb649eba npm run deploy:v2:mainnet`,
  then set `NEXT_PUBLIC_LAUNCHPAD_FACTORY` + `NEXT_PUBLIC_DEX_*` in Vercel.
- Contracts are **unaudited**.
- See `README.md`, `CONTRACTS.md`, `DEPLOY.md`, `FLETCH_CAT.md`, `TOKENOMICS.md` for deeper docs.
```
