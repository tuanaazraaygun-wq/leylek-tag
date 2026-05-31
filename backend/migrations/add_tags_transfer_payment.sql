-- Phase 2-D-1: IBAN/havale transfer payment claim/respond state (JSONB, no full IBAN).
-- Apply after add_tags_matched_bank_account_id.sql.

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS transfer_payment jsonb;

CREATE INDEX IF NOT EXISTS idx_tags_transfer_payment_status
  ON tags ((transfer_payment->>'status'))
  WHERE transfer_payment IS NOT NULL;

COMMENT ON COLUMN tags.transfer_payment IS
  'IBAN transfer lifecycle: status awaiting_driver|confirmed|disputed, timestamps, dispute_note (no IBAN).';
