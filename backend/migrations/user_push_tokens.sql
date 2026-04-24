-- Çoklu cihaz FCM kayıtları (Leylek Muhabbeti + genel push).
-- POST /api/user/push-token ile doldurulur; send_push_notification buradan da token okur.

CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_push_tokens_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens (user_id);

COMMENT ON TABLE user_push_tokens IS 'FCM registration token(lar); kullanıcı başına birden fazla cihaz.';
