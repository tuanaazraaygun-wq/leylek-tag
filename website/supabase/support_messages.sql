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
  CONSTRAINT support_messages_message_trimmed CHECK (
    length(trim(message)) >= 10
  )
);

COMMENT ON TABLE public.support_messages IS 'Web sitesi destek/geri bildirim; anon yalnızca INSERT (RLS).';

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_anon_insert ON public.support_messages;

CREATE POLICY support_messages_anon_insert ON public.support_messages
FOR INSERT
TO anon
WITH CHECK (true);

-- Select / update / delete için anon policy tanımlanmıyor — RLS ile reddedilir.

GRANT USAGE ON SCHEMA public TO anon;

GRANT INSERT ON TABLE public.support_messages TO anon;
