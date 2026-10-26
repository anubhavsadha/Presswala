# Deploying Presswala

These steps use Vercel for the app and Supabase (or Neon) for Postgres. Both have free tiers.

## 1. Database

> Presswala has its **own Supabase account** (signed in with GitHub), separate from the Readiv one. Never point it at Readiv's database.

1. Create a project on [Supabase](https://supabase.com) (region: Mumbai `ap-south-1`) or [Neon](https://neon.tech).
2. Copy the Postgres connection string:
   - Supabase: open the project → **Connect** button in the top bar → Connection String → **Transaction pooler** (port 6543). Replace `[YOUR-PASSWORD]` with the database password. Prepared statements are switched off automatically for `pooler` URLs.
   - Neon: the pooled connection string.
3. From your machine, create the tables and seed data:

   ```bash
   DATABASE_URL="postgres://..." ADMIN_PHONE=98xxxxxxxx ADMIN_PASSWORD='a-strong-password' SEED_DEMO=0 npm run db:setup
   ```

   Use `SEED_DEMO=1` on a staging database if you want demo presswalas and households.
   `npm run db:migrate` is safe to re-run after future schema changes.

## 2. App on Vercel

1. Push this repo to GitHub and import it at vercel.com/new (the framework is detected as Next.js).
2. Add these environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the connection string from step 1 |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `CRON_SECRET` | another random string |

3. Deploy. `vercel.json` registers a daily cron (00:00 IST) that turns weekly schedules into orders for the next 7 days.
4. Optional: add your domain under Project → Settings → Domains.

## Any other Node host (Railway, Render, a VPS)

```bash
npm ci
npm run build
npm start            # listens on $PORT (default 3000)
```

Set the same environment variables. For the daily schedule job, call this once a day:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/schedules
```

(The app also generates schedule orders whenever a customer or presswala opens it, so the cron is a safety net.)

## Going live checklist

- [ ] Strong `AUTH_SECRET` and admin password; delete demo data if you seeded it
- [ ] Add your real sectors/societies under Admin → Areas (with a centre lat/lng for each)
- [ ] Set commission % and plans under Admin
- [ ] Approve each presswala only after checking ID and stall location
- [ ] Health check: `GET /api/health` returns `{"ok":true}`
- [ ] Next phase: SMS OTP login, WhatsApp notifications, Razorpay
