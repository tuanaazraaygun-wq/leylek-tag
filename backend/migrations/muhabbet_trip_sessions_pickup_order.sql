-- Muhabbet çoklu yolcu: biniş / pickup sırası (kabul sırası ile aynı).
-- Önkoşul: accepted_passenger_ids uuid[] sütunu mevcut.

ALTER TABLE public.muhabbet_trip_sessions
  ADD COLUMN IF NOT EXISTS pickup_order uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.muhabbet_trip_sessions.pickup_order IS
  'Biniş sırası: kabul tarihine göre; boşsa API accepted_passenger_ids ile doldurur.';

-- Mevcut satırlar: sıra = kabul listesi
UPDATE public.muhabbet_trip_sessions
SET pickup_order = accepted_passenger_ids
WHERE cardinality(pickup_order) = 0
  AND cardinality(accepted_passenger_ids) > 0;
