-- ============================================================
-- TICKETING PLATFORM — PRODUCTION SCHEMA
-- Version: 1.2.0
-- Target: Supabase PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('organizer', 'admin', 'staff');
CREATE TYPE organizer_status AS ENUM ('pending', 'approved', 'suspended');
CREATE TYPE event_status AS ENUM (
  'draft', 'pending_approval', 'active', 'sold_out', 'completed', 'cancelled'
);
CREATE TYPE reservation_status AS ENUM ('pending', 'expired', 'converted');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE ticket_status AS ENUM ('confirmed', 'used', 'voided');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE payout_status AS ENUM (
  'held', 'eligible', 'scheduled', 'processing', 'completed', 'failed'
);
CREATE TYPE ledger_event_type AS ENUM (
  'payment_received', 'commission_deducted', 'payout_scheduled',
  'payout_completed', 'ticket_voided', 'event_cancelled'
);
CREATE TYPE payout_trigger_reason AS ENUM ('sold_out', 'sale_ended');

-- ============================================================
-- PLATFORM CONFIG (immutable rate at payout creation)
-- ============================================================

CREATE TABLE platform_config (
  key         TEXT        PRIMARY KEY,
  value_text  TEXT,
  value_num   NUMERIC(12,4),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_config (key, value_num)
VALUES ('default_commission_rate', 0.0500);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_auth_id UUID        NOT NULL UNIQUE,
  email            TEXT        NOT NULL UNIQUE,
  full_name        TEXT        NOT NULL,
  phone            TEXT        CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  role             user_role   NOT NULL,
  organizer_status organizer_status,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organizer_status_scoped CHECK (
    (role = 'organizer' AND organizer_status IS NOT NULL) OR
    (role <> 'organizer' AND organizer_status IS NULL)
  )
);

-- ============================================================
-- GUEST CUSTOMERS
-- ============================================================

CREATE TABLE guest_customers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phone_e164 CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT phone_unique UNIQUE (phone)
);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE events (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id          UUID         NOT NULL REFERENCES users(id),
  title                 TEXT         NOT NULL,
  description           TEXT,
  venue                 TEXT         NOT NULL,
  event_date            TIMESTAMPTZ  NOT NULL,
  sale_ends_at          TIMESTAMPTZ  NOT NULL,
  status                event_status NOT NULL DEFAULT 'draft',
  max_tickets_per_order INTEGER      NOT NULL DEFAULT 10,
  refund_policy_note    TEXT,
  approved_by           UUID         REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  sold_out_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT sale_ends_before_event   CHECK (sale_ends_at <= event_date),
  CONSTRAINT positive_max_tickets     CHECK (max_tickets_per_order > 0),
  CONSTRAINT approved_fields_together CHECK (
    (approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
    (approved_by IS NULL AND approved_at IS NULL)
  ),
  CONSTRAINT sold_out_requires_timestamp CHECK (
    (status = 'sold_out' AND sold_out_at IS NOT NULL) OR (status <> 'sold_out')
  )
);

-- ============================================================
-- TICKET TYPES
-- ============================================================

CREATE TABLE ticket_types (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID          NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  name           TEXT          NOT NULL,
  description    TEXT,
  price          NUMERIC(12,2) NOT NULL,
  total_capacity INTEGER       NOT NULL,
  available      INTEGER       NOT NULL,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_type_per_event   UNIQUE (event_id, name),
  CONSTRAINT positive_price          CHECK (price >= 0),
  CONSTRAINT positive_capacity       CHECK (total_capacity > 0),
  CONSTRAINT available_within_bounds CHECK (available >= 0 AND available <= total_capacity)
);

-- ============================================================
-- HMAC KEY VERSIONS (metadata only; secrets live in env/Vault)
-- ============================================================

CREATE TABLE hmac_key_versions (
  version    INTEGER     PRIMARY KEY,
  is_current BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  CONSTRAINT retired_after_created CHECK (
    retired_at IS NULL OR retired_at >= created_at
  )
);

-- ============================================================
-- STAFF ASSIGNMENTS
-- ============================================================

CREATE TABLE staff_event_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assigned_by UUID        NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, event_id)
);

-- ============================================================
-- RESERVATIONS
-- ============================================================

CREATE TABLE reservations (
  id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID               NOT NULL REFERENCES guest_customers(id),
  event_id           UUID               NOT NULL REFERENCES events(id),
  status             reservation_status NOT NULL DEFAULT 'pending',
  expires_at         TIMESTAMPTZ        NOT NULL,
  inventory_held     BOOLEAN            NOT NULL DEFAULT FALSE,
  inventory_held_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT pending_requires_expiry CHECK (
    status <> 'pending' OR expires_at > created_at
  )
);

CREATE TABLE reservation_items (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID    NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  ticket_type_id UUID    NOT NULL REFERENCES ticket_types(id),
  quantity       INTEGER NOT NULL,
  UNIQUE (reservation_id, ticket_type_id),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID         NOT NULL REFERENCES guest_customers(id),
  reservation_id  UUID         NOT NULL UNIQUE REFERENCES reservations(id),
  event_id        UUID         NOT NULL REFERENCES events(id),
  total_amount    NUMERIC(12,2) NOT NULL,
  status          order_status NOT NULL DEFAULT 'pending',
  tickets_issued  BOOLEAN      NOT NULL DEFAULT FALSE,
  idempotency_key TEXT         NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_total CHECK (total_amount > 0)
);

CREATE TABLE order_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID          NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  ticket_type_id UUID          NOT NULL REFERENCES ticket_types(id),
  quantity       INTEGER       NOT NULL,
  unit_price     NUMERIC(12,2) NOT NULL,
  line_total     NUMERIC(12,2) NOT NULL,
  UNIQUE (order_id, ticket_type_id),
  CONSTRAINT positive_quantity   CHECK (quantity > 0),
  CONSTRAINT positive_unit_price CHECK (unit_price >= 0),
  CONSTRAINT line_total_correct  CHECK (ABS((quantity * unit_price) - line_total) < 0.01)
);

-- ============================================================
-- PAYMENTS & WEBHOOK IDEMPOTENCY
-- ============================================================

CREATE TABLE payments (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID           NOT NULL REFERENCES orders(id),
  provider            TEXT           NOT NULL DEFAULT 'sham_cash',
  provider_payment_id TEXT           NOT NULL,
  amount              NUMERIC(12,2)  NOT NULL,
  currency            TEXT           NOT NULL DEFAULT 'SYP',
  status              payment_status NOT NULL DEFAULT 'pending',
  webhook_verified    BOOLEAN        NOT NULL DEFAULT FALSE,
  webhook_received_at TIMESTAMPTZ,
  raw_webhook_payload JSONB,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_amount CHECK (amount > 0),
  CONSTRAINT webhook_fields_consistent CHECK (
    (webhook_verified = TRUE AND webhook_received_at IS NOT NULL) OR
    (webhook_verified = FALSE)
  ),
  CONSTRAINT provider_payment_id_unique UNIQUE (provider_payment_id)
);

-- One successful payment per order (retries update same row via provider id)
CREATE UNIQUE INDEX idx_payments_one_completed_per_order
  ON payments(order_id)
  WHERE status = 'completed';

CREATE TABLE payment_webhook_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            TEXT        NOT NULL DEFAULT 'sham_cash',
  provider_event_id   TEXT        NOT NULL,
  provider_payment_id TEXT,
  order_id            UUID        REFERENCES orders(id),
  payload_hash        CHAR(64)    NOT NULL,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_webhook_events_provider_event_unique
    UNIQUE (provider, provider_event_id)
);

-- ============================================================
-- TICKETS & SCAN AUDIT
-- ============================================================

CREATE TABLE tickets (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID          NOT NULL REFERENCES orders(id),
  order_item_id    UUID          NOT NULL REFERENCES order_items(id),
  ticket_type_id   UUID          NOT NULL REFERENCES ticket_types(id),
  event_id         UUID          NOT NULL REFERENCES events(id),
  customer_id      UUID          NOT NULL REFERENCES guest_customers(id),
  holder_name      TEXT          NOT NULL,
  holder_phone     TEXT          NOT NULL CHECK (holder_phone ~ '^\+[1-9][0-9]{7,14}$'),
  token            TEXT          NOT NULL,
  hmac_signature   CHAR(64)      NOT NULL CHECK (hmac_signature ~ '^[0-9a-f]{64}$'),
  hmac_key_version INTEGER       NOT NULL REFERENCES hmac_key_versions(version),
  qr_image_url     TEXT,
  status           ticket_status NOT NULL DEFAULT 'confirmed',
  scanned_at       TIMESTAMPTZ,
  scanned_by       UUID          REFERENCES users(id),
  voided_at        TIMESTAMPTZ,
  voided_by        UUID          REFERENCES users(id),
  void_reason      TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT tickets_token_unique UNIQUE (token),
  CONSTRAINT scan_fields_consistent CHECK (
    (status = 'used' AND scanned_at IS NOT NULL AND scanned_by IS NOT NULL) OR
    (status <> 'used')
  ),
  CONSTRAINT void_fields_consistent CHECK (
    (status = 'voided' AND voided_at IS NOT NULL AND voided_by IS NOT NULL) OR
    (status <> 'voided')
  )
);

CREATE TABLE ticket_scan_events (
  id           BIGSERIAL   PRIMARY KEY,
  ticket_id    UUID        REFERENCES tickets(id),
  token        TEXT        NOT NULL,
  event_id     UUID        NOT NULL REFERENCES events(id),
  staff_id     UUID        NOT NULL REFERENCES users(id),
  result       TEXT        NOT NULL,
  scanned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYOUTS
-- ============================================================

CREATE TABLE payouts (
  id                UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id      UUID                  NOT NULL REFERENCES users(id),
  event_id          UUID                  NOT NULL UNIQUE REFERENCES events(id),
  trigger_reason    payout_trigger_reason NOT NULL,
  gross_amount      NUMERIC(12,2)         NOT NULL,
  commission_rate   NUMERIC(5,4)          NOT NULL DEFAULT 0.0500,
  commission_amount NUMERIC(12,2)         NOT NULL,
  net_amount        NUMERIC(12,2)         NOT NULL,
  status            payout_status         NOT NULL DEFAULT 'held',
  eligible_at       TIMESTAMPTZ,
  initiated_by      UUID                  REFERENCES users(id),
  provider_tx_id    TEXT,
  scheduled_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_gross_when_set CHECK (
    status = 'held' OR gross_amount > 0
  ),
  CONSTRAINT valid_commission_rate CHECK (commission_rate > 0 AND commission_rate < 1),
  CONSTRAINT commission_math       CHECK (ABS((gross_amount * commission_rate) - commission_amount) < 0.01),
  CONSTRAINT net_math              CHECK (ABS((gross_amount - commission_amount) - net_amount) < 0.01),
  CONSTRAINT eligible_at_when_eligible CHECK (
    status NOT IN ('eligible', 'scheduled', 'processing', 'completed') OR eligible_at IS NOT NULL
  )
);

CREATE TABLE payout_payment_inclusions (
  payout_id  UUID NOT NULL REFERENCES payouts(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  PRIMARY KEY (payout_id, payment_id),
  CONSTRAINT payout_payment_inclusions_payment_unique UNIQUE (payment_id)
);

-- ============================================================
-- LEDGER
-- ============================================================

CREATE TABLE ledger (
  id              BIGSERIAL         PRIMARY KEY,
  event_type      ledger_event_type NOT NULL,
  amount          NUMERIC(12,2)     NOT NULL,
  reference_id    UUID              NOT NULL,
  reference_table TEXT              NOT NULL,
  organizer_id    UUID              REFERENCES users(id),
  customer_id     UUID              REFERENCES guest_customers(id),
  event_id        UUID              REFERENCES events(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT ledger_idempotency UNIQUE (event_type, reference_id, reference_table)
);

-- ============================================================
-- HELPER: SECURITY DEFINER CONTEXT
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
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

CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true)
  ) = 'service_role';
$$;

CREATE OR REPLACE FUNCTION adjust_ticket_type_available(
  p_ticket_type_id UUID,
  p_delta INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_inventory_guard', 'on', true);
  UPDATE ticket_types
  SET available = LEAST(total_capacity, GREATEST(0, available + p_delta)),
      updated_at = NOW()
  WHERE id = p_ticket_type_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_type % not found', p_ticket_type_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION set_reservation_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + INTERVAL '10 minutes';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- INTEGRITY TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_ledger_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows are immutable';
END;
$$;

CREATE OR REPLACE FUNCTION enforce_ticket_non_transferable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.customer_id <> OLD.customer_id OR NEW.holder_name <> OLD.holder_name
     OR NEW.holder_phone <> OLD.holder_phone OR NEW.token <> OLD.token
     OR NEW.hmac_signature <> OLD.hmac_signature OR NEW.hmac_key_version <> OLD.hmac_key_version THEN
    RAISE EXCEPTION 'Ticket ownership and QR material are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_staff_role_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role user_role;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = NEW.staff_id;
  IF v_role IS DISTINCT FROM 'staff' THEN
    RAISE EXCEPTION 'Only staff users can be assigned to events';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_organizer_on_event()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_role user_role; v_status organizer_status;
BEGIN
  SELECT role, organizer_status INTO v_role, v_status FROM users WHERE id = NEW.organizer_id;
  IF v_role <> 'organizer' OR v_status <> 'approved' THEN
    RAISE EXCEPTION 'organizer_id must be an approved organizer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_event_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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

    IF current_user_role() = 'organizer' AND NEW.organizer_id = current_user_id() THEN
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

CREATE OR REPLACE FUNCTION prevent_ticket_type_inventory_tamper()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.available IS DISTINCT FROM OLD.available
       OR NEW.total_capacity IS DISTINCT FROM OLD.total_capacity THEN
      IF NOT is_service_role()
         AND current_setting('app.bypass_inventory_guard', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'available and total_capacity are system-managed';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_ticket_type_insert_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_event_status event_status;
BEGIN
  SELECT e.status INTO v_event_status FROM events e WHERE e.id = NEW.event_id;

  IF v_event_status NOT IN ('draft', 'pending_approval') THEN
    IF NOT is_service_role()
       AND current_setting('app.bypass_inventory_guard', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'ticket types for active events can only be created by the system';
    END IF;
  ELSIF NOT is_service_role()
        AND current_setting('app.bypass_inventory_guard', true) IS DISTINCT FROM 'on' THEN
    IF NEW.available IS DISTINCT FROM NEW.total_capacity THEN
      RAISE EXCEPTION 'new ticket types must start with available = total_capacity';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_order_item_matches_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_reservation_id UUID;
  v_res_qty INTEGER;
BEGIN
  SELECT o.reservation_id INTO v_reservation_id
  FROM orders o WHERE o.id = NEW.order_id;

  IF v_reservation_id IS NULL THEN
    RAISE EXCEPTION 'order % has no reservation', NEW.order_id;
  END IF;

  SELECT ri.quantity INTO v_res_qty
  FROM reservation_items ri
  WHERE ri.reservation_id = v_reservation_id
    AND ri.ticket_type_id = NEW.ticket_type_id;

  IF v_res_qty IS NULL THEN
    RAISE EXCEPTION 'order item ticket_type not in reservation';
  END IF;

  IF v_res_qty IS DISTINCT FROM NEW.quantity THEN
    RAISE EXCEPTION 'order item quantity must match reservation (expected %)', v_res_qty;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_payment_amount_matches_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_order_total NUMERIC(12,2);
BEGIN
  IF NEW.status = 'completed' OR NEW.webhook_verified = TRUE THEN
    SELECT total_amount INTO v_order_total FROM orders WHERE id = NEW.order_id;
    IF v_order_total IS NULL THEN
      RAISE EXCEPTION 'payment references missing order %', NEW.order_id;
    END IF;
    IF ABS(NEW.amount - v_order_total) >= 0.01 THEN
      RAISE EXCEPTION 'payment amount % does not match order total %', NEW.amount, v_order_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_ticket_issuance_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed INTEGER;
  v_issued INTEGER;
BEGIN
  SELECT oi.quantity INTO v_allowed FROM order_items oi WHERE oi.id = NEW.order_item_id;
  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'order_item % not found', NEW.order_item_id;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_issued
  FROM tickets t
  WHERE t.order_item_id = NEW.order_item_id;

  IF v_issued > v_allowed THEN
    RAISE EXCEPTION 'ticket count % exceeds order_item quantity %', v_issued, v_allowed;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_one_current_hmac_key()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE hmac_key_versions
    SET is_current = FALSE, retired_at = COALESCE(retired_at, NOW())
    WHERE version <> NEW.version AND is_current = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_reservation_item_event_match()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_res_event UUID; v_type_event UUID;
BEGIN
  SELECT event_id INTO v_res_event FROM reservations WHERE id = NEW.reservation_id;
  SELECT event_id INTO v_type_event FROM ticket_types WHERE id = NEW.ticket_type_id;
  IF v_res_event IS DISTINCT FROM v_type_event THEN
    RAISE EXCEPTION 'ticket_type does not belong to reservation event';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_max_tickets_per_order()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_event_id UUID;
  v_max INTEGER;
  v_total INTEGER;
  v_parent_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'reservation_items' THEN
    v_parent_id := NEW.reservation_id;
    SELECT r.event_id INTO v_event_id FROM reservations r WHERE r.id = v_parent_id;
    SELECT COALESCE(SUM(ri.quantity), 0) INTO v_total
    FROM reservation_items ri
    WHERE ri.reservation_id = v_parent_id AND ri.id IS DISTINCT FROM NEW.id;
  ELSE
    v_parent_id := NEW.order_id;
    SELECT o.event_id INTO v_event_id FROM orders o WHERE o.id = v_parent_id;
    SELECT COALESCE(SUM(oi.quantity), 0) INTO v_total
    FROM order_items oi
    WHERE oi.order_id = v_parent_id AND oi.id IS DISTINCT FROM NEW.id;
  END IF;

  SELECT max_tickets_per_order INTO v_max FROM events WHERE id = v_event_id;
  IF (v_total + NEW.quantity) > v_max THEN
    RAISE EXCEPTION 'Exceeds max_tickets_per_order (%)', v_max;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION truncate_webhook_payload()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.raw_webhook_payload IS NOT NULL
     AND octet_length(NEW.raw_webhook_payload::TEXT) > 65536 THEN
    RAISE EXCEPTION 'Webhook payload exceeds 64KB';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- INVENTORY & RESERVATIONS
-- ============================================================

CREATE OR REPLACE FUNCTION atomic_decrement_inventory(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res reservations%ROWTYPE;
  v_item RECORD;
BEGIN
  SELECT * INTO v_res
  FROM reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation % not found', p_reservation_id;
  END IF;

  IF v_res.status <> 'pending' THEN
    RAISE EXCEPTION 'reservation % is not pending (status=%)', p_reservation_id, v_res.status;
  END IF;

  IF v_res.expires_at <= NOW() THEN
    RAISE EXCEPTION 'reservation % already expired', p_reservation_id;
  END IF;

  IF v_res.inventory_held THEN
    RETURN TRUE; -- idempotent
  END IF;

  PERFORM 1 FROM events e
  WHERE e.id = v_res.event_id AND e.status = 'active' AND e.sale_ends_at > NOW();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not open for sale';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM reservation_items ri WHERE ri.reservation_id = p_reservation_id
  ) THEN
    RAISE EXCEPTION 'reservation % has no items', p_reservation_id;
  END IF;

  PERFORM set_config('app.bypass_inventory_guard', 'on', true);

  FOR v_item IN
    SELECT ri.ticket_type_id, ri.quantity
    FROM reservation_items ri
    WHERE ri.reservation_id = p_reservation_id
    ORDER BY ri.ticket_type_id
  LOOP
    UPDATE ticket_types tt
    SET available = tt.available - v_item.quantity, updated_at = NOW()
    WHERE tt.id = v_item.ticket_type_id
      AND tt.is_active = TRUE
      AND tt.available >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient availability for ticket_type %', v_item.ticket_type_id;
    END IF;
  END LOOP;

  UPDATE reservations
  SET inventory_held = TRUE, inventory_held_at = NOW()
  WHERE id = p_reservation_id;

  PERFORM check_and_mark_event_sold_out(v_res.event_id);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION release_reservation_inventory(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_res reservations%ROWTYPE; v_item RECORD;
BEGIN
  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR NOT v_res.inventory_held OR v_res.status = 'converted' THEN
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_inventory_guard', 'on', true);

  FOR v_item IN
    SELECT ticket_type_id, quantity FROM reservation_items
    WHERE reservation_id = p_reservation_id
    ORDER BY ticket_type_id
  LOOP
    PERFORM adjust_ticket_type_available(v_item.ticket_type_id, v_item.quantity);
  END LOOP;

  UPDATE reservations SET inventory_held = FALSE WHERE id = p_reservation_id;
  PERFORM reopen_event_if_inventory_available(v_res.event_id);
END;
$$;

CREATE OR REPLACE FUNCTION check_and_mark_event_sold_out(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET status = 'sold_out', sold_out_at = NOW(), updated_at = NOW()
  WHERE id = p_event_id
    AND status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM ticket_types
      WHERE event_id = p_event_id AND is_active = TRUE AND available > 0
    );

  IF FOUND THEN
    PERFORM ensure_payout_row(p_event_id, 'sold_out');
    PERFORM mark_payout_eligible_for_event(p_event_id, 'sold_out');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reopen_event_if_inventory_available(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ticket_types
    WHERE event_id = p_event_id AND is_active = TRUE AND available > 0
  ) THEN
    UPDATE events
    SET status = 'active', sold_out_at = NULL, updated_at = NOW()
    WHERE id = p_event_id AND status = 'sold_out';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION restore_inventory_on_void()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_event_status event_status;
BEGIN
  IF NEW.status = 'voided' AND OLD.status = 'confirmed' THEN
    SELECT status INTO v_event_status FROM events WHERE id = NEW.event_id;
    IF v_event_status IN ('active', 'sold_out') THEN
      PERFORM adjust_ticket_type_available(NEW.ticket_type_id, 1);
      PERFORM reopen_event_if_inventory_available(NEW.event_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_res RECORD; v_count INTEGER := 0;
BEGIN
  FOR v_res IN
    SELECT id FROM reservations
    WHERE status = 'pending' AND expires_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM release_reservation_inventory(v_res.id);
    UPDATE reservations SET status = 'expired' WHERE id = v_res.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============================================================
-- QR SCAN (auth-bound staff, single atomic UPDATE)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_qr_scan(p_token TEXT, p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_ticket_id UUID;
  v_status ticket_status;
  v_ticket_event UUID;
BEGIN
  v_staff_id := current_user_id();
  IF v_staff_id IS NULL OR current_user_role() IS DISTINCT FROM 'staff' THEN
    RETURN 'STAFF_NOT_AUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_event_assignments
    WHERE staff_id = v_staff_id AND event_id = p_event_id
  ) THEN
    RETURN 'STAFF_NOT_AUTHORIZED';
  END IF;

  UPDATE tickets t
  SET status = 'used', scanned_at = NOW(), scanned_by = v_staff_id, updated_at = NOW()
  WHERE t.token = p_token
    AND t.event_id = p_event_id
    AND t.status = 'confirmed'
  RETURNING t.id, t.status INTO v_ticket_id, v_status;

  IF v_ticket_id IS NOT NULL THEN
    INSERT INTO ticket_scan_events (ticket_id, token, event_id, staff_id, result)
    VALUES (v_ticket_id, p_token, p_event_id, v_staff_id, 'VALID');
    RETURN 'VALID';
  END IF;

  SELECT id, status, event_id INTO v_ticket_id, v_status, v_ticket_event
  FROM tickets WHERE token = p_token;

  IF NOT FOUND THEN
    INSERT INTO ticket_scan_events (ticket_id, token, event_id, staff_id, result)
    VALUES (NULL, p_token, p_event_id, v_staff_id, 'INVALID');
    RETURN 'INVALID';
  END IF;

  IF v_ticket_event <> p_event_id THEN
    INSERT INTO ticket_scan_events (ticket_id, token, event_id, staff_id, result)
    VALUES (v_ticket_id, p_token, p_event_id, v_staff_id, 'WRONG_EVENT');
    RETURN 'WRONG_EVENT';
  END IF;

  IF v_status = 'used' THEN
    INSERT INTO ticket_scan_events (ticket_id, token, event_id, staff_id, result)
    VALUES (v_ticket_id, p_token, p_event_id, v_staff_id, 'ALREADY_USED');
    RETURN 'ALREADY_USED';
  END IF;

  IF v_status = 'voided' THEN
    INSERT INTO ticket_scan_events (ticket_id, token, event_id, staff_id, result)
    VALUES (v_ticket_id, p_token, p_event_id, v_staff_id, 'VOIDED');
    RETURN 'VOIDED';
  END IF;

  INSERT INTO ticket_scan_events (ticket_id, token, event_id, staff_id, result)
  VALUES (v_ticket_id, p_token, p_event_id, v_staff_id, 'INVALID');
  RETURN 'INVALID';
END;
$$;

-- HMAC verification remains in application/Vercel (secret not in DB).
-- DB stores version + signature for audit and offline dispute resolution.

-- ============================================================
-- GUEST UPSERT (service-only)
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_guest_customer(
  p_phone TEXT, p_full_name TEXT, p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT is_service_role() THEN
    RAISE EXCEPTION 'upsert_guest_customer is service_role only';
  END IF;

  INSERT INTO guest_customers (full_name, phone, email)
  VALUES (p_full_name, p_phone, p_email)
  ON CONFLICT (phone) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, guest_customers.email),
        updated_at = CASE
          WHEN guest_customers.full_name = EXCLUDED.full_name THEN guest_customers.updated_at
          ELSE NOW()
        END,
        full_name = CASE
          WHEN guest_customers.created_at < NOW() - INTERVAL '1 day'
          THEN guest_customers.full_name
          ELSE EXCLUDED.full_name
        END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- PAYOUTS
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_payout_row(
  p_event_id UUID, p_reason payout_trigger_reason
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_id UUID;
  v_organizer UUID;
  v_rate NUMERIC(5,4);
BEGIN
  SELECT organizer_id INTO v_organizer FROM events WHERE id = p_event_id;
  SELECT COALESCE(value_num, 0.05)::NUMERIC(5,4) INTO v_rate
  FROM platform_config WHERE key = 'default_commission_rate';

  INSERT INTO payouts (
    organizer_id, event_id, trigger_reason,
    gross_amount, commission_rate, commission_amount, net_amount, status
  )
  VALUES (v_organizer, p_event_id, p_reason, 0, v_rate, 0, 0, 'held')
  -- gross/net finalized when status moves to eligible
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_payout_id;

  IF v_payout_id IS NULL THEN
    SELECT id INTO v_payout_id FROM payouts WHERE event_id = p_event_id;
  END IF;

  RETURN v_payout_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_payout_eligible_for_event(
  p_event_id UUID, p_reason payout_trigger_reason
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross NUMERIC(12,2);
  v_rate NUMERIC(5,4);
  v_commission NUMERIC(12,2);
  v_net NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(p.amount), 0) INTO v_gross
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  WHERE o.event_id = p_event_id
    AND p.status = 'completed'
    AND p.webhook_verified = TRUE;

  IF v_gross <= 0 THEN RETURN; END IF;

  SELECT COALESCE(value_num, 0.05)::NUMERIC(5,4) INTO v_rate
  FROM platform_config WHERE key = 'default_commission_rate';

  v_commission := ROUND(v_gross * v_rate, 2);
  v_net := v_gross - v_commission;

  UPDATE payouts
  SET trigger_reason = p_reason,
      gross_amount = v_gross,
      commission_rate = v_rate,
      commission_amount = v_commission,
      net_amount = v_net,
      status = 'eligible',
      eligible_at = NOW(),
      updated_at = NOW()
  WHERE event_id = p_event_id
    AND status IN ('held', 'eligible');

  INSERT INTO payout_payment_inclusions (payout_id, payment_id)
  SELECT po.id, p.id
  FROM payments p
  JOIN orders o ON o.id = p.order_id
  JOIN payouts po ON po.event_id = p_event_id
  WHERE o.event_id = p_event_id
    AND p.status = 'completed'
    AND p.webhook_verified = TRUE
  ON CONFLICT (payment_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION process_sale_end_payouts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_event RECORD; v_count INTEGER := 0;
BEGIN
  FOR v_event IN
    SELECT id FROM events
    WHERE status IN ('active', 'sold_out') AND sale_ends_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE events
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_event.id;

    PERFORM ensure_payout_row(v_event.id, 'sale_ended');
    PERFORM mark_payout_eligible_for_event(v_event.id, 'sale_ended');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_guest_customers_updated_at BEFORE UPDATE ON guest_customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ticket_types_updated_at BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ledger_immutable
  BEFORE UPDATE OR DELETE ON ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_ledger_immutable();

CREATE TRIGGER trg_ticket_non_transferable
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION enforce_ticket_non_transferable();

CREATE TRIGGER trg_staff_role_on_assignment
  BEFORE INSERT OR UPDATE ON staff_event_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_staff_role_on_assignment();

CREATE TRIGGER trg_organizer_on_event
  BEFORE INSERT OR UPDATE OF organizer_id ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_organizer_on_event();

CREATE TRIGGER trg_event_status_transition
  BEFORE INSERT OR UPDATE OF status ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_event_status_transition();

CREATE TRIGGER trg_reservations_set_expires_at
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_reservation_expires_at();

CREATE TRIGGER trg_ticket_types_inventory_guard
  BEFORE UPDATE ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION prevent_ticket_type_inventory_tamper();

CREATE TRIGGER trg_ticket_types_insert_rules
  BEFORE INSERT ON ticket_types
  FOR EACH ROW EXECUTE FUNCTION enforce_ticket_type_insert_rules();

CREATE TRIGGER trg_hmac_one_current
  AFTER INSERT OR UPDATE OF is_current ON hmac_key_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_one_current_hmac_key();

CREATE TRIGGER trg_reservation_item_event
  BEFORE INSERT OR UPDATE ON reservation_items
  FOR EACH ROW EXECUTE FUNCTION enforce_reservation_item_event_match();

CREATE TRIGGER trg_max_tickets_reservation
  BEFORE INSERT OR UPDATE ON reservation_items
  FOR EACH ROW EXECUTE FUNCTION enforce_max_tickets_per_order();

CREATE TRIGGER trg_max_tickets_order
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION enforce_max_tickets_per_order();

CREATE TRIGGER trg_order_item_matches_reservation
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION enforce_order_item_matches_reservation();

CREATE TRIGGER trg_payment_amount_matches_order
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_amount_matches_order();

CREATE TRIGGER trg_ticket_issuance_limit
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION enforce_ticket_issuance_limit();

CREATE TRIGGER trg_restore_inventory_on_void
  AFTER UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION restore_inventory_on_void();

CREATE TRIGGER trg_truncate_webhook_payload
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION truncate_webhook_payload();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_tickets_status_event ON tickets(event_id, status);
CREATE INDEX idx_tickets_order ON tickets(order_id);
CREATE INDEX idx_staff_assignments_staff_event ON staff_event_assignments(staff_id, event_id);
CREATE INDEX idx_ticket_types_event_active ON ticket_types(event_id, is_active, available);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_event ON orders(event_id);
CREATE INDEX idx_orders_status_issued ON orders(status, tickets_issued)
  WHERE status = 'confirmed' AND tickets_issued = FALSE;
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_reservations_expiry_pending ON reservations(expires_at)
  WHERE status = 'pending';
CREATE INDEX idx_reservations_event ON reservations(event_id);
CREATE INDEX idx_events_sale_ends_active ON events(sale_ends_at)
  WHERE status IN ('active', 'sold_out');
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_ledger_event_id ON ledger(event_id);
CREATE INDEX idx_ledger_organizer ON ledger(organizer_id);
CREATE INDEX idx_ledger_reference ON ledger(reference_id, reference_table);
CREATE INDEX idx_scan_events_event_time ON ticket_scan_events(event_id, scanned_at DESC);
CREATE UNIQUE INDEX idx_hmac_key_versions_one_current
  ON hmac_key_versions (is_current)
  WHERE is_current = TRUE;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_payment_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmac_key_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users FOR SELECT
  USING (supabase_auth_id = auth.uid());
CREATE POLICY users_admin_all ON users FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY events_public_read ON events FOR SELECT
  USING (status IN ('active', 'sold_out', 'completed', 'cancelled'));
CREATE POLICY events_organizer_own ON events FOR SELECT
  USING (organizer_id = current_user_id());
CREATE POLICY events_organizer_insert ON events FOR INSERT
  WITH CHECK (organizer_id = current_user_id() AND current_user_role() = 'organizer');
CREATE POLICY events_organizer_update ON events FOR UPDATE
  USING (organizer_id = current_user_id() AND current_user_role() = 'organizer')
  WITH CHECK (organizer_id = current_user_id());
CREATE POLICY events_admin_all ON events FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY ticket_types_public_read ON ticket_types FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM events e WHERE e.id = ticket_types.event_id
      AND e.status IN ('active', 'sold_out', 'completed', 'cancelled')
  ));
CREATE POLICY ticket_types_organizer_insert ON ticket_types FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM events e WHERE e.id = ticket_types.event_id
      AND e.organizer_id = current_user_id()
      AND e.status IN ('draft', 'pending_approval')
  ));
CREATE POLICY ticket_types_organizer_update_metadata ON ticket_types FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM events e WHERE e.id = ticket_types.event_id
      AND e.organizer_id = current_user_id() AND e.status IN ('draft', 'pending_approval')
  ));
CREATE POLICY ticket_types_admin_all ON ticket_types FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY guest_customers_deny ON guest_customers FOR ALL USING (FALSE);
CREATE POLICY reservations_deny ON reservations FOR ALL USING (FALSE);
CREATE POLICY reservation_items_deny ON reservation_items FOR ALL USING (FALSE);
CREATE POLICY payment_webhooks_deny ON payment_webhook_events FOR ALL USING (FALSE);

CREATE POLICY orders_deny_write ON orders FOR INSERT WITH CHECK (FALSE);
CREATE POLICY orders_deny_update ON orders FOR UPDATE USING (FALSE);
CREATE POLICY orders_organizer_read ON orders FOR SELECT
  USING (current_user_role() = 'organizer' AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = orders.event_id AND e.organizer_id = current_user_id()
  ));
CREATE POLICY orders_admin_all ON orders FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY order_items_organizer_read ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o JOIN events e ON e.id = o.event_id
    WHERE o.id = order_items.order_id AND e.organizer_id = current_user_id()
  ));
CREATE POLICY order_items_admin_all ON order_items FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY payments_deny_write ON payments FOR INSERT WITH CHECK (FALSE);
CREATE POLICY payments_organizer_read ON payments FOR SELECT
  USING (current_user_role() = 'organizer' AND EXISTS (
    SELECT 1 FROM orders o JOIN events e ON e.id = o.event_id
    WHERE o.id = payments.order_id AND e.organizer_id = current_user_id()
  ));
CREATE POLICY payments_admin_all ON payments FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY tickets_staff_read ON tickets FOR SELECT
  USING (current_user_role() = 'staff' AND EXISTS (
    SELECT 1 FROM staff_event_assignments sea
    WHERE sea.staff_id = current_user_id() AND sea.event_id = tickets.event_id
  ));
CREATE POLICY tickets_organizer_read ON tickets FOR SELECT
  USING (current_user_role() = 'organizer' AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = tickets.event_id AND e.organizer_id = current_user_id()
  ));
CREATE POLICY tickets_deny_write ON tickets FOR INSERT WITH CHECK (FALSE);
CREATE POLICY tickets_deny_update ON tickets FOR UPDATE USING (FALSE);
CREATE POLICY tickets_admin_all ON tickets FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY scan_events_staff_read ON ticket_scan_events FOR SELECT
  USING (current_user_role() IN ('staff', 'admin'));
CREATE POLICY scan_events_deny_write ON ticket_scan_events FOR INSERT WITH CHECK (FALSE);

CREATE POLICY sea_staff_read_own ON staff_event_assignments FOR SELECT
  USING (staff_id = current_user_id());
CREATE POLICY sea_organizer_manage ON staff_event_assignments FOR ALL
  USING (current_user_role() = 'organizer' AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = staff_event_assignments.event_id
      AND e.organizer_id = current_user_id()
  ));
CREATE POLICY sea_admin_all ON staff_event_assignments FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY payouts_organizer_read ON payouts FOR SELECT
  USING (organizer_id = current_user_id() AND current_user_role() = 'organizer');
CREATE POLICY payouts_admin_all ON payouts FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY ledger_deny_write ON ledger FOR INSERT WITH CHECK (FALSE);
CREATE POLICY ledger_organizer_read ON ledger FOR SELECT
  USING (organizer_id = current_user_id() AND current_user_role() = 'organizer');
CREATE POLICY ledger_admin_read ON ledger FOR SELECT USING (current_user_role() = 'admin');

CREATE POLICY hmac_versions_admin_only ON hmac_key_versions FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY payout_inclusions_admin_all ON payout_payment_inclusions FOR ALL
  USING (current_user_role() = 'admin');
CREATE POLICY payout_inclusions_organizer_read ON payout_payment_inclusions FOR SELECT
  USING (current_user_role() = 'organizer' AND EXISTS (
    SELECT 1 FROM payouts p WHERE p.id = payout_payment_inclusions.payout_id
      AND p.organizer_id = current_user_id()
  ));

CREATE POLICY platform_config_admin ON platform_config FOR ALL
  USING (current_user_role() = 'admin');

-- ============================================================
-- GRANTS (narrow execute surface)
-- ============================================================

REVOKE ALL ON FUNCTION current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION validate_qr_scan(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_qr_scan(TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION atomic_decrement_inventory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atomic_decrement_inventory(UUID) TO service_role;

REVOKE ALL ON FUNCTION upsert_guest_customer(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_guest_customer(TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION release_reservation_inventory(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_reservation_inventory(UUID) TO service_role;

REVOKE ALL ON FUNCTION check_and_mark_event_sold_out(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_and_mark_event_sold_out(UUID) TO service_role;

REVOKE ALL ON FUNCTION reopen_event_if_inventory_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reopen_event_if_inventory_available(UUID) TO service_role;

REVOKE ALL ON FUNCTION expire_stale_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_stale_reservations() TO service_role;

REVOKE ALL ON FUNCTION ensure_payout_row(UUID, payout_trigger_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_payout_row(UUID, payout_trigger_reason) TO service_role;

REVOKE ALL ON FUNCTION mark_payout_eligible_for_event(UUID, payout_trigger_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_payout_eligible_for_event(UUID, payout_trigger_reason) TO service_role;

REVOKE ALL ON FUNCTION process_sale_end_payouts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_sale_end_payouts() TO service_role;

REVOKE ALL ON FUNCTION adjust_ticket_type_available(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION adjust_ticket_type_available(UUID, INTEGER) TO service_role;

-- ============================================================
-- CRON (optional — failure does not abort migration)
-- ============================================================

DO $pg_cron_setup$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_cron extension skipped: insufficient privilege';
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron extension skipped: %', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('expire-stale-reservations');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.unschedule('process-sale-end-payouts');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'expire-stale-reservations',
      '*/2 * * * *',
      $job$SELECT expire_stale_reservations();$job$
    );
    PERFORM cron.schedule(
      'process-sale-end-payouts',
      '*/15 * * * *',
      $job$SELECT process_sale_end_payouts();$job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed; schedule jobs via Supabase Dashboard';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron setup skipped: %', SQLERRM;
END;
$pg_cron_setup$;

-- ============================================================
-- SEED
-- ============================================================

INSERT INTO hmac_key_versions (version, is_current) VALUES (1, TRUE);
