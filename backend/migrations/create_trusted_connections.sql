-- Trusted Driver Network — Phase A1 (schema only)
-- Application code does not read/write this table until a later phase.
-- Apply via Supabase SQL Editor or migration runner.
-- No runtime behavior change.

CREATE TABLE IF NOT EXISTS trusted_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  initiator_id uuid NOT NULL REFERENCES users(id),
  counterparty_id uuid NOT NULL REFERENCES users(id),
  initiator_role text NOT NULL,
  counterparty_role text NOT NULL,

  status text NOT NULL DEFAULT 'pending',

  source_tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  last_trip_at timestamptz,

  revoked_by uuid REFERENCES users(id),
  revoke_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  schema_version smallint NOT NULL DEFAULT 1,

  pair_key text GENERATED ALWAYS AS (
    LEAST(initiator_id::text, counterparty_id::text)
    || ':'
    || GREATEST(initiator_id::text, counterparty_id::text)
  ) STORED,

  CONSTRAINT trusted_connections_participants_distinct
    CHECK (initiator_id <> counterparty_id),

  CONSTRAINT trusted_connections_roles_valid
    CHECK (
      initiator_role IN ('passenger', 'driver')
      AND counterparty_role IN ('passenger', 'driver')
      AND (
        (initiator_role = 'passenger' AND counterparty_role = 'driver')
        OR (initiator_role = 'driver' AND counterparty_role = 'passenger')
      )
    ),

  CONSTRAINT trusted_connections_status_valid
    CHECK (status IN ('pending', 'active', 'declined', 'revoked', 'expired')),

  CONSTRAINT trusted_connections_revoke_reason_valid
    CHECK (
      revoke_reason IS NULL
      OR revoke_reason IN (
        'user_revoke',
        'block',
        'admin',
        'account_deleted',
        'expired_system'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_trusted_connections_initiator_status_invited
  ON trusted_connections (initiator_id, status, invited_at DESC);

CREATE INDEX IF NOT EXISTS idx_trusted_connections_counterparty_status_invited
  ON trusted_connections (counterparty_id, status, invited_at DESC);

CREATE INDEX IF NOT EXISTS idx_trusted_connections_source_tag_id
  ON trusted_connections (source_tag_id)
  WHERE source_tag_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_connections_expires_at_pending
  ON trusted_connections (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trusted_connections_pair_open
  ON trusted_connections (pair_key)
  WHERE status IN ('pending', 'active');

ALTER TABLE trusted_connections ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE trusted_connections IS
  'Trusted Driver Network (Sürücülerim / Yolcularım). Backend service role only; no direct client access. Phase A1: schema only.';

COMMENT ON COLUMN trusted_connections.initiator_id IS
  'User who sent the trusted-network invite.';
COMMENT ON COLUMN trusted_connections.counterparty_id IS
  'User who receives or holds the other side of the trusted relationship.';
COMMENT ON COLUMN trusted_connections.initiator_role IS
  'Role of initiator at invite time: passenger or driver.';
COMMENT ON COLUMN trusted_connections.counterparty_role IS
  'Role of counterparty at invite time: passenger or driver.';
COMMENT ON COLUMN trusted_connections.status IS
  'Lifecycle: pending, active, declined, revoked, expired. Block is derived via blocked_users, not stored here.';
COMMENT ON COLUMN trusted_connections.source_tag_id IS
  'Completed normal tag that proves the invite eligibility; SET NULL if tag row is removed.';
COMMENT ON COLUMN trusted_connections.pair_key IS
  'Canonical user pair (LEAST:uuid:GREATEST:uuid) for open-connection uniqueness.';
COMMENT ON COLUMN trusted_connections.revoke_reason IS
  'Nullable; when set: user_revoke, block, admin, account_deleted, expired_system.';
COMMENT ON COLUMN trusted_connections.schema_version IS
  'Row schema version for forward-compatible migrations.';
