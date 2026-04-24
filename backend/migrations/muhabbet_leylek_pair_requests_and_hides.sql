-- Leylek Muhabbeti: in-chat "eşleş" isteği (cooldown sunucu tarafı) + sohbet gizleme (liste)
-- Yolculuk/QR: conversations tablosuna dokunmaz; yalnızca muhabbet metadatası.

CREATE TABLE IF NOT EXISTS public.muhabbet_leylek_pair_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  initiator_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz NULL,
  CONSTRAINT muhabbet_leylek_pair_participants CHECK (initiator_user_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_mlpair_conv_init_created
  ON public.muhabbet_leylek_pair_requests (conversation_id, initiator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mlpair_target_pending
  ON public.muhabbet_leylek_pair_requests (target_user_id, status, created_at DESC);

COMMENT ON TABLE public.muhabbet_leylek_pair_requests IS 'Leylek Muhabbeti: sohbetten gönderilen Leylek Anahtar eşleşme isteği; kabul = conversation.matched.';

-- Kullanıcının kendi sohbet listesinden gizlediği konuşmalar (içerik silinmez)
CREATE TABLE IF NOT EXISTS public.user_conversation_hides (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_user_conversation_hides_uid ON public.user_conversation_hides (user_id, hidden_at DESC);

COMMENT ON TABLE public.user_conversation_hides IS 'Kullanıcı sohbet listesinden gizle; mesajlar ve conversation kalır.';
