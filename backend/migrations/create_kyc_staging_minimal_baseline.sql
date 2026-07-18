-- KYC Staging — minimal synthetic baseline (local/staging only)
--
-- PURPOSE:
--   Deterministic minimum public.users schema for Leylek KYC queue, detail,
--   document-access grant/audit FK, and enterprise decision smoke in an
--   isolated synthetic staging database.
--
-- NOT FOR PRODUCTION:
--   This manifest is not a production replacement schema.
--   Do not import production data. Do not apply to production refs.
--   KYC-only minimum — no unrelated product tables, buckets, RPCs, or Auth triggers.
--
-- APPLY ORDER (documented):
--   1. create_kyc_staging_minimal_baseline.sql
--   2. seed_kyc_staging_synthetic.sql
--   3. create_kyc_document_access_grants.sql
--   4. create_kyc_document_access_events.sql

-- =============================================================================
-- extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Supabase-compatible stub roles for local dry-run REVOKE statements in KYC audit migration.
-- No-op on Supabase where anon/authenticated already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- =============================================================================
-- public.users — KYC-minimum columns only
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone text NOT NULL,
  name text NOT NULL,
  city text NULL,
  push_token text NULL,
  driver_details jsonb NULL,
  driver_active_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_phone_unique UNIQUE (phone)
);

-- Fail-visible validation when an incompatible pre-existing table is present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'id'
      AND udt_name <> 'uuid'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.id must be uuid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'phone'
      AND udt_name <> 'text'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.phone must be text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'name'
      AND udt_name <> 'text'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.name must be text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'city'
      AND udt_name <> 'text'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.city must be text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'push_token'
      AND udt_name <> 'text'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.push_token must be text';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'driver_details'
      AND udt_name <> 'jsonb'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.driver_details must be jsonb';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'driver_active_until'
      AND udt_name <> 'timestamptz'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.driver_active_until must be timestamptz';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'created_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.created_at must be timestamptz';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'updated_at'
      AND udt_name <> 'timestamptz'
  ) THEN
    RAISE EXCEPTION 'kyc_staging_baseline_invalid: public.users.updated_at must be timestamptz';
  END IF;
END
$$;

-- Additive column backfill for partially-created tables (never destructive).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS driver_details jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS driver_active_until timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON TABLE public.users IS
  'KYC staging baseline — synthetic users only. Not a full Leylek product schema.';

COMMENT ON COLUMN public.users.driver_details IS
  'KYC application state (kyc_status, document URL presence keys, vehicle kind).';

COMMENT ON COLUMN public.users.driver_active_until IS
  'Written on KYC approve by enterprise decision service; nullable for pending rows.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_phone_unique'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_driver_details_not_null
  ON public.users (id)
  WHERE driver_details IS NOT NULL;
