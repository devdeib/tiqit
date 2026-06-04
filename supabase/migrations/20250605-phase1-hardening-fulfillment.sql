-- Phase 1 hardening: atomic payment fulfillment + reservation eligibility checks

CREATE OR REPLACE FUNCTION fulfill_payment_webhook(
  p_provider_payment_id TEXT,
  p_provider_event_id   TEXT,
  p_payload_hash        CHAR(64),
  p_raw_payload         JSONB,
  p_tickets             JSONB,
  p_amount              NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_order   orders%ROWTYPE;
  v_order_id UUID;
  v_res     reservations%ROWTYPE;
  v_event   events%ROWTYPE;
  v_rate    NUMERIC(5,4);
  v_commission NUMERIC(12,2);
  v_ticket  JSONB;
  v_updated INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_webhook_events
    WHERE provider = 'sham_cash' AND provider_event_id = p_provider_event_id
  ) THEN
    SELECT order_id INTO v_order_id
    FROM payments WHERE provider_payment_id = p_provider_payment_id;
    RETURN jsonb_build_object(
      'already_processed', TRUE,
      'order_id', v_order_id
    );
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE provider_payment_id = p_provider_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment not found';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF v_payment.status = 'completed' AND v_payment.webhook_verified THEN
    INSERT INTO payment_webhook_events (
      provider, provider_event_id, provider_payment_id, order_id, payload_hash
    ) VALUES (
      'sham_cash', p_provider_event_id, p_provider_payment_id, v_order.id, p_payload_hash
    )
    ON CONFLICT ON CONSTRAINT payment_webhook_events_provider_event_unique DO NOTHING;

    RETURN jsonb_build_object(
      'already_processed', TRUE,
      'order_id', v_order.id
    );
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION 'payment is not pending (status=%)', v_payment.status;
  END IF;

  SELECT * INTO v_res
  FROM reservations
  WHERE id = v_order.reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation not found';
  END IF;

  IF v_res.status <> 'pending'
     OR NOT v_res.inventory_held
     OR v_res.expires_at <= NOW() THEN
    RAISE EXCEPTION 'reservation_not_eligible_for_payment';
  END IF;

  IF p_amount IS NOT NULL AND ABS(p_amount - v_order.total_amount) >= 0.01 THEN
    RAISE EXCEPTION 'payment amount mismatch';
  END IF;

  IF v_order.tickets_issued THEN
    RAISE EXCEPTION 'tickets already issued for order';
  END IF;

  UPDATE payments
  SET status = 'completed',
      webhook_verified = TRUE,
      webhook_received_at = NOW(),
      raw_webhook_payload = p_raw_payload,
      updated_at = NOW()
  WHERE id = v_payment.id AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'payment completion guard failed';
  END IF;

  UPDATE orders
  SET status = 'confirmed', updated_at = NOW()
  WHERE id = v_order.id AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'order confirmation guard failed';
  END IF;

  UPDATE reservations
  SET status = 'converted'
  WHERE id = v_res.id AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'reservation conversion guard failed';
  END IF;

  FOR v_ticket IN SELECT * FROM jsonb_array_elements(p_tickets)
  LOOP
    INSERT INTO tickets (
      order_id,
      order_item_id,
      ticket_type_id,
      event_id,
      customer_id,
      holder_name,
      holder_phone,
      token,
      hmac_signature,
      hmac_key_version,
      status
    ) VALUES (
      v_order.id,
      (v_ticket->>'order_item_id')::UUID,
      (v_ticket->>'ticket_type_id')::UUID,
      v_order.event_id,
      v_order.customer_id,
      v_ticket->>'holder_name',
      v_ticket->>'holder_phone',
      v_ticket->>'token',
      v_ticket->>'hmac_signature',
      (v_ticket->>'hmac_key_version')::INTEGER,
      'confirmed'
    );
  END LOOP;

  UPDATE orders
  SET tickets_issued = TRUE, updated_at = NOW()
  WHERE id = v_order.id AND tickets_issued = FALSE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'tickets_issued guard failed';
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_order.event_id;

  INSERT INTO ledger (
    event_type, amount, reference_id, reference_table,
    organizer_id, customer_id, event_id
  ) VALUES (
    'payment_received', v_order.total_amount, v_order.id, 'orders',
    v_event.organizer_id, v_order.customer_id, v_order.event_id
  )
  ON CONFLICT ON CONSTRAINT ledger_idempotency DO NOTHING;

  SELECT COALESCE(value_num, 0.05)::NUMERIC(5,4) INTO v_rate
  FROM platform_config WHERE key = 'default_commission_rate';

  v_commission := ROUND(v_order.total_amount * v_rate, 2);

  IF v_commission > 0 THEN
    INSERT INTO ledger (
      event_type, amount, reference_id, reference_table,
      organizer_id, customer_id, event_id
    ) VALUES (
      'commission_deducted', v_commission, v_order.id, 'orders',
      v_event.organizer_id, v_order.customer_id, v_order.event_id
    )
    ON CONFLICT ON CONSTRAINT ledger_idempotency DO NOTHING;
  END IF;

  INSERT INTO payment_webhook_events (
    provider, provider_event_id, provider_payment_id, order_id, payload_hash
  ) VALUES (
    'sham_cash', p_provider_event_id, p_provider_payment_id, v_order.id, p_payload_hash
  );

  RETURN jsonb_build_object(
    'already_processed', FALSE,
    'order_id', v_order.id
  );
END;
$$;

REVOKE ALL ON FUNCTION fulfill_payment_webhook(TEXT, TEXT, CHAR(64), JSONB, JSONB, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fulfill_payment_webhook(TEXT, TEXT, CHAR(64), JSONB, JSONB, NUMERIC) TO service_role;
