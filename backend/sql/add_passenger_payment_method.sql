-- Supabase / PostgreSQL: yolcu teklif anında ödeme tercihi (cash | card)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS passenger_payment_method text;

COMMENT ON COLUMN tags.passenger_payment_method IS 'Yolcu teklifte seçtiği ödeme: cash | card';
