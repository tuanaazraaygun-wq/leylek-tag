-- ADDR-P0-2B: Anonim öğrenilmiş adres aggregate (user_id / phone / tag yok).
-- Apply via Supabase SQL Editor or migration runner.
-- Backend: POST /api/places/learn → upsert by dedupe_key.

CREATE TABLE IF NOT EXISTS learned_addresses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key        text NOT NULL UNIQUE,
  normalized_query  text NOT NULL,
  display_name      text NOT NULL,
  city              text NOT NULL DEFAULT '',
  district          text NOT NULL DEFAULT '',
  latitude          double precision NOT NULL,
  longitude         double precision NOT NULL,
  provider          text NOT NULL DEFAULT 'learned',
  usage_count       integer NOT NULL DEFAULT 1,
  last_used_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learned_query_city
  ON learned_addresses (normalized_query, city);

CREATE INDEX IF NOT EXISTS idx_learned_city_usage
  ON learned_addresses (city, usage_count DESC, last_used_at DESC);
