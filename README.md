# fletch.cat — FletchPad + FletchSwap 🚀

A pump.fun-style token launchpad (**FletchPad**) **plus its own AMM
(FletchSwap)**, on **Robinhood Chain** (EVM, Arbitrum Orbit L2 — mainnet
`4663`, testnet `46630`).

> **Naming:** product names are **FletchPad** (launchpad) and **FletchSwap**
> (AMM/DEX). The Solidity contracts keep their original `Launchpad*` /
> `PumpSwap*` names — those are already deployed on mainnet.

- **FletchPad** — anyone creates a fixed-supply ERC20 that trades on a
  constant-product **bonding curve**.
- **Graduation** — once the whole sale allocation is bought, the curve takes a
  platform fee, seeds a **FletchSwap** ETH/token pool with the raised ETH +
  reserved tokens, and **locks the LP forever**.
- **FletchSwap** — a minimal Uniswap-v2-style constant-product AMM (ETH ⇄ token,
  0.30% fee to LPs) that we own, with a full Uniswap v2 router/factory clone in
  `contracts/src/dex` for token⇄token routing.
- **Flagship token + buyback flywheel** — **Fletch Cat** (`$FLETCH`) launched
  with **99.9% held by the treasury** and **0.1% floating** in a PumpSwap pool.
  Launchpad graduation fees accumulate in the **treasury wallet**; you run manual
  buybacks via script to swap ETH for `$FLETCH` and burn it. Tiny float + fee-funded bid.
- **Web app** — Next.js + wagmi/viem + RainbowKit board with a flagship "ape
  first" hero, plus create/buy/sell on the curve or the AMM.

```
pumpclone/
  contracts/   Hardhat project (Solidity 0.8.24, OpenZeppelin 5)
  web/         Next.js 14 app (App Router)
  backend/     Fastify API + on-chain indexer
```

**Docs:** [CONTRACTS.md](./CONTRACTS.md) (how the launchpad works — start here) · [TOKENOMICS.md](./TOKENOMICS.md) · [HANDOFF.md](./HANDOFF.md) · [DEPLOY.md](./DEPLOY.md)

## How the bonding curve works

Virtual-reserve constant product, `(X0 + ethReserve) * (Y0 - tokensSold) = X0*Y0`:

| Param            | Default        | Meaning                              |
| ---------------- | -------------- | ------------------------------------ |
| Total supply     | 1,000,000,000  | Minted to the curve at creation      |
| Sale supply      | 800,000,000    | Sold along the curve                 |
| Migration supply | 200,000,000    | Seeded into PumpSwap at graduation   |
| Virtual token Y0 | 1,073,000,000  | Curve shape                          |
| Virtual ETH X0   | 0.5 ETH        | Curve shape → graduates at ~1.46 ETH |
| Graduation fee   | 1%             | Taken from raised ETH                |

Change these in `contracts/scripts/deploy.ts` (X0 also via `VIRTUAL_ETH` env).

---

## Quick start (local)

Two terminals. **Contracts first.**

### 1. Contracts

```bash
cd pumpclone/contracts
npm install
npm run build          # compile
npm test               # run the test suite (curve, graduation, swap)
```

Run a local chain + deploy + seed demo tokens:

```bash
npm run node                       # terminal A: local hardhat node (chainId 31337)
npm run deploy:local               # terminal B
npm run seed:local                 # optional: creates 3 demo tokens
```

`deploy:local` prints the factory addresses and writes
`web/lib/addresses.31337.json`.

### 2. Web

```bash
cd pumpclone/web
npm install
cp .env.local.example .env.local
```

Set in `.env.local` (use the addresses printed by the deploy step):

```
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_LAUNCHPAD_FACTORY=0x...
NEXT_PUBLIC_PUMPSWAP_FACTORY=0x...
NEXT_PUBLIC_PLATFORM_TOKEN=0x...
NEXT_PUBLIC_PLATFORM_PAIR=0x...
NEXT_PUBLIC_TREASURY=0x...
```

(The deploy step prints all of these.)

```bash
npm run dev            # http://localhost:3000
```

Import a hardhat test account into MetaMask (the node prints private keys) and
add a network with RPC `http://127.0.0.1:8545`, chainId `31337`.

---

## Deploy to Robinhood Chain

> **Going live?** Follow the full step-by-step runbook in [`DEPLOY.md`](./DEPLOY.md)
> (contracts → Vercel → custom domain). The quick reference is below.

### Testnet (chainId 46630)

```bash
cd pumpclone/contracts
cp .env.example .env          # add PRIVATE_KEY (a funded testnet key)
npm run deploy:testnet
```

Then in `web/.env.local`:

```
NEXT_PUBLIC_CHAIN_ID=46630
NEXT_PUBLIC_LAUNCHPAD_FACTORY=<printed>
NEXT_PUBLIC_PUMPSWAP_FACTORY=<printed>
```

### Mainnet (chainId 4663)

```bash
npm run deploy:mainnet        # requires real ETH on Robinhood Chain
```

Verify on Blockscout (no API key needed):

```bash
npx hardhat verify --network robinhoodTestnet <address> <constructor args...>
```

Network reference:

| Property   | Mainnet                                   | Testnet                                     |
| ---------- | ----------------------------------------- | ------------------------------------------- |
| Chain ID   | 4663                                      | 46630                                       |
| RPC        | https://rpc.mainnet.chain.robinhood.com   | https://rpc.testnet.chain.robinhood.com     |
| Explorer   | https://robinhoodchain.blockscout.com     | https://explorer.testnet.chain.robinhood.com|
| Gas token  | ETH                                       | ETH                                         |

---

## Contracts overview

| Contract              | Role                                                        |
| --------------------- | ---------------------------------------------------------- |
| `Token.sol`           | Fixed-supply ERC20, whole supply minted to its curve       |
| `BondingCurve.sol`    | Buy/sell on the curve; migrates to PumpSwap at graduation   |
| `LaunchpadFactory.sol`| Creates tokens+curves, tracks metadata, optional dev buy    |
| `PumpSwapFactory.sol` | Deploys one ETH/token pair per token                        |
| `PumpSwapPair.sol`    | Constant-product AMM + LP token (add/remove liquidity, swap)|

## Flagship token + buyback flywheel

`npm run deploy:*` deploys the whole stack and:

1. Mints **Fletch Cat** (`$FLETCH`, 1B supply) entirely to the treasury (deployer).
2. Seeds **0.1%** of supply + `PLATFORM_LP_ETH` into a PumpSwap pool (treasury keeps the LP).
3. Leaves **99.9%** with the treasury.
4. Sets the launchpad's `feeRecipient` to the **treasury wallet** — graduation fees accumulate as ETH there.

Run a manual buyback from the treasury wallet (swaps on PumpSwap, burns to `0xdead`):

```bash
cd pumpclone/contracts
npm run buyback:local                 # spend available treasury ETH (minus gas buffer)
AMOUNT_ETH=0.05 npm run buyback:local # spend a fixed amount
```

Tune the flagship launch via env: `PLATFORM_NAME`, `PLATFORM_SYMBOL`, `PLATFORM_LP_ETH`.
Point fees at a different wallet with `FEE_RECIPIENT` at deploy time, or call
`setFeeRecipient` on the launchpad factory later.

## Status / next steps

- ✅ **Slippage controls** — presets + custom in the trade panel; real min-out
  on curve buys/sells and FletchSwap swaps.
- ✅ **Price charts + trade history** — candlesticks (1m/5m/1h), recent trades,
  USD stats, fed by the `backend/` indexer. Set `NEXT_PUBLIC_API_URL` in the
  web env to enable (site degrades gracefully without it).
- ✅ **/swap page** — FletchSwap UI for any graduated token.
- ✅ **LaunchpadFactoryV2** (`contracts/src/v2`) — graduations seed canonical
  **Uniswap v2** pools so every graduated token **auto-charts on DEXScreener**.
  Tested (25/25); web app auto-routes graduated trading through the router.
- ⬜ Deploy V2 to mainnet (one command, gas only — needs owner go-ahead):
  `ROUTER_ADDRESS=0x89e5db8b5aa49aa85ac63f691524311aeb649eba npm run deploy:v2:mainnet`
- ⬜ Deploy the backend (Docker — see `backend/README.md`) and set
  `NEXT_PUBLIC_API_URL` in Vercel.
- ⬜ DEXScreener launchpad/DEX application — see [DEXSCREENER.md](./DEXSCREENER.md).
- ⬜ Curve trades have no per-trade fee; the platform fee is taken once at
  graduation. Add a trade fee if desired.
- ⬜ Contracts are unaudited. **Do not scale real value without an audit.**
