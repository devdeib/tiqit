-- Fix infinite recursion on events RLS.
--
-- Root cycle (among others):
--   events.events_staff_assigned_read → staff_event_assignments
--   → sea_organizer_manage → events (again)
--
-- Also broken by inline users subqueries in events policies (20250611):
--   events → users (RLS) → policies that re-enter other RLS tables
--
-- Fix: SECURITY DEFINER helpers that read users (or bypass RLS for ownership
-- checks only). Policies must not use inline subqueries on RLS-protected tables.

-- ============================================================================
-- 1. Profile helpers (users table ONLY — no events / assignments)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_user_profile()
RETURNS TABLE (
  id UUID,
  role user_role,
  organizer_status organizer_status,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.role, u.organizer_status, u.is_active
  FROM public.users u
  WHERE u.supabase_auth_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM get_current_user_profile() AS p LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_current_organizer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM get_current_user_profile() AS p
    WHERE p.role = 'organizer'
      AND p.organizer_status = 'approved'
      AND p.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_current_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM get_current_user_profile() AS p
    WHERE p.role = 'admin'
      AND p.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_current_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM get_current_user_profile() AS p
    WHERE p.role = 'staff'
      AND p.is_active = TRUE
  );
$$;

-- Backward-compatible aliases used by triggers / older policies
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_current_user_id();
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role FROM get_current_user_profile() AS p LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_approved_organizer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_current_organizer();
$$;

-- ============================================================================
-- 2. Internal DEFINER ownership helpers (break cross-table RLS cycles)
--    These bypass RLS intentionally; they do not replace get_current_user_*.
-- ============================================================================

CREATE OR REPLACE FUNCTION organizer_owns_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.organizer_id = get_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION staff_assigned_to_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_event_assignments sea
    WHERE sea.event_id = p_event_id
      AND sea.staff_id = get_current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION event_is_editable(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.status IN ('draft', 'pending_approval')
  );
$$;

-- ============================================================================
-- 3. Grants
-- ============================================================================

REVOKE ALL ON FUNCTION get_current_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_current_organizer() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_current_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_current_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_approved_organizer() FROM PUBLIC;
REVOKE ALL ON FUNCTION organizer_owns_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION staff_assigned_to_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION event_is_editable(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_current_user_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_current_organizer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_current_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_current_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_approved_organizer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION organizer_owns_event(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION staff_assigned_to_event(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION event_is_editable(UUID) TO authenticated, service_role;

-- ============================================================================
-- 4. USERS policies
-- ============================================================================

DROP POLICY IF EXISTS users_admin_all ON users;
CREATE POLICY users_admin_all ON users
  FOR ALL
  USING (is_current_admin())
  WITH CHECK (is_current_admin());

DROP POLICY IF EXISTS users_organizer_read_staff ON users;
CREATE POLICY users_organizer_read_staff ON users
  FOR SELECT
  USING (
    is_current_organizer()
    AND role = 'staff'
    AND is_active = TRUE
  );

-- users_select_own unchanged (auth.uid() only — no recursion)

-- ============================================================================
-- 5. EVENTS policies
-- ============================================================================

DROP POLICY IF EXISTS events_organizer_own ON events;
CREATE POLICY events_organizer_own ON events
  FOR SELECT
  USING (
    is_current_organizer()
    AND organizer_id = get_current_user_id()
  );

DROP POLICY IF EXISTS events_organizer_insert ON events;
CREATE POLICY events_organizer_insert ON events
  FOR INSERT
  WITH CHECK (
    is_current_organizer()
    AND organizer_id = get_current_user_id()
  );

DROP POLICY IF EXISTS events_organizer_update ON events;
CREATE POLICY events_organizer_update ON events
  FOR UPDATE
  USING (
    is_current_organizer()
    AND organizer_id = get_current_user_id()
    AND status IN ('draft', 'pending_approval')
  )
  WITH CHECK (
    is_current_organizer()
    AND organizer_id = get_current_user_id()
    AND status IN ('draft', 'pending_approval')
  );

DROP POLICY IF EXISTS events_admin_all ON events;
CREATE POLICY events_admin_all ON events
  FOR ALL
  USING (is_current_admin())
  WITH CHECK (is_current_admin());

DROP POLICY IF EXISTS events_staff_assigned_read ON events;
CREATE POLICY events_staff_assigned_read ON events
  FOR SELECT
  USING (
    is_current_staff()
    AND staff_assigned_to_event(events.id)
  );

-- events_public_read unchanged (status check only — no table joins)

-- ============================================================================
-- 6. TICKET_TYPES policies
-- ============================================================================

DROP POLICY IF EXISTS ticket_types_organizer_read ON ticket_types;
CREATE POLICY ticket_types_organizer_read ON ticket_types
  FOR SELECT
  USING (
    is_current_organizer()
    AND organizer_owns_event(ticket_types.event_id)
  );

DROP POLICY IF EXISTS ticket_types_organizer_insert ON ticket_types;
CREATE POLICY ticket_types_organizer_insert ON ticket_types
  FOR INSERT
  WITH CHECK (
    is_current_organizer()
    AND organizer_owns_event(ticket_types.event_id)
    AND event_is_editable(ticket_types.event_id)
  );

DROP POLICY IF EXISTS ticket_types_organizer_update_metadata ON ticket_types;
CREATE POLICY ticket_types_organizer_update_metadata ON ticket_types
  FOR UPDATE
  USING (
    is_current_organizer()
    AND organizer_owns_event(ticket_types.event_id)
    AND event_is_editable(ticket_types.event_id)
  );

DROP POLICY IF EXISTS ticket_types_organizer_delete ON ticket_types;
CREATE POLICY ticket_types_organizer_delete ON ticket_types
  FOR DELETE
  USING (
    is_current_organizer()
    AND organizer_owns_event(ticket_types.event_id)
    AND event_is_editable(ticket_types.event_id)
  );

DROP POLICY IF EXISTS ticket_types_staff_assigned_read ON ticket_types;
CREATE POLICY ticket_types_staff_assigned_read ON ticket_types
  FOR SELECT
  USING (
    is_current_staff()
    AND staff_assigned_to_event(ticket_types.event_id)
  );

-- ticket_types_public_read + ticket_types_admin_all unchanged

-- ============================================================================
-- 7. STAFF_EVENT_ASSIGNMENTS policies
-- ============================================================================

DROP POLICY IF EXISTS sea_organizer_manage ON staff_event_assignments;
CREATE POLICY sea_organizer_manage ON staff_event_assignments
  FOR ALL
  USING (
    is_current_organizer()
    AND organizer_owns_event(staff_event_assignments.event_id)
  )
  WITH CHECK (
    is_current_organizer()
    AND organizer_owns_event(staff_event_assignments.event_id)
  );

DROP POLICY IF EXISTS sea_staff_read_own ON staff_event_assignments;
CREATE POLICY sea_staff_read_own ON staff_event_assignments
  FOR SELECT
  USING (staff_id = get_current_user_id());

DROP POLICY IF EXISTS sea_admin_all ON staff_event_assignments;
CREATE POLICY sea_admin_all ON staff_event_assignments
  FOR ALL
  USING (is_current_admin())
  WITH CHECK (is_current_admin());
