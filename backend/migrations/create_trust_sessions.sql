-- Güven Al (trust) oturumları — Supabase SQL Editor'da bir kez çalıştırın
-- LeylekTag: eşleşmiş yolcu/sürücü kısa görüntülü doğrulama

CREATE TABLE IF NOT EXISTS trust_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_role text NOT NULL CHECK (requester_role IN ('passenger', 'driver')),
  target_role text NOT NULL CHECK (target_role IN ('passenger', 'driver')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'ended')),
  channel_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz,
  request_ttl_expires_at timestamptz,
  session_hard_deadline_at timestamptz,
  end_reason text CHECK (
    end_reason IS NULL OR end_reason IN ('rejected', 'expired', 'user_ended', 'auto_closed')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_sessions_tag_status ON trust_sessions(tag_id, status);
CREATE INDEX IF NOT EXISTS idx_trust_sessions_requester ON trust_sessions(requester_id);
CREATE INDEX IF NOT EXISTS idx_trust_sessions_target ON trust_sessions(target_id);

COMMENT ON TABLE trust_sessions IS 'Güven Al: eşleşme içi kısa görüntülü doğrulama (calls tablosundan ayrı)';
