-- Muhabbet: kullanıcı bazlı son okuma zamanı — sohbet listesi unread_count için.
-- conversations/me ve POST .../read ile güncellenir; message_seen ile ince ayar yapılabilir.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS user_a_last_read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS user_b_last_read_at timestamptz NULL;

COMMENT ON COLUMN public.conversations.user_a_last_read_at IS
  'Muhabbet: user_a için son okuma; bu zamandan sonraki karşı mesajları unread sayılır.';
COMMENT ON COLUMN public.conversations.user_b_last_read_at IS
  'Muhabbet: user_b için son okuma; bu zamandan sonraki karşı mesajları unread sayılır.';

-- Mevcut konuşmalar: son aktiviteye kadar okunmuş say (anında tüm geçmiş unread kalmasın).
UPDATE public.conversations
SET
  user_a_last_read_at = COALESCE(user_a_last_read_at, last_message_at, updated_at, created_at),
  user_b_last_read_at = COALESCE(user_b_last_read_at, last_message_at, updated_at, created_at)
WHERE user_a_last_read_at IS NULL OR user_b_last_read_at IS NULL;
