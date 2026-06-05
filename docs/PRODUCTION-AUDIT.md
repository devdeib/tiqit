# Production Readiness Audit

**Date:** 2026-06-05  
**Scope:** Phases 1–4 deployed stack + Phase 5 ops foundations  
**Environment:** Next.js 15 on Vercel, Supabase PostgreSQL

---

## Executive summary

| Area | Status | Notes |
|------|--------|-------|
| Guest checkout (mock) | Ready | Service-role APIs, idempotent fulfillment |
| Ticket / QR / scan | Ready | HMAC + `validate_qr_scan` RPC |
| Portals (organizer/admin/staff) | Conditional | Requires RLS recursion fix migration |
| Live payments | **Not ready** | Live adapter stub; mock default |
| Rate limiting | Partial | In-memory per instance; KV abstraction added |
| CI/CD | Added | GitHub Actions typecheck/test/build |
| Observability | Improved | Structured logs, payment lifecycle, `/api/ready` migration checks |
| Backups | Operator | Supabase PITR recommended; not automated in repo |

**Overall production posture:** Safe for **mock-payment** staging/production. Live revenue requires Sham Cash API documentation + adapter completion.

---

## 1. Environment variables

### Required (all environments)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + middleware auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server guest checkout, fulfillment |

### Required for ticket issuance

| Variable | Purpose |
|----------|---------|
| `HMAC_SECRET_V1` | QR signing (≥16 chars; error in production if missing) |

### Required for redirects / webhooks

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Public HTTPS URL (production/staging) |

### Payment (mock default)

| Variable | Default behavior |
|----------|------------------|
| `SHAM_CASH_MOCK` | Optional; mock when unset |
| `SHAM_CASH_FORCE_LIVE` | Must be `true` + API key for live |
| `SHAM_CASH_API_KEY` | Ignored unless force live |
| `SHAM_CASH_WEBHOOK_SECRET` | Optional signed webhooks |
| `SHAM_CASH_API_BASE_URL` | Reserved for live adapter |
| `ALLOW_DEV_PAYMENT` | Mock simulate route; disable in prod live |

### Operations (Phase 5)

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `development` / `staging` / `production` |
| `LOG_FORMAT` | `json` or `pretty` |
| `ADMIN_API_SECRET` | Emergency admin API key |
| `RATE_LIMIT_BACKEND` | `memory` (default) or `kv` |
| `RATE_LIMIT_KV_URL` / `RATE_LIMIT_KV_TOKEN` | Future distributed limits |

Reference files: `lib/env.ts`, `.env.example`, `env/production.env.example`, `env/staging.env.example`.

---

## 2. Security risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Service role key leak | Critical | Server-only; rotate if exposed |
| `HMAC_SECRET_V1` leak | Critical | Rotate key version in DB + env |
| In-memory rate limits | Medium | Set `RATE_LIMIT_BACKEND=kv` when KV wired |
| Auth error URL sharing | Fixed | Flash cookie/sessionStorage (no `?error=` in URL) |
| RLS recursion if wrong migration | Critical | Apply `20250610-fix-rls-recursion.sql` |
| `ALLOW_DEV_PAYMENT` on production | Medium | Disable when live payments enabled |
| CSRF on portal writes | Low | Custom headers + same-origin |
| Admin emergency API | Low | `ADMIN_API_SECRET` optional |

---

## 3. Deployment configuration

### Vercel

- Region: `fra1` (`vercel.json`)
- Build: `npm run build`
- Webhook routes: `Cache-Control: no-store`
- Login pages: statically prerendered shell; auth is client-side

### Readiness endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Env + Supabase connectivity |
| `GET /api/ready` | Schema seed, migrations, deployment validation, payment mode |

### Gaps

- `next.config.ts` has no security headers (CSP, HSTS) — add when policy defined
- No automated staging audit in CI (manual `npm run staging:audit`)

---

## 4. Database migrations

See `supabase/MIGRATION-CHECKLIST.md` for full ordering.

**Critical:** `20250610-fix-rls-recursion.sql` must be applied before organizer/admin portals work reliably.

**Verification:** `GET /api/ready` → `schema.migrations.ok` and `schema.migrations.missing[]`.

---

## 5. Backups

| Item | Recommendation |
|------|----------------|
| Supabase PITR | Enable on production |
| Pre-migration snapshot | Manual export or branch DB |
| Secrets | Store in Vercel env; never commit |
| Audit logs | `admin_audit_logs` + structured app logs |

Repo does not automate backups — operator responsibility.

---

## 6. Logging

### Structured logger (`lib/logger.ts`)

- JSON in staging/production/preview or when `LOG_FORMAT=json`
- Fields: `ts`, `level`, `msg`, `service`, context

### Phase 5 additions

| Event | Source |
|-------|--------|
| `api_request_started` / `api_request_completed` | `lib/observability/request-log.ts` |
| `payment_lifecycle` | `lib/observability/payment-log.ts` |
| `payment_webhook` | `lib/webhook-log.ts` |
| `production_error` | `lib/observability/error-report.ts` (sanitized) |

Correlation: `x-request-id` on API responses.

---

## 7. Monitoring

### Current

- Vercel deployment logs (stdout JSON)
- Supabase dashboard (DB, auth, API)
- `/api/ready` for synthetic checks

### Recommended (not implemented)

- Uptime monitor on `/api/health` and `/api/ready`
- Alert on `production_error` log rate
- Alert on stuck `payments.status = pending` > N minutes
- Supabase log drain to observability vendor

---

## 8. Payment architecture status

| Component | Status |
|-----------|--------|
| Mock Sham Cash | Working |
| Webhook fulfillment | Working (when secret configured) |
| Live `createSession` | Stub (503) |
| API polling | Not implemented |
| Provider interface | `services/payments/*` (Phase 5) |
| Retry helper | `withProviderRetry()` prepared |
| Recovery mapping | `resolvePaymentRecoveryPlan()` prepared |

---

## 9. Rate limiting

- Presets unchanged (`RATE_LIMITS` in `lib/rate-limit/index.ts`)
- Backend: in-memory default; `RATE_LIMIT_BACKEND=kv` selects KV placeholder (falls back to memory until client wired)

---

## 10. CI/CD

GitHub Actions workflow: `.github/workflows/ci.yml`

On push/PR to `main`/`master`:

1. `npm run typecheck`
2. `npm test`
3. `npm run build` (with CI placeholder Supabase env)

---

## 11. Pre-launch checklist

- [ ] Migrations through `20250610-fix-rls-recursion.sql` applied
- [ ] `/api/ready` status `ok`
- [ ] `HMAC_SECRET_V1` set on production
- [ ] `APP_URL` = public HTTPS
- [ ] `ALLOW_DEV_PAYMENT=false` on production (or accept mock-only)
- [ ] `SHAM_CASH_FORCE_LIVE` unset until live adapter ready
- [ ] E2E: guest checkout → tickets → staff scan
- [ ] E2E: organizer → admin approve → public listing
- [ ] Supabase PITR enabled
- [ ] `ADMIN_API_SECRET` set for incidents

---

## 12. Remaining blockers for live revenue

1. Sham Cash live API mapping (`live-adapter.ts`)
2. API polling path for API-key-only setups
3. Distributed rate limiting (KV client)
4. E2E integration tests against Supabase branch
5. External error tracking (Sentry/Datadog) optional
