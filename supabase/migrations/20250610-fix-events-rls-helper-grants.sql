-- Fix events RLS helper functions (missing function or EXECUTE breaks ALL events SELECT)

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

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users
  WHERE supabase_auth_id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users
  WHERE supabase_auth_id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION is_approved_organizer() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION is_approved_organizer() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;

-- Supabase expects authenticated role to have table privileges (RLS still applies)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
