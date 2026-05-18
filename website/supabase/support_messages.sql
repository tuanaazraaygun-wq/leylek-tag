-- Leylek TAG — website destek mesajları
-- Çalıştır: Supabase SQL Editor'de bu dosyayı yapıştır ve çalıştır.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text,
  email text,
  message text NOT NULL,
  page_path text,
  user_agent text,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'website',
  assigned_admin_id UUID REFERENCES auth.users (id),
  assigned_admin_email text,
  accepted_at timestamptz,
  closed_at timestamptz,
  client_token text,
  last_message_at timestamptz DEFAULT now(),
  CONSTRAINT support_messages_message_trimmed CHECK (
    length(trim(message)) >= 10
  )
);

COMMENT ON TABLE public.support_messages IS 'Web sitesi destek/geri bildirim; anon yalnızca INSERT (RLS). Admin atama yaşam döngüsü: website/supabase/support_assignments.sql.';

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_anon_insert ON public.support_messages;

CREATE POLICY support_messages_anon_insert ON public.support_messages
FOR INSERT
TO anon
WITH CHECK (true);

-- Select / update / delete için anon policy tanımlanmıyor — RLS ile reddedilir.

GRANT USAGE ON SCHEMA public TO anon;

GRANT INSERT ON TABLE public.support_messages TO anon;
