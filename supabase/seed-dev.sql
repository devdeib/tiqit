-- ============================================================
-- Dev seed — one active event for local guest checkout
--
-- HOW TO RUN (Supabase Dashboard → SQL Editor):
--   1. Open ONLY this file in your editor — do not paste error messages.
--   2. Copy from the line below through the end of the DO block.
--   3. Run, then run the two SELECT "Verify" queries at the bottom.
--
-- PREREQUISITE: run supabase/migrations/20250604-organizer-publish-events.sql
-- once if your DB still requires admin to activate events.
-- ============================================================

DO $seed$
DECLARE
  v_org_auth   UUID := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  v_org_id     UUID;
  v_event_id   UUID;
  v_now        TIMESTAMPTZ := NOW();
  v_status     event_status;
BEGIN
  SELECT id INTO v_org_id FROM users WHERE email = 'dev-organizer@tiqit.local';
  IF v_org_id IS NULL THEN
    INSERT INTO users (supabase_auth_id, email, full_name, role, organizer_status)
    VALUES (v_org_auth, 'dev-organizer@tiqit.local', 'Dev Organizer', 'organizer', 'approved')
    RETURNING id INTO v_org_id;
  END IF;

  SELECT id INTO v_event_id FROM events WHERE title = 'Demo Concert — Damascus';
  IF v_event_id IS NULL THEN
    INSERT INTO events (
      organizer_id,
      title,
      description,
      venue,
      event_date,
      sale_ends_at,
      status,
      max_tickets_per_order
    ) VALUES (
      v_org_id,
      'Demo Concert — Damascus',
      'Sample event for local Phase 1 testing.',
      'City Hall',
      v_now + INTERVAL '30 days',
      v_now + INTERVAL '25 days',
      'draft',
      10
    )
    RETURNING id INTO v_event_id;

    INSERT INTO ticket_types (event_id, name, description, price, total_capacity, available)
    VALUES
      (v_event_id, 'General Admission', 'Standard entry', 50000.00, 100, 100),
      (v_event_id, 'VIP', 'Front section', 120000.00, 20, 20);
  END IF;

  SELECT status INTO v_status FROM events WHERE id = v_event_id;

  IF v_status IN ('draft', 'pending_approval') THEN
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    UPDATE events SET status = 'active' WHERE id = v_event_id;
    PERFORM set_config('request.jwt.claim.role', '', true);
  END IF;
END;
$seed$;

-- Verify
SELECT id, title, status FROM events WHERE title = 'Demo Concert — Damascus';

SELECT name, price, available FROM ticket_types
WHERE event_id = (SELECT id FROM events WHERE title = 'Demo Concert — Damascus');
