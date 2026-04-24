-- Leylek Muhabbeti — talep gönderenin niyeti (yetki/KYC ile karışmaması için).
-- passenger_offer ilanına talip → actor_intent = driver
-- driver_offer ilanına "beni de al" → actor_intent = passenger

ALTER TABLE public.listing_match_requests
  ADD COLUMN IF NOT EXISTS actor_intent text NOT NULL DEFAULT 'passenger';

COMMENT ON COLUMN public.listing_match_requests.actor_intent IS
  'Talep anındaki niyet: driver (yolcu ilanına talip) | passenger (sürücü ilanına yolcu olarak talep).';

-- Mevcut satırlar: ilan türüne göre sunucu varsayılanıyla hizala (_muhabbet_listing_offer_kind).
UPDATE public.listing_match_requests lmr
SET
  actor_intent = CASE
    WHEN lower(trim(coalesce(rl.listing_type, ''))) IN ('gidiyorum', 'ozel_sofor') THEN 'passenger'
    WHEN lower(trim(coalesce(rl.listing_type, ''))) IN ('gidecegim', 'beni_alsin') THEN 'driver'
    WHEN lower(trim(coalesce(rl.role_type, ''))) IN ('driver', 'private_driver') THEN 'passenger'
    ELSE 'driver'
  END,
  updated_at = now()
FROM public.ride_listings rl
WHERE rl.id = lmr.listing_id;

ALTER TABLE public.listing_match_requests
  DROP CONSTRAINT IF EXISTS listing_match_requests_actor_intent_chk;

ALTER TABLE public.listing_match_requests
  ADD CONSTRAINT listing_match_requests_actor_intent_chk
  CHECK (lower(trim(actor_intent)) IN ('driver', 'passenger'));
