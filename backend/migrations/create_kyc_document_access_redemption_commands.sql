-- KYC Phase D7-B1 — redemption command ledger (artifact only)
-- Creates public.kyc_document_access_redemption_commands only.
--
-- MANUAL PREFLIGHT (required before staging apply):
--   * create_kyc_document_access_grants.sql applied first.
--   * Staging verification required before production.
--
-- Security posture:
--   * Stores safe terminal replay snapshots only — no raw bearer tokens.
--   * No storage paths, buckets, signed URLs, provider credentials, or JSON blobs.
--   * Direct browser/anon/authenticated access forbidden (RLS enabled, no client policies).
--   * Limited UPDATE lifecycle: pending → completed | failed only.

CREATE TABLE IF NOT EXISTS public.kyc_document_access_redemption_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  grant_id uuid NOT NULL
    REFERENCES public.kyc_document_access_grants(id) ON DELETE RESTRICT,

  actor_admin_id text NOT NULL,
  request_id text NOT NULL,
  source_channel text NOT NULL,

  request_fingerprint text NOT NULL,

  status text NOT NULL DEFAULT 'pending',

  terminal_outcome_code text NULL,

  result_grant_id uuid NULL,
  result_application_id uuid NULL,
  result_document_type text NULL,
  result_state text NULL,
  result_redeemed_at timestamptz NULL,
  result_source_binding_hash text NULL,
  result_application_record_version timestamptz NULL,

  failure_reason_code text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,

  CONSTRAINT kdarc_actor_admin_id_valid
    CHECK (char_length(trim(actor_admin_id)) > 0 AND char_length(actor_admin_id) <= 128),

  CONSTRAINT kdarc_request_id_valid
    CHECK (char_length(trim(request_id)) > 0 AND char_length(request_id) <= 128),

  CONSTRAINT kdarc_source_channel_valid
    CHECK (source_channel IN ('enterprise_bff', 'leylek_internal')),

  CONSTRAINT kdarc_request_fingerprint_valid
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),

  CONSTRAINT kdarc_status_valid
    CHECK (status IN ('pending', 'completed', 'failed')),

  CONSTRAINT kdarc_terminal_outcome_valid
    CHECK (
      terminal_outcome_code IS NULL
      OR terminal_outcome_code IN (
        'redeemed',
        'not_found_or_unauthorized',
        'grant_expired',
        'grant_redeemed',
        'grant_revoked',
        'invalid_input',
        'audit_unavailable'
      )
    ),

  CONSTRAINT kdarc_failure_reason_valid
    CHECK (
      failure_reason_code IS NULL
      OR failure_reason_code IN (
        'source_binding_mismatch',
        'record_version_stale',
        'idempotency_mismatch',
        'actor_mismatch',
        'terminal_state_block'
      )
    ),

  CONSTRAINT kdarc_completed_at_required_for_terminal_status
    CHECK (
      status = 'pending'
      OR completed_at IS NOT NULL
    ),

  CONSTRAINT kdarc_completed_at_null_for_pending
    CHECK (
      status <> 'pending'
      OR completed_at IS NULL
    ),

  CONSTRAINT kdarc_terminal_outcome_required_for_terminal_status
    CHECK (
      status = 'pending'
      OR terminal_outcome_code IS NOT NULL
    ),

  CONSTRAINT kdarc_redeemed_snapshot_consistency
    CHECK (
      terminal_outcome_code <> 'redeemed'
      OR (
        result_grant_id IS NOT NULL
        AND result_application_id IS NOT NULL
        AND result_document_type IS NOT NULL
        AND result_state = 'redeemed'
        AND result_redeemed_at IS NOT NULL
        AND result_source_binding_hash IS NOT NULL
        AND result_application_record_version IS NOT NULL
      )
    ),

  CONSTRAINT uq_kdarc_grant_actor_request
    UNIQUE (grant_id, actor_admin_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_kdarc_grant_status_completed
  ON public.kyc_document_access_redemption_commands (grant_id, status, completed_at DESC);

ALTER TABLE public.kyc_document_access_redemption_commands ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kyc_document_access_redemption_commands FROM PUBLIC;
REVOKE ALL ON public.kyc_document_access_redemption_commands FROM anon;
REVOKE ALL ON public.kyc_document_access_redemption_commands FROM authenticated;

COMMENT ON TABLE public.kyc_document_access_redemption_commands IS
  'KYC Phase D7-B1 — redemption idempotency command ledger with safe replay snapshots. '
  'Raw bearer grant tokens are never stored. '
  'Limited UPDATE lifecycle only; no DELETE path.';

COMMENT ON COLUMN public.kyc_document_access_redemption_commands.request_fingerprint IS
  'Deterministic SHA-256 fingerprint of grant, actor, request, binding, version, and channel.';

COMMENT ON COLUMN public.kyc_document_access_redemption_commands.result_grant_id IS
  'Safe replay snapshot fields only — no storage locators or provider URLs.';
