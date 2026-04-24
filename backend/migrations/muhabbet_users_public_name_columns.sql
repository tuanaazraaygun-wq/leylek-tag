-- Leylek Muhabbeti: teklif kartı / profil için ad parçalama (soyad tam gösterilmez; backend _muhabbet_public_display_name).
-- Kolonlar yoksa Supabase users sorguları 400 dönebilir; bu migration ile eklenir.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.users.first_name IS 'Kayıtta ayrı tutulan ad; Muhabbet gizlilik gösterimi.';
COMMENT ON COLUMN public.users.last_name IS 'Kayıtta ayrı tutulan soyad; Muhabbet kartında yalnızca baş harf kullanılır.';
