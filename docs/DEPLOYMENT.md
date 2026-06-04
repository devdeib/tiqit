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
| `SHAM_CASH_MOCK` | Server | `true` → mock adapter (local/staging). **Must be `false` or unset in production** |
| `SHAM_CASH_API_KEY` | **Secret** | Live adapter; required in production |
| `SHAM_CASH_WEBHOOK_SECRET` | **Secret** | Webhook HMAC; required in production |
| `SHAM_CASH_API_BASE_URL` | Server | Live API base (implement in `live-adapter.ts`) |

**Adapter selection** (`services/sham-cash/`):

- `mock` — `MockShamCashAdapter`: mock pay page + relaxed webhook verify on dev/staging
- `live` — `LiveShamCashAdapter`: requires API key + webhook secret; `createSession` stub until API mapped

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

## Webhook (production)

**Endpoint (canonical):**

```http
POST https://YOUR_APP_URL/api/webhooks/sham-cash
Content-Type: application/json
x-sham-cash-signature: <sha256 hex of rawBody + SHAM_CASH_WEBHOOK_SECRET>
```

**Readiness**

- Production rejects requests if `SHAM_CASH_WEBHOOK_SECRET` is missing or `SHAM_CASH_MOCK=true`.
- Signature verified with constant-time compare (`services/sham-cash/signature.ts`).
- `order_id` in the body is validated against the payment row (not trusted alone).
- `GET` returns `405` with endpoint metadata (connectivity probes only).

**Sham Cash dashboard**

Register the production URL above. Do not point production webhooks at Preview URLs unless testing with staging secrets.

**Optional:** Supabase Edge `edge-functions/sham-cash-webhook` proxies to `APP_URL` — prefer the Vercel route when the app is hosted on Vercel.

## Staging vs production checklist

| Check | Staging | Production |
|-------|---------|------------|
| Supabase project | Staging | Production |
| `APP_ENV` | `staging` (optional) | `production` |
| `SHAM_CASH_MOCK` | `true` OK | **must not be `true`** |
| `SHAM_CASH_WEBHOOK_SECRET` | Recommended | **Required** |
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
