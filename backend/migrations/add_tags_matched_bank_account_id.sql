-- Phase 1-A: driver bank account reference at match time (UUID only, not full IBAN).
-- Apply after create_driver_bank_accounts.sql.
-- Phase 1-B accept-offer snapshot will populate this column.

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS matched_bank_account_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tags_matched_bank_account_id_fkey'
  ) THEN
    ALTER TABLE tags
      ADD CONSTRAINT tags_matched_bank_account_id_fkey
      FOREIGN KEY (matched_bank_account_id)
      REFERENCES driver_bank_accounts (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tags_matched_bank_account_id
  ON tags (matched_bank_account_id)
  WHERE matched_bank_account_id IS NOT NULL;

COMMENT ON COLUMN tags.matched_bank_account_id IS
  'Match-time snapshot: driver_bank_accounts.id. ON DELETE SET NULL. Full IBAN is not stored here.';
