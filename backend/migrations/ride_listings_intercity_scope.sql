-- Leylek Muhabbet / Teklif Sende: şehir içi vs şehirler arası ilan kapsamı.
-- Normal ride / tags / dispatch tablolarına dokunmaz.

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS listing_scope text NOT NULL DEFAULT 'local';

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS origin_city text;

ALTER TABLE public.ride_listings
  ADD COLUMN IF NOT EXISTS destination_city text;

UPDATE public.ride_listings
SET
  listing_scope = COALESCE(NULLIF(trim(listing_scope), ''), 'local'),
  origin_city = COALESCE(NULLIF(trim(origin_city), ''), city),
  destination_city = COALESCE(NULLIF(trim(destination_city), ''), city)
WHERE listing_scope IS NULL
   OR trim(listing_scope) = ''
   OR origin_city IS NULL
   OR trim(origin_city) = ''
   OR destination_city IS NULL
   OR trim(destination_city) = '';

ALTER TABLE public.ride_listings
  ALTER COLUMN listing_scope SET DEFAULT 'local';

ALTER TABLE public.ride_listings
  ALTER COLUMN listing_scope SET NOT NULL;

ALTER TABLE public.ride_listings
  DROP CONSTRAINT IF EXISTS ride_listings_listing_scope_chk;

ALTER TABLE public.ride_listings
  ADD CONSTRAINT ride_listings_listing_scope_chk
  CHECK (listing_scope IN ('local', 'intercity'));

ALTER TABLE public.ride_listings
  DROP CONSTRAINT IF EXISTS ride_listings_scope_city_chk;

ALTER TABLE public.ride_listings
  ADD CONSTRAINT ride_listings_scope_city_chk
  CHECK (
    (listing_scope = 'local' AND city IS NOT NULL)
    OR
    (
      listing_scope = 'intercity'
      AND origin_city IS NOT NULL
      AND destination_city IS NOT NULL
      AND lower(trim(origin_city)) <> lower(trim(destination_city))
    )
  );

ALTER TABLE public.ride_listings
  DROP CONSTRAINT IF EXISTS ride_listings_status_chk;

ALTER TABLE public.ride_listings
  ADD CONSTRAINT ride_listings_status_chk
  CHECK (status IN ('active', 'pending_chat', 'matched', 'closed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_ride_listings_scope_city_status_created
  ON public.ride_listings (listing_scope, city, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ride_listings_intercity_origin_status_created
  ON public.ride_listings (origin_city, status, created_at DESC)
  WHERE listing_scope = 'intercity';

CREATE INDEX IF NOT EXISTS idx_ride_listings_intercity_destination_status_created
  ON public.ride_listings (destination_city, status, created_at DESC)
  WHERE listing_scope = 'intercity';

COMMENT ON COLUMN public.ride_listings.listing_scope IS
  'Leylek Muhabbet/Teklif Sende: local şehir içi, intercity şehirler arası.';

COMMENT ON COLUMN public.ride_listings.origin_city IS
  'Intercity kalkış şehri; local ilanlarda city ile aynı.';

COMMENT ON COLUMN public.ride_listings.destination_city IS
  'Intercity varış şehri; local ilanlarda city ile aynı.';
