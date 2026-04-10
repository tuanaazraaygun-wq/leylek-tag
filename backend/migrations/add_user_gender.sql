-- Supabase SQL: kullanıcı cinsiyeti (harita marker)
-- Bir kez çalıştırın: Supabase → SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN users.gender IS 'female | male — kayıtta seçilir';
