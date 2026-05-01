-- Muhabbet trip: zorla bitir zaman aşımı + çağrı kanal adı + timeout yanıtı
-- Idempotent: ADD COLUMN IF NOT EXISTS

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS call_channel_name text NULL,
  ADD COLUMN IF NOT EXISTS forced_finish_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS forced_finish_timeout_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS forced_finish_request_id uuid NULL;

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_forced_finish_other_user_response_check;

ALTER TABLE public.muhabbet_trip_sessions
  ADD CONSTRAINT muhabbet_trip_sessions_forced_finish_other_user_response_check
  CHECK (
    forced_finish_other_user_response IS NULL
    OR forced_finish_other_user_response IN ('accepted', 'declined', 'timeout')
  );

COMMENT ON COLUMN public.muhabbet_trip_sessions.call_channel_name IS 'Muhabbet ses kanalı — Agora ile eşleşir';
COMMENT ON COLUMN public.muhabbet_trip_sessions.forced_finish_timeout_at IS 'ready+biniş öncesi: yanıt için son tarih (UTC)';
