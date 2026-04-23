-- Leylek Muhabbeti v1 — Faz 2: gönderiler, yorumlar, şikayet kayıtları
-- Önkoşul: Faz 1 migration (neighborhoods, groups, group_members) uygulanmış olmalı.

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body_text text NOT NULL,
  image_storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_body_len CHECK (char_length(trim(body_text)) >= 1 AND char_length(body_text) <= 500),
  CONSTRAINT posts_image_path_nonempty CHECK (char_length(trim(image_storage_path)) >= 8)
);

CREATE INDEX IF NOT EXISTS idx_posts_group_created ON posts (group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_body_len CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 800)
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason text,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_post_reports_post_reporter UNIQUE (post_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports (status, created_at DESC);

COMMENT ON TABLE posts IS 'Leylek Muhabbeti Faz 2 — grup gönderisi (foto + kısa metin)';
COMMENT ON TABLE post_comments IS 'Leylek Muhabbeti Faz 2 — tek seviye yorum';
COMMENT ON TABLE post_reports IS 'Leylek Muhabbeti Faz 2 — gönderi şikayeti (moderasyon sonrası)';

-- Supabase Storage: Dashboard üzerinden `muhabbet-posts` public bucket oluşturun (veya backend ilk presign’de oluşturmayı dener).

-- Daha önce 600 karakter ile oluşturulmuş kurulumlarda posts metin sınırını API ile hizala (500).
-- Uyarı: body_text > 500 olan satır varsa bu ADD başarısız olur; önce veriyi kısaltın.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_body_len;
ALTER TABLE public.posts ADD CONSTRAINT posts_body_len CHECK (
  char_length(trim(body_text)) >= 1 AND char_length(body_text) <= 500
);
