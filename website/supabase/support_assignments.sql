-- Leylek TAG — support_messages atama kolonları + güçlendirilmiş güncelleme RLS
--
-- Çalıştırma sırası (Supabase SQL Editor):
--   1) website/supabase/support_messages.sql (tablo + anon INSERT)
--   2) website/supabase/admin_support.sql (admin_users + ilk admin SELECT / UPDATE / authenticated INSERT)
--   3) Bu dosya: kolonları ekler ve UPDATE politikasını atama kurallarına göre günceller.
--
-- Amaç:
-- • Yeni kayıtta (status=new) atanmamış iken bir admin görüşmeyi kabul eder → reviewing + assigned_* + accepted_at.
-- • Kabul edilmiş görüşmeyi yalnızca atanan admin (assigned_admin_id = auth.uid()) yönetir (Çözüldü vb.).
-- • Diğer adminler liste/görünüm için kayıtları okuyabilir; UPDATE RLS atanmayanların “çalma” / değiştirme denemesini reddeder.
-- • Service role / SECURITY DEFINER tetiklemesi kullanılmaz — yalın RLS.

-- -----------------------------------------------------------------------------
-- Kolonlar (mevcut projeler için idempotent ADD)
-- -----------------------------------------------------------------------------
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES auth.users (id);

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS assigned_admin_email text;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

COMMENT ON COLUMN public.support_messages.assigned_admin_id IS 'Görüşmeyi kabul eden admin (Auth kullanıcı id).';
COMMENT ON COLUMN public.support_messages.assigned_admin_email IS 'Kabul sırasında oturumdaki admin e‑postası (JWT ile doğrulanır).';
COMMENT ON COLUMN public.support_messages.accepted_at IS 'Görüşme kabul tarihi.';
COMMENT ON COLUMN public.support_messages.closed_at IS 'status=resolved kapatılma tarihi.';

CREATE INDEX IF NOT EXISTS support_messages_status_assigned_idx
  ON public.support_messages (status, assigned_admin_id);

-- -----------------------------------------------------------------------------
-- UPDATE politikası — admin_users + yaşam döngüsü
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS support_messages_authenticated_admin_update ON public.support_messages;

CREATE POLICY support_messages_authenticated_admin_update ON public.support_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(trim(coalesce(au.email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  AND (
    (
      trim(lower(coalesce(status, ''))) = 'new'
      AND assigned_admin_id IS NULL
      AND closed_at IS NULL
    )
    OR (
      assigned_admin_id = auth.uid()
      AND trim(lower(coalesce(status, ''))) = 'reviewing'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(trim(coalesce(au.email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  AND (
    (
      trim(lower(coalesce(status, ''))) = 'reviewing'
      AND assigned_admin_id = auth.uid()
      AND closed_at IS NULL
      AND accepted_at IS NOT NULL
      AND lower(trim(coalesce(assigned_admin_email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR (
      trim(lower(coalesce(status, ''))) = 'resolved'
      AND assigned_admin_id = auth.uid()
      AND closed_at IS NOT NULL
      AND accepted_at IS NOT NULL
      AND lower(trim(coalesce(assigned_admin_email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  )
);
