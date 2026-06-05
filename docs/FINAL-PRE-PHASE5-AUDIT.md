# Final Pre–Phase 5 Integration Audit

**Date:** 2026-06-05  
**Scope:** Phases 1–4 complete. No new features. Static + architectural review.

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Readiness score** | **82 / 100** (mock payments, RLS fix applied) |
| **Production-ready (guest checkout)** | Conditional — mock path yes; live payments no |
| **Production-ready (portals)** | Conditional — requires `20250610-fix-rls-recursion.sql` on Supabase |
| **Recommended next phase** | **Phase 5: Operations & scale** (see bottom) |

---

## 1. Guest flow (Phase 1)

### Path audited

```
/events → reserve → /checkout/[reservationId] → POST /api/checkout
  → mock redirect /checkout/mock-pay → POST /api/dev/simulate-payment
  → processPaymentWebhook → fulfill_payment_webhook RPC
  → tickets issued → /orders/[orderId]/confirmation (poll + lookup)
```

### Findings

| Step | Implementation | Verdict |
|------|----------------|---------|
| Reservation | `services/reservations.service.ts` — service role, `atomic_decrement_inventory` | Pass |
| Checkout | `services/checkout.service.ts` — idempotency, reservation guards | Pass |
| Payment | Mock by default (`SHAM_CASH_FORCE_LIVE` required for live) | Pass (mock) |
| Fulfillment | `fulfill_payment_webhook` — idempotent, inventory guard | Pass |
| Ticket issuance | HMAC + token in `fulfillment.service` / RPC | Pass |
| Confirmation | Phone ownership via `assertGuestOwnsOrder`, session phone | Pass |

### Guest security model

- Guest has **no Supabase Auth**; checkout uses **service role** server-side only.
- RLS denies direct client access to `reservations`, `orders`, `payments`, `tickets`.
- Appropriate for Phase 1; guest identity = phone + order lookup.

### Gaps (non-blocking for mock)

- No rate limiting on confirmation lookup beyond global IP limits.
- Confirmation shows QR **payload text**, not rendered QR image (product gap, not security).
- Live Sham Cash adapter incomplete (`live-adapter.ts` / polling).

---

## 2. Ticket system

### HMAC generation

| Item | Location | Verdict |
|------|----------|---------|
| Token | `generateTicketToken()` — 32-byte hex | Pass |
| Signature | `signTicketToken()` — HMAC-SHA256 `version:token` | Pass |
| Secret | `HMAC_SECRET_V1` env (≥16 chars prod warning) | Pass |
| DB metadata | `hmac_key_versions`, `tickets.hmac_key_version` | Pass |

### QR payload

Format: `v{version}:{token}:{signature}` via `buildQrPayload()`.

Confirmation page displays payload; staff scanner parses via `parseQrInput()`.

### Staff validation flow

```
POST /api/staff/scan
  → parseQrInput + verifyTicketToken (app layer)
  → validate_qr_scan RPC (DB source of truth)
  → ticket_scan_events audit row
```

| Check | Mechanism | Verdict |
|-------|-----------|---------|
| HMAC | App before RPC | Pass |
| Assignment | RPC + `assertStaffAssignedToEvent` | Pass |
| Atomic update | Single `UPDATE tickets` in RPC | Pass |
| No direct ticket UPDATE from app | RLS deny write on tickets | Pass |

### Duplicate scan protection

- RPC: first scan `confirmed → used`; second returns `ALREADY_USED`.
- `ticket_scan_events` records each attempt.
- Mapped to `already_used` in `services/staff/scan-logic.ts`.

### Wrong event

- RPC compares `tickets.event_id` vs `p_event_id` → `WRONG_EVENT`.

---

## 3. Roles & isolation

### Role matrix

| Role | Auth | Middleware | DB access |
|------|------|------------|-----------|
| **Guest** | None | Public routes | Service role APIs only |
| **Organizer** | Supabase JWT | `/organizer`, `/api/organizer` — approved + active | RLS `is_current_organizer()` + ownership |
| **Admin** | Supabase JWT | `/admin`, `/api/admin` | RLS `is_current_admin()` + `users_admin_all` |
| **Staff** | Supabase JWT | `/staff`, `/api/staff` — active staff | Assigned events only + scan RPC |

### RLS isolation

| Concern | Status |
|---------|--------|
| Cross-organizer event access | Blocked — `organizer_id = get_current_user_id()` |
| Pending organizer portal | Blocked — `is_current_organizer()` requires `approved` |
| Staff unassigned events | Blocked — `staff_assigned_to_event()` |
| Admin bypass | `is_current_admin()` on admin policies |
| Guest direct DB | Denied policies on sensitive tables |

### RLS recursion (critical — fixed)

**Root cause (resolved in `20250610-fix-rls-recursion.sql`):**

```
events → staff_event_assignments → events (infinite)
```

Plus broken inline `EXISTS (SELECT FROM users)` in deprecated `20250611` migration.

**Fix:** SECURITY DEFINER helpers (`get_current_user_profile`, `is_current_*`, `organizer_owns_event`, `staff_assigned_to_event`) — no inline RLS subqueries on protected tables in events/users/staff policies.

**Action required:** Supabase must have **`20250610-fix-rls-recursion.sql` applied**. Do **not** apply old `20250611` inline content (now no-op in repo).

### Privilege escalation review

| Vector | Mitigation | Residual risk |
|--------|------------|---------------|
| Organizer self-activate event | `enforce_event_status_transition` trigger | Low |
| Pending organizer DB writes | `is_current_organizer()` | Low (after migration) |
| Staff scan without assignment | RPC returns `STAFF_NOT_AUTHORIZED` | Low |
| Service role key leak | Server-only env | **High if leaked** — ops |
| CSRF on portal mutations | Custom headers + same-origin | Medium (XSS) |
| Emergency admin API key | `ADMIN_API_SECRET` optional | Medium |

### Service role usage (by design)

Used only server-side for: guest checkout, fulfillment, public event list, auth user create (admin), webhook replay. **Not** used for organizer/admin/staff reads — pass.

---

## 4. Database

### Base schema

- Reference: `supabase/schema-v1.2.sql`
- Validation suite: `supabase/schema-v1.2-validation.sql`

### Migration order (apply once, in sequence)

| # | File | Purpose |
|---|------|---------|
| 0 | `schema-v1.2.sql` | Base tables, RLS, RPCs |
| 1 | `20250604-organizer-publish-events.sql` | Status transitions (superseded by 20250606) |
| 2 | `20250605-phase1-hardening-fulfillment.sql` | Fulfillment RPC hardening |
| 3 | `20250606-phase2-organizer-approval.sql` | Admin-only event activation |
| 4 | `20250607-phase2-security-hardening.sql` | Approved-organizer RLS |
| 5 | `20250608-phase3-admin-portal.sql` | Admin audit + guest/reservation admin read |
| 6 | `20250609-phase4-staff-scanning.sql` | Staff assigned event read |
| 7 | `20250610-fix-events-rls-helper-grants.sql` | Grants (optional if #8 run) |
| 8 | **`20250610-fix-rls-recursion.sql`** | **Required — fixes recursion** |
| 9 | `20250611-events-inline-rls.sql` | **No-op (superseded)** |

**Note:** Two `20250610-*` files exist; run **both** or at minimum **`fix-rls-recursion`**.

### Schema consistency

| Area | Status |
|------|--------|
| `types/database.ts` vs SQL | Hand-maintained; `admin_audit_logs` present |
| `event_status.pending_approval` | Required for Phase 2 workflow |
| `ticket_scan_events` | In SQL; not in TS types (low impact) |

### Indexes (from schema-v1.2)

Present and adequate for current scale:

- `idx_tickets_status_event`, `idx_tickets_order`
- `idx_staff_assignments_staff_event`
- `idx_orders_event`, `idx_orders_status_issued`
- `idx_reservations_expiry_pending`
- `idx_scan_events_event_time`
- `idx_events_organizer`, `idx_events_sale_ends_active`

**Missing (nice-to-have, not blocking):**

- `events(status)` partial index for `pending_approval` admin queue
- `users(role, organizer_status)` for admin user filters

### Policies still using legacy patterns (outside recursion fix scope)

These use `current_user_role()` or `EXISTS (events …)` but **do not recreate the events↔staff cycle** after recursion fix:

- `orders_organizer_read`, `payments_organizer_read`, `tickets_organizer_read` (20250607)
- `ticket_types_public_read` (joins public events — OK)

Monitor if organizer order pages error; migrate to `organizer_owns_event()` in Phase 5 if needed.

### Unused / superseded artifacts

| Artifact | Status |
|----------|--------|
| `20250611-events-inline-rls.sql` | Superseded — no-op |
| `20250604` organizer self-publish | Overridden by `20250606` |
| Emergency admin API (`x-admin-api-key`) | Still valid for incidents |

---

## 5. Deployment

### Vercel environment (required)

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only |
| `HMAC_SECRET_V1` | Yes (prod) | Ticket signing |
| `APP_URL` | Yes (non-dev) | Must be public HTTPS in production |

### Recommended

| Variable | Purpose |
|----------|---------|
| `APP_ENV` | `staging` / `production` |
| `ADMIN_API_SECRET` | Emergency admin APIs |
| `ALLOW_DEV_PAYMENT` | Mock simulate — disable with live payments |

### Do not set for mock production

| Variable | Notes |
|----------|-------|
| `SHAM_CASH_FORCE_LIVE` | Unless live adapter ready |
| `SHAM_CASH_API_KEY` alone | Ignored in mock mode (warning in `/api/ready`) |

### Supabase environment

- Apply migration chain through **`20250610-fix-rls-recursion.sql`**
- Seed: `platform_config`, `hmac_key_versions` (checked by `/api/ready`)
- Provision users: `seed-organizer-dev.sql`, `seed-admin-dev.sql`, `seed-staff-dev.sql` patterns

### Verification endpoints

```bash
GET /api/health   # connectivity
GET /api/ready    # schema seed + deployment validation + paymentProvider
GET /api/debug/session-check  # after login — events/users probe (dev aid)
```

### Production blockers

| # | Blocker | Severity |
|---|---------|----------|
| 1 | **`20250610-fix-rls-recursion.sql` not applied** | Critical |
| 2 | Live Sham Cash not implemented | High (if taking real money) |
| 3 | No automated E2E test suite in CI | Medium |
| 4 | In-memory rate limits (serverless) | Medium |
| 5 | Manual user/event provisioning | Medium |
| 6 | `ADMIN_API_SECRET` unset | Low (incident response) |

---

## 6. Phase scorecard

| Phase | Score | Notes |
|-------|-------|-------|
| Phase 1 Guest | 90 | Mock path solid; live payments deferred |
| Phase 2 Organizer | 85 | After RLS fix; CSRF + approval workflow |
| Phase 3 Admin | 83 | Portal complete; webhook replay uses service role |
| Phase 4 Staff | 86 | RPC scan + HMAC; camera browser-dependent |
| Cross-cutting security | 78 | RLS fixed; service role concentration |
| Ops / deployment | 75 | Ready checks exist; no CI E2E |

**Overall readiness: 82 / 100**

---

## 7. Critical fix applied in this audit

- **`20250611-events-inline-rls.sql`** neutralized to no-op in repo so migration runners cannot re-break RLS.

**Operator action still required:** Run `20250610-fix-rls-recursion.sql` on Supabase if not already applied.

---

## 8. Recommended Phase 5

**Theme: Operations, revenue, and hardening**

Priority order:

1. **Migration verification tooling** — `/api/ready` check for `get_current_user_profile` / recursion fix functions
2. **Live payments** — Sham Cash polling/webhook completion, staging E2E
3. **Payouts & ledger UI** — organizer/admin (schema exists, UI missing)
4. **Observability** — structured scan/checkout metrics, alert on stuck payments
5. **CI integration tests** — guest checkout + scan RPC against Supabase branch
6. **Distributed rate limiting** — Vercel KV / Redis
7. **Policy cleanup** — migrate remaining `EXISTS (events)` organizer policies to `organizer_owns_event()`

---

## 9. Pre-launch checklist

- [ ] `schema-v1.2.sql` + migrations through `20250610-fix-rls-recursion.sql` applied
- [ ] `20250611` no-op run or skipped (never apply old inline content)
- [ ] `HMAC_SECRET_V1` set on Vercel production
- [ ] `APP_URL` = public HTTPS URL
- [ ] `/api/ready` → `status: ok`, `paymentProvider: mock`
- [ ] E2E: guest purchase → confirmation QR payload
- [ ] E2E: organizer draft → submit → admin approve → public listing
- [ ] E2E: staff scan valid / duplicate / wrong event
- [ ] Admin + organizer dashboards load events (no 502)

---

## 10. Sign-off

Phases 1–4 form a **coherent integrated system** with clear separation: guests via service APIs, privileged roles via JWT + RLS, tickets via HMAC + RPC scan.

**Proceed to Phase 5** after confirming RLS recursion fix is live on Supabase and mock checkout E2E passes on staging.
