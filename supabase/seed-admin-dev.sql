-- Link a Supabase Auth user to an admin profile (run in SQL Editor).
-- 1. Create user in Dashboard → Authentication → Users (note UUID).
-- 2. Replace placeholders and run.

/*
INSERT INTO users (
  supabase_auth_id,
  email,
  full_name,
  role,
  is_active
) VALUES (
  'AUTH_USER_UUID_HERE',
  'admin@example.com',
  'Platform Admin',
  'admin',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  supabase_auth_id = EXCLUDED.supabase_auth_id,
  role = 'admin',
  organizer_status = NULL,
  is_active = TRUE;
*/
