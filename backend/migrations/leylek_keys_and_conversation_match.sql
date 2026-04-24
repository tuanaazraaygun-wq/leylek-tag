-- Leylek Anahtar: tek kullanımlık, süreli eşleşme kodları
CREATE TABLE IF NOT EXISTS public.leylek_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code text NOT NULL UNIQUE,
  key_display text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  used_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL,
  related_conversation_id uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leylek_keys_status_chk CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_leylek_keys_creator ON public.leylek_keys (created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leylek_keys_expires ON public.leylek_keys (expires_at) WHERE status = 'active';

COMMENT ON TABLE public.leylek_keys IS 'Leylek Muhabbeti — tek kullanımlık güvenli eşleşme anahtarı.';

-- Sohbet satırı: anahtar ile tam eşleşme metadatası (ön görüşme sohbeti ile aynı conversation)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS matched_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS match_source text NULL,
  ADD COLUMN IF NOT EXISTS leylek_key_id uuid NULL;

COMMENT ON COLUMN public.conversations.matched_at IS 'Leylek Anahtar veya ileride ride eşleşmesi ile doldurulabilir.';
COMMENT ON COLUMN public.conversations.match_source IS 'örn. leylek_key';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS muhabbet_bio text NULL;

COMMENT ON COLUMN public.users.muhabbet_bio IS 'Leylek Muhabbeti genel profil açıklaması (KVKK: gönüllü).';
