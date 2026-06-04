-- Link a Supabase Auth user to an approved organizer profile (run in SQL Editor).
-- 1. Create the user in Dashboard → Authentication → Users (note the user UUID).
-- 2. Replace placeholders below and run.

/*
INSERT INTO users (
  supabase_auth_id,
  email,
  full_name,
  role,
  organizer_status,
  is_active
) VALUES (
  'AUTH_USER_UUID_HERE',
  'organizer@example.com',
  'Demo Organizer',
  'organizer',
  'approved',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  supabase_auth_id = EXCLUDED.supabase_auth_id,
  organizer_status = 'approved',
  is_active = TRUE;
*/
