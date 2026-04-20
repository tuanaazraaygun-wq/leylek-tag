-- Boarding QR lifecycle (additive). Apply in Supabase SQL editor or your migration runner.
-- Finish QR (/trip/complete-qr, leylektag://end) is unchanged.

ALTER TABLE tags ADD COLUMN IF NOT EXISTS boarding_qr_issued_at timestamptz;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS boarding_confirmed_at timestamptz;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS proximity_prompted_at timestamptz;

COMMENT ON COLUMN tags.boarding_qr_issued_at IS 'Driver last issued a boarding QR token (server-side token TTL is separate).';
COMMENT ON COLUMN tags.boarding_confirmed_at IS 'Passenger boarding QR verified; trip may transition to in_progress.';
COMMENT ON COLUMN tags.proximity_prompted_at IS 'Optional: client set when proximity boarding UI was shown (step 2).';
