-- Leylek Muhabbeti — Faz 3A: metin moderasyonu (olay kaydı, allow | block)
-- Önkoşul: Faz 1 + Faz 2 tabloları (users, groups, posts, post_comments) mevcut olmalı.

CREATE TABLE IF NOT EXISTS ai_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('post', 'comment')),
  decision text NOT NULL CHECK (decision IN ('allow', 'block')),
  group_id uuid NULL REFERENCES public.groups (id) ON DELETE SET NULL,
  parent_post_id uuid NULL REFERENCES public.posts (id) ON DELETE SET NULL,
  result_post_id uuid NULL REFERENCES public.posts (id) ON DELETE SET NULL,
  result_comment_id uuid NULL REFERENCES public.post_comments (id) ON DELETE SET NULL,
  content_sha256 char(64) NOT NULL,
  char_len int NOT NULL CHECK (char_len >= 0),
  model_label text NULL,
  detail text NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_moderation_events_user_created
  ON ai_moderation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_moderation_events_decision
  ON ai_moderation_events (decision, created_at DESC);

COMMENT ON TABLE ai_moderation_events IS
  'Faz 3A — metin moderasyonu (gönderi/yorum; block durumunda posts/post_comments satırı oluşmaz)';
