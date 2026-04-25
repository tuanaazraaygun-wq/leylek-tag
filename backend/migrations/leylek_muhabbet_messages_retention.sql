-- Leylek Muhabbeti: mesajlar 90 gün sunucuda (destek / güvenlik / cihaz değişimi); sonra expires_at ile temizlenebilir.

CREATE TABLE IF NOT EXISTS public.muhabbet_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  deleted_for_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  CONSTRAINT muhabbet_messages_text_len CHECK (char_length(text) >= 1 AND char_length(text) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_muhabbet_messages_conv_created
  ON public.muhabbet_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_muhabbet_messages_expires_at
  ON public.muhabbet_messages (expires_at);

COMMENT ON TABLE public.muhabbet_messages IS 'Muhabbet 1:1 mesaj metni; en fazla ~90 gün saklanır; deleted_for_user_ids ile kullanıcı bazlı gizleme.';
