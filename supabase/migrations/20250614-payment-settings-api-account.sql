-- Separate Sham Cash API account id (from GET /accounts) from customer-facing wallet id

ALTER TABLE platform_payment_settings
  ADD COLUMN IF NOT EXISTS sham_cash_api_account_id TEXT NOT NULL DEFAULT '';
