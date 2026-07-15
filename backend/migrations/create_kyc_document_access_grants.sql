-- KYC Phase 5B1 — document access grant persistence schema (contract only)
-- Creates public.kyc_document_access_grants only. No audit table, triggers, RPCs, or policies.
--
-- MANUAL PREFLIGHT (required before production apply):
--   * Verify no conflicting public.kyc_document_access_grants table already exists.
--   * CREATE TABLE IF NOT EXISTS does not reconcile schema drift or validate column mismatches.
--   * Staging verification is required before production application.
--
-- Access posture:
--   * Direct browser/anon/authenticated access is forbidden (RLS enabled, no client policies).
--   * Future Product backend access will occur through hardened SECURITY DEFINER RPCs (Phase 5B2+).
--   * Enterprise must never access this table directly.
--   * This table stores grant metadata and hashes only — no document URLs, paths, buckets, bytes, or Product PII.
--   * RLS does not constrain service-role access; RPC-only write enforcement belongs to a later phase.
--
-- Idempotency posture:
--   * Unique (actor_admin_id, request_id) enforces one issuance row per actor/request pair.
--   * Application/document/review_reason consistency for duplicate request_id retries is enforced
--     by the future issuance RPC before returning an existing row.
--   * Active-grant reuse and expiry-aware uniqueness are enforced inside atomic RPC/transaction (later phase).
--   * Indexes alone do not enforce active-grant concurrency.

-- =============================================================================
-- kyc_document_access_grants
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_document_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  grant_reference_hash text NOT NULL,
  token_version smallint NOT NULL DEFAULT 1,

  application_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  document_type text NOT NULL,
  actor_admin_id text NOT NULL,
  request_id text NOT NULL,
  review_reason text NOT NULL,

  state text NOT NULL DEFAULT 'issued',
  ttl_seconds integer NOT NULL,

  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz NULL,
  revoked_at timestamptz NULL,

  source_binding_hash text NOT NULL,
  application_record_version timestamptz NULL,

  redemption_attempt_count integer NOT NULL DEFAULT 0,
  last_redemption_attempt_at timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kdag_grant_reference_hash_nonempty
    CHECK (char_length(grant_reference_hash) > 0 AND char_length(grant_reference_hash) <= 128),

  CONSTRAINT kdag_source_binding_hash_nonempty
    CHECK (char_length(source_binding_hash) > 0 AND char_length(source_binding_hash) <= 128),

  CONSTRAINT kdag_token_version_valid
    CHECK (token_version >= 1),

  CONSTRAINT kdag_document_type_valid
    CHECK (document_type IN ('license', 'vehicle_registration', 'selfie')),

  CONSTRAINT kdag_review_reason_valid
    CHECK (review_reason IN ('initial_review', 'recheck')),

  CONSTRAINT kdag_state_valid
    CHECK (state IN ('issued', 'redeemed', 'expired', 'revoked')),

  CONSTRAINT kdag_ttl_seconds_valid
    CHECK (ttl_seconds >= 60 AND ttl_seconds <= 120),

  CONSTRAINT kdag_actor_admin_id_valid
    CHECK (char_length(actor_admin_id) > 0 AND char_length(actor_admin_id) <= 128),

  CONSTRAINT kdag_request_id_valid
    CHECK (char_length(request_id) > 0 AND char_length(request_id) <= 128),

  CONSTRAINT kdag_redemption_attempt_count_valid
    CHECK (redemption_attempt_count >= 0),

  CONSTRAINT kdag_expires_after_issued
    CHECK (expires_at > issued_at),

  CONSTRAINT kdag_redeemed_at_required_when_redeemed
    CHECK (state <> 'redeemed' OR redeemed_at IS NOT NULL),

  CONSTRAINT kdag_revoked_at_required_when_revoked
    CHECK (state <> 'revoked' OR revoked_at IS NOT NULL),

  CONSTRAINT kdag_redeemed_revoked_exclusive
    CHECK (NOT (redeemed_at IS NOT NULL AND revoked_at IS NOT NULL)),

  CONSTRAINT kdag_issued_no_terminal_timestamps
    CHECK (state <> 'issued' OR (redeemed_at IS NULL AND revoked_at IS NULL)),

  CONSTRAINT kdag_expired_no_terminal_timestamps
    CHECK (state <> 'expired' OR (redeemed_at IS NULL AND revoked_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kdag_grant_reference_hash
  ON public.kyc_document_access_grants (grant_reference_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kdag_actor_request_idempotency
  ON public.kyc_document_access_grants (actor_admin_id, request_id);

CREATE INDEX IF NOT EXISTS idx_kdag_application_document_issued
  ON public.kyc_document_access_grants (application_id, document_type, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdag_actor_issued
  ON public.kyc_document_access_grants (actor_admin_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdag_state_expires
  ON public.kyc_document_access_grants (state, expires_at);

ALTER TABLE public.kyc_document_access_grants ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.kyc_document_access_grants IS
  'KYC Phase 5B1 — opaque document access grant lifecycle metadata. '
  'Direct browser access is forbidden. Future Product backend access via hardened RPCs only. '
  'Enterprise must never access this table directly. '
  'Contains no document URLs, storage paths, buckets, bytes, or Product PII. '
  'Grant hash and binding hash only; raw grant tokens are never persisted.';

COMMENT ON COLUMN public.kyc_document_access_grants.grant_reference_hash IS
  'Deterministic reference to the issued grant (hash only). Raw grant token is never stored.';

COMMENT ON COLUMN public.kyc_document_access_grants.source_binding_hash IS
  'Hash binding grant to normalized document source at issuance time. No raw source reference stored.';

COMMENT ON COLUMN public.kyc_document_access_grants.application_id IS
  'KYC application user id (public.users.id). ON DELETE RESTRICT preserves grant audit trail.';

COMMENT ON COLUMN public.kyc_document_access_grants.actor_admin_id IS
  'Enterprise admin actor identifier for issuance idempotency and activity lookup.';

COMMENT ON COLUMN public.kyc_document_access_grants.request_id IS
  'Client-supplied idempotency key per actor. Unique with actor_admin_id; payload consistency enforced by future RPC.';

COMMENT ON COLUMN public.kyc_document_access_grants.state IS
  'Lifecycle: issued, redeemed, expired, revoked. Active-grant uniqueness enforced by future atomic RPC.';

COMMENT ON COLUMN public.kyc_document_access_grants.ttl_seconds IS
  'Grant TTL in seconds. Bounded 60–120 per Product contract.';
