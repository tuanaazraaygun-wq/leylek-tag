-- Tek conversation için en fazla bir pending trip conversion isteği.
-- Önce mükerrer pending satırları temizlenir (en güncel tutulur), sonra kısmi UNIQUE index.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY conversation_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.muhabbet_trip_conversion_requests
  WHERE status = 'pending'
)
DELETE FROM public.muhabbet_trip_conversion_requests r
USING ranked x
WHERE r.id = x.id
  AND x.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_trip_request
  ON public.muhabbet_trip_conversion_requests (conversation_id)
  WHERE (status = 'pending');

COMMENT ON INDEX public.unique_pending_trip_request IS
  'Aynı sohbette tek bir pending yolculuğa çevirme isteği; yarış ve çift tıklama koruması.';
