# Phase 5 — Production Operations & Scale

**Status:** In progress (foundations complete)  
**Prior phases:** Guest checkout, portals, RLS, deployment — complete

---

## Completed in Phase 5

### 1. Production readiness audit

- [x] `docs/PRODUCTION-AUDIT.md` — env, security, deployment, migrations, backups, logging, monitoring

### 2. Real payment architecture preparation

- [x] Provider-agnostic types: `services/payments/types.ts`
- [x] Sham Cash bridge: `services/payments/sham-cash-provider.ts`
- [x] Retry helper: `services/payments/retry.ts`
- [x] Failure recovery mapping: `services/payments/recovery.ts`
- [x] Public exports: `services/payments/index.ts`
- [ ] Live Sham Cash API — **blocked** (no provider API documentation in repo)

Mock provider unchanged and default.

### 3. Observability

- [x] Structured API request logging (`api_request_started` / `api_request_completed`)
- [x] Payment lifecycle logging (`payment_lifecycle` events in checkout + fulfillment)
- [x] Webhook audit logging (existing `payment_webhook` events)
- [x] Production-safe error reporting (`production_error` with redaction)
- [x] Admin audit failures use `reportProductionError` instead of raw `console.error`

### 4. Rate limiting upgrade

- [x] `RateLimitStore` abstraction (`lib/rate-limit/types.ts`)
- [x] In-memory store (default, backward compatible limits)
- [x] KV store placeholder (`lib/rate-limit/kv-store.ts`)
- [x] Env: `RATE_LIMIT_BACKEND`, `RATE_LIMIT_KV_URL`, `RATE_LIMIT_KV_TOKEN`
- [ ] Wire actual Vercel KV / Redis client

### 5. CI/CD

- [x] `.github/workflows/ci.yml` — typecheck, test, build on push/PR

### 6. Database operations

- [x] `supabase/MIGRATION-CHECKLIST.md`
- [x] `lib/migrations/verify.ts` — migration markers
- [x] `/api/ready` includes `schema.migrations` verification

### 7. Developer experience

- [x] `.env.example` at repo root

---

## Files created

| Path | Purpose |
|------|---------|
| `docs/PRODUCTION-AUDIT.md` | Production readiness audit |
| `docs/PHASE5.md` | This document |
| `supabase/MIGRATION-CHECKLIST.md` | Migration order + operator checklist |
| `.github/workflows/ci.yml` | CI pipeline |
| `.env.example` | Local env template |
| `lib/rate-limit/types.ts` | Rate limit store interface |
| `lib/rate-limit/memory-store.ts` | In-memory backend |
| `lib/rate-limit/kv-store.ts` | KV placeholder |
| `lib/rate-limit/index.ts` | Public rate limit API |
| `lib/observability/request-log.ts` | API request logs |
| `lib/observability/payment-log.ts` | Payment lifecycle logs |
| `lib/observability/error-report.ts` | Sanitized error reporting |
| `lib/migrations/verify.ts` | Migration verification |
| `services/payments/types.ts` | Payment provider types |
| `services/payments/sham-cash-provider.ts` | Sham Cash bridge |
| `services/payments/retry.ts` | Provider retry policy |
| `services/payments/recovery.ts` | Guest recovery mapping |
| `services/payments/index.ts` | Payment module exports |

## Files changed

| Path | Change |
|------|--------|
| `lib/api/handler.ts` | Request logging + production error reporting |
| `lib/api/request-context.ts` | HTTP method on context |
| `lib/env.ts` | Optional ops env vars in schema |
| `services/checkout.service.ts` | Payment lifecycle logs |
| `services/fulfillment.service.ts` | Payment lifecycle logs |
| `services/health.ts` | Migration verification in ready check |
| `services/admin/audit.service.ts` | Structured error reporting |

## Files removed

| Path | Reason |
|------|--------|
| `lib/rate-limit.ts` | Replaced by `lib/rate-limit/` module |

## Migrations created

**None** — Phase 5 is ops/code only; no schema changes.

---

## Remaining blockers

| # | Blocker | Owner |
|---|---------|-------|
| 1 | Sham Cash live API documentation | Business / provider |
| 2 | Implement `live-adapter.ts` + API polling | Engineering (after #1) |
| 3 | Wire Vercel KV / Redis in `kv-store.ts` | Engineering |
| 4 | E2E tests against Supabase branch in CI | Engineering |
| 5 | External APM/alerting integration | Ops |
| 6 | Confirm RLS fix migration on production Supabase | Operator |

---

## Production checklist

### Deploy

- [ ] CI green on `main`
- [ ] Vercel env matches `env/production.env.example`
- [ ] `/api/ready` → `status: ok`

### Security

- [ ] `HMAC_SECRET_V1` rotated from dev value
- [ ] `ALLOW_DEV_PAYMENT=false` for live revenue path
- [ ] `ADMIN_API_SECRET` set
- [ ] Service role key server-only

### Database

- [ ] Migrations per `supabase/MIGRATION-CHECKLIST.md`
- [ ] Supabase PITR enabled
- [ ] `schema.migrations.ok: true` on ready check

### Payments

- [ ] Mock E2E passes on staging
- [ ] Do **not** set `SHAM_CASH_FORCE_LIVE` until live adapter ships

### Observability

- [ ] `LOG_FORMAT=json` on production
- [ ] Monitor `/api/health` uptime
- [ ] Review Vercel logs for `production_error` events

---

## Recommended next work (Phase 5b / Phase 6)

1. Implement Sham Cash live session + polling when API docs available
2. Connect Vercel KV to `createKvRateLimitStore()`
3. Add Playwright/Cypress E2E in CI with Supabase branch
4. Payouts & ledger UI (schema exists)
5. Security headers in `next.config.ts`
