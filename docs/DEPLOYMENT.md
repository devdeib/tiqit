# Deployment guide (Phase 1)

Guest checkout on **Vercel** + **Supabase** with optional **Sham Cash** payments.

## Architecture

| Environment | Vercel target | Supabase project | Payments |
|-------------|---------------|------------------|----------|
| **Local** | — | Dev / staging DB | `SHAM_CASH_MOCK=true` |
| **Staging** | Preview (`VERCEL_ENV=preview`) | Staging project | Mock recommended |
| **Production** | Production | Production project | Live adapter + webhook secret |

Set `APP_ENV` explicitly when Vercel’s defaults are not enough (`APP_ENV=staging` on a Production-like preview domain).

**Logical env resolution**

1. `APP_ENV` if set (`development` | `staging` | `production`)
2. Else `VERCEL_ENV`: `production` → production, `preview` → staging
3. Else `development`

## Prerequisites

1. Apply SQL on each Supabase project (in order):
   - `supabase/schema-v1.2.sql`
   - `supabase/migrations/20250604-organizer-publish-events.sql`
   - `supabase/migrations/20250605-phase1-hardening-fulfillment.sql`
2. Run `supabase/seed-dev.sql` on **staging only** (not production) if you need demo events.
3. Seed `hmac_key_versions` and `platform_config` (included in schema).

## Environment variables

### Required (all environments)

| Variable | Exposure | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key (RLS; Phase 1 APIs use service role server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Service role — server only |

### Required for ticket fulfillment

| Variable | Exposure | Description |
|----------|----------|-------------|
| `HMAC_SECRET_V1` | **Secret** | ≥16 chars; signs QR tokens |

### Required for deployed redirects / webhooks

| Variable | Exposure | Description |
|----------|----------|-------------|
| `APP_URL` | Server | Canonical HTTPS origin, e.g. `https://app.example.com` |
| | | On Vercel, `VERCEL_URL` is used if `APP_URL` is unset (preview URLs change per deploy — set `APP_URL` for stable webhooks) |

### Payment provider (Sham Cash adapter)

| Variable | Exposure | Description |
|----------|----------|-------------|
| `SHAM_CASH_MOCK` | Server | `true` → mock adapter (optional; mock is already the default) |
| `SHAM_CASH_FORCE_LIVE` | Server | `true` + `SHAM_CASH_API_KEY` → live adapter (Phase 2+; not for Phase 1) |
| `SHAM_CASH_API_KEY` | **Secret** | Ignored unless `SHAM_CASH_FORCE_LIVE=true` |
| `SHAM_CASH_WEBHOOK_SECRET` | **Secret** | Optional — only if Sham Cash provides signed webhooks (uncommon) |
| `SHAM_CASH_API_BASE_URL` | Server | Live API base (implement in `live-adapter.ts`) |

**Adapter selection** (`services/sham-cash/`):

- `mock` — `MockShamCashAdapter`: mock pay page + relaxed webhook verify on dev/staging
- `live` — `LiveShamCashAdapter`: only when `SHAM_CASH_FORCE_LIVE=true` and `SHAM_CASH_API_KEY` is set (not implemented for Phase 1).

### Environment label

| Variable | Description |
|----------|-------------|
| `APP_ENV` | Override: `development` \| `staging` \| `production` |

### Dangerous (do not enable in production)

| Variable | Description |
|----------|-------------|
| `ALLOW_DEV_PAYMENT` | Enables `POST /api/dev/simulate-payment` when `APP_ENV=production` |

### Vercel system (automatic)

| Variable | Description |
|----------|-------------|
| `VERCEL_ENV` | `production` \| `preview` \| `development` |
| `VERCEL_URL` | Hostname for preview deployments |

## Vercel setup

1. Import the Git repository.
2. Framework preset: **Next.js** (see `vercel.json`).
3. Create **two Supabase projects** (staging + production) — do not share service role keys.
4. Configure environment variables:
   - **Production** ← `env/production.env.example`
   - **Preview** ← `env/staging.env.example`
5. Set **Production** branch to `main` (or your release branch).
6. Deploy.

### Post-deploy checks

```bash
curl -sS https://YOUR_APP_URL/api/health
curl -sS https://YOUR_APP_URL/api/ready
```

`/api/ready` includes `deployment.errors` / `deployment.warnings` and `deployment.paymentProvider` (`mock` | `live`).

## Payment confirmation (Sham Cash)

Most Sham Cash integrations provide **only an API key** (no webhook URL or signing secret).

| Mode | When | How orders become `confirmed` |
|------|------|--------------------------------|
| `mock` | `SHAM_CASH_MOCK=true` or no API key on staging | `/api/dev/simulate-payment` or mock pay page |
| `api_poll` | Production + `SHAM_CASH_API_KEY`, no webhook secret | Poll Sham Cash with the API key after redirect (implement in `live-adapter.ts`; wire from checkout status / return URL) |
| `webhook` | `SHAM_CASH_WEBHOOK_SECRET` set | `POST /api/webhooks/sham-cash` with `x-sham-cash-signature` |

`/api/ready` reports `deployment.paymentConfirmation` (`mock` \| `api_poll` \| `webhook`).

### Optional webhooks

Only if Sham Cash gives you a callback URL and signing secret:

```http
POST https://YOUR_APP_URL/api/webhooks/sham-cash
x-sham-cash-signature: <sha256 hex of rawBody + SHAM_CASH_WEBHOOK_SECRET>
```

Without `SHAM_CASH_WEBHOOK_SECRET`, that route returns **503** (by design).

**Optional:** Supabase Edge `edge-functions/sham-cash-webhook` proxies to the Next.js route — only useful when webhooks are enabled.

## Staging vs production checklist

| Check | Staging | Production |
|-------|---------|------------|
| Supabase project | Staging | Production |
| `APP_ENV` | `staging` (optional) | `production` |
| `SHAM_CASH_MOCK` | Optional | Optional (mock is default) |
| `SHAM_CASH_FORCE_LIVE` | **must be unset/false** | **must be unset/false** until live adapter ships |
| `SHAM_CASH_WEBHOOK_SECRET` | Optional | Optional (only if provider sends webhooks) |
| `HMAC_SECRET_V1` | Required for E2E | **Required** |
| `ALLOW_DEV_PAYMENT` | Optional | **false / unset** |
| Demo seed SQL | OK | **Do not run** |

## Local development

```bash
cp .env.example .env.local
# fill Supabase + HMAC_SECRET_V1
npm install
npm run dev
```

Use `SHAM_CASH_MOCK=true` and `/checkout/mock-pay` for payments without Sham Cash credentials.

## Staging readiness

1. Set `ADMIN_API_SECRET` (≥16 chars) on Vercel Preview.
2. Run `APP_URL=https://your-staging-url npm run staging:audit`.
3. Execute manual flows in **[STAGING-TESTS.md](./STAGING-TESTS.md)**.
4. Review **[API-AUDIT-STAGING.md](./API-AUDIT-STAGING.md)** for route/auth matrix.
