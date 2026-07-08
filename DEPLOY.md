# 🚀 Go Live — fletch.cat deployment runbook

Two things ship independently:

1. **Contracts** → Robinhood Chain (mainnet `4663` or testnet `46630`)
2. **Web app** → Vercel, then your domain

Do them in order (the web app needs the contract addresses).

Total time once you have a funded wallet + Vercel account: **~15 minutes.**

---

## ✅ Prerequisites (things only you can do)

- [ ] A wallet **private key** funded with ETH on Robinhood Chain
      (mainnet or testnet). Mainnet ETH is bridged real ETH.
- [ ] Enough ETH for: gas + the platform LP seed (`PLATFORM_LP_ETH`, default **0.1 ETH**).
      Budget ~**0.15 ETH** on mainnet to be safe.
- [ ] A [Vercel](https://vercel.com) account (free tier is fine).
- [ ] A [WalletConnect Project ID](https://cloud.walletconnect.com) (free, 2 min) —
      needed so "Connect Wallet" works reliably in production.
- [ ] The domain you're buying (point it after the app is live).

---

## 1) Deploy the contracts

```bash
cd pumpclone/contracts
npm install
npm run build          # compile
npm test               # sanity-check curve + graduation + swap (optional but recommended)

# add your key
cp .env.example .env
#   edit .env → PRIVATE_KEY=<your funded key>
#   (optional) FEE_RECIPIENT=<treasury wallet, defaults to deployer>
#   (optional) PLATFORM_NAME / PLATFORM_SYMBOL / PLATFORM_LP_ETH
```

**Testnet first (recommended dry run):**

```bash
npm run deploy:testnet
```

**Mainnet (the real launch):**

```bash
npm run deploy:mainnet
```

The script prints a block like this and also writes `web/lib/addresses.<chainId>.json`:

```
NEXT_PUBLIC_CHAIN_ID=4663
NEXT_PUBLIC_LAUNCHPAD_FACTORY=0x...
NEXT_PUBLIC_PUMPSWAP_FACTORY=0x...
NEXT_PUBLIC_PLATFORM_TOKEN=0x...
NEXT_PUBLIC_PLATFORM_PAIR=0x...
NEXT_PUBLIC_TREASURY=0x...
```

**Copy that whole block** — you'll paste it into Vercel next.

> Fees: every token that graduates sends the 1% fee (ETH) to your treasury wallet.
> Run buybacks whenever you want: `AMOUNT_ETH=0.05 npm run buyback:mainnet` (buys `$FLETCH`
> on PumpSwap and burns it).

---

## 2) Put the logo in place (one-time)

The app references `web/public/logo.png`. Copy your mascot art there (PowerShell,
paste as-is):

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\Maximilian\iCloudDrive\Documents\DEV\pumpclone\web\public" | Out-Null
Copy-Item "C:\Users\Maximilian\.cursor\projects\c-Users-Maximilian-iCloudDrive-Documents-DEV\assets\c__Users_Maximilian_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-cbb98932-0538-4dec-ad8d-73092da2259a.png" "C:\Users\Maximilian\iCloudDrive\Documents\DEV\pumpclone\web\public\logo.png" -Force
```

Or just drag the PNG into `pumpclone/web/public/` and name it `logo.png`.
(The build succeeds without it, but the header/favicon/hero image will 404.)

---

## 3) Verify the web build locally (optional, 1 min)

```bash
cd pumpclone/web
npm install
npm run build          # must succeed before deploying
```

---

## 4) Deploy the web app to Vercel

### Option A — GitHub + Vercel dashboard (easiest, gives auto-deploys)

```bash
# from repo root (pumpclone/ or its parent — see note below)
git init                       # if not already a repo
git add .
git commit -m "fletch.cat: launchpad + PumpSwap + $FLETCH"
# create a repo on github.com, then:
git remote add origin https://github.com/<you>/pumpclone.git
git push -u origin main
```

In Vercel:

1. **Add New → Project → Import** your GitHub repo.
2. **Root Directory:** set to `web` (or `pumpclone/web` if you pushed the parent folder).
   ⚠️ This is the one setting people miss — the Next.js app lives in `web/`.
3. **Environment Variables** → paste each line from the deploy output, plus:
   ```
   NEXT_PUBLIC_WALLETCONNECT_ID=<your walletconnect project id>
   ```
4. **Deploy.** You get a live `*.vercel.app` URL in ~1 min.

### Option B — Vercel CLI (fastest, no GitHub)

```bash
cd pumpclone/web
npm i -g vercel
vercel                 # first run: links project, asks a few questions
# add env vars:
vercel env add NEXT_PUBLIC_CHAIN_ID production          # 4663
vercel env add NEXT_PUBLIC_LAUNCHPAD_FACTORY production
vercel env add NEXT_PUBLIC_PUMPSWAP_FACTORY production
vercel env add NEXT_PUBLIC_PLATFORM_TOKEN production
vercel env add NEXT_PUBLIC_PLATFORM_PAIR production
vercel env add NEXT_PUBLIC_TREASURY production
vercel env add NEXT_PUBLIC_WALLETCONNECT_ID production
vercel --prod          # ship to production
```

---

## 5) Point your domain

In **Vercel → Project → Settings → Domains**, add your domain. Vercel shows the exact
records; the standard ones are:

| Record | Host  | Value                    |
| ------ | ----- | ------------------------ |
| `A`    | `@`   | `76.76.21.21`            |
| `CNAME`| `www` | `cname.vercel-dns.com`   |

Add those at your domain registrar's DNS settings. Propagation is usually minutes;
Vercel issues the SSL cert automatically. **You're live.**

---

## 6) Post-launch checklist

- [ ] Visit the domain, click **Connect Wallet**, confirm it connects on Robinhood Chain.
- [ ] The flagship **$FLETCH** hero shows a price and lets you ape.
- [ ] Create a test token from the UI; buy a little; confirm the curve moves.
- [ ] Add the network to MetaMask if prompted (chainId `4663`, RPC `https://rpc.mainnet.chain.robinhood.com`).
- [ ] (Optional) Verify contracts on Blockscout:
      `npx hardhat verify --network robinhood <address> <constructor args>`
- [ ] Tell people to add Robinhood Chain to their wallet — see the network table in `README.md`.

---

## Environment variables reference

| Variable                        | Where            | Example                              |
| ------------------------------- | ---------------- | ------------------------------------ |
| `NEXT_PUBLIC_CHAIN_ID`          | Vercel           | `4663` (mainnet) / `46630` (testnet) |
| `NEXT_PUBLIC_LAUNCHPAD_FACTORY` | Vercel           | from deploy output                   |
| `NEXT_PUBLIC_PUMPSWAP_FACTORY`  | Vercel           | from deploy output                   |
| `NEXT_PUBLIC_PLATFORM_TOKEN`    | Vercel           | from deploy output                   |
| `NEXT_PUBLIC_PLATFORM_PAIR`     | Vercel           | from deploy output                   |
| `NEXT_PUBLIC_TREASURY`          | Vercel           | from deploy output                   |
| `NEXT_PUBLIC_WALLETCONNECT_ID`  | Vercel           | from cloud.walletconnect.com         |
| `PRIVATE_KEY`                   | contracts/.env   | funded deployer key (never commit)   |
| `FEE_RECIPIENT`                 | contracts/.env   | treasury wallet (optional)           |

> ⚠️ Contracts are **unaudited**. For a real-money mainnet launch, get an audit and add
> UI slippage controls first (see README "MVP notes").
