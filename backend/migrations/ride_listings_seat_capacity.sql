-- Muhabbet ride_listings: çoklu koltuk.
-- Önceki kurulumda seat_capacity için farklı constraint adı kullanıldıysa hem eski hem yeni ad düşürülür.

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS seat_capacity integer NOT NULL DEFAULT 1;

ALTER TABLE public.ride_listings
  DROP CONSTRAINT IF EXISTS ride_listings_seat_capacity_chk;

ALTER TABLE public.ride_listings
  DROP CONSTRAINT IF EXISTS ride_listings_seat_capacity_check;

ALTER TABLE public.ride_listings
  ADD CONSTRAINT ride_listings_seat_capacity_check CHECK (seat_capacity >= 1);

COMMENT ON COLUMN public.ride_listings.seat_capacity IS
  'Muhabbet Leylek: aynı ilanda kaç yolcu kabul edilebilir (intercity / muhabbet_trip).';

-- Mevcut eski kayıtlar
UPDATE public.ride_listings
SET seat_capacity = coalesce(seat_capacity, 1);
