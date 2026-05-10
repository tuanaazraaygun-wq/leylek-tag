-- Leylek Yol Oturumu: esnek pickup hazırlığı.
-- Normal TAG / tags / normal QR akışlarına dokunmaz.

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS active_pickup_passenger_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS active_pickup_selected_at timestamptz NULL;

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS active_pickup_selected_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.muhabbet_trip_sessions.active_pickup_passenger_id IS
  'Leylek Yol Oturumu: sürücünün şu anda almaya gittiği yolcu; pickup_order yalnızca öneri/legacy sıradır.';

COMMENT ON COLUMN public.muhabbet_trip_sessions.active_pickup_selected_at IS
  'Leylek Yol Oturumu: aktif pickup yolcusunun seçildiği zaman.';

COMMENT ON COLUMN public.muhabbet_trip_sessions.active_pickup_selected_by_user_id IS
  'Leylek Yol Oturumu: aktif pickup yolcusunu seçen kullanıcı.';

ALTER TABLE public.muhabbet_trip_passengers
  DROP CONSTRAINT IF EXISTS muhabbet_trip_passengers_status_check;

ALTER TABLE public.muhabbet_trip_passengers
  DROP CONSTRAINT IF EXISTS muhabbet_trip_passengers_status_chk;

ALTER TABLE public.muhabbet_trip_passengers
  ADD CONSTRAINT muhabbet_trip_passengers_status_check
  CHECK (
    status IN (
      'invited',
      'accepted',
      'waiting_pickup',
      'boarding',
      'pickup_active',
      'onboard',
      'boarded',
      'cancelled',
      'no_show',
      'completed'
    )
  );

COMMENT ON COLUMN public.muhabbet_trip_passengers.status IS
  'Passenger leg durumu. Legacy boarding/onboard korunur; yeni esnek pickup UI waiting_pickup/pickup_active/boarded kullanabilir.';
