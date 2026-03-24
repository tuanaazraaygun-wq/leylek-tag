-- Tek sefer araç tercihi (yolcu car | motorcycle). Supabase SQL Editor'da bir kez çalıştırın.
-- Kolon yoksa ride/create ve filtreler hata verebilir veya tercih düşmez.

ALTER TABLE tags ADD COLUMN IF NOT EXISTS passenger_preferred_vehicle TEXT;

COMMENT ON COLUMN tags.passenger_preferred_vehicle IS 'Yolcu talep tercihi: car | motorcycle (dispatch ve listeler)';
