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

### Regenerate database types (after schema changes)

```bash
npx supabase gen types typescript --project-id <project-id> > types/database.generated.ts
```
