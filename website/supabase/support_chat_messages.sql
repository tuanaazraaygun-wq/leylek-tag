-- =========================================================
-- Leylek TAG — Realtime Canlı Destek Sohbet Sistemi
-- Sadece website canlı destek içindir.
-- Mobile / backend / ride logic ile ilgisi yoktur.
-- =========================================================
--
-- Çalıştırma sırası (Supabase SQL Editor):
--   1) website/supabase/support_messages.sql
--   2) website/supabase/admin_support.sql
--   3) website/supabase/support_assignments.sql
--   4) Bu dosya
--
-- Client: her istekte `x-support-client-token: <ticket client_token>`
-- ------------------------------------------------------------
-- Önceki sürüm (çift politika/trigger önlemek için)
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS support_chat_messages_bump_ticket_tr ON public.support_chat_messages;
DROP TRIGGER IF EXISTS support_chat_messages_touch_ticket ON public.support_chat_messages;

DROP FUNCTION IF EXISTS public.support_chat_messages_bump_ticket ();

DROP POLICY IF EXISTS support_messages_anon_select_own_client_token ON public.support_messages;
DROP POLICY IF EXISTS support_messages_authenticated_select_own_client_token ON public.support_messages;

DROP POLICY IF EXISTS support_chat_messages_anon_select ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_messages_anon_insert ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_messages_authenticated_select ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_messages_authenticated_insert ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_messages_admin_select ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_messages_admin_insert ON public.support_chat_messages;

DROP POLICY IF EXISTS support_chat_user_select_by_token ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_user_insert_by_token ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_admin_select ON public.support_chat_messages;
DROP POLICY IF EXISTS support_chat_admin_insert ON public.support_chat_messages;
DROP POLICY IF EXISTS support_messages_client_token_select ON public.support_messages;

-- Gerekli extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) support_messages tablosuna canlı sohbet alanları ekle
-- =========================================================

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS client_token text;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();

UPDATE public.support_messages
SET last_message_at = COALESCE(last_message_at, created_at);

CREATE INDEX IF NOT EXISTS support_messages_client_token_idx ON public.support_messages (client_token);

CREATE INDEX IF NOT EXISTS support_messages_last_message_at_idx
  ON public.support_messages (last_message_at DESC NULLS LAST);

COMMENT ON COLUMN public.support_messages.client_token IS 'Tarayıcıda saklanan gizli anahtar; public sohbet RLS ile eşleşir.';
COMMENT ON COLUMN public.support_messages.last_message_at IS 'Son sohbet etkinliği; tetik ile güncellenir.';

-- =========================================================
-- 2) Chat mesajları tablosu
-- =========================================================

CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  support_message_id uuid NOT NULL REFERENCES public.support_messages (id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (
    sender_type IN ('user', 'admin', 'system')
  ),
  sender_email text NULL,
  body text NOT NULL CHECK (char_length(trim(body)) >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_chat_messages IS 'Ticket başına canlı sohbet; RLS + client_token başlığı.';

CREATE INDEX IF NOT EXISTS support_chat_messages_ticket_created_idx ON public.support_chat_messages (
  support_message_id,
  created_at ASC
);

CREATE INDEX IF NOT EXISTS support_chat_messages_created_idx ON public.support_chat_messages (created_at DESC);

-- =========================================================
-- 3) Client token helper
-- Supabase client request header: x-support-client-token
-- =========================================================

CREATE OR REPLACE FUNCTION public.support_request_client_token ()
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path = public
  AS $$
  SELECT NULLIF(
    lower(trim(coalesce(current_setting('request.headers', TRUE)::json ->> 'x-support-client-token', ''))),
    '')
$$;

COMMENT ON FUNCTION public.support_request_client_token () IS 'WS destek: x-support-client-token başlığı (PostgREST request.headers JSON).';

-- =========================================================
-- 4) last_message_at güncelleme trigger
-- =========================================================

CREATE OR REPLACE FUNCTION public.touch_support_last_message_at ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  UPDATE public.support_messages
  SET last_message_at = now()
  WHERE id = NEW.support_message_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_chat_messages_touch_ticket ON public.support_chat_messages;

CREATE TRIGGER support_chat_messages_touch_ticket
  AFTER INSERT ON public.support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_support_last_message_at ();

-- =========================================================
-- 5) RLS aç
-- =========================================================

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 7) Public kullanıcı kendi ticket bilgisini token ile okuyabilsin
-- =========================================================

CREATE POLICY support_messages_client_token_select ON public.support_messages
  FOR SELECT
  TO anon, authenticated
  USING (
    client_token IS NOT NULL
    AND lower(trim(client_token)) = public.support_request_client_token ()
    );

-- =========================================================
-- 8) Public kullanıcı kendi ticket chat mesajlarını okuyabilsin
-- =========================================================

CREATE POLICY support_chat_user_select_by_token ON public.support_chat_messages
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_messages sm
      WHERE sm.id = support_chat_messages.support_message_id
        AND sm.client_token IS NOT NULL
        AND lower(trim(sm.client_token)) = public.support_request_client_token ()
    ));

-- =========================================================
-- 9) Public kullanıcı kendi ticketına mesaj yazabilsin
-- =========================================================

CREATE POLICY support_chat_user_insert_by_token ON public.support_chat_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    sender_type = 'user'
    AND EXISTS (
      SELECT 1
      FROM public.support_messages sm
      WHERE sm.id = support_chat_messages.support_message_id
        AND sm.client_token IS NOT NULL
        AND lower(trim(sm.client_token)) = public.support_request_client_token ()
    ));

-- =========================================================
-- 10) Admin chat mesajlarını okuyabilsin
-- Atanmamış ticketları adminler görebilir.
-- Atanmış ticketı sadece atanmış admin görebilir.
-- =========================================================

CREATE POLICY support_chat_admin_select ON public.support_chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE lower(trim(au.email)) = lower(trim(auth.jwt()->>'email'))
    )
    AND EXISTS (
      SELECT 1
      FROM public.support_messages sm
      WHERE sm.id = support_chat_messages.support_message_id
        AND (
          sm.assigned_admin_id IS NULL
          OR sm.assigned_admin_id = auth.uid()
        )
    )
  );

-- =========================================================
-- 11) Admin sadece kendisine atanmış reviewing ticket'a mesaj yazabilsin
-- =========================================================

CREATE POLICY support_chat_admin_insert ON public.support_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'admin'
    AND lower(trim(coalesce(sender_email, ''))) = lower(trim(auth.jwt()->>'email'))
    AND EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE lower(trim(au.email)) = lower(trim(auth.jwt()->>'email'))
    )
    AND EXISTS (
      SELECT 1
      FROM public.support_messages sm
      WHERE sm.id = support_chat_messages.support_message_id
        AND sm.status = 'reviewing'
        AND sm.assigned_admin_id = auth.uid()
    )
  );

-- =========================================================
-- 12) Yetkiler
-- ------------------------------------------------------------
-- Admin paneli doğrulanmış rol ile çalışır; revoke PUBLIC sonrası
-- anon/authenticated’a açılım yeterli.
-- =========================================================

REVOKE ALL ON public.support_chat_messages FROM PUBLIC;

REVOKE ALL ON public.support_chat_messages FROM anon;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT,
INSERT ON public.support_chat_messages TO anon;

GRANT SELECT,
INSERT ON public.support_chat_messages TO authenticated;

GRANT SELECT ON public.support_messages TO anon;

GRANT SELECT ON public.support_messages TO authenticated;

-- =========================================================
-- 13) Realtime publication
-- Hata verirse sorun değil; tablo zaten ekli olabilir.
-- =========================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END $$;

-- =========================================================
-- 14) Kontrol
-- =========================================================

SELECT 'support_chat_messages ready' AS status,
  COUNT(*) AS chat_message_count
FROM public.support_chat_messages;
