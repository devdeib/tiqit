# Phase 3 — Admin portal

## Prerequisites

- Phase 2 migrations applied (`20250606`, `20250607`)
- Run `supabase/migrations/20250608-phase3-admin-portal.sql`
- Admin Auth user + `users` row with `role = admin` (see `supabase/seed-admin-dev.sql`)

## Sign in

`/admin/login` → dashboard at `/admin`

## Features

| Area | Routes |
|------|--------|
| Dashboard | `/admin` |
| Event approval | `/admin/events/pending`, `/admin/events/[id]` |
| Users | `/admin/users` |
| Orders | `/admin/orders/[id]` |
| Webhooks | `/admin/webhooks` |

## Security

- Session auth: `role = admin` + `is_active` (middleware + API handlers)
- Reads use Supabase **anon JWT** + RLS (`users_admin_all`, `events_admin_all`, etc.)
- **Service role** only for: Auth `createUser`, webhook replay fulfillment (`processPaymentWebhook`)
- Mutations: same-origin + `x-tiqit-admin-request: 1` header
- Actions logged in `admin_audit_logs`

## Emergency APIs (unchanged)

`ADMIN_API_SECRET` + `x-admin-api-key` for:

- `GET /api/admin/orders/[orderId]` (service role inspect)
- `POST .../resend-tickets`
- `POST /api/admin/reservations/[id]/release`

Portal session also supports `GET /api/admin/orders/[orderId]` without API key.
