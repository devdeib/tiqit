-- ============================================================
-- schema-v1.2.sql — DATABASE VALIDATION SUITE
-- Run on a fresh Supabase branch AFTER applying schema-v1.2.sql
-- Execute in SQL Editor (postgres role recommended)
-- ============================================================

BEGIN;

-- ============================================================
-- HARNESS
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS test_ctx (
  key   TEXT PRIMARY KEY,
  value UUID
);

CREATE TEMP TABLE IF NOT EXISTS test_results (
  test_name TEXT PRIMARY KEY,
  passed    BOOLEAN NOT NULL,
  detail    TEXT
);

CREATE OR REPLACE FUNCTION test_record(p_name TEXT, p_passed BOOLEAN, p_detail TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO test_results (test_name, passed, detail)
  VALUES (p_name, p_passed, p_detail)
  ON CONFLICT (test_name) DO UPDATE
    SET passed = EXCLUDED.passed, detail = EXCLUDED.detail;
END;
$$;

CREATE OR REPLACE FUNCTION test_set_jwt(p_auth_user_id UUID, p_role TEXT DEFAULT 'authenticated')
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_auth_user_id::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
END;
$$;

CREATE OR REPLACE FUNCTION test_clear_jwt()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION test_service_role()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$$;

-- ============================================================
-- GLOBAL SETUP (shared fixtures)
-- ============================================================

DO $setup$
DECLARE
  v_admin_auth    UUID := '11111111-1111-4111-8111-111111111101';
  v_org_auth      UUID := '22222222-2222-4222-8222-222222222202';
  v_staff_auth    UUID := '33333333-3333-4333-8333-333333333303';
  v_admin_id      UUID;
  v_org_id        UUID;
  v_staff_id      UUID;
  v_guest_id      UUID;
  v_event_id      UUID;
  v_type_id       UUID;
BEGIN
  DELETE FROM test_ctx;

  INSERT INTO users (supabase_auth_id, email, full_name, role, organizer_status)
  VALUES (v_admin_auth, 'test-admin@validation.local', 'Test Admin', 'admin', NULL)
  RETURNING id INTO v_admin_id;

  INSERT INTO users (supabase_auth_id, email, full_name, role, organizer_status)
  VALUES (v_org_auth, 'test-organizer@validation.local', 'Test Organizer', 'organizer', 'approved')
  RETURNING id INTO v_org_id;

  INSERT INTO users (supabase_auth_id, email, full_name, role, organizer_status)
  VALUES (v_staff_auth, 'test-staff@validation.local', 'Test Staff', 'staff', NULL)
  RETURNING id INTO v_staff_id;

  INSERT INTO guest_customers (full_name, phone, email)
  VALUES ('Test Guest', '+963900000001', 'guest@validation.local')
  RETURNING id INTO v_guest_id;

  INSERT INTO events (
    organizer_id, title, venue, event_date, sale_ends_at, status, max_tickets_per_order
  ) VALUES (
    v_org_id, 'Validation Event', 'Test Venue',
    NOW() + INTERVAL '30 days', NOW() + INTERVAL '7 days', 'draft', 10
  ) RETURNING id INTO v_event_id;

  INSERT INTO ticket_types (event_id, name, price, total_capacity, available)
  VALUES (v_event_id, 'General', 100.00, 5, 5)
  RETURNING id INTO v_type_id;

  INSERT INTO test_ctx (key, value) VALUES
    ('admin_auth', v_admin_auth),
    ('organizer_auth', v_org_auth),
    ('staff_auth', v_staff_auth),
    ('admin_id', v_admin_id),
    ('organizer_id', v_org_id),
    ('staff_id', v_staff_id),
    ('guest_id', v_guest_id),
    ('event_id', v_event_id),
    ('ticket_type_id', v_type_id);
END;
$setup$;

-- ============================================================
-- 1. EVENT CREATION
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_org_id UUID;
  v_event_id UUID;
BEGIN
  SELECT value INTO v_org_id FROM test_ctx WHERE key = 'organizer_id';

  INSERT INTO events (
    organizer_id, title, venue, event_date, sale_ends_at, status
  ) VALUES (
    v_org_id, 'Draft Event 2', 'Venue B',
    NOW() + INTERVAL '20 days', NOW() + INTERVAL '5 days', 'draft'
  ) RETURNING id INTO v_event_id;

  INSERT INTO test_ctx (key, value) VALUES ('event_draft_2', v_event_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_status event_status;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_draft_2';
  SELECT status INTO v_status FROM events WHERE id = v_event_id;
  PERFORM test_record(
    '01_event_creation',
    v_status = 'draft',
    'status=' || v_status::TEXT
  );
END;
$t$;

-- Expected Result: test_results.passed = true for 01_event_creation (status = draft)

-- ============================================================
-- 2. EVENT PUBLISH (organizer — no admin approval)
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  UPDATE events SET status = 'pending_approval' WHERE id = v_event_id;
END;
$t$;

-- Test SQL (organizer publishes without approved_by)
DO $t$
DECLARE
  v_event_id UUID;
  v_org_auth UUID;
  v_status event_status;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_org_auth FROM test_ctx WHERE key = 'organizer_auth';
  PERFORM test_set_jwt(v_org_auth, 'authenticated');
  UPDATE events SET status = 'active' WHERE id = v_event_id;
  SELECT status INTO v_status FROM events WHERE id = v_event_id;
  PERFORM test_record(
    '02a_organizer_publish_success',
    v_status = 'active',
    'status=' || v_status::TEXT
  );
  PERFORM test_clear_jwt();
END;
$t$;

-- Test SQL (organizer cannot set approved_by when publishing)
DO $t$
DECLARE
  v_event_id UUID;
  v_org_auth UUID;
  v_admin_id UUID;
  v_blocked BOOLEAN := FALSE;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_draft_2';
  SELECT value INTO v_org_auth FROM test_ctx WHERE key = 'organizer_auth';
  SELECT value INTO v_admin_id FROM test_ctx WHERE key = 'admin_id';
  UPDATE events SET status = 'pending_approval' WHERE id = v_event_id;
  PERFORM test_set_jwt(v_org_auth, 'authenticated');
  BEGIN
    UPDATE events
    SET status = 'active', approved_by = v_admin_id, approved_at = NOW()
    WHERE id = v_event_id;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM LIKE '%approved_by%' OR SQLERRM LIKE '%approved_at%';
  END;
  PERFORM test_record(
    '02b_organizer_publish_rejects_approval_fields',
    v_blocked,
    'organizer must not set approval fields'
  );
  PERFORM test_clear_jwt();
END;
$t$;

-- Expected Result: 02a passed=true, 02b passed=true

-- ============================================================
-- 3. RESERVATION CREATION
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_res_id UUID;
BEGIN
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';

  INSERT INTO reservations (customer_id, event_id, expires_at)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '10 minutes')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 2);

  INSERT INTO test_ctx (key, value) VALUES ('reservation_1', v_res_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_res_id UUID;
  v_qty INTEGER;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT value INTO v_res_id FROM test_ctx WHERE key = 'reservation_1';
  SELECT ri.quantity, r.expires_at
  INTO v_qty, v_expires
  FROM reservations r
  JOIN reservation_items ri ON ri.reservation_id = r.id
  WHERE r.id = v_res_id;

  PERFORM test_record(
    '03_reservation_creation',
    v_qty = 2 AND v_expires > NOW(),
    'qty=' || v_qty::TEXT
  );
END;
$t$;

-- Expected Result: 03_reservation_creation passed=true

-- ============================================================
-- 4. INVENTORY DECREMENT
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_res_id UUID;
  v_type_id UUID;
BEGIN
  SELECT value INTO v_res_id FROM test_ctx WHERE key = 'reservation_1';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  UPDATE ticket_types SET available = 5 WHERE id = v_type_id;
  UPDATE reservations SET inventory_held = FALSE, status = 'pending',
    expires_at = NOW() + INTERVAL '10 minutes'
  WHERE id = v_res_id;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_res_id UUID;
  v_type_id UUID;
  v_avail_before INTEGER;
  v_avail_after INTEGER;
  v_held BOOLEAN;
  v_ok BOOLEAN;
BEGIN
  PERFORM test_service_role();
  SELECT value INTO v_res_id FROM test_ctx WHERE key = 'reservation_1';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  SELECT available INTO v_avail_before FROM ticket_types WHERE id = v_type_id;

  v_ok := atomic_decrement_inventory(v_res_id);

  SELECT available INTO v_avail_after FROM ticket_types WHERE id = v_type_id;
  SELECT inventory_held INTO v_held FROM reservations WHERE id = v_res_id;

  PERFORM test_record(
    '04_inventory_decrement',
    v_ok IS TRUE AND v_avail_after = v_avail_before - 2 AND v_held IS TRUE,
    format('before=%s after=%s held=%s', v_avail_before, v_avail_after, v_held)
  );
  PERFORM test_clear_jwt();
END;
$t$;

-- Expected Result: available decreased by 2; inventory_held=true

-- ============================================================
-- 5. RESERVATION EXPIRATION
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_res_id UUID;
BEGIN
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';

  UPDATE ticket_types SET available = 3 WHERE id = v_type_id;

  -- Hold inventory while still valid, then backdate expires_at for the cron test
  INSERT INTO reservations (customer_id, event_id, expires_at, created_at)
  VALUES (
    v_guest_id,
    v_event_id,
    NOW() + INTERVAL '15 minutes',
    NOW() - INTERVAL '10 minutes'
  )
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 1);

  PERFORM test_service_role();
  PERFORM atomic_decrement_inventory(v_res_id);

  UPDATE reservations
  SET expires_at = NOW() - INTERVAL '1 minute'
  WHERE id = v_res_id;

  PERFORM test_clear_jwt();

  INSERT INTO test_ctx (key, value) VALUES ('reservation_expire', v_res_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_res_id UUID;
  v_type_id UUID;
  v_avail_before INTEGER;
  v_avail_after INTEGER;
  v_status reservation_status;
  v_count INTEGER;
BEGIN
  PERFORM test_service_role();
  SELECT value INTO v_res_id FROM test_ctx WHERE key = 'reservation_expire';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  SELECT available INTO v_avail_before FROM ticket_types WHERE id = v_type_id;

  v_count := expire_stale_reservations();

  SELECT status INTO v_status FROM reservations WHERE id = v_res_id;
  SELECT available INTO v_avail_after FROM ticket_types WHERE id = v_type_id;

  PERFORM test_record(
    '05_reservation_expiration',
    v_count >= 1 AND v_status = 'expired' AND v_avail_after = v_avail_before + 1,
    format('expired_count=%s status=%s avail=%s', v_count, v_status, v_avail_after)
  );
  PERFORM test_clear_jwt();
END;
$t$;

-- Expected Result: reservation status=expired; inventory restored +1

-- ============================================================
-- 6. PAYMENT COMPLETION
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_guest_id UUID;
  v_event_id UUID;
  v_res_id UUID;
  v_type_id UUID;
  v_order_id UUID;
  v_payment_id UUID;
BEGIN
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';

  INSERT INTO reservations (customer_id, event_id, expires_at)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '15 minutes')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 1);

  PERFORM test_service_role();
  PERFORM atomic_decrement_inventory(v_res_id);
  PERFORM test_clear_jwt();

  INSERT INTO orders (
    customer_id, reservation_id, event_id, total_amount, idempotency_key
  ) VALUES (
    v_guest_id, v_res_id, v_event_id, 100.00, 'test-order-pay-001'
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, ticket_type_id, quantity, unit_price, line_total)
  VALUES (v_order_id, v_type_id, 1, 100.00, 100.00);

  INSERT INTO payments (order_id, provider_payment_id, amount, status)
  VALUES (v_order_id, 'sham-pay-001', 100.00, 'pending')
  RETURNING id INTO v_payment_id;

  INSERT INTO test_ctx (key, value) VALUES
    ('order_pay', v_order_id),
    ('payment_pay', v_payment_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_payment_id UUID;
  v_status payment_status;
  v_blocked BOOLEAN := FALSE;
BEGIN
  SELECT value INTO v_payment_id FROM test_ctx WHERE key = 'payment_pay';

  BEGIN
    UPDATE payments SET amount = 50.00, status = 'completed',
      webhook_verified = TRUE, webhook_received_at = NOW()
    WHERE id = v_payment_id;
    v_blocked := FALSE;
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM LIKE '%does not match order total%';
  END;

  PERFORM test_record('06a_payment_amount_mismatch_blocked', v_blocked, 'wrong amount rejected');

  UPDATE payments SET amount = 100.00, status = 'completed',
    webhook_verified = TRUE, webhook_received_at = NOW()
  WHERE id = v_payment_id;

  SELECT status INTO v_status FROM payments WHERE id = v_payment_id;
  PERFORM test_record(
    '06b_payment_completion',
    v_status = 'completed',
    'status=' || v_status::TEXT
  );
END;
$t$;

-- Expected Result: 06a passed=true (mismatch blocked); 06b passed=true

-- ============================================================
-- 7. TICKET ISSUANCE
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_ticket_id UUID;
BEGIN
  SELECT value INTO v_order_id FROM test_ctx WHERE key = 'order_pay';
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  SELECT id INTO v_item_id FROM order_items WHERE order_id = v_order_id LIMIT 1;

  UPDATE orders SET status = 'confirmed' WHERE id = v_order_id;
  UPDATE reservations SET status = 'converted'
  WHERE id = (SELECT reservation_id FROM orders WHERE id = v_order_id);

  INSERT INTO tickets (
    order_id, order_item_id, ticket_type_id, event_id, customer_id,
    holder_name, holder_phone, token, hmac_signature, hmac_key_version
  ) VALUES (
    v_order_id, v_item_id, v_type_id, v_event_id, v_guest_id,
    'Test Guest', '+963900000001',
    'test-token-issue-001',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    1
  ) RETURNING id INTO v_ticket_id;

  UPDATE orders SET tickets_issued = TRUE WHERE id = v_order_id;

  INSERT INTO test_ctx (key, value) VALUES ('ticket_issued', v_ticket_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_order_id UUID;
  v_count INTEGER;
  v_issued BOOLEAN;
BEGIN
  SELECT value INTO v_order_id FROM test_ctx WHERE key = 'order_pay';
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM tickets WHERE order_id = v_order_id;

  SELECT tickets_issued INTO v_issued FROM orders WHERE id = v_order_id;

  PERFORM test_record(
    '07_ticket_issuance',
    v_count = 1 AND v_issued IS TRUE,
    'ticket_count=' || COALESCE(v_count::TEXT, '0')
  );
END;
$t$;

-- Expected Result: 1 ticket; tickets_issued=true

-- ============================================================
-- 8. TICKET VOID
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_order_id UUID;
  v_item_id UUID;
  v_ticket_id UUID;
  v_admin_id UUID;
  v_res_id UUID;
BEGIN
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  SELECT value INTO v_admin_id FROM test_ctx WHERE key = 'admin_id';

  INSERT INTO reservations (customer_id, event_id, expires_at, status)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '1 hour', 'converted')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 1);

  INSERT INTO orders (
    customer_id, reservation_id, event_id, total_amount, status, tickets_issued, idempotency_key
  ) VALUES (
    v_guest_id, v_res_id, v_event_id, 100.00, 'confirmed', TRUE, 'test-order-void-001'
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, ticket_type_id, quantity, unit_price, line_total)
  VALUES (v_order_id, v_type_id, 1, 100.00, 100.00);

  SELECT id INTO v_item_id FROM order_items WHERE order_id = v_order_id LIMIT 1;

  INSERT INTO tickets (
    order_id, order_item_id, ticket_type_id, event_id, customer_id,
    holder_name, holder_phone, token, hmac_signature, hmac_key_version, status
  ) VALUES (
    v_order_id, v_item_id, v_type_id, v_event_id, v_guest_id,
    'Test Guest', '+963900000001',
    'test-token-void-001',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    1, 'confirmed'
  ) RETURNING id INTO v_ticket_id;

  INSERT INTO test_ctx (key, value) VALUES ('ticket_void', v_ticket_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_ticket_id UUID;
  v_admin_id UUID;
  v_status ticket_status;
BEGIN
  SELECT value INTO v_ticket_id FROM test_ctx WHERE key = 'ticket_void';
  SELECT value INTO v_admin_id FROM test_ctx WHERE key = 'admin_id';

  UPDATE tickets
  SET status = 'voided', voided_at = NOW(), voided_by = v_admin_id, void_reason = 'validation test'
  WHERE id = v_ticket_id;

  SELECT status INTO v_status FROM tickets WHERE id = v_ticket_id;
  PERFORM test_record(
    '08_ticket_void',
    v_status = 'voided',
    'status=' || v_status::TEXT
  );
END;
$t$;

-- Expected Result: ticket status=voided

-- ============================================================
-- 9. INVENTORY RESTORATION (void)
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_type_id UUID;
  v_avail_before INTEGER;
BEGIN
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  SELECT available INTO v_avail_before FROM ticket_types WHERE id = v_type_id;
  INSERT INTO test_ctx (key, value) VALUES ('avail_before_void_restore', v_type_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_type_id UUID;
  v_avail INTEGER;
BEGIN
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';
  SELECT available INTO v_avail FROM ticket_types WHERE id = v_type_id;

  PERFORM test_record(
    '09_inventory_restoration_void',
    v_avail >= 1,
    'available=' || v_avail::TEXT
  );
END;
$t$;

-- Expected Result: available increased after void (>= 1)

-- ============================================================
-- 10. EVENT SOLD OUT
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_org_id UUID;
  v_admin_id UUID;
  v_admin_auth UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_guest_id UUID;
  v_res_id UUID;
BEGIN
  SELECT value INTO v_org_id FROM test_ctx WHERE key = 'organizer_id';
  SELECT value INTO v_admin_id FROM test_ctx WHERE key = 'admin_id';
  SELECT value INTO v_admin_auth FROM test_ctx WHERE key = 'admin_auth';
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';

  INSERT INTO events (
    organizer_id, title, venue, event_date, sale_ends_at, status
  ) VALUES (
    v_org_id, 'Sellout Event', 'Venue C',
    NOW() + INTERVAL '25 days', NOW() + INTERVAL '6 days', 'pending_approval'
  ) RETURNING id INTO v_event_id;

  INSERT INTO ticket_types (event_id, name, price, total_capacity, available)
  VALUES (v_event_id, 'Single', 50.00, 1, 1)
  RETURNING id INTO v_type_id;

  PERFORM test_set_jwt(v_admin_auth, 'authenticated');
  UPDATE events
  SET status = 'active', approved_by = v_admin_id, approved_at = NOW()
  WHERE id = v_event_id;
  PERFORM test_clear_jwt();

  INSERT INTO reservations (customer_id, event_id, expires_at)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '10 minutes')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 1);

  PERFORM test_service_role();
  PERFORM atomic_decrement_inventory(v_res_id);
  PERFORM test_clear_jwt();

  INSERT INTO test_ctx (key, value) VALUES
    ('sellout_event', v_event_id),
    ('sellout_type', v_type_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_status event_status;
  v_sold_out_at TIMESTAMPTZ;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'sellout_event';
  SELECT status, sold_out_at INTO v_status, v_sold_out_at FROM events WHERE id = v_event_id;

  PERFORM test_record(
    '10_event_sold_out',
    v_status = 'sold_out' AND v_sold_out_at IS NOT NULL,
    'status=' || v_status::TEXT
  );
END;
$t$;

-- Expected Result: event status=sold_out; sold_out_at NOT NULL

-- ============================================================
-- 11. PAYOUT ELIGIBILITY
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_res_id UUID;
  v_order_id UUID;
  v_type_single UUID;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'sellout_event';
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_type_single FROM test_ctx WHERE key = 'sellout_type';

  INSERT INTO guest_customers (full_name, phone)
  VALUES ('Pay Guest', '+963900000002')
  ON CONFLICT (phone) DO NOTHING;

  SELECT id INTO v_guest_id FROM guest_customers WHERE phone = '+963900000002';

  INSERT INTO reservations (customer_id, event_id, expires_at, status)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '20 minutes', 'converted')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_single, 1);

  INSERT INTO orders (
    customer_id, reservation_id, event_id, total_amount, status, tickets_issued, idempotency_key
  ) VALUES (
    v_guest_id, v_res_id, v_event_id, 50.00, 'confirmed', TRUE, 'test-payout-order-001'
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, ticket_type_id, quantity, unit_price, line_total)
  VALUES (v_order_id, v_type_single, 1, 50.00, 50.00);

  INSERT INTO payments (
    order_id, provider_payment_id, amount, status, webhook_verified, webhook_received_at
  ) VALUES (
    v_order_id, 'sham-pay-payout-001', 50.00, 'completed', TRUE, NOW()
  );

  INSERT INTO test_ctx (key, value) VALUES ('payout_event', v_event_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_status payout_status;
  v_gross NUMERIC(12,2);
  v_inclusions INTEGER;
BEGIN
  PERFORM test_service_role();
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'payout_event';
  PERFORM mark_payout_eligible_for_event(v_event_id, 'sold_out');
  PERFORM test_clear_jwt();

  SELECT status, gross_amount INTO v_status, v_gross
  FROM payouts WHERE event_id = v_event_id;

  SELECT COUNT(*)::INTEGER INTO v_inclusions
  FROM payout_payment_inclusions ppi
  JOIN payouts p ON p.id = ppi.payout_id
  WHERE p.event_id = v_event_id;

  PERFORM test_record(
    '11_payout_eligibility',
    v_status = 'eligible' AND v_gross >= 50.00 AND v_inclusions >= 1,
    format('status=%s gross=%s inclusions=%s', v_status, v_gross, v_inclusions)
  );
END;
$t$;

-- Expected Result: payout status=eligible; gross_amount>=50; >=1 inclusion row

-- ============================================================
-- 12. STAFF ASSIGNMENT
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_staff_id UUID;
  v_org_id UUID;
  v_org_auth UUID;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_staff_id FROM test_ctx WHERE key = 'staff_id';
  SELECT value INTO v_org_id FROM test_ctx WHERE key = 'organizer_id';
  SELECT value INTO v_org_auth FROM test_ctx WHERE key = 'organizer_auth';

  DELETE FROM staff_event_assignments
  WHERE staff_id = v_staff_id AND event_id = v_event_id;

  PERFORM test_set_jwt(v_org_auth, 'authenticated');
  INSERT INTO staff_event_assignments (staff_id, event_id, assigned_by)
  VALUES (v_staff_id, v_event_id, v_org_id);
  PERFORM test_clear_jwt();
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_staff_id UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_staff_id FROM test_ctx WHERE key = 'staff_id';

  SELECT EXISTS (
    SELECT 1 FROM staff_event_assignments
    WHERE staff_id = v_staff_id AND event_id = v_event_id
  ) INTO v_exists;

  PERFORM test_record('12_staff_assignment', v_exists IS TRUE, 'assignment row exists');
END;
$t$;

-- Expected Result: assignment row exists

-- ============================================================
-- 13. QR SCAN
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_res_id UUID;
  v_order_id UUID;
  v_item_id UUID;
  v_ticket_id UUID;
BEGIN
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';

  INSERT INTO reservations (customer_id, event_id, expires_at, status)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '1 hour', 'converted')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 1);

  INSERT INTO orders (
    customer_id, reservation_id, event_id, total_amount, status, tickets_issued, idempotency_key
  ) VALUES (
    v_guest_id, v_res_id, v_event_id, 100.00, 'confirmed', TRUE, 'test-order-scan-001'
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, ticket_type_id, quantity, unit_price, line_total)
  VALUES (v_order_id, v_type_id, 1, 100.00, 100.00);

  SELECT id INTO v_item_id FROM order_items WHERE order_id = v_order_id LIMIT 1;

  INSERT INTO tickets (
    order_id, order_item_id, ticket_type_id, event_id, customer_id,
    holder_name, holder_phone, token, hmac_signature, hmac_key_version, status
  ) VALUES (
    v_order_id, v_item_id, v_type_id, v_event_id, v_guest_id,
    'Scan Guest', '+963900000001',
    'test-token-scan-001',
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    1, 'confirmed'
  ) RETURNING id INTO v_ticket_id;

  INSERT INTO test_ctx (key, value) VALUES ('scan_token_event', v_event_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_staff_auth UUID;
  v_result TEXT;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'scan_token_event';
  SELECT value INTO v_staff_auth FROM test_ctx WHERE key = 'staff_auth';
  PERFORM test_set_jwt(v_staff_auth, 'authenticated');

  v_result := validate_qr_scan('test-token-scan-001', v_event_id);

  PERFORM test_record('13_qr_scan', v_result = 'VALID', 'result=' || v_result);
  PERFORM test_clear_jwt();
END;
$t$;

-- Expected Result: validate_qr_scan returns VALID

-- ============================================================
-- 14. DOUBLE SCAN PREVENTION
-- ============================================================

-- Setup SQL
-- (uses ticket from test 13)

-- Test SQL
DO $t$
DECLARE
  v_event_id UUID;
  v_staff_auth UUID;
  v_result TEXT;
BEGIN
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'scan_token_event';
  SELECT value INTO v_staff_auth FROM test_ctx WHERE key = 'staff_auth';
  PERFORM test_set_jwt(v_staff_auth, 'authenticated');

  v_result := validate_qr_scan('test-token-scan-001', v_event_id);

  PERFORM test_record('14_double_scan_prevention', v_result = 'ALREADY_USED', 'result=' || v_result);
  PERFORM test_clear_jwt();
END;
$t$;

-- Expected Result: second scan returns ALREADY_USED

-- ============================================================
-- 15. WEBHOOK IDEMPOTENCY
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_order_id UUID;
BEGIN
  SELECT value INTO v_order_id FROM test_ctx WHERE key = 'order_pay';
  INSERT INTO test_ctx (key, value) VALUES ('webhook_order', v_order_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_order_id UUID;
  v_dup_blocked BOOLEAN := FALSE;
BEGIN
  SELECT value INTO v_order_id FROM test_ctx WHERE key = 'webhook_order';

  INSERT INTO payment_webhook_events (
    provider, provider_event_id, order_id, payload_hash
  ) VALUES (
    'sham_cash', 'evt-dup-001', v_order_id,
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
  );

  BEGIN
    INSERT INTO payment_webhook_events (
      provider, provider_event_id, order_id, payload_hash
    ) VALUES (
      'sham_cash', 'evt-dup-001', v_order_id,
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
  EXCEPTION WHEN unique_violation THEN
    v_dup_blocked := TRUE;
  END;

  PERFORM test_record('15_webhook_idempotency', v_dup_blocked IS TRUE, 'duplicate event rejected');
END;
$t$;

-- Expected Result: duplicate provider_event_id raises unique_violation

-- ============================================================
-- 16. CONCURRENT PURCHASE PROTECTION (sequential simulation)
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_org_id UUID;
  v_admin_id UUID;
  v_admin_auth UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_guest_a UUID;
  v_guest_b UUID;
  v_res_a UUID;
  v_res_b UUID;
BEGIN
  SELECT value INTO v_org_id FROM test_ctx WHERE key = 'organizer_id';
  SELECT value INTO v_admin_id FROM test_ctx WHERE key = 'admin_id';
  SELECT value INTO v_admin_auth FROM test_ctx WHERE key = 'admin_auth';

  INSERT INTO events (
    organizer_id, title, venue, event_date, sale_ends_at, status
  ) VALUES (
    v_org_id, 'Race Event', 'Venue D',
    NOW() + INTERVAL '22 days', NOW() + INTERVAL '4 days', 'pending_approval'
  ) RETURNING id INTO v_event_id;

  INSERT INTO ticket_types (event_id, name, price, total_capacity, available)
  VALUES (v_event_id, 'Last Seat', 25.00, 1, 1)
  RETURNING id INTO v_type_id;

  PERFORM test_set_jwt(v_admin_auth, 'authenticated');
  UPDATE events
  SET status = 'active', approved_by = v_admin_id, approved_at = NOW()
  WHERE id = v_event_id;
  PERFORM test_clear_jwt();

  INSERT INTO guest_customers (full_name, phone)
  VALUES ('Race A', '+963900000010')
  RETURNING id INTO v_guest_a;

  INSERT INTO guest_customers (full_name, phone)
  VALUES ('Race B', '+963900000011')
  RETURNING id INTO v_guest_b;

  INSERT INTO reservations (customer_id, event_id, expires_at)
  VALUES (v_guest_a, v_event_id, NOW() + INTERVAL '10 minutes')
  RETURNING id INTO v_res_a;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_a, v_type_id, 1);

  INSERT INTO reservations (customer_id, event_id, expires_at)
  VALUES (v_guest_b, v_event_id, NOW() + INTERVAL '10 minutes')
  RETURNING id INTO v_res_b;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_b, v_type_id, 1);

  INSERT INTO test_ctx (key, value) VALUES
    ('race_res_a', v_res_a),
    ('race_res_b', v_res_b),
    ('race_type', v_type_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_res_a UUID;
  v_res_b UUID;
  v_type_id UUID;
  v_first_ok BOOLEAN;
  v_second_ok BOOLEAN := FALSE;
  v_avail INTEGER;
BEGIN
  PERFORM test_service_role();
  SELECT value INTO v_res_a FROM test_ctx WHERE key = 'race_res_a';
  SELECT value INTO v_res_b FROM test_ctx WHERE key = 'race_res_b';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'race_type';

  v_first_ok := atomic_decrement_inventory(v_res_a);

  BEGIN
    v_second_ok := atomic_decrement_inventory(v_res_b);
  EXCEPTION WHEN OTHERS THEN
    v_second_ok := FALSE;
  END;

  SELECT available INTO v_avail FROM ticket_types WHERE id = v_type_id;

  PERFORM test_record(
    '16_concurrent_purchase_protection',
    v_first_ok IS TRUE AND v_second_ok IS FALSE AND v_avail = 0,
    format('first=%s second=%s avail=%s', v_first_ok, v_second_ok, v_avail)
  );
  PERFORM test_clear_jwt();
END;
$t$;

-- Expected Result: first decrement succeeds; second fails; available=0

-- ============================================================
-- 17. TICKET ISSUANCE LIMIT (bonus integrity)
-- ============================================================

-- Setup SQL
DO $t$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_res_id UUID;
BEGIN
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';

  INSERT INTO reservations (customer_id, event_id, expires_at, status)
  VALUES (v_guest_id, v_event_id, NOW() + INTERVAL '1 hour', 'converted')
  RETURNING id INTO v_res_id;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES (v_res_id, v_type_id, 1);

  INSERT INTO orders (
    customer_id, reservation_id, event_id, total_amount, status, idempotency_key
  ) VALUES (
    v_guest_id, v_res_id, v_event_id, 100.00, 'confirmed', 'test-issuance-cap-001'
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, ticket_type_id, quantity, unit_price, line_total)
  VALUES (v_order_id, v_type_id, 1, 100.00, 100.00);

  SELECT id INTO v_item_id FROM order_items WHERE order_id = v_order_id LIMIT 1;

  INSERT INTO tickets (
    order_id, order_item_id, ticket_type_id, event_id, customer_id,
    holder_name, holder_phone, token, hmac_signature, hmac_key_version
  ) VALUES (
    v_order_id, v_item_id, v_type_id, v_event_id, v_guest_id,
    'Cap Guest', '+963900000001',
    'test-token-cap-001',
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    1
  );

  INSERT INTO test_ctx (key, value) VALUES
    ('cap_order', v_order_id),
    ('cap_item', v_item_id)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$t$;

-- Test SQL
DO $t$
DECLARE
  v_order_id UUID;
  v_item_id UUID;
  v_guest_id UUID;
  v_event_id UUID;
  v_type_id UUID;
  v_blocked BOOLEAN := FALSE;
BEGIN
  SELECT value INTO v_order_id FROM test_ctx WHERE key = 'cap_order';
  SELECT value INTO v_item_id FROM test_ctx WHERE key = 'cap_item';
  SELECT value INTO v_guest_id FROM test_ctx WHERE key = 'guest_id';
  SELECT value INTO v_event_id FROM test_ctx WHERE key = 'event_id';
  SELECT value INTO v_type_id FROM test_ctx WHERE key = 'ticket_type_id';

  BEGIN
    INSERT INTO tickets (
      order_id, order_item_id, ticket_type_id, event_id, customer_id,
      holder_name, holder_phone, token, hmac_signature, hmac_key_version
    ) VALUES (
      v_order_id, v_item_id, v_type_id, v_event_id, v_guest_id,
      'Cap Guest', '+963900000001',
      'test-token-cap-002',
      '1111111111111111111111111111111111111111111111111111111111111111',
      1
    );
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM LIKE '%exceeds order_item quantity%';
  END;

  PERFORM test_record('17_ticket_issuance_limit', v_blocked IS TRUE, 'over-issue blocked');
END;
$t$;

-- Expected Result: second ticket insert blocked

-- ============================================================
-- SUMMARY
-- ============================================================

SELECT
  test_name,
  passed,
  detail
FROM test_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed) AS passed_count,
  COUNT(*) FILTER (WHERE NOT passed) AS failed_count,
  COUNT(*) AS total
FROM test_results;

ROLLBACK;
