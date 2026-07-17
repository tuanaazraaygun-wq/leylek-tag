-- KYC Phase 5B2 — append-only document access audit schema (contract only)
-- Creates public.kyc_document_access_events + mutation-deny trigger. No RPCs or runtime writers.
--
-- MANUAL PREFLIGHT (required before production apply):
--   * Verify no conflicting public.kyc_document_access_events table or trigger function exists.
--   * CREATE TABLE IF NOT EXISTS does not reconcile schema drift or validate column mismatches.
--   * Apply and verify in staging first.
--   * Rollback requires a separate compensating migration (DROP TRIGGER, DROP FUNCTION, DROP TABLE).
--
-- Access posture:
--   * Direct browser/anon/authenticated access is forbidden (RLS enabled, no client policies, REVOKE).
--   * Future Product backend access will occur through hardened SECURITY DEFINER RPCs (later phase).
--   * Enterprise must never access this table directly.
--   * Contains no document URLs, paths, buckets, bytes, or Product PII.
--   * Append-only: UPDATE and DELETE rejected for all roles including service role.
--   * Corrections use compensating INSERT events in future phases.

-- =============================================================================
-- kyc_document_access_events
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kyc_document_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  event_type text NOT NULL,
  actor_admin_id text NOT NULL,

  application_id uuid NOT NULL
    REFERENCES public.users(id) ON DELETE RESTRICT,

  document_type text NOT NULL,
  request_id text NOT NULL,

  grant_id uuid NULL
    REFERENCES public.kyc_document_access_grants(id) ON DELETE SET NULL,

  grant_reference_hash text NULL,
  review_reason text NULL,

  result text NOT NULL,
  reason_code text NULL,

  source_channel text NOT NULL,

  occurred_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kdae_event_type_valid
    CHECK (event_type IN (
      'kyc.document.access_requested',
      'kyc.document.access_denied',
      'kyc.document.grant_issued',
      'kyc.document.viewed',
      'kyc.document.redeemed',
      'kyc.document.view_failed',
      'kyc.document.grant_expired',
      'kyc.document.grant_revoked'
    )),

  CONSTRAINT kdae_document_type_valid
    CHECK (document_type IN ('license', 'vehicle_registration', 'selfie')),

  CONSTRAINT kdae_review_reason_valid
    CHECK (review_reason IS NULL OR review_reason IN ('initial_review', 'recheck')),

  CONSTRAINT kdae_result_valid
    CHECK (result IN ('allowed', 'denied', 'viewed', 'unavailable')),

  CONSTRAINT kdae_reason_code_valid
    CHECK (reason_code IS NULL OR reason_code IN (
      'authentication_required',
      'allowlist_required',
      'permission_required',
      'document_not_reviewable',
      'audit_unavailable',
      'rate_limited',
      'application_not_found',
      'document_missing',
      'document_unavailable',
      'invalid_document_type',
      'invalid_source_reference',
      'unsupported_mime_type',
      'source_unavailable',
      'grant_expired',
      'grant_redeemed',
      'grant_revoked',
      'temporarily_unavailable'
    )),

  CONSTRAINT kdae_source_channel_valid
    CHECK (source_channel IN ('enterprise_bff', 'leylek_internal')),

  CONSTRAINT kdae_actor_admin_id_valid
    CHECK (char_length(actor_admin_id) > 0 AND char_length(actor_admin_id) <= 128),

  CONSTRAINT kdae_request_id_valid
    CHECK (char_length(request_id) > 0 AND char_length(request_id) <= 128),

  CONSTRAINT kdae_grant_reference_hash_valid
    CHECK (
      grant_reference_hash IS NULL
      OR (char_length(grant_reference_hash) > 0 AND char_length(grant_reference_hash) <= 128)
    ),

  CONSTRAINT kdae_review_reason_required_for_requested_and_issued
    CHECK (
      event_type NOT IN ('kyc.document.access_requested', 'kyc.document.grant_issued')
      OR review_reason IS NOT NULL
    ),

  CONSTRAINT kdae_grant_hash_required_for_grant_lifecycle
    CHECK (
      event_type NOT IN (
        'kyc.document.grant_issued',
        'kyc.document.viewed',
        'kyc.document.redeemed',
        'kyc.document.grant_expired',
        'kyc.document.grant_revoked'
      )
      OR grant_reference_hash IS NOT NULL
    ),

  CONSTRAINT kdae_denied_requires_reason_code
    CHECK (result <> 'denied' OR reason_code IS NOT NULL),

  CONSTRAINT kdae_unavailable_requires_reason_code
    CHECK (result <> 'unavailable' OR reason_code IS NOT NULL),

  CONSTRAINT kdae_allowed_viewed_forbid_reason_code
    CHECK (result NOT IN ('allowed', 'viewed') OR reason_code IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_kdae_application_occurred
  ON public.kyc_document_access_events (application_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdae_actor_occurred
  ON public.kyc_document_access_events (actor_admin_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdae_grant_hash_occurred
  ON public.kyc_document_access_events (grant_reference_hash, occurred_at DESC)
  WHERE grant_reference_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kdae_event_type_occurred
  ON public.kyc_document_access_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_kdae_request_id
  ON public.kyc_document_access_events (request_id);

ALTER TABLE public.kyc_document_access_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kyc_document_access_events FROM PUBLIC;
REVOKE ALL ON public.kyc_document_access_events FROM anon;
REVOKE ALL ON public.kyc_document_access_events FROM authenticated;

COMMENT ON TABLE public.kyc_document_access_events IS
  'KYC Phase 5B2 — append-only document access audit events. '
  'Direct browser access is forbidden. Future Product backend access via hardened RPCs only. '
  'Enterprise must never access this table directly. '
  'Contains no document URLs, storage paths, buckets, bytes, or Product PII. '
  'UPDATE and DELETE rejected for all roles; corrections use compensating INSERT events.';

COMMENT ON COLUMN public.kyc_document_access_events.grant_id IS
  'Optional FK to grant row; ON DELETE SET NULL preserves audit timeline after grant cleanup.';

COMMENT ON COLUMN public.kyc_document_access_events.grant_reference_hash IS
  'Persisted hash reference; survives grant-row cleanup. Raw grant tokens are never stored.';

COMMENT ON COLUMN public.kyc_document_access_events.occurred_at IS
  'Authoritative database event timestamp. Caller-controlled timestamps are not permitted.';

COMMENT ON COLUMN public.kyc_document_access_events.source_channel IS
  'Closed channel enum (enterprise_bff, leylek_internal). Not a storage source reference.';

-- =============================================================================
-- append-only enforcement
-- =============================================================================

CREATE OR REPLACE FUNCTION public.kyc_document_access_events_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'append_only_violation'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS kyc_document_access_events_deny_mutation
  ON public.kyc_document_access_events;

CREATE TRIGGER kyc_document_access_events_deny_mutation
  BEFORE UPDATE OR DELETE
  ON public.kyc_document_access_events
  FOR EACH ROW
  EXECUTE FUNCTION public.kyc_document_access_events_deny_mutation();
