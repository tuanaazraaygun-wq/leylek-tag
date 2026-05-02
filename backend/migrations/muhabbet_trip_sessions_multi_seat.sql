-- Muhabbet Leylek trip: çoklu yolcu / koltuk (uuid[]).
-- NOT: Daha önce jsonb ile bu isimlerde sütun eklendiyse önce jsonb sütunları kaldırıp/tip dönüştürüp bu dosyayı çalıştırın.
-- Repo içi eski migration constraint adları için DROP IF EXISTS geniş tutuldu.

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS seat_capacity integer NOT NULL DEFAULT 1;

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS accepted_passenger_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS boarded_passenger_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS ride_status text NOT NULL DEFAULT 'waiting';

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_seat_capacity_chk;

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_seat_capacity_check;

ALTER TABLE public.muhabbet_trip_sessions
  ADD CONSTRAINT muhabbet_trip_sessions_seat_capacity_check CHECK (seat_capacity >= 1);

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_ride_status_chk;

ALTER TABLE public.muhabbet_trip_sessions
  DROP CONSTRAINT IF EXISTS muhabbet_trip_sessions_ride_status_check;

ALTER TABLE public.muhabbet_trip_sessions
  ADD CONSTRAINT muhabbet_trip_sessions_ride_status_check CHECK (
    ride_status IN ('waiting', 'boarding', 'active', 'finished', 'cancelled', 'expired')
  );

COMMENT ON COLUMN public.muhabbet_trip_sessions.seat_capacity IS
  'Çoklu yolcu koltuk sayısı (listing ile uyumlu; >1 ise çoklu mantık).';

COMMENT ON COLUMN public.muhabbet_trip_sessions.accepted_passenger_ids IS
  'Kabul edilen yolcu kullanıcı UUID dizisi.';

COMMENT ON COLUMN public.muhabbet_trip_sessions.boarded_passenger_ids IS
  'QR ile binmiş yolcu UUID dizisi (accepted alt kümesi).';

COMMENT ON COLUMN public.muhabbet_trip_sessions.ride_status IS
  'Çoklu oturum fazı; status kolonundan ayrı (waiting|boarding|active|finished|cancelled|expired).';

-- Mevcut eski kayıtları uyumlu hale getir
UPDATE public.muhabbet_trip_sessions
SET
  seat_capacity = coalesce(seat_capacity, 1),
  accepted_passenger_ids = CASE
    WHEN accepted_passenger_ids IS NULL OR cardinality(accepted_passenger_ids) = 0
      THEN array_remove(array[passenger_id], NULL)
    ELSE accepted_passenger_ids
  END,
  boarded_passenger_ids = CASE
    WHEN boarded_passenger_ids IS NULL THEN '{}'::uuid[]
    ELSE boarded_passenger_ids
  END,
  ride_status = CASE
    WHEN status = 'finished' THEN 'finished'
    WHEN status = 'cancelled' THEN 'cancelled'
    WHEN status = 'expired' THEN 'expired'
    WHEN status IN ('active', 'started') THEN 'active'
    ELSE coalesce(ride_status, 'waiting')
  END;
