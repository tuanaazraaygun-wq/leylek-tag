-- Leylek Muhabbeti: grup moderasyonu (pending → admin onayı → approved / rejected)
-- Önkoşul: public.groups, public.users, neighborhoods (Faz-1 migration)

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid NULL REFERENCES public.users (id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE public.groups
    ADD CONSTRAINT groups_status_chk CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.groups.status IS 'pending | approved | rejected — keşif listesinde yalnızca approved';
COMMENT ON COLUMN public.groups.created_by_user_id IS 'Kullanıcı önerisiyle oluşturulduysa öneren kullanıcı';

CREATE INDEX IF NOT EXISTS idx_groups_status ON public.groups (status);
CREATE INDEX IF NOT EXISTS idx_groups_pending_created ON public.groups (created_at DESC) WHERE status = 'pending';
