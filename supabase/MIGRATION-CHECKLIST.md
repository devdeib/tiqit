# Supabase migration checklist

Apply migrations **once**, in order, on each environment (staging → production).

## Prerequisites

1. Run base schema: `supabase/schema-v1.2.sql`
2. Seed dev data if needed: `supabase/seed-dev.sql`, role-specific seeds
3. Confirm `platform_config` and `hmac_key_versions` rows exist

## Migration order

| # | File | Purpose |
|---|------|---------|
| 0 | `schema-v1.2.sql` | Base tables, RLS, core RPCs |
| 1 | `20250604-organizer-publish-events.sql` | Event status transitions (superseded by #3) |
| 2 | `20250605-phase1-hardening-fulfillment.sql` | Fulfillment RPC hardening |
| 3 | `20250606-phase2-organizer-approval.sql` | Admin-only event activation |
| 4 | `20250607-phase2-security-hardening.sql` | Approved-organizer RLS |
| 5 | `20250608-phase3-admin-portal.sql` | `admin_audit_logs` |
| 6 | `20250609-phase4-staff-scanning.sql` | Staff assigned-event read policies |
| 7 | `20250610-fix-events-rls-helper-grants.sql` | Helper function grants |
| 8 | **`20250610-fix-rls-recursion.sql`** | **Required** — fixes events RLS recursion |
| 9 | `20250611-events-inline-rls.sql` | No-op (superseded by #8) |

## Operator checklist

- [ ] All files applied in order on staging
- [ ] `GET /api/ready` → `schema.migrations.ok: true`
- [ ] Organizer `/organizer` loads events (no 502)
- [ ] Admin pending events page loads
- [ ] Staff scan RPC works (`validate_qr_scan`)
- [ ] Same migration set applied to production
- [ ] Backup taken before production migration

## Verification

`GET /api/ready` checks:

- `platform_config.default_commission_rate`
- `hmac_key_versions` current row
- `admin_audit_logs` table (Phase 3)
- `validate_qr_scan` RPC (Phase 4 + RLS fix)

## Missing migration symptoms

| Symptom | Likely missing migration |
|---------|--------------------------|
| Organizer/admin events 502 | `20250610-fix-rls-recursion.sql` |
| Admin audit insert fails | `20250608-phase3-admin-portal.sql` |
| Staff scan RPC missing | Base schema or Phase 4 |
| Fulfillment idempotency errors | `20250605-phase1-hardening-fulfillment.sql` |

## Do not apply

- Old content of `20250611-events-inline-rls.sql` (reintroduces RLS recursion). Current file is a no-op.

## Backups

- Enable Supabase Point-in-Time Recovery on production projects
- Export schema + critical tables before major migrations
- Document rollback: re-apply previous known-good migration set only with DBA review
