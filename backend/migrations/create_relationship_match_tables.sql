-- Relationship Match Engine — Phase RME-1 (schema only)
-- Tables: relationship_match_requests, relationship_match_invites, relationship_match_events
-- Application code does not read/write these tables until RME-3 orchestrator.
-- Apply via Supabase SQL Editor or migration runner.
-- No runtime behavior change. Feature flags are code-side (RME_ENABLED/TDM_ENABLED); not in this migration.
-- No direct client access: RLS enabled, no policies (backend service role only).
-- Separate from quick_match_*, dispatch_queue, offers. Retention/anonymization: future RME-9.

-- =============================================================================
-- relationship_match_requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS relationship_match_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  match_module text NOT NULL DEFAULT 'trusted_direct',
  relationship_type text NOT NULL DEFAULT 'trusted',

  requester_id uuid NOT NULL REFERENCES users(id),
  responder_id uuid NOT NULL REFERENCES users(id),
  relationship_connection_id uuid NOT NULL REFERENCES trusted_connections(id),

  vehicle_preference text NOT NULL,

  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  pickup_label text,
  dropoff_lat double precision NOT NULL,
  dropoff_lng double precision NOT NULL,
  dropoff_label text,

  distance_km numeric(6, 2) NOT NULL,
  distance_band text NOT NULL,

  suggested_contribution_tl integer NOT NULL,
  offered_contribution_tl integer NOT NULL,

  status text NOT NULL DEFAULT 'pending_responder',

  matched_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  decline_reason text,
  cancel_reason text,

  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  cancelled_at timestamptz,
  matched_at timestamptz,

  idempotency_key text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  schema_version smallint NOT NULL DEFAULT 1,

  CONSTRAINT rmr_participants_distinct
    CHECK (requester_id <> responder_id),

  CONSTRAINT rmr_status_valid
    CHECK (status IN (
      'pending_responder',
      'accepted',
      'declined',
      'expired',
      'cancelled'
    )),

  CONSTRAINT rmr_match_module_valid
    CHECK (match_module IN ('trusted_direct')),

  CONSTRAINT rmr_relationship_type_valid
    CHECK (relationship_type IN ('trusted')),

  CONSTRAINT rmr_vehicle_preference_valid
    CHECK (vehicle_preference IN ('car', 'motorcycle')),

  CONSTRAINT rmr_distance_band_valid
    CHECK (distance_band IN ('0_5', '5_10', '10_20')),

  CONSTRAINT rmr_distance_km_valid
    CHECK (distance_km > 0 AND distance_km <= 20),

  CONSTRAINT rmr_suggested_positive
    CHECK (suggested_contribution_tl > 0),

  CONSTRAINT rmr_offered_gte_suggested
    CHECK (offered_contribution_tl >= suggested_contribution_tl),

  CONSTRAINT rmr_pickup_label_len
    CHECK (pickup_label IS NULL OR char_length(pickup_label) <= 200),

  CONSTRAINT rmr_dropoff_label_len
    CHECK (dropoff_label IS NULL OR char_length(dropoff_label) <= 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rmr_one_pending_per_requester_module
  ON relationship_match_requests (requester_id, match_module)
  WHERE status = 'pending_responder';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rmr_idempotency_requester_key
  ON relationship_match_requests (requester_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rmr_requester_created
  ON relationship_match_requests (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rmr_responder_status
  ON relationship_match_requests (responder_id, status);

CREATE INDEX IF NOT EXISTS idx_rmr_pending_expires
  ON relationship_match_requests (expires_at)
  WHERE status = 'pending_responder';

CREATE INDEX IF NOT EXISTS idx_rmr_matched_tag
  ON relationship_match_requests (matched_tag_id)
  WHERE matched_tag_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rmr_connection_status
  ON relationship_match_requests (relationship_connection_id, status);

ALTER TABLE relationship_match_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE relationship_match_requests IS
  'RME schema foundation — match requests (TDM v1: match_module=trusted_direct). '
  'Backend service role only; no direct client access. No runtime behavior change until RME-3. '
  'Separate from quick_match_*, dispatch_queue, offers. Retention/anonymization: future RME-9.';

COMMENT ON COLUMN relationship_match_requests.match_module IS
  'RME module identifier. v1: trusted_direct only; future modules extend CHECK constraint.';

COMMENT ON COLUMN relationship_match_requests.relationship_type IS
  'Relationship context. v1: trusted (trusted_connections proof).';

COMMENT ON COLUMN relationship_match_requests.requester_id IS
  'User who initiated the match request (TDM v1: passenger).';

COMMENT ON COLUMN relationship_match_requests.responder_id IS
  'Target user for direct match (TDM v1: selected trusted driver).';

COMMENT ON COLUMN relationship_match_requests.relationship_connection_id IS
  'Active trusted_connections row proving bilateral trusted relationship at create time.';

COMMENT ON COLUMN relationship_match_requests.status IS
  'Lifecycle: pending_responder, accepted, declined, expired, cancelled. '
  'At most one pending_responder per (requester_id, match_module) via partial unique index.';

COMMENT ON COLUMN relationship_match_requests.matched_tag_id IS
  'Set on accept; links to tags row (match_channel=trusted) for journey lifecycle. ON DELETE SET NULL.';

COMMENT ON COLUMN relationship_match_requests.idempotency_key IS
  'Optional client retry key; unique per requester when set.';

COMMENT ON COLUMN relationship_match_requests.schema_version IS
  'Row schema version for forward-compatible migrations.';

-- =============================================================================
-- relationship_match_invites
-- =============================================================================

CREATE TABLE IF NOT EXISTS relationship_match_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id uuid NOT NULL
    REFERENCES relationship_match_requests(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES users(id),

  status text NOT NULL DEFAULT 'pending_responder',

  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  decline_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  schema_version smallint NOT NULL DEFAULT 1,

  CONSTRAINT rmi_status_valid
    CHECK (status IN (
      'pending_responder',
      'accepted',
      'declined',
      'expired',
      'cancelled'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rmi_one_pending_per_request
  ON relationship_match_invites (request_id)
  WHERE status = 'pending_responder';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rmi_request_responder
  ON relationship_match_invites (request_id, responder_id);

CREATE INDEX IF NOT EXISTS idx_rmi_responder_status
  ON relationship_match_invites (responder_id, status);

CREATE INDEX IF NOT EXISTS idx_rmi_pending_expires
  ON relationship_match_invites (expires_at)
  WHERE status = 'pending_responder';

ALTER TABLE relationship_match_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE relationship_match_invites IS
  'RME schema foundation — per-request invite (TDM v1: single target driver). '
  'Backend service role only; no direct client access. No runtime behavior change until RME-3. '
  'CASCADE delete with parent request (ops only). Separate from quick_match_invites.';

COMMENT ON COLUMN relationship_match_invites.request_id IS
  'Parent relationship_match_requests row; CASCADE delete when request row is removed (ops only).';

COMMENT ON COLUMN relationship_match_invites.responder_id IS
  'Target responder for this invite (TDM v1: equals request.responder_id).';

COMMENT ON COLUMN relationship_match_invites.status IS
  'Lifecycle: pending_responder, accepted, declined, expired, cancelled. '
  'At most one pending_responder per request via partial unique index.';

COMMENT ON COLUMN relationship_match_invites.expires_at IS
  'Per-invite TTL; orchestrator expires pending_responder when passed.';

COMMENT ON COLUMN relationship_match_invites.schema_version IS
  'Row schema version for forward-compatible migrations.';

-- =============================================================================
-- relationship_match_events (append-only audit)
-- =============================================================================

CREATE TABLE IF NOT EXISTS relationship_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id uuid NOT NULL
    REFERENCES relationship_match_requests(id) ON DELETE RESTRICT,
  invite_id uuid
    REFERENCES relationship_match_invites(id) ON DELETE SET NULL,

  match_module text NOT NULL,
  event_type text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,

  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rme_request_created
  ON relationship_match_events (request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rme_module_type_created
  ON relationship_match_events (match_module, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rme_created
  ON relationship_match_events (created_at);

ALTER TABLE relationship_match_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE relationship_match_events IS
  'RME schema foundation — append-only audit events. payload_json must be PII-minimized. '
  'Backend service role only; no direct client access. No runtime behavior change until RME-3/RME-9. '
  'Retention/anonymization: future RME-9 job.';

COMMENT ON COLUMN relationship_match_events.request_id IS
  'Parent request; ON DELETE RESTRICT — requests are anonymized in place, not hard-deleted.';

COMMENT ON COLUMN relationship_match_events.invite_id IS
  'Optional invite reference; ON DELETE SET NULL preserves event timeline.';

COMMENT ON COLUMN relationship_match_events.event_type IS
  'Audit event name, e.g. request_created, accepted, declined, expired, cancelled, matched.';

COMMENT ON COLUMN relationship_match_events.payload_json IS
  'PII-safe structured payload; no phone, email, raw coordinates duplicate, or driver_details JSON.';
