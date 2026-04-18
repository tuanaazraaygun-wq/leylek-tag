-- FCM native device token (Android) — Expo push ile paralel faz-1.
-- Supabase SQL editor veya migration runner ile uygulayın.

ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_push_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_push_token_updated_at timestamptz;

COMMENT ON COLUMN users.fcm_push_token IS 'Android FCM registration token (native); Expo ExponentPushToken ayrı tutulur.';
COMMENT ON COLUMN users.fcm_push_token_updated_at IS 'Son FCM token kaydı (POST /api/user/save-push-token token_type=fcm).';
