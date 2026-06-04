-- Phase 3: Admin portal — audit logs + RLS for admin reads (no service role in UI)

-- ---------------------------------------------------------------------------
-- Admin audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE admin_audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_admin_created ON admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX idx_admin_audit_logs_entity ON admin_audit_logs(entity_type, entity_id);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_logs_admin_read ON admin_audit_logs
  FOR SELECT
  USING (current_user_role() = 'admin');

CREATE POLICY admin_audit_logs_admin_insert ON admin_audit_logs
  FOR INSERT
  WITH CHECK (current_user_role() = 'admin' AND admin_id = current_user_id());

-- ---------------------------------------------------------------------------
-- Guest / reservation reads for order inspection (admin JWT only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS guest_customers_deny ON guest_customers;
CREATE POLICY guest_customers_admin_read ON guest_customers
  FOR SELECT
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS reservations_deny ON reservations;
CREATE POLICY reservations_admin_read ON reservations
  FOR SELECT
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS reservation_items_deny ON reservation_items;
CREATE POLICY reservation_items_admin_read ON reservation_items
  FOR SELECT
  USING (current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Webhook idempotency log (admin read for replay UI)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payment_webhooks_deny ON payment_webhook_events;
CREATE POLICY payment_webhooks_admin_read ON payment_webhook_events
  FOR SELECT
  USING (current_user_role() = 'admin');
