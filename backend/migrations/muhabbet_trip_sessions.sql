-- Leylek Teklif Sende: accepted chat conversion -> isolated Muhabbet trip-like session.
-- This table is separate from normal ride tags/dispatch/QR/payment lifecycle.

CREATE TABLE IF NOT EXISTS public.muhabbet_trip_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_request_id uuid NOT NULL UNIQUE REFERENCES public.muhabbet_trip_conversion_requests (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  listing_id uuid NULL REFERENCES public.ride_listings (id) ON DELETE SET NULL,
  listing_match_request_id uuid NULL REFERENCES public.listing_match_requests (id) ON DELETE SET NULL,
  requester_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  passenger_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'started', 'cancelled', 'finished')),
  city text NULL,
  pickup_text text NULL,
  pickup_lat double precision NULL,
  pickup_lng double precision NULL,
  dropoff_text text NULL,
  dropoff_lat double precision NULL,
  dropoff_lng double precision NULL,
  agreed_price numeric NULL,
  vehicle_kind text NULL CHECK (vehicle_kind IS NULL OR vehicle_kind IN ('car', 'motorcycle')),
  payment_method text NULL CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card')),
  route_polyline text NULL,
  route_distance_km double precision NULL,
  route_duration_min integer NULL,
  route_source text NULL,
  route_updated_at timestamptz NULL,
  passenger_location_lat double precision NULL,
  passenger_location_lng double precision NULL,
  passenger_location_updated_at timestamptz NULL,
  driver_location_lat double precision NULL,
  driver_location_lng double precision NULL,
  driver_location_updated_at timestamptz NULL,
  trust_status text NULL
    CHECK (trust_status IS NULL OR trust_status IN ('requested', 'accepted', 'declined')),
  trust_requested_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  trust_resolved_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  trust_requested_at timestamptz NULL,
  trust_resolved_at timestamptz NULL,
  navigation_status text NULL,
  started_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  cancelled_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  cancel_reason text NULL,
  finished_at timestamptz NULL,
  finished_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT muhabbet_trip_session_roles CHECK (passenger_id <> driver_id),
  CONSTRAINT muhabbet_trip_session_coords_chk CHECK (
    (pickup_lat IS NULL OR (pickup_lat BETWEEN -90 AND 90)) AND
    (dropoff_lat IS NULL OR (dropoff_lat BETWEEN -90 AND 90)) AND
    (passenger_location_lat IS NULL OR (passenger_location_lat BETWEEN -90 AND 90)) AND
    (driver_location_lat IS NULL OR (driver_location_lat BETWEEN -90 AND 90)) AND
    (pickup_lng IS NULL OR (pickup_lng BETWEEN -180 AND 180)) AND
    (dropoff_lng IS NULL OR (dropoff_lng BETWEEN -180 AND 180)) AND
    (passenger_location_lng IS NULL OR (passenger_location_lng BETWEEN -180 AND 180)) AND
    (driver_location_lng IS NULL OR (driver_location_lng BETWEEN -180 AND 180))
  )
);

-- Existing environments may already have an older, narrower table. Keep this
-- migration idempotent so PostgREST can see every column used by Phase 2.
ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS conversion_request_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS listing_id uuid,
  ADD COLUMN IF NOT EXISTS listing_match_request_id uuid,
  ADD COLUMN IF NOT EXISTS requester_user_id uuid,
  ADD COLUMN IF NOT EXISTS passenger_id uuid,
  ADD COLUMN IF NOT EXISTS driver_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS pickup_text text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_text text,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS agreed_price numeric,
  ADD COLUMN IF NOT EXISTS vehicle_kind text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS route_distance_km double precision,
  ADD COLUMN IF NOT EXISTS route_duration_min integer,
  ADD COLUMN IF NOT EXISTS route_source text,
  ADD COLUMN IF NOT EXISTS route_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS passenger_location_lat double precision,
  ADD COLUMN IF NOT EXISTS passenger_location_lng double precision,
  ADD COLUMN IF NOT EXISTS passenger_location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_location_lat double precision,
  ADD COLUMN IF NOT EXISTS driver_location_lng double precision,
  ADD COLUMN IF NOT EXISTS driver_location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS trust_status text,
  ADD COLUMN IF NOT EXISTS trust_requested_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS trust_resolved_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS trust_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS trust_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS navigation_status text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.muhabbet_trip_sessions
  ALTER COLUMN status SET DEFAULT 'ready';

CREATE INDEX IF NOT EXISTS idx_mts_conversation_status_created
  ON public.muhabbet_trip_sessions (conversation_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mts_passenger_status_created
  ON public.muhabbet_trip_sessions (passenger_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mts_driver_status_created
  ON public.muhabbet_trip_sessions (driver_id, status, created_at DESC);

COMMENT ON TABLE public.muhabbet_trip_sessions IS
  'Leylek Teklif Sende Phase 2: chat conversion sonrası trip-like oturum; normal tags/dispatch/QR/payment lifecycle kullanmaz.';
