-- Phase 6.3: Sham Cash transaction verification (reference codes + transaction id storage)

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference_code TEXT,
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_reference_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference_code_unique
  ON payments (reference_code)
  WHERE reference_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_id_unique
  ON payments (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

COMMENT ON COLUMN payments.reference_code IS 'Guest-facing Sham Cash payment note (TIQIT-XXXX)';
COMMENT ON COLUMN payments.provider_transaction_id IS 'Sham Cash transaction_id after verification';
COMMENT ON COLUMN orders.payment_reference_code IS 'Denormalized copy of pending payment reference_code';
