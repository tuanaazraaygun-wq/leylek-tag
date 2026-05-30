-- Driver IBAN accounts (Phase 1-A)
-- Apply via Supabase SQL Editor or migration runner.
-- Full IBAN is readable/writable only through backend service-role APIs.
-- No direct mobile anon/authenticated access; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS driver_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  iban text NOT NULL,
  account_holder_name text NOT NULL,
  label text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT driver_bank_accounts_iban_nonempty CHECK (char_length(trim(iban)) >= 15),
  CONSTRAINT driver_bank_accounts_holder_nonempty CHECK (char_length(trim(account_holder_name)) >= 2)
);

CREATE INDEX IF NOT EXISTS idx_driver_bank_accounts_driver_id
  ON driver_bank_accounts (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_bank_accounts_driver_active
  ON driver_bank_accounts (driver_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_bank_accounts_driver_iban_active
  ON driver_bank_accounts (driver_id, iban)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_bank_accounts_driver_default_active
  ON driver_bank_accounts (driver_id)
  WHERE is_default = true AND deleted_at IS NULL;

ALTER TABLE driver_bank_accounts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE driver_bank_accounts IS
  'Driver IBAN accounts. RLS: no client direct access; backend service role API (Phase 1-B).';
COMMENT ON COLUMN driver_bank_accounts.iban IS
  'Normalized IBAN (app layer: uppercase, no spaces). Never exposed in tag/offer/socket payloads.';
COMMENT ON COLUMN driver_bank_accounts.is_default IS
  'At most one true per driver among active rows (partial unique index).';
COMMENT ON COLUMN driver_bank_accounts.deleted_at IS
  'Soft delete; row kept for match snapshot (tags.matched_bank_account_id).';
