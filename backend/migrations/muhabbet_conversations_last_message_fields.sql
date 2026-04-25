-- Leylek Muhabbeti: sohbet listesi için konuşma özet alanları
-- Not: IF NOT EXISTS ile güvenli ekleme; mevcut veriye dokunmaz.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message text NULL,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Sohbet listesinde son güncellenen konuşmaları hızlı sıralamak için.
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON public.conversations (updated_at DESC);

