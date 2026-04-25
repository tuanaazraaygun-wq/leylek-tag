ALTER TABLE ride_listings ADD COLUMN IF NOT EXISTS vehicle_kind text NOT NULL DEFAULT 'car';

COMMENT ON COLUMN ride_listings.vehicle_kind IS 'Araç sınıfı: car | motorcycle (Leylek Muhabbeti teklif feed).';
