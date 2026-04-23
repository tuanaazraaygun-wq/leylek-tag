-- Rota eşleşme optimizasyonu v2: kullanıcı+pattern tekil, groups.group_type
-- Mevcut duplicate (user_id, pattern_hash) satırları varsa bu migration başarısız olur; önce temizleyin.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'community';

COMMENT ON COLUMN public.groups.group_type IS 'community | route | (ileride)';

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_routes_user_pattern
  ON public.user_routes (user_id, pattern_hash);
