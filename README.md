# Chay Ops (SE-BIOP)

Small Enterprise Business Intelligence & Operations Platform for Philippine businesses.

Built with **Next.js**, **MongoDB**, and **NextAuth** — ready for **Vercel** + **MongoDB Atlas**.

## Features (Phase 1)

| Module | Capability |
|--------|------------|
| Dashboard | Revenue, profit, margins, inventory turnover, ROI, cash position |
| Revenue | Daily sales entry with payment methods |
| Expenses & Losses | Categorized expenses + inventory damage/loss |
| Inventory | SKU CRUD, stock adjustments, low-stock alerts, CSV/XLSX import |
| Capital | Initial capital, investments, withdrawals |
| Reports | P&L, inventory valuation, KPI summary — CSV/Excel export |
| Users | RBAC: Owner / Manager / Staff |
| Alerts | Low stock, negative cash, info notifications |
| Mobile | Responsive UI + PWA manifest |

## Quick start

### 1. Prerequisites

- Node.js 20+
- MongoDB locally **or** [MongoDB Atlas](https://www.mongodb.com/atlas) (required for Vercel)

### 2. Install

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
MONGODB_URI=mongodb+srv://USER:PASS@CLUSTER.mongodb.net/chay-ops?retryWrites=true&w=majority
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-string
ALLOW_SEED=true
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login), click **Load demo data**, then sign in:

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@chay.ph | password123 |
| Manager | manager@chay.ph | password123 |
| Staff | staff@chay.ph | password123 |

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Set environment variables:

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Atlas connection string |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `ALLOW_SEED` | `true` once to seed, then `false` |

4. Deploy. Open `/login` → **Load demo data** (while `ALLOW_SEED=true`).

`vercel.json` pins the Singapore region (`sin1`) for lower latency in the Philippines.

## Project structure

```
src/
  app/                 # App Router pages + API routes
  components/          # UI shell, charts, forms
  lib/                 # DB, auth, KPI engine, helpers
  models/              # Mongoose schemas
  types/               # Shared TypeScript types
scripts/seed.ts        # Optional CLI seed helper
```

## Roles

- **Owner** — full access including capital & users
- **Manager** — view + edit operations, export reports
- **Staff** — data entry (revenue, expenses, inventory)

## Notes

- Cloud backup/sync is provided by MongoDB Atlas + Vercel serverless APIs.
- Native App Store apps are out of Phase 1 scope; the web app is mobile-first and installable via PWA.
- PDF export can be layered on the existing report JSON; CSV/Excel is included for investor/ops workflows.
