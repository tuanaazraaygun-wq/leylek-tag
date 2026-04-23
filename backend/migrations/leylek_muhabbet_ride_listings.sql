-- Leylek Muhabbeti — ride_listings (ilan) tablosu
-- Supabase SQL Editor veya migration pipeline ile çalıştırın.
-- Servis rolü ile insert; backend: /muhabbet/listings

CREATE TABLE IF NOT EXISTS ride_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  linked_user_route_id uuid,
  linked_pattern_hash text,
  city text NOT NULL,
  from_text text NOT NULL,
  to_text text NOT NULL,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  departure_time timestamptz,
  listing_type text NOT NULL,
  role_type text NOT NULL,
  price_amount numeric,
  note text,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_listings_city_status ON ride_listings (city, status);
CREATE INDEX IF NOT EXISTS idx_ride_listings_created_by ON ride_listings (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_listings_departure ON ride_listings (departure_time);

COMMENT ON TABLE ride_listings IS 'Leylek Muhabbeti Faz1 — rota ilanları (sürücü/yolcu)';

-- Eski kurulumda sütun adı user_id ise backend .env: RIDE_LISTINGS_OWNER_COLUMN=user_id
-- ve FK aynı kullanıcı tablosunu göstermeli; bu dosya varsayılan olarak created_by_user_id kullanır.

-- Mevcut tabloda bu kolonlar yoksa (500 / unknown column) idempotent ekleme:
ALTER TABLE ride_listings ADD COLUMN IF NOT EXISTS linked_user_route_id uuid;
ALTER TABLE ride_listings ADD COLUMN IF NOT EXISTS linked_pattern_hash text;
ALTER TABLE ride_listings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
