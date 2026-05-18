-- Leylek TAG — admin_users e-posta normalizasyonu + benzersizlik (migration)
--
-- Çalıştır: Supabase SQL Editor (canlı düzeltme için özellikle önerilir)
--
-- Amaç:
-- • Mevcut satırlarda email → lower(trim(email))
-- • Aynı adresin farklı yazılmış kopyalarını UNION öncesi el ile birleştirmeniz gerekebilir; çakışma olursa aşağıdaki UPDATE duplicate key verir.
-- • Büyük/küçük harf yüzünden çift UNIQUE satır oluşmasını engeller (indeks ile lower(trim)).

-- 1) Önce içeriği küçült
UPDATE public.admin_users
SET email = lower(trim(email));

-- 2) Yinelenen lower(trim(email)) satırlarını temizle (varsa ilk id tutulur — ihtiyaç halinde özelleştir)
WITH ranked AS (
  SELECT id,
    row_number() OVER (PARTITION BY lower(trim(email)) ORDER BY created_at ASC) AS rn
  FROM public.admin_users
)
DELETE FROM public.admin_users a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- 3) İfade üzerinden benzersizlik (PostgreSQL UNIQUE index)
DROP INDEX IF EXISTS admin_users_email_lower_trim_unique;
CREATE UNIQUE INDEX admin_users_email_lower_trim_unique
  ON public.admin_users (lower(trim(email)));

-- 4) BEFORE INSERT/UPDATE: her zaman küçük ve trim yaz
CREATE OR REPLACE FUNCTION public.admin_users_normalize_email_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(coalesce(NEW.email, '')));
  IF NEW.email = '' THEN
    RAISE EXCEPTION 'admin_users.email boş olamaz';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_normalize_email_biud ON public.admin_users;
CREATE TRIGGER admin_users_normalize_email_biud
  BEFORE INSERT OR UPDATE OF email ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_users_normalize_email_trigger();

COMMENT ON TRIGGER admin_users_normalize_email_biud ON public.admin_users IS
  'E-postayı lower(trim) ile tutarlı yazar (panel + RLS ile aynı eşleşme).';
