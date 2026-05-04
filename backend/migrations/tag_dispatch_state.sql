-- Normal TAG dispatch persistence (Phase 1): durable rolling-wave metadata per tag.
-- Application code does not read/write this table until a later phase.

CREATE TABLE IF NOT EXISTS tag_dispatch_state (
  tag_id uuid PRIMARY KEY REFERENCES tags(id) ON DELETE CASCADE,
  batch_seq integer NOT NULL DEFAULT 0,
  offered_driver_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_driver_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  relax_vehicle_on_empty boolean NOT NULL DEFAULT false,
  wave_deadline timestamptz NULL,
  next_wave_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  schema_version smallint NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_tag_dispatch_state_wave_deadline
  ON tag_dispatch_state (wave_deadline)
  WHERE wave_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tag_dispatch_state_next_wave_at
  ON tag_dispatch_state (next_wave_at)
  WHERE next_wave_at IS NOT NULL;
