# Phase 4 — Staff scanning

## Prerequisites

- `schema-v1.2` + Phase 1–3 migrations
- Run `supabase/migrations/20250609-phase4-staff-scanning.sql`
- Staff Auth user + `users.role = staff` + `staff_event_assignments` row

See `supabase/seed-staff-dev.sql`.

## Routes

| Route | Purpose |
|-------|---------|
| `/staff/login` | Staff sign in |
| `/staff` | Assigned events list |
| `/staff/events/[id]/scan` | QR scanner + manual entry |
| `/staff/events/[id]/stats` | Total / scanned / remaining |

## APIs

| Method | Path |
|--------|------|
| GET | `/api/staff/events` |
| GET | `/api/staff/events/[eventId]/stats` |
| POST | `/api/staff/scan` `{ eventId, qrToken }` |

## Scan flow

1. Parse QR (`v1:token:signature`) or raw token (verified against DB `hmac_signature`)
2. Verify HMAC in app layer
3. `validate_qr_scan` RPC (atomic ticket update + audit row)
4. Return outcome: `valid` | `already_used` | `invalid` | `wrong_event` | `voided`

## Security

- Staff JWT + RLS (no service role on reads)
- Assignment check in app + RPC
- No direct `UPDATE tickets` from app
- CSRF header `x-tiqit-staff-request: 1` on POST

## Tests

```bash
npm run test
```

Includes scan result mapping and QR parse tests. Full RPC behavior validated in `supabase/schema-v1.2-validation.sql`.
