-- Muhabbet trip: sesli görüşme alanları (REST + polling).
-- Production'da ana migration'dan önce oluşturulmuş tablolarda bu kolonlar eksik olabilir.
-- Tekrar çalıştırılabilir: ADD COLUMN IF NOT EXISTS

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS call_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_caller_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS call_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS call_state text NULL;

COMMENT ON COLUMN public.muhabbet_trip_sessions.call_active IS 'Muhabbet trip içi sesli görüşme açık mı';
COMMENT ON COLUMN public.muhabbet_trip_sessions.call_caller_id IS 'Aramayı başlatan kullanıcı (API yanıtında caller_id olarak map edilir)';
COMMENT ON COLUMN public.muhabbet_trip_sessions.call_started_at IS 'Çağrının başlangıç zamanı';
COMMENT ON COLUMN public.muhabbet_trip_sessions.call_state IS 'Örn. ringing, active (uygulama katmanı)';
