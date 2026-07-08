# Contracts — How the Launchpad Works

Onboarding doc for anyone touching `contracts/` or integrating against it
(frontend/backend). Basics only — see [README.md](./README.md) for run
commands and [HANDOFF.md](./HANDOFF.md) for live addresses/env.

> **Naming:** product names are **FletchPad** (the launchpad) and
> **FletchSwap** (the AMM). On-chain the contracts are named `Launchpad*` and
> `PumpSwap*` — same thing, deployed before the rebrand.

## Big picture

```
                    createToken()
User ─────────────► LaunchpadFactory
                        │  deploys per token:
                        ├──► Token (fixed-supply ERC20, whole supply → curve)
                        └──► BondingCurve (holds the supply, sells it for ETH)
                                  │
                    buy()/sell()  │  price follows constant-product curve
                                  │
                                  ▼  sale supply fully bought = "graduation"
                        1% fee → treasury (feeRecipient)
                        rest of ETH + 200M reserved tokens
                                  │
                                  ▼
                    PumpSwapFactory.createPair(token)
                                  │
                                  ▼
                    PumpSwapPair (ETH/token AMM) — LP sent to 0xdead (locked forever)
```

Separately, `contracts/src/dex/` contains a **full Uniswap v2 clone**
(Factory, Router02, Pair, WETH9) — built and tested, **not yet deployed to
mainnet**. It is independent of the launchpad flow above.

## V2: DEXScreener-visible graduations (`src/v2/`)

`LaunchpadFactoryV2` + `BondingCurveV2` are the **same launchpad and curve
math**, with one change: graduation seeds a **standard Uniswap v2 WETH/token
pool through a v2 router** (`addLiquidityETH`, LP minted to `0xdead`).
Standard v2 pairs emit the events aggregators index, so **every graduated
token charts on DEXScreener automatically** — proven by the FLETCH Uniswap
pair already charting there.

- Deploy with `ROUTER_ADDRESS=<v2 router> npm run deploy:v2:mainnet` — point it
  at the **canonical Uniswap v2 Router02 on Robinhood Chain**
  (`0x89e5db8b5aa49aa85ac63f691524311aeb649eba`) or at our own FletchSwap
  router from `deploy:dex:*`.
- The curve exposes `pair()` after graduation; post-graduation trading goes
  through the router (the web app auto-detects this via
  `NEXT_PUBLIC_DEX_ROUTER/FACTORY/WETH`).
- Tests: `test/launchpadV2.test.ts` (graduation, LP burn, fee, router swaps).

## The five contracts

| Contract | File | Role |
|---|---|---|
| `LaunchpadFactory` | `src/LaunchpadFactory.sol` | Entry point. `createToken(...)` deploys a Token + BondingCurve pair, stores metadata (name, symbol, image, socials, creator), emits `TokenCreated`. Optional **dev buy**: send ETH with `createToken` and it buys on the curve in the same tx. Owner can `setFeeRecipient`. |
| `Token` | `src/Token.sol` | Plain fixed-supply ERC20 (OpenZeppelin). Entire supply minted at creation and transferred to its BondingCurve. No mint, no owner functions. |
| `BondingCurve` | `src/BondingCurve.sol` | Sells the token for ETH along a virtual-reserve constant-product curve. Handles `buy`, `sell`, quotes, and graduation. One curve per token. |
| `PumpSwapFactory` | `src/pumpswap/PumpSwapFactory.sol` | One ETH/token pair per token. `getPair(token)` / `createPair(token)`. |
| `PumpSwapPair` | `src/pumpswap/PumpSwapPair.sol` | Minimal ETH⇄token constant-product AMM with LP token. 0.30% fee to LPs. `swapExactETHForTokens` / `swapExactTokensForETH` / `addLiquidity` / `removeLiquidity`. |

## Curve math (BondingCurve)

Virtual reserves make the curve start at a nonzero price without seed capital:

```
(X0 + ethReserve) * (Y0 - tokensSold) == X0 * Y0  (= K)
```

- `X0` (`virtualEth`, default **0.5 ETH**) and `Y0` (`virtualToken`, default
  **1.073B**) are curve-shape constants fixed at deploy.
- `ethReserve` = real ETH held by the curve; `tokensSold` = tokens sold so far.
- Spot price = `(X0 + ethReserve) / (Y0 - tokensSold)` — rises as tokens sell.
- Defaults (set in the factory constructor via `scripts/deploy.ts`):
  1B total supply, **800M sold on the curve**, **200M reserved for the AMM**,
  graduates after ~**1.46 ETH** raised (`graduationEth()` computes this).

Key functions:

- `getBuyQuote(ethIn) → (tokensOut, ethUsed)` — quote for a buy. If `ethIn`
  overshoots the remaining sale supply, `ethUsed < ethIn` and the surplus is
  **refunded** in `buy`.
- `getSellQuote(tokensIn) → ethOut` — quote for selling back to the curve.
- `buy(minTokensOut, to)` payable — reverts with `SLIPPAGE` if the quote moved
  below `minTokensOut`. Triggers graduation when `tokensSold >= saleSupply`.
- `sell(tokensIn, minEthOut, to)` — requires prior ERC20 `approve` to the curve.
- Selling is only possible **before** graduation; after that the curve is
  closed (`live` modifier) and all trading moves to the PumpSwap pair.

## Graduation (automatic, inside the final `buy`)

1. `graduated = true` — curve permanently closes.
2. **Fee**: `graduationFeeBps` (default **1%**) of raised ETH → `feeRecipient`
   (the treasury wallet; fees fund $FLETCH buybacks).
3. Creates the PumpSwap pair if needed, then `addLiquidity` with the remaining
   ETH + the 200M reserved tokens.
4. **LP tokens go to `0xdead`** — liquidity is locked forever, nobody can rug.
5. Emits `Graduated(pair, ethLiquidity, tokenLiquidity, fee)`.

## Events (what the backend indexer consumes)

| Event | Emitted by | Meaning |
|---|---|---|
| `TokenCreated(token, curve, creator, name, symbol, index)` | LaunchpadFactory | New launch |
| `Buy(buyer, ethIn, tokensOut, newTokensSold)` | BondingCurve | Curve buy |
| `Sell(seller, tokensIn, ethOut, newTokensSold)` | BondingCurve | Curve sell |
| `Graduated(pair, ethLiquidity, tokenLiquidity, fee)` | BondingCurve | Curve → AMM |
| `Swap`, `Mint`, `Burn` | PumpSwapPair | Post-graduation trading/liquidity |

## Working on it

```bash
cd contracts
npm install
npm run build        # hardhat compile (Solidity 0.8.24, OZ 5)
npm test             # launchpad + buyback + dex test suites

npm run node         # terminal A: local chain (chainId 31337)
npm run deploy:local # terminal B: deploys everything, writes web/lib/addresses.31337.json
npm run seed:local   # optional: 3 demo tokens
```

Deploy scripts (`contracts/scripts/`):

- `deploy.ts` — full stack: PumpSwapFactory → LaunchpadFactory → flagship
  $FLETCH token + LP seed. Prints the `NEXT_PUBLIC_*` env block for the web app.
- `deployDex.ts` — the Uniswap v2 clone (needs `WETH_ADDRESS`; RH Chain WETH9
  is in HANDOFF.md). Not yet run on mainnet.
- `buyback.ts` — treasury buys $FLETCH on PumpSwap and burns to `0xdead`.
- `seed.ts` — demo tokens for local dev.

Live mainnet addresses (chainId 4663) are kept in **[HANDOFF.md](./HANDOFF.md)** —
treat that as the source of truth.

## Integration cheat sheet (frontend/backend)

- Token list: `LaunchpadFactory.getTokens(offset, limit)` (newest first) or
  index `TokenCreated` events. Single token: `getToken(address)`.
- Curve state: `ethReserve`, `graduationEth()`, `tokensSold`, `saleSupply`,
  `graduated`, `currentPrice()` — all cheap view calls.
- Progress bar = `ethReserve / graduationEth()` (or 100% once `graduated`).
- After graduation find the pool via `PumpSwapFactory.getPair(token)`;
  `getReserves()` returns `(reserveETH, reserveToken)`.
- Hand-written ABIs the web app uses: `web/lib/abis.ts` (kept in sync with the
  Solidity by hand — update both when interfaces change).

## Safety notes

- Contracts are **unaudited** — no mainnet marketing push before an audit.
- `BondingCurve` uses OZ `ReentrancyGuard` on `buy`/`sell`; graduation runs
  inside the final buy.
- Always pass real `minTokensOut` / `minEthOut` / `amountOutMin` values from
  UIs (slippage protection) — the contracts enforce them, the UI must supply them.
- Curve parameters are **immutable per factory**; changing economics means
  deploying a new factory.
