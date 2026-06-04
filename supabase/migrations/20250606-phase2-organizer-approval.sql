-- Phase 2: Admin approval for event activation; organizer edit only on draft / pending_approval

-- ---------------------------------------------------------------------------
-- Event status transitions (replaces organizer self-publish from 20250604)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_event_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_approval') THEN
      RAISE EXCEPTION 'New events must start as draft or pending_approval';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'pending_approval', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from draft (use submit for approval)';
  END IF;

  IF OLD.status = 'pending_approval' AND NEW.status NOT IN ('pending_approval', 'draft', 'active', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from pending_approval';
  END IF;

  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF is_service_role() THEN
      RETURN NEW;
    END IF;

    IF current_user_role() = 'admin' THEN
      IF OLD.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'events can only be activated from pending_approval';
      END IF;
      IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL THEN
        RAISE EXCEPTION 'admin activation requires approved_by and approved_at';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'only admin or service role can activate events';
  END IF;

  IF OLD.status IN ('completed', 'cancelled', 'sold_out') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Terminal event status cannot change';
  END IF;

  RETURN NEW;
END;
$$;

-- Organizers may update only draft / pending_approval events
DROP POLICY IF EXISTS events_organizer_update ON events;
CREATE POLICY events_organizer_update ON events
  FOR UPDATE
  USING (
    organizer_id = current_user_id()
    AND current_user_role() = 'organizer'
    AND status IN ('draft', 'pending_approval')
  )
  WITH CHECK (
    organizer_id = current_user_id()
    AND current_user_role() = 'organizer'
    AND status IN ('draft', 'pending_approval')
  );

-- Organizers read ticket types on their events
DROP POLICY IF EXISTS ticket_types_organizer_read ON ticket_types;
CREATE POLICY ticket_types_organizer_read ON ticket_types
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_types.event_id
        AND e.organizer_id = current_user_id()
        AND current_user_role() = 'organizer'
    )
  );

DROP POLICY IF EXISTS ticket_types_organizer_delete ON ticket_types;
CREATE POLICY ticket_types_organizer_delete ON ticket_types
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ticket_types.event_id
        AND e.organizer_id = current_user_id()
        AND e.status IN ('draft', 'pending_approval')
        AND current_user_role() = 'organizer'
    )
  );

-- Organizers list staff users when building assignments
DROP POLICY IF EXISTS users_organizer_read_staff ON users;
CREATE POLICY users_organizer_read_staff ON users
  FOR SELECT
  USING (role = 'staff' AND is_active = TRUE AND current_user_role() = 'organizer');

-- Allow organizers to adjust total_capacity on draft / pending_approval events (available recalculated)
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
         AND current_user_role() = 'organizer' THEN
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
