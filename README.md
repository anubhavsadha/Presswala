# Istrify™

**Istrify** ([istrify.in](https://istrify.in)) is an aggregator web app connecting Gurgaon households with their colony presswala (ironing).
Customers book pickups or drops by slot, set weekly schedules, track orders, keep a khata and
buy monthly plans. Presswalas get an optimised daily route, a counting-and-billing screen and a
digital khata. The platform admin approves presswalas, manages areas and plans, and tracks commission.

**Stack:** Next.js 16 (React 19, App Router, Server Actions) · Node.js · PostgreSQL · Tailwind CSS 4.
It works on phones and can be added to the home screen like an app.

## Features

| Who | What |
|---|---|
| Household | Phone + password sign-up with sector/society and GPS pin · sees **only presswalas serving their area** (ranked) · **one-tap "Pick up soon" nudge** · book a pickup or self-drop by date and slot · choose a return slot and "I'll be home" time (changeable later) · weekly recurring schedule · order tracking and itemised bill · khata with UPI pay link and "I have paid" · monthly plans · ratings |
| Presswala | Daily plan: **optimised walking route** for morning pickups and evening drops, with Google Maps links · new-request inbox · count clothes per item (rate card) → automatic bill, plan deduction and khata entry · ironed/delivered status · customer list (**only his own households**) · confirm payments · 7-day load forecast vs capacity · settings for rate card, sectors, working days, capacity, UPI |
| Admin | KPIs (homes, orders, GMV, platform fee) · **supply vs demand per area** (where to recruit) · approve or disable presswalas · collect commission (settlements) · areas · subscription plans · commission % |

### Optimisation (`lib/optimize.ts`)

- **Route planning:** stops are grouped by time window. Within each window the order comes from nearest-neighbour plus 2-opt, starting where the last window ended. Each day shows the km saved versus booking order. Homes without GPS fall back to their area's centre point.
- **Slot nudging:** customers see a "★ Best" slot when the presswala is already visiting homes in their society, so pickups cluster. Each slot has a capacity cap, and slots that have already started are closed.
- **Presswala matching:** a smoothed rating, spare capacity (out of ~100 homes) and distance are combined, so load spreads evenly. Full presswalas can't be chosen.
- **Load forecast:** expected clothes per day (bookings plus schedules) against the presswala's daily capacity.
- **Schedules → orders:** a single idempotent SQL insert, run on page load and by a daily cron.

### Visibility rules

- Customers only ever see verified, accepting presswalas who serve their area.
- Presswalas only see households linked to them, and orders and khata entries tied to them. Every query filters on the logged-in presswala's id.
- `proxy.ts` gates `/c`, `/p` and `/admin` by role, and every page and action re-checks the role on the server.

### Money

- Bill = items × the presswala's rate card. Monthly plan pieces cover regular and kids clothes, dearest first.
- Khata per customer–presswala pair: charges (orders, plans) minus confirmed payments. Payments reported by the customer stay pending until the presswala confirms them.
- Platform commission is stored per order and per plan (percentages set by the admin). Settlements recorded by the admin reduce what each presswala owes.

## Run locally

Requires Node 20.9+ and PostgreSQL 14+.

```bash
cp .env.example .env          # set DATABASE_URL and a long AUTH_SECRET
npm install
npm run db:setup              # creates tables, Gurgaon areas, plans, admin (+ demo data if SEED_DEMO=1)
npm run dev                   # http://localhost:3000
```

Demo logins (password `demo1234` unless noted):

| Role | Phone |
|---|---|
| Admin | `ADMIN_PHONE` / `ADMIN_PASSWORD` from `.env` (default 9999999999 / admin1234) |
| Presswala (DLF 1, DLF 4, Sushant Lok 1) | 9000000001 |
| Presswala (DLF 1, South City 1) | 9000000002 |
| Presswala (Sector 45, 46, Malibu Towne) | 9000000003 |
| Households | 8100000001 … 8100000048 |

Add or remove the demo accounts on any database (including production) at any time:

```bash
npm run db:demo          # creates the presswalas and households above (safe to re-run)
npm run db:demo:remove   # deletes them and all their orders; real accounts stay
```

Checks: `npm run typecheck`, `npm test` (optimiser and billing unit tests), `npm run build`.

## Deploy

See [DEPLOY.md](DEPLOY.md). In short: create a Postgres database (Supabase or Neon), set the environment variables, run `npm run db:setup` once against it, and deploy to Vercel (or any Node host with `npm run build && npm start`).

## Project layout

```
app/
  actions/        server actions (auth, customer, presswala, admin)
  c/              household app        p/   presswala app        admin/  admin console
  api/cron/       daily schedule job   api/health
components/       UI pieces
lib/
  optimize.ts     routing, slot advice, matching (pure, unit-tested)
  billing.ts      bill calculation (pure, unit-tested)
  data.ts         scoped database queries
  auth.ts, session.ts, db.ts, dates.ts (IST), constants.ts (slots)
db/schema.sql     idempotent schema       scripts/  migrate + seed
proxy.ts          role-based route gate (Next 16's replacement for middleware)
```

## Roadmap (not built yet)

- SMS OTP login (swap `login`/`register*` in `app/actions/auth.ts` for MSG91 or Twilio Verify; the phone column is already unique and normalised)
- WhatsApp/SMS notifications for pickups and "clothes on the way"
- Razorpay for online payment and automatic commission split
- Presswala UI fully in Hindi; a native app wrapper (the same server actions can back a REST API)
