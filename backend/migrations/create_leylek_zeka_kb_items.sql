-- Leylek Zeka — admin yönetimli runtime bilgi kartları (Supabase SQL Editor / migration)
-- Uygulama: POST/PATCH yalnızca /api/admin/leylek-zeka-kb/* + Bearer admin

CREATE TABLE IF NOT EXISTS leylek_zeka_kb_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_phrases text[] NOT NULL DEFAULT '{}',
  body text NOT NULL,
  priority smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leylek_zeka_kb_items_active_prio
  ON leylek_zeka_kb_items (is_active, priority DESC);

COMMENT ON TABLE leylek_zeka_kb_items IS 'Leylek Zeka admin KB — yalnızca admin API ile yönetilir; okuma feature flag ile.';
