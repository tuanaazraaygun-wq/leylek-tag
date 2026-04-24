-- Leylek Muhabbeti: ilan yaşam döngüsü (ride_listings)
-- Normal yolculuk / dispatch tablolarına dokunmaz.
-- FK: İsterseniz Supabase’de accepted_match_request_id -> listing_match_requests(id),
-- accepted_user_id -> users(id), matched_conversation_id -> conversations(id) elle ekleyin.

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS accepted_match_request_id uuid;

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS accepted_user_id uuid;

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS matched_conversation_id uuid;

CREATE INDEX IF NOT EXISTS idx_ride_listings_expires_at ON public.ride_listings (expires_at);
CREATE INDEX IF NOT EXISTS idx_ride_listings_matched_conversation_id ON public.ride_listings (matched_conversation_id);

COMMENT ON COLUMN public.ride_listings.expires_at IS 'Muhabbet: feed süresi; ilan açılışında +60 dk.';
COMMENT ON COLUMN public.ride_listings.accepted_match_request_id IS 'Muhabbet: kabul edilen talip.';
COMMENT ON COLUMN public.ride_listings.accepted_user_id IS 'Muhabbet: kabul edilen talip gönderen kullanıcı.';
COMMENT ON COLUMN public.ride_listings.matched_conversation_id IS 'Muhabbet: açılan sohbet (pending_chat → Leylek matched).';

UPDATE public.ride_listings
SET expires_at = created_at + interval '60 minutes'
WHERE expires_at IS NULL AND status = 'active';
