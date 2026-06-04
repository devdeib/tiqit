# Phase 2 — Organizer portal

## Schema audit (pre-code)

See migration `supabase/migrations/20250606-phase2-organizer-approval.sql` for RLS/trigger changes.

### Existing tables

| Table | Organizer use |
|-------|----------------|
| `users` | `role`, `organizer_status`, `supabase_auth_id` — auth profile |
| `events` | CRUD (draft / pending_approval only for writes) |
| `ticket_types` | CRUD while event editable |
| `staff_event_assignments` | Assign staff to events |
| `orders` / `order_items` / `payments` / `tickets` | Read-only sales |
| `payouts` / `ledger` | RLS read for organizer (not in UI yet) |

### Workflow

- Organizer: `draft` → `pending_approval` (submit)
- Admin: `pending_approval` → `active` (sets `approved_by`, `approved_at`)
- Organizer **cannot** set `active` or edit active events

### Auth setup

1. Run migration `20250606-phase2-organizer-approval.sql`
2. Create Auth user in Supabase
3. Run `supabase/seed-organizer-dev.sql` pattern to insert `users` row
4. Run `supabase/migrations/20250607-phase2-security-hardening.sql`
5. Sign in at `/login`

## Security hardening

- DB: `is_approved_organizer()` on all organizer RLS policies
- Middleware: `/organizer` + `/api/organizer` require approved organizer profile
- Mutations: same-origin + header `x-tiqit-organizer-request: 1` (via `organizerFetch`)
