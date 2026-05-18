-- Leylek TAG — website vitrin kullanıcı profilleri (RLS + updated_at tetikleyicisi)
-- Çalıştırma: Supabase Dashboard → SQL Editor → tek blok olarak Run (idempotent güvenli tekrar).
--
-- Sorun giderme:
-- • Kayıt 42501 → RLS veya GRANT eksik; bu dosyayı tekrar çalıştırın veya politikaları kontrol edin.
-- • Relation does not exist / schema cache → tablo oluşmamış; bu dosyanın başarıyla çalışması gerekir.
--
-- Örnek admin e-postalar (yalnızca referans, admin_users tablosuna Elle eklenir):
--   leylektagsystem@gmail.com
--   karekodsystem@gmail.com

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_profiles IS 'Website kullanıcı profili (Google OAuth sonrası ad/şehir).';

-- Tarayıcı: authenticated (anon doğrudan profil yazamaz — RLS ile de engellenir)
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.user_profiles FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_own_select ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_own_insert ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_own_update ON public.user_profiles;

-- SELECT: kullanıcı yalnızca kendi satırını görür (auth.uid = id).
CREATE POLICY user_profiles_own_select ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- INSERT: satır kullanıcı kendi kimliğiyle ilişkilendirilmeli.
CREATE POLICY user_profiles_own_insert ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: yalnızca kendi satırı (+ upsert sırasında ON CONFLICT UPDATE için gerekli).
CREATE POLICY user_profiles_own_update ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at: satır güncellenmeden önce zaman damgası
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_profiles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_touch_updated_at ON public.user_profiles;

-- Postgres 14+ genelde EXECUTE FUNCTION; daha eskiyse EXECUTE PROCEDURE ile deneyin.
CREATE TRIGGER user_profiles_touch_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.user_profiles_set_updated_at();

-- Postgres sürümü "EXECUTE FUNCTION" kabul etmiyorsa TRIGGER satırında şunu kullanın:
-- EXECUTE PROCEDURE public.user_profiles_set_updated_at();
