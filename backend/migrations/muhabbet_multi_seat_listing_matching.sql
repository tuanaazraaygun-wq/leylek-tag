-- Muhabbet Leylek Teklifi — çoklu koltuk ilan eşleşmesi: feed görünürlüğü + süre
-- Normal TAG ride / dispatch tablolarına dokunmaz; yalnız ride_listings.

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS matching_status text NOT NULL DEFAULT 'open';

ALTER TABLE public.ride_listings
  DROP CONSTRAINT IF EXISTS ride_listings_matching_status_chk;

ALTER TABLE public.ride_listings
  ADD CONSTRAINT ride_listings_matching_status_chk
  CHECK (matching_status IN ('open', 'full', 'closed_expired', 'closed_manual'));

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS matching_deadline_at timestamptz NULL;

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS accepted_passenger_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ride_listings.matching_status IS
  'Muhabbet intercity: open = yeni yolcu kabulü; full = kontenjan dolu; closed_* = eşleşme kapalı.';
COMMENT ON COLUMN public.ride_listings.matching_deadline_at IS
  'Genelde departure_time + 3 saat; bu süre sonunda open ilanlar closed_expired olur.';
COMMENT ON COLUMN public.ride_listings.accepted_passenger_count IS
  'listing_match_requests status=accepted sayısı (feed ve kapasite için özet).';

-- Backfill: accepted sayımı
UPDATE public.ride_listings rl
SET accepted_passenger_count = COALESCE(ac.cnt, 0)
FROM (
  SELECT listing_id AS lid, COUNT(*)::integer AS cnt
  FROM public.listing_match_requests
  WHERE status = 'accepted'
  GROUP BY listing_id
) ac
WHERE rl.id = ac.lid;

UPDATE public.ride_listings
SET accepted_passenger_count = 0
WHERE accepted_passenger_count IS NULL;

-- Backfill: matching_deadline_at (önce kalkış zamanı + 3 saat)
UPDATE public.ride_listings
SET matching_deadline_at = departure_time + interval '3 hours'
WHERE listing_scope = 'intercity'
  AND departure_time IS NOT NULL
  AND matching_deadline_at IS NULL;

-- Kalkış yoksa: expires_at veya created_at + 3 saat
UPDATE public.ride_listings
SET matching_deadline_at = COALESCE(expires_at, created_at, now()) + interval '3 hours'
WHERE listing_scope = 'intercity'
  AND matching_deadline_at IS NULL;

-- Backfill: matching_status
UPDATE public.ride_listings
SET matching_status = CASE
  WHEN listing_scope IS DISTINCT FROM 'intercity' THEN matching_status
  WHEN status IN ('cancelled', 'closed') THEN 'closed_manual'
  WHEN COALESCE(seat_capacity, 1) <= COALESCE(accepted_passenger_count, 0)
    AND COALESCE(accepted_passenger_count, 0) > 0
    THEN 'full'
  ELSE 'open'
END
WHERE listing_scope = 'intercity';

UPDATE public.ride_listings
SET matching_status = 'open'
WHERE listing_scope IS DISTINCT FROM 'intercity';

CREATE INDEX IF NOT EXISTS idx_ride_listings_matching_status_deadline
  ON public.ride_listings (matching_status, matching_deadline_at)
  WHERE listing_scope = 'intercity';

CREATE INDEX IF NOT EXISTS idx_ride_listings_intercity_feed_open
  ON public.ride_listings (listing_scope, status, matching_status)
  WHERE listing_scope = 'intercity'
    AND status = 'active'
    AND matching_status = 'open';
