# Ticketing Platform

Next.js 15 + Supabase + Sham Cash ticketing system.

## Phase 0 — Foundation

### Prerequisites

- Node.js 20+
- Supabase project with `supabase/schema-v1.2.sql` applied
- Validation suite passed: `supabase/schema-v1.2-validation.sql`

### Setup

```bash
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

npm install
npm run dev
```

### Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | App + env + Supabase connectivity |
| `GET /api/ready` | Health + schema seed checks |

### Project layout

```
app/              # Next.js App Router
components/       # UI (Phase 1+)
lib/              # env, errors, logger, supabase clients
services/         # Domain / infrastructure services
types/            # Shared TypeScript types (database)
supabase/         # SQL schema reference + migrations
edge-functions/   # Supabase Edge Functions (Phase 1)
```

## Phase 1 — Guest checkout (mock payments)

Requires Phase 0 plus `HMAC_SECRET_V1` (32+ byte secret) in `.env.local`. For local dev without Sham Cash, set `SHAM_CASH_MOCK=true` or leave `SHAM_CASH_API_KEY` unset.

### Flow

1. Apply migrations once on your Supabase DB: `20250604-organizer-publish-events.sql`, then `20250605-phase1-hardening-fulfillment.sql`.
2. Seed a demo event: in **SQL Editor**, paste **only** `supabase/seed-dev.sql` (not error text), run it, then refresh `/`.
   (Organizers publish events themselves; only **organizer accounts** need admin approval.)
2. `npm run dev` → open `/` → pick an event → reserve tickets → checkout.
3. Mock pay redirects to `/checkout/mock-pay` → simulates webhook → confirmation shows QR payloads.

### API routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/events` | List public events |
| `GET` | `/api/events/[id]` | Event + ticket types |
| `POST` | `/api/reservations` | Hold inventory |
| `GET` | `/api/reservations/[id]` | Reservation status |
| `POST` | `/api/checkout` | Create order + payment redirect |
| `GET` | `/api/checkout/[orderId]/status` | Poll payment / tickets |
| `POST` | `/api/webhooks/sham-cash` | Optional signed webhooks (only if `SHAM_CASH_WEBHOOK_SECRET` set) |
| `POST` | `/api/dev/simulate-payment` | Dev-only mock fulfillment |
| `POST` | `/api/orders/lookup` | Confirmation (orderId + phone) |

## Deployment (Phase 1)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Vercel, staging/production env separation, Sham Cash webhook URL, and `/api/ready` deployment checks.

**Staging testing:** [docs/STAGING-TESTS.md](docs/STAGING-TESTS.md) · `npm run staging:audit` · [docs/API-AUDIT-STAGING.md](docs/API-AUDIT-STAGING.md)

- `env/staging.env.example` → Vercel **Preview**
- `env/production.env.example` → Vercel **Production**
- Payment provider: `services/sham-cash/` (`mock-adapter` | `live-adapter`)

### Regenerate database types (after schema changes)

```bash
npx supabase gen types typescript --project-id <project-id> > types/database.generated.ts
```
