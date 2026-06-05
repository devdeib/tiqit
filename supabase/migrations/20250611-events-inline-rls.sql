-- Fix events SELECT failures: replace function-based RLS with inline checks.
-- When is_approved_organizer() / current_user_role() cannot execute, ANY events
-- query errors (including admin) because PostgreSQL evaluates all policies.

-- ---------------------------------------------------------------------------
-- Events policies (inline — no helper function EXECUTE required)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_organizer_own ON events;
CREATE POLICY events_organizer_own ON events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.supabase_auth_id = auth.uid()
        AND u.id = events.organizer_id
        AND u.role = 'organizer'
        AND u.organizer_status = 'approved'
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS events_organizer_insert ON events;
CREATE POLICY events_organizer_insert ON events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.supabase_auth_id = auth.uid()
        AND u.id = events.organizer_id
        AND u.role = 'organizer'
        AND u.organizer_status = 'approved'
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS events_organizer_update ON events;
CREATE POLICY events_organizer_update ON events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.supabase_auth_id = auth.uid()
        AND u.id = events.organizer_id
        AND u.role = 'organizer'
        AND u.organizer_status = 'approved'
        AND u.is_active = TRUE
    )
    AND status IN ('draft', 'pending_approval')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.supabase_auth_id = auth.uid()
        AND u.id = events.organizer_id
        AND u.role = 'organizer'
        AND u.organizer_status = 'approved'
        AND u.is_active = TRUE
    )
    AND status IN ('draft', 'pending_approval')
  );

DROP POLICY IF EXISTS events_admin_all ON events;
CREATE POLICY events_admin_all ON events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.supabase_auth_id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.supabase_auth_id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  );

-- Ensure table + helper grants (idempotent)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT ON events TO anon;

CREATE OR REPLACE FUNCTION is_approved_organizer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE supabase_auth_id = auth.uid()
      AND role = 'organizer'
      AND organizer_status = 'approved'
      AND is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION is_approved_organizer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_approved_organizer() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;

-- Ensure pending_approval exists on event_status (Phase 2)
DO $$
BEGIN
  ALTER TYPE event_status ADD VALUE 'pending_approval';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
