-- Sequential Quick Match — Phase P6-B1 (schema only)
-- Tables: quick_match_requests, quick_match_invites
-- Application code does not read/write these tables until P6-C orchestrator.
-- Apply via Supabase SQL Editor or migration runner.
-- No runtime behavior change. tags.match_channel is P6-B2 (separate migration).
-- No direct client access: RLS enabled, no policies (backend service role only).

-- =============================================================================
-- quick_match_requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS quick_match_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  passenger_id uuid NOT NULL REFERENCES users(id),

  status text NOT NULL DEFAULT 'sequencing',

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

  vehicle_preference text,

  attempt_count integer NOT NULL DEFAULT 0,

  matched_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  matched_at timestamptz,
  cancelled_at timestamptz,
  exhausted_at timestamptz,
  expired_at timestamptz,

  expires_at timestamptz NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  schema_version smallint NOT NULL DEFAULT 1,

  CONSTRAINT quick_match_requests_status_valid
    CHECK (status IN ('sequencing', 'matched', 'exhausted', 'expired', 'cancelled')),

  CONSTRAINT quick_match_requests_distance_band_valid
    CHECK (distance_band IN ('0_5', '5_10', '10_20')),

  CONSTRAINT quick_match_requests_distance_km_valid
    CHECK (distance_km > 0 AND distance_km <= 20),

  CONSTRAINT quick_match_requests_suggested_positive
    CHECK (suggested_contribution_tl > 0),

  CONSTRAINT quick_match_requests_offered_gte_suggested
    CHECK (offered_contribution_tl >= suggested_contribution_tl),

  CONSTRAINT quick_match_requests_attempt_count_valid
    CHECK (attempt_count >= 0),

  CONSTRAINT quick_match_requests_vehicle_preference_valid
    CHECK (
      vehicle_preference IS NULL
      OR vehicle_preference IN ('car', 'motorcycle')
    )
);

CREATE INDEX IF NOT EXISTS idx_quick_match_requests_passenger_status
  ON quick_match_requests (passenger_id, status);

CREATE INDEX IF NOT EXISTS idx_quick_match_requests_sequencing_expires
  ON quick_match_requests (status, expires_at)
  WHERE status = 'sequencing';

CREATE INDEX IF NOT EXISTS idx_quick_match_requests_matched_tag
  ON quick_match_requests (matched_tag_id)
  WHERE matched_tag_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quick_match_requests_created_at
  ON quick_match_requests (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quick_match_requests_one_sequencing_per_passenger
  ON quick_match_requests (passenger_id)
  WHERE status = 'sequencing';

ALTER TABLE quick_match_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE quick_match_requests IS
  'Sequential Quick Match passenger requests. Backend service role only; no direct client access. P6-B1 schema only. Separate from normal dispatch_queue/offers.';

COMMENT ON COLUMN quick_match_requests.passenger_id IS
  'JWT actor (passenger) who started the quick match request.';

COMMENT ON COLUMN quick_match_requests.status IS
  'Lifecycle: sequencing (active search), matched, exhausted (no drivers in radius), expired (TTL), cancelled (passenger).';

COMMENT ON COLUMN quick_match_requests.distance_band IS
  'System-computed band from route distance: 0_5, 5_10, or 10_20 km.';

COMMENT ON COLUMN quick_match_requests.suggested_contribution_tl IS
  'System-suggested yol masrafı katkısı (TL, integer). Not a fare, tariff, or platform payment.';

COMMENT ON COLUMN quick_match_requests.offered_contribution_tl IS
  'Passenger contribution offer (TL); must be >= suggested_contribution_tl. LeylekTAG does not collect payment.';

COMMENT ON COLUMN quick_match_requests.vehicle_preference IS
  'Optional vehicle filter: car or motorcycle; aligns with tags.passenger_preferred_vehicle vocabulary.';

COMMENT ON COLUMN quick_match_requests.attempt_count IS
  'Number of sequential driver invite rounds attempted for this request.';

COMMENT ON COLUMN quick_match_requests.matched_tag_id IS
  'Set when a driver accepts; links to tags row for QR → in_progress → completed lifecycle. ON DELETE SET NULL.';

COMMENT ON COLUMN quick_match_requests.expires_at IS
  'Request-level TTL; orchestrator moves status to expired when passed.';

COMMENT ON COLUMN quick_match_requests.schema_version IS
  'Row schema version for forward-compatible migrations.';

-- =============================================================================
-- quick_match_invites
-- =============================================================================

CREATE TABLE IF NOT EXISTS quick_match_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id uuid NOT NULL REFERENCES quick_match_requests(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES users(id),

  status text NOT NULL DEFAULT 'pending_driver',

  sequence_no smallint NOT NULL,

  driver_distance_km numeric(6, 2),
  decline_reason text,

  expires_at timestamptz NOT NULL,
  responded_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  schema_version smallint NOT NULL DEFAULT 1,

  CONSTRAINT quick_match_invites_status_valid
    CHECK (status IN ('pending_driver', 'accepted', 'declined', 'expired', 'cancelled')),

  CONSTRAINT quick_match_invites_sequence_positive
    CHECK (sequence_no > 0),

  CONSTRAINT quick_match_invites_driver_distance_valid
    CHECK (driver_distance_km IS NULL OR driver_distance_km >= 0),

  CONSTRAINT quick_match_invites_decline_reason_valid
    CHECK (
      decline_reason IS NULL
      OR decline_reason IN (
        'driver_declined',
        'timeout',
        'superseded',
        'system_cancelled',
        'passenger_cancelled'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_quick_match_invites_request_status
  ON quick_match_invites (request_id, status);

CREATE INDEX IF NOT EXISTS idx_quick_match_invites_driver_status
  ON quick_match_invites (driver_id, status);

CREATE INDEX IF NOT EXISTS idx_quick_match_invites_pending_expires
  ON quick_match_invites (expires_at)
  WHERE status = 'pending_driver';

CREATE UNIQUE INDEX IF NOT EXISTS uq_quick_match_invites_request_driver
  ON quick_match_invites (request_id, driver_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quick_match_invites_one_pending_per_request
  ON quick_match_invites (request_id)
  WHERE status = 'pending_driver';

ALTER TABLE quick_match_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE quick_match_invites IS
  'Sequential Quick Match driver invites (one pending_driver per request at a time). Backend service role only. Not dispatch_queue or new_passenger_offer.';

COMMENT ON COLUMN quick_match_invites.request_id IS
  'Parent quick_match_requests row; CASCADE delete when request row is removed (ops only).';

COMMENT ON COLUMN quick_match_invites.driver_id IS
  'Target driver for this sequential invite round.';

COMMENT ON COLUMN quick_match_invites.status IS
  'Lifecycle: pending_driver, accepted, declined, expired, cancelled (superseded by another accept or request cancel).';

COMMENT ON COLUMN quick_match_invites.sequence_no IS
  '1-based attempt sequence within the request; matches orchestrator round number.';

COMMENT ON COLUMN quick_match_invites.driver_distance_km IS
  'Snapshot: driver distance to pickup at invite time (Quick Match 3 km radius enforced in app layer).';

COMMENT ON COLUMN quick_match_invites.decline_reason IS
  'Nullable terminal reason: driver_declined, timeout, superseded, system_cancelled, passenger_cancelled.';

COMMENT ON COLUMN quick_match_invites.expires_at IS
  'Per-invite TTL; orchestrator expires pending_driver when passed.';

COMMENT ON COLUMN quick_match_invites.schema_version IS
  'Row schema version for forward-compatible migrations.';
