-- MATCH-REL-1A: driver-seen telemetry for quick match invites (schema only).
-- Column: quick_match_invites.driver_seen_at — driver poll telemetry; existing rows remain NULL (safe).

ALTER TABLE public.quick_match_invites
  ADD COLUMN IF NOT EXISTS driver_seen_at timestamptz;

COMMENT ON COLUMN public.quick_match_invites.driver_seen_at IS
  'First time the target driver poll returned this pending invite. NULL = never seen by driver.';
