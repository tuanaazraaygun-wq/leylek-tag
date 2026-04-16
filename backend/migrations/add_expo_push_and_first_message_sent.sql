-- Expo push token (kayıt: POST /user/save-push-token) ve sohbet ilk push bayrağı.
-- Supabase SQL editor veya migration runner ile uygulayın.

ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token text;

-- Zorunlu: kolon yoksa backend ilk mesaj push göndermez (fallback yok).
ALTER TABLE tags ADD COLUMN IF NOT EXISTS first_message_sent boolean DEFAULT false;

COMMENT ON COLUMN tags.first_message_sent IS 'Bu tag sohbetinde alıcıya ilk push bir kez; send_chat_message atomik günceller.';
