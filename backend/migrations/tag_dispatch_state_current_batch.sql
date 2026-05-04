-- Phase 1C-0: persist current wave driver ids for future restart recovery (shadow writes only).

ALTER TABLE tag_dispatch_state
ADD COLUMN IF NOT EXISTS current_batch jsonb NOT NULL DEFAULT '[]'::jsonb;
