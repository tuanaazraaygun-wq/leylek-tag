-- P0: Offer seen telemetry — dispatch_queue.driver_seen_at / driver_seen_source
-- Telemetry only; no TTL/revoke behavior change.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dispatch_queue'
      AND column_name = 'driver_seen_at'
  ) THEN
    ALTER TABLE public.dispatch_queue
      ADD COLUMN driver_seen_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dispatch_queue'
      AND column_name = 'driver_seen_source'
  ) THEN
    ALTER TABLE public.dispatch_queue
      ADD COLUMN driver_seen_source text NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.dispatch_queue.driver_seen_at IS
  'First driver UI render ack; telemetry P0 — no TTL side effects.';

COMMENT ON COLUMN public.dispatch_queue.driver_seen_source IS
  'Ingress channel: socket | poll | push | requests | unknown.';

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_unseen_sent
  ON public.dispatch_queue (tag_id, driver_id)
  WHERE status = 'sent' AND driver_seen_at IS NULL;
