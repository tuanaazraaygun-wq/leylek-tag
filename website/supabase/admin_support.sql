-- Leylek TAG — admin destek paneli (RLS + admin_users)
-- Önkoşul: support_messages tablosu mevcut (website/supabase/support_messages.sql).
-- Çalıştır: Supabase SQL Editor'de bu dosyayı yapıştır ve çalıştır.

-- ---------------------------------------------------------------------------
-- admin_users: yetkili e-postalar (Auth magic link ile giriş yapan kullanıcı)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_users IS 'Admin destek paneli; yalnızca listelenen e-postalar support_messages okuyup güncelleyebilir.';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users;

-- Oturumdaki kullanıcı yalnızca kendi e-postasına denk satırı görebilir (EXISTS alt sorguları için gerekli).
CREATE POLICY admin_users_self_read ON public.admin_users
FOR SELECT
TO authenticated
USING (
  lower(trim(coalesce(admin_users.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
);

-- Kayıt ekleme yalnızca SQL Editor / service role ile (authenticated ve anon için policy yok).
GRANT SELECT ON TABLE public.admin_users TO authenticated;

-- ---------------------------------------------------------------------------
-- support_messages — admin SELECT / UPDATE (+ tarayıcıda oturum varken public INSERT için authenticated INSERT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS support_messages_authenticated_admin_select ON public.support_messages;
DROP POLICY IF EXISTS support_messages_authenticated_admin_update ON public.support_messages;
DROP POLICY IF EXISTS support_messages_authenticated_insert_website ON public.support_messages;

-- Oturumu olan admin tüm kayıtları okuyabilir.
CREATE POLICY support_messages_authenticated_admin_select ON public.support_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(trim(coalesce(au.email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
);

-- Status güncelleme (değer sınırlı).
CREATE POLICY support_messages_authenticated_admin_update ON public.support_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(trim(coalesce(au.email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(trim(coalesce(au.email, ''))) =
          lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  )
  AND trim(coalesce(status, '')) IN ('new', 'reviewing', 'resolved')
);

-- Aynı tarayıcıda admin oturumu varken vitrin destek formu anon yerine authenticated istek atabilir;
-- mevcut kullanıcı akışını korumak için genel INSERT (anon ile aynı esneklik).
CREATE POLICY support_messages_authenticated_insert_website ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

GRANT SELECT ON TABLE public.support_messages TO authenticated;
GRANT UPDATE ON TABLE public.support_messages TO authenticated;
GRANT INSERT ON TABLE public.support_messages TO authenticated;

-- ---------------------------------------------------------------------------
-- Atama yaşam döngüsü + sıkı UPDATE RLS: website/supabase/support_assignments.sql
-- Kolonları ve politikayı yüklemeden önce üst iki dosyanın projede çalıştığından emin olun.
--
-- Örnek yetkili e-posta eklemek (yorum satırından çıkarın, e-postayı düzenleyin):
-- insert into public.admin_users (email) values ('admin@leylektag.com');
