-- Leylek Muhabbeti: accepted listing_match_request başına ayrı conversation.
-- Normal ride / tags / dispatch tablolarına dokunmaz.
--
-- Eski veriler korunur. Bu migration yalnızca aynı user_a/user_b çifti için
-- birden fazla Muhabbet conversation açılabilmesini sağlar.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS conversation_kind text NOT NULL DEFAULT 'pair';

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS listing_match_request_id uuid NULL
    REFERENCES public.listing_match_requests (id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS uq_conversations_user_pair;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_user_a_user_b_key;

DROP INDEX IF EXISTS public.uq_conversations_user_pair;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_listing_match_request
  ON public.conversations (listing_match_request_id)
  WHERE listing_match_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_user_pair_created
  ON public.conversations (user_a, user_b, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_kind_created
  ON public.conversations (conversation_kind, created_at DESC);

COMMENT ON COLUMN public.conversations.conversation_kind IS
  'Muhabbet: pair = eski çift sohbeti/Leylek Anahtar; listing_match_request = kabul edilen ilan isteğine özel sohbet.';

COMMENT ON COLUMN public.conversations.listing_match_request_id IS
  'Muhabbet: listing_match_request conversation scope; aynı iki kullanıcının yeni eşleşmelerinde eski mesajlar görünmez.';

COMMENT ON INDEX public.idx_conversations_user_pair_created IS
  'Muhabbet: aynı kullanıcı çifti artık birden fazla accepted listing match conversation açabilir.';
