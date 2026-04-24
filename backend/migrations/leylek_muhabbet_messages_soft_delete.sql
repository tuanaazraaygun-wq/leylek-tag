-- Muhabbet 1:1 mesajlar — yumuşak silme (sadece gönderen)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_not_deleted
  ON public.messages (conversation_id, created_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.messages.deleted_at IS 'Gönderen silince doldurulur; liste ve sohbet özeti bu satırları dışlayabilir.';
COMMENT ON COLUMN public.messages.deleted_by_user_id IS 'Silme işlemini yapan (sender ile aynı olmalı).';
