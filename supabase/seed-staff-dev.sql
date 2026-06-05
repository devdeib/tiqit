-- Staff account (run after Auth user exists). Organizer must assign staff to events.

/*
INSERT INTO users (
  supabase_auth_id,
  email,
  full_name,
  role,
  is_active
) VALUES (
  'AUTH_USER_UUID_HERE',
  'staff@example.com',
  'Door Staff',
  'staff',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  supabase_auth_id = EXCLUDED.supabase_auth_id,
  role = 'staff',
  organizer_status = NULL,
  is_active = TRUE;

-- Assign to an event (replace UUIDs):
INSERT INTO staff_event_assignments (staff_id, event_id, assigned_by)
VALUES (
  (SELECT id FROM users WHERE email = 'staff@example.com'),
  'EVENT_UUID_HERE',
  (SELECT id FROM users WHERE role = 'organizer' LIMIT 1)
)
ON CONFLICT (staff_id, event_id) DO NOTHING;
*/
