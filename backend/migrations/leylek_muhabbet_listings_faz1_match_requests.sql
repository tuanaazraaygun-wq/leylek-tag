-- Leylek Muhabbeti FAZ 1 — ilan (ride_listings) + eşleşme isteği (listing_match_requests)
-- Önkoşul: public.users, public.user_routes (güzergah tablosu; linked_user_route_id için nullable FK)
-- Mevcut route / auto_groups / groups / posts akışlarına dokunmaz.

CREATE TABLE IF NOT EXISTS public.ride_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  linked_user_route_id uuid NULL REFERENCES public.user_routes (id) ON DELETE SET NULL,
  linked_pattern_hash text NULL,
  city text NOT NULL,
  from_text text NOT NULL,
  to_text text NOT NULL,
  start_lat double precision NULL,
  start_lng double precision NULL,
  end_lat double precision NULL,
  end_lng double precision NULL,
  departure_time timestamptz NULL,
  listing_type text NOT NULL,
  role_type text NOT NULL,
  price_amount numeric NULL,
  note text NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ride_listings_listing_type_chk CHECK (
    listing_type IN ('gidiyorum', 'gidecegim', 'beni_alsin', 'ozel_sofor')
  ),
  CONSTRAINT ride_listings_role_type_chk CHECK (role_type IN ('driver', 'passenger', 'private_driver')),
  CONSTRAINT ride_listings_status_chk CHECK (status IN ('active', 'matched', 'closed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_ride_listings_city_status_created
  ON public.ride_listings (city, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ride_listings_creator_created
  ON public.ride_listings (created_by_user_id, created_at DESC);

COMMENT ON TABLE public.ride_listings IS 'Leylek Muhabbeti FAZ 1 — ilan; route zorunlu değil, linked_* opsiyonel.';

CREATE TABLE IF NOT EXISTS public.listing_match_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ride_listings (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  receiver_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_match_req_status_chk CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  CONSTRAINT listing_match_req_sender_ne_receiver CHECK (sender_user_id <> receiver_user_id)
);

-- Yalnızca pending: aynı ilan+alıcı+kabul eden (sender); reject/cancel sonrası yeni satır açılabilir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lmr_pending_listing_sender_receiver
  ON public.listing_match_requests (listing_id, sender_user_id, receiver_user_id)
  WHERE (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_listing_match_receiver_status_created
  ON public.listing_match_requests (receiver_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_match_sender_status_created
  ON public.listing_match_requests (sender_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_match_listing_status
  ON public.listing_match_requests (listing_id, status);

COMMENT ON TABLE public.listing_match_requests IS 'Faz 1 — eşleşme isteği; chat / anahtar yok.';
