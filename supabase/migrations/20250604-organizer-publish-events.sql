-- Organizers publish their own events (no admin approval).
-- Admin approval remains for organizer accounts (users.organizer_status).

CREATE OR REPLACE FUNCTION enforce_event_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending_approval') THEN
      RAISE EXCEPTION 'New events must start as draft or pending_approval';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'pending_approval', 'active', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid transition from draft';
  END IF;

  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF is_service_role() THEN
      RETURN NEW;
    END IF;

    v_uid := current_user_id();

    IF current_user_role() = 'organizer' AND NEW.organizer_id = v_uid THEN
      IF NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
        RAISE EXCEPTION 'organizer-published events must not set approved_by or approved_at';
      END IF;
      RETURN NEW;
    END IF;

    IF current_user_role() = 'admin' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'only the owning organizer, admin, or service role can activate events';
  END IF;

  IF OLD.status IN ('completed', 'cancelled') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Terminal event status cannot change';
  END IF;

  RETURN NEW;
END;
$$;
