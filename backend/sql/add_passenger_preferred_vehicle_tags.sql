-- Supabase: yolcu araç tercihi (tags satırında; dispatch ile uyumlu)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS passenger_preferred_vehicle text;

COMMENT ON COLUMN tags.passenger_preferred_vehicle IS 'Yolcu teklif anı araç tercihi: car | motorcycle';
