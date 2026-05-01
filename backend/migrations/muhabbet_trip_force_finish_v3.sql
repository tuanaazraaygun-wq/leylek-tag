-- Muhabbet trip: force-finish decline keeps session active; timeout auto-accept; finish_method forced_timeout
-- Idempotent

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS forced_finish_resolved_at timestamptz NULL;

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_finish_method_check;

ALTER TABLE public.muhabbet_trip_sessions
  ADD CONSTRAINT muhabbet_trip_sessions_finish_method_check
  CHECK (
    finish_method IS NULL
    OR finish_method IN ('qr', 'forced', 'forced_timeout')
  );

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_forced_finish_other_user_response_check;

ALTER TABLE public.muhabbet_trip_sessions
  ADD CONSTRAINT muhabbet_trip_sessions_forced_finish_other_user_response_check
  CHECK (
    forced_finish_other_user_response IS NULL
    OR forced_finish_other_user_response IN ('accepted', 'declined', 'timeout', 'timeout_auto_accepted')
  );

COMMENT ON COLUMN public.muhabbet_trip_sessions.forced_finish_resolved_at IS 'Zorla bitir reddi sonrası çözüm zamanı (UTC)';
