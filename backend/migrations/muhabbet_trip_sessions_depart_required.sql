-- Leylek Yol Oturumu: depart ve required passenger hazırlığı.
-- Bu migration yalnız Muhabbet trip session payload hazırlığı içindir; QR lifecycle davranışını değiştirmez.

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS required_passenger_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS depart_confirmed_at timestamptz NULL;

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS depart_confirmed_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS depart_reason text NULL;

COMMENT ON COLUMN public.muhabbet_trip_sessions.required_passenger_ids IS
  'Leylek Yol Oturumu: depart anında tamamlanması gereken onboard yolcu kullanıcı id listesi.';

COMMENT ON COLUMN public.muhabbet_trip_sessions.depart_confirmed_at IS
  'Leylek Yol Oturumu: sürücünün boş koltukla veya tüm yolcularla yola çıkmayı onayladığı zaman.';

COMMENT ON COLUMN public.muhabbet_trip_sessions.depart_confirmed_by_user_id IS
  'Leylek Yol Oturumu: depart kararını onaylayan kullanıcı.';

COMMENT ON COLUMN public.muhabbet_trip_sessions.depart_reason IS
  'Leylek Yol Oturumu: depart kararının kısa nedeni.';
