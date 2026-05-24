-- Leylek TAG — KYC inceleme audit log (opsiyonel; Faz 2 website API migration gerektirmez)
-- Supabase SQL Editor'de manuel çalıştırın. Tablo yoksa website action API etkilenmez.

CREATE TABLE IF NOT EXISTS public.kyc_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  admin_auth_uid UUID,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'request_docs')),
  before_status TEXT,
  after_status TEXT,
  user_message TEXT,
  admin_note TEXT,
  pending_vehicle_kind TEXT,
  approved_vehicle_kinds JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_review_logs_user_created
  ON public.kyc_review_logs (user_id, created_at DESC);

COMMENT ON TABLE public.kyc_review_logs IS
  'KYC web panel karar geçmişi. Son durum users.driver_details içindeki kyc_last_review_* alanlarında da tutulur.';

ALTER TABLE public.kyc_review_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass eder; authenticated admin okuma ileride policy ile açılabilir.
