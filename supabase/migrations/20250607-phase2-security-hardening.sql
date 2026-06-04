-- Phase 2 security: approved-organizer gate on RLS + inventory trigger

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

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_organizer_own ON events;
CREATE POLICY events_organizer_own ON events
  FOR SELECT
  USING (is_approved_organizer() AND organizer_id = current_user_id());

DROP POLICY IF EXISTS events_organizer_insert ON events;
CREATE POLICY events_organizer_insert ON events
  FOR INSERT
  WITH CHECK (is_approved_organizer() AND organizer_id = current_user_id());

DROP POLICY IF EXISTS events_organizer_update ON events;
CREATE POLICY events_organizer_update ON events
  FOR UPDATE
  USING (
    is_approved_organizer()
    AND organizer_id = current_user_id()
    AND status IN ('draft', 'pending_approval')
  )
  WITH CHECK (
    is_approved_organizer()
    AND organizer_id = current_user_id()
    AND status IN ('draft', 'pending_approval')
  );

-- ---------------------------------------------------------------------------
-- Ticket types
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ticket_types_organizer_read ON ticket_types;
CREATE POLICY ticket_types_organizer_read ON ticket_types
  FOR SELECT
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_types.event_id
        AND e.organizer_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS ticket_types_organizer_insert ON ticket_types;
CREATE POLICY ticket_types_organizer_insert ON ticket_types
  FOR INSERT
  WITH CHECK (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_types.event_id
        AND e.organizer_id = current_user_id()
        AND e.status IN ('draft', 'pending_approval')
    )
  );

DROP POLICY IF EXISTS ticket_types_organizer_update_metadata ON ticket_types;
CREATE POLICY ticket_types_organizer_update_metadata ON ticket_types
  FOR UPDATE
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_types.event_id
        AND e.organizer_id = current_user_id()
        AND e.status IN ('draft', 'pending_approval')
    )
  );

DROP POLICY IF EXISTS ticket_types_organizer_delete ON ticket_types;
CREATE POLICY ticket_types_organizer_delete ON ticket_types
  FOR DELETE
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_types.event_id
        AND e.organizer_id = current_user_id()
        AND e.status IN ('draft', 'pending_approval')
    )
  );

-- ---------------------------------------------------------------------------
-- Orders / payments / tickets (read)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS orders_organizer_read ON orders;
CREATE POLICY orders_organizer_read ON orders
  FOR SELECT
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = orders.event_id
        AND e.organizer_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS order_items_organizer_read ON order_items;
CREATE POLICY order_items_organizer_read ON order_items
  FOR SELECT
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM orders o
      JOIN events e ON e.id = o.event_id
      WHERE o.id = order_items.order_id
        AND e.organizer_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS payments_organizer_read ON payments;
CREATE POLICY payments_organizer_read ON payments
  FOR SELECT
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM orders o
      JOIN events e ON e.id = o.event_id
      WHERE o.id = payments.order_id
        AND e.organizer_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS tickets_organizer_read ON tickets;
CREATE POLICY tickets_organizer_read ON tickets
  FOR SELECT
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = tickets.event_id
        AND e.organizer_id = current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Staff assignments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sea_organizer_manage ON staff_event_assignments;
CREATE POLICY sea_organizer_manage ON staff_event_assignments
  FOR ALL
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = staff_event_assignments.event_id
        AND e.organizer_id = current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Payouts / ledger
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS payouts_organizer_read ON payouts;
CREATE POLICY payouts_organizer_read ON payouts
  FOR SELECT
  USING (is_approved_organizer() AND organizer_id = current_user_id());

DROP POLICY IF EXISTS ledger_organizer_read ON ledger;
CREATE POLICY ledger_organizer_read ON ledger
  FOR SELECT
  USING (is_approved_organizer() AND organizer_id = current_user_id());

DROP POLICY IF EXISTS payout_inclusions_organizer_read ON payout_payment_inclusions;
CREATE POLICY payout_inclusions_organizer_read ON payout_payment_inclusions
  FOR SELECT
  USING (
    is_approved_organizer()
    AND EXISTS (
      SELECT 1 FROM payouts p
      WHERE p.id = payout_payment_inclusions.payout_id
        AND p.organizer_id = current_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Staff directory for assignment UI
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_organizer_read_staff ON users;
CREATE POLICY users_organizer_read_staff ON users
  FOR SELECT
  USING (is_approved_organizer() AND role = 'staff' AND is_active = TRUE);

-- ---------------------------------------------------------------------------
-- Inventory trigger (approved organizer only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_ticket_type_inventory_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_event_status event_status;
  v_sold INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.available IS DISTINCT FROM OLD.available THEN
      IF NOT is_service_role()
         AND current_setting('app.bypass_inventory_guard', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'available is system-managed';
      END IF;
    END IF;

    IF NEW.total_capacity IS DISTINCT FROM OLD.total_capacity THEN
      IF is_service_role()
         OR current_setting('app.bypass_inventory_guard', true) = 'on' THEN
        RETURN NEW;
      END IF;

      SELECT e.status INTO v_event_status
      FROM events e
      WHERE e.id = NEW.event_id;

      IF v_event_status IN ('draft', 'pending_approval')
         AND is_approved_organizer() THEN
        v_sold := OLD.total_capacity - OLD.available;
        IF NEW.total_capacity < v_sold THEN
          RAISE EXCEPTION 'total_capacity cannot be less than sold or held inventory';
        END IF;
        NEW.available := NEW.total_capacity - v_sold;
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'total_capacity is system-managed for this event status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
