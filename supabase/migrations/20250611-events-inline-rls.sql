-- SUPERSEDED — DO NOT USE
--
-- This migration was replaced by 20250610-fix-rls-recursion.sql.
-- Applying it reintroduces infinite RLS recursion on events
-- (inline users subqueries + staff_event_assignments ↔ events cycle).
--
-- Intentionally a no-op. Safe to run on databases that already applied the old content.

DO $$ BEGIN
  RAISE NOTICE '20250611-events-inline-rls.sql is superseded by 20250610-fix-rls-recursion.sql — no changes applied.';
END $$;
