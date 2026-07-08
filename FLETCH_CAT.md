# fletch.cat — Go Live Checklist

**Flagship token:** Fletch Cat · `$FLETCH` (minted on first deploy)

## Step 1 — Deploy contracts

```bash
cd pumpclone/contracts
cp .env.example .env
```

Add to `.env`:

```
PRIVATE_KEY=your_wallet_private_key_without_0x
FEE_RECIPIENT=your_treasury_wallet_address
```

Get testnet ETH on Robinhood Chain testnet (chainId 46630), then:

```bash
npm install
npm run build
npm test
npm run deploy:testnet
```

**Save every address printed** — you need them for Vercel.

---

## Step 2 — Deploy to Vercel

```bash
cd ../web
npm install
npx vercel login
npx vercel --prod
```

In the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_CHAIN_ID` | `46630` |
| `NEXT_PUBLIC_LAUNCHPAD_FACTORY` | from deploy |
| `NEXT_PUBLIC_PUMPSWAP_FACTORY` | from deploy |
| `NEXT_PUBLIC_PLATFORM_TOKEN` | from deploy |
| `NEXT_PUBLIC_PLATFORM_PAIR` | from deploy |
| `NEXT_PUBLIC_TREASURY` | your treasury wallet |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | from [cloud.walletconnect.com](https://cloud.walletconnect.com) |

Redeploy after adding env vars: **Deployments → ⋯ → Redeploy**.

---

## Step 3 — Add domain in Vercel

1. Vercel dashboard → Project → **Settings → Domains**
2. Add `fletch.cat`
3. Add `www.fletch.cat`
4. Vercel will show the DNS records you need (should match below)

---

## Step 4 — DNS at your registrar

Add these records where you bought **fletch.cat**:

| Type | Host / Name | Value | TTL |
|------|-------------|-------|-----|
| **A** | `@` (or blank) | `76.76.21.21` | 3600 |
| **CNAME** | `www` | `cname.vercel-dns.com` | 3600 |

**Notes for .cat domains:**
- Some registrars label the host field differently (`@`, blank, or `fletch.cat`) — all mean the apex.
- Do **not** use a CNAME on the apex (`@`) — use the **A record** above.
- DNS can take 5–60 minutes (sometimes up to 24h).
- Vercel will auto-provision HTTPS once DNS propagates.

**Alternative:** point nameservers to Vercel (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) and manage DNS in Vercel instead.

---

## Step 5 — Verify

- [ ] https://fletch.cat loads
- [ ] https://www.fletch.cat redirects to apex (or vice versa — set in Vercel)
- [ ] Wallet connects on Robinhood Chain testnet
- [ ] Platform token hero shows $FLETCH price
- [ ] You can create a test token

---

## Buybacks (when fees accumulate)

```bash
cd pumpclone/contracts
npm run buyback:testnet
```

Fees from graduated launches land in your treasury wallet. Run buyback whenever you want to buy & burn $FLETCH.
