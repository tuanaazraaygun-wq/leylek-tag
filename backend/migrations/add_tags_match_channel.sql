-- Sequential Quick Match — Phase P6-B2 (schema only)
-- Column: tags.match_channel (normal | quick | trusted)
-- Application code does not read/write this column until P6-C orchestrator.
-- Apply via Supabase SQL Editor or migration runner.
-- No runtime behavior change. DEFAULT 'normal' kept so existing tag INSERTs without match_channel do not break.
-- No index in this phase (evaluate in P6-C or P6-G).

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS match_channel text DEFAULT 'normal';

UPDATE public.tags
SET match_channel = 'normal'
WHERE match_channel IS NULL;

ALTER TABLE public.tags
  ALTER COLUMN match_channel SET DEFAULT 'normal';

ALTER TABLE public.tags
  ALTER COLUMN match_channel SET NOT NULL;

COMMENT ON COLUMN public.tags.match_channel IS
  'Match origin channel (backend controlled). normal=classic offer/dispatch match; '
  'quick=sequential quick match (P6); trusted=future trusted network match. '
  'Independent of tags.type (normal vs muhabbet product line).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tags_match_channel_check'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_match_channel_check
      CHECK (match_channel IN ('normal', 'quick', 'trusted'));
  END IF;
END $$;
