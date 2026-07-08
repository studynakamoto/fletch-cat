# Fletch Backend API & Indexer

Node.js + TypeScript backend for the [fletch.cat](https://fletch.cat) / pumpclone launchpad. Indexes on-chain events from Robinhood Chain mainnet and exposes a REST API for the frontend.

## Stack

- **Fastify** — HTTP server
- **viem** — RPC reads and event log indexing
- **better-sqlite3** — file-based SQLite database
- **TypeScript** — typed throughout

## Setup

```bash
cd pumpclone/backend
cp .env.example .env
npm install
npm run build
```

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Description |
|----------|-------------|
| `RPC_URL` | Robinhood Chain RPC endpoint |
| `CHAIN_ID` | `4663` |
| `START_BLOCK` | First block to index (`4003957` = factory deploy; auto-detected on reindex) |
| `ETH_USD` | ETH/USD price stub for USD quotes (default `1800`) |
| `PORT` | API server port (default `3001`) |
| `DATABASE_PATH` | SQLite file path |
| `BLOCKSCOUT_API_URL` | Optional explorer API for deploy-block detection |

Contract addresses default to mainnet deployments from `contracts/deployments.json`.

The platform token (`PLATFORM_TOKEN`) is seeded from on-chain ERC20 metadata + pair reserves even if it was not created via `LaunchpadFactory` (e.g. FLETCH on mainnet today).

## Running

### 1. Index on-chain data

Backfill historical logs up to chain head:

```bash
npm run index
```

Full reindex (wipe DB, auto-detect factory deploy block):

```bash
npm run reindex
```

Continuous indexing (follow new blocks):

```bash
npm run index -- --watch
```

### 2. Start API server

Development (hot reload):

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/tokens?sort=new\|volume\|mcap&limit=&offset=` | Token list |
| GET | `/tokens/:address` | Token detail |
| GET | `/tokens/:address/candles?interval=1m\|5m\|1h` | OHLCV candles |
| GET | `/tokens/:address/trades?limit=` | Recent trades |
| GET | `/stats` | Global stats (tokens, volume, treasury) |

CORS is enabled for all origins.

## Indexed Events

- `LaunchpadFactory.TokenCreated`
- `BondingCurve.Buy` / `Sell` / `Graduated`
- `PumpSwapPair.Swap` / `Sync`
- `PumpSwapFactory.PairCreated`

Trades are stored idempotently by `txHash:logIndex`. Candles are derived on insert.

## Deploying (Docker — Railway / Fly.io / any VPS)

The backend needs a **persistent disk** for SQLite, so serverless hosts (Vercel,
Lambda) won't work. The included `Dockerfile` runs the API and the `--watch`
indexer in one container.

```bash
docker build -t fletch-backend .
docker run -p 3001:3001 -v fletch-data:/data --env-file .env -e DATABASE_PATH=/data/indexer.db fletch-backend
```

**Railway:** New Project → Deploy from GitHub repo → set root directory to
`backend/` (it auto-detects the Dockerfile) → add a **Volume** mounted at
`/data` → set the env vars from `.env.example` with `DATABASE_PATH=/data/indexer.db`.

**Fly.io:** `fly launch --no-deploy` in `backend/`, then
`fly volumes create fletch_data --size 1`, add to `fly.toml`:

```toml
[mounts]
  source = "fletch_data"
  destination = "/data"

[http_service]
  internal_port = 3001
```

then `fly secrets set` the env vars and `fly deploy`.

After it's live, set `NEXT_PUBLIC_API_URL=https://<your-backend-host>` in the
web app's Vercel env and redeploy — the site picks up charts, trade history,
and USD stats automatically.

## Project Structure

```
backend/
├── src/
│   ├── abis.ts          # Minimal contract ABIs
│   ├── config.ts        # Env + addresses
│   ├── db.ts            # SQLite schema & queries
│   ├── indexer.ts       # Event backfill + watch
│   ├── server.ts        # Fastify app
│   ├── routes/          # REST route handlers
│   └── cli/             # index & reindex scripts
├── .env.example
├── package.json
└── tsconfig.json
```
