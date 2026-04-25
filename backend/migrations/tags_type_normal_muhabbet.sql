-- tags.type: Martı vs Muhabbet. INSERT her zaman type göndermeli; DB default YOK.
-- Idempotent: önceki sürümde DEFAULT 'normal' varsa kaldırılır.

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS type text;

UPDATE public.tags
SET type = 'normal'
WHERE type IS NULL OR trim(both from type) = '';

ALTER TABLE public.tags
  ALTER COLUMN type SET NOT NULL;

COMMENT ON COLUMN public.tags.type IS 'normal=Martı; muhabbet=Leylek Muhabbeti. INSERT zorunlu; default yok.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_type_check'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_type_check CHECK (type IN ('normal', 'muhabbet'));
  END IF;
END $$;

-- Eski migration DEFAULT kaldırılmış olsa da güvenli.
ALTER TABLE public.tags
  ALTER COLUMN type DROP DEFAULT;
