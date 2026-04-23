-- Muhabbet eşleşme sonrası 1-1 sohbet: conversations + messages
-- listing_match_requests.conversation_id bu tablodaki id ile dolar (accept akışı)

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_users_distinct CHECK (user_a <> user_b),
  CONSTRAINT uq_conversations_user_pair UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON public.conversations (user_a);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON public.conversations (user_b);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_len CHECK (char_length(body) >= 1 AND char_length(body) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at);

COMMENT ON TABLE public.conversations IS 'Eşleşme kabulü ile oluşan 1-1 sohbet (user_a, user_b sıra: string karşılaştırmalı).';
COMMENT ON TABLE public.messages IS 'Sohbet mesajı; API max 1000 karakter.';

-- match_request: önceki patch yoksa kolonu ekle (FK yok: eski placeholder uuid kalabilir)
ALTER TABLE public.listing_match_requests
  ADD COLUMN IF NOT EXISTS conversation_id uuid NULL;
