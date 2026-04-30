-- Muhabbet: okunmamış sayımı için kullanıcı bazlı son okuma (conversations/me unread_count).
-- Uygulanmazsa GET /muhabbet/conversations/me 42703 verir; backend kolon yokken de liste döner (unread=0).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS user_a_last_read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS user_b_last_read_at timestamptz NULL;

COMMENT ON COLUMN public.conversations.user_a_last_read_at IS
  'Muhabbet: user_a için son okuma; bu zamandan sonraki karşı mesajları unread sayılır.';
COMMENT ON COLUMN public.conversations.user_b_last_read_at IS
  'Muhabbet: user_b için son okuma; bu zamandan sonraki karşı mesajları unread sayılır.';

-- Yeni kolonlar NULL iken tüm geçmişi "okunmamış" saymamak için doldur.
UPDATE public.conversations
SET
  user_a_last_read_at = COALESCE(user_a_last_read_at, last_message_at, updated_at, created_at),
  user_b_last_read_at = COALESCE(user_b_last_read_at, last_message_at, updated_at, created_at)
WHERE user_a_last_read_at IS NULL OR user_b_last_read_at IS NULL;
