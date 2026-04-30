-- Faz 1 — Leylek Teklif Sende: yolcu üyelik satırları (çoklu yolcu altyapısı; tek session modeli korunur).
-- Önkoşul: muhabbet_trip_sessions, conversations, users, ride_listings, muhabbet_trip_conversion_requests

CREATE TABLE IF NOT EXISTS public.muhabbet_trip_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.muhabbet_trip_sessions (id) ON DELETE CASCADE,
  listing_id uuid NULL REFERENCES public.ride_listings (id) ON DELETE SET NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  conversion_request_id uuid NULL REFERENCES public.muhabbet_trip_conversion_requests (id) ON DELETE SET NULL,
  passenger_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'accepted'
    CHECK (
      status IN (
        'invited',
        'accepted',
        'boarding',
        'onboard',
        'cancelled',
        'no_show',
        'completed'
      )
    ),

  pickup_lat double precision NULL,
  pickup_lng double precision NULL,
  pickup_text text NULL,
  dropoff_lat double precision NULL,
  dropoff_lng double precision NULL,
  dropoff_text text NULL,

  agreed_price numeric NULL,
  payment_method text NULL CHECK (
    payment_method IS NULL OR payment_method IN ('cash', 'card')
  ),

  boarded_at timestamptz NULL,
  cancelled_at timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT muhabbet_trip_passengers_passenger_ne_driver CHECK (passenger_user_id <> driver_user_id),
  CONSTRAINT uq_muhabbet_trip_passengers_session_passenger UNIQUE (session_id, passenger_user_id),
  CONSTRAINT uq_muhabbet_trip_passengers_session_conversation UNIQUE (session_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_muhabbet_trip_passengers_session_status
  ON public.muhabbet_trip_passengers (session_id, status);

CREATE INDEX IF NOT EXISTS idx_muhabbet_trip_passengers_passenger_user
  ON public.muhabbet_trip_passengers (passenger_user_id, status);

CREATE INDEX IF NOT EXISTS idx_muhabbet_trip_passengers_listing
  ON public.muhabbet_trip_passengers (listing_id)
  WHERE listing_id IS NOT NULL;

COMMENT ON TABLE public.muhabbet_trip_passengers IS
  'Leylek Teklif Sende Faz 1: oturum başına yolcu üyeliği; özet sayımlar ve ileride çoklu yolcu için.';

-- Backfill: mevcut tek-yolcu session → tek passenger row
INSERT INTO public.muhabbet_trip_passengers (
  session_id,
  listing_id,
  conversation_id,
  conversion_request_id,
  passenger_user_id,
  driver_user_id,
  status,
  pickup_lat,
  pickup_lng,
  pickup_text,
  dropoff_lat,
  dropoff_lng,
  dropoff_text,
  agreed_price,
  payment_method,
  boarded_at,
  cancelled_at,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.listing_id,
  s.conversation_id,
  s.conversion_request_id,
  s.passenger_id,
  s.driver_id,
  CASE
    WHEN lower(trim(coalesce(s.status, ''))) IN ('cancelled', 'expired') THEN 'cancelled'::text
    WHEN lower(trim(coalesce(s.status, ''))) = 'finished' THEN 'completed'::text
    WHEN s.boarding_qr_confirmed_at IS NOT NULL THEN 'onboard'::text
    ELSE 'accepted'::text
  END,
  s.pickup_lat,
  s.pickup_lng,
  s.pickup_text,
  s.dropoff_lat,
  s.dropoff_lng,
  s.dropoff_text,
  s.agreed_price,
  s.payment_method,
  s.boarding_qr_confirmed_at,
  CASE
    WHEN lower(trim(coalesce(s.status, ''))) IN ('cancelled', 'expired')
      THEN coalesce(s.cancelled_at, s.expired_at, s.updated_at, now())
    ELSE NULL
  END,
  coalesce(s.created_at, now()),
  coalesce(s.updated_at, now())
FROM public.muhabbet_trip_sessions s
WHERE s.passenger_id IS NOT NULL
  AND s.driver_id IS NOT NULL
  AND s.conversation_id IS NOT NULL
ON CONFLICT (session_id, passenger_user_id) DO NOTHING;
