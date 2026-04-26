-- Leylek Teklif Sende: matched chat -> trip conversion intent.
-- Phase 1 only: records mutual intent inside Muhabbet; does not create normal ride tags.

CREATE TABLE IF NOT EXISTS public.muhabbet_trip_conversion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  listing_id uuid NULL REFERENCES public.ride_listings (id) ON DELETE SET NULL,
  listing_match_request_id uuid NULL REFERENCES public.listing_match_requests (id) ON DELETE SET NULL,
  requester_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
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
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT muhabbet_trip_conversion_participants CHECK (requester_user_id <> target_user_id),
  CONSTRAINT muhabbet_trip_conversion_roles CHECK (passenger_id <> driver_id)
);

-- Existing Supabase environments may have an older Phase 1 table. Keep every
-- column used by the isolated Muhabbet conversion insert available to PostgREST.
ALTER TABLE public.muhabbet_trip_conversion_requests
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS listing_id uuid,
  ADD COLUMN IF NOT EXISTS listing_match_request_id uuid,
  ADD COLUMN IF NOT EXISTS requester_user_id uuid,
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS passenger_id uuid,
  ADD COLUMN IF NOT EXISTS driver_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
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
  ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.muhabbet_trip_conversion_requests
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_mtc_conversation_status_created
  ON public.muhabbet_trip_conversion_requests (conversation_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mtc_target_pending
  ON public.muhabbet_trip_conversion_requests (target_user_id, status, created_at DESC);

COMMENT ON TABLE public.muhabbet_trip_conversion_requests IS
  'Leylek Teklif Sende Phase 1: sohbet eşleşmesini yolculuğa çevirme niyeti; normal tags/dispatch oluşturmaz.';
