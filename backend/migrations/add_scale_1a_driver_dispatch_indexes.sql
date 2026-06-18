-- SCALE-1A-1: driver dispatch query indexes (schema only).
-- Speeds up online-driver location scans and per-driver dispatch_queue lookups.
--
-- IMPORTANT — manual apply only:
--   CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
--   Run each statement separately in Supabase SQL Editor (or psql with autocommit).
--   If your migration runner wraps files in a transaction, do NOT auto-run this file.
--
-- Rollback (reference only — do not execute unless reverting indexes):
--   DROP INDEX CONCURRENTLY IF EXISTS idx_users_online_active_loc;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_dispatch_queue_driver_status;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_dispatch_queue_driver_sent;
--
-- No application code changes; no runtime behavior change.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_online_active_loc
  ON users (latitude, longitude)
  WHERE driver_online = true
    AND is_active = true
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispatch_queue_driver_status
  ON dispatch_queue (driver_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dispatch_queue_driver_sent
  ON dispatch_queue (driver_id, created_at DESC)
  WHERE status = 'sent';
