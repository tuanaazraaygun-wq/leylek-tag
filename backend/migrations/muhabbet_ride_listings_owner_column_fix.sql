-- Leylek Muhabbet — ride_listings: backend'in kullandığı created_by_user_id kolonunu garanti et.
-- Supabase SQL Editor'da bir kez çalıştırın.
-- Çakışma yoksa idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ride_listings'
  ) THEN
    RAISE NOTICE 'public.ride_listings tablosu bulunamadı; önce tabloyu oluşturun.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ride_listings' AND column_name = 'created_by_user_id'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ride_listings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.ride_listings RENAME COLUMN user_id TO created_by_user_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ride_listings' AND column_name = 'creator_user_id'
  ) THEN
    ALTER TABLE public.ride_listings RENAME COLUMN creator_user_id TO created_by_user_id;
    RETURN;
  END IF;

  ALTER TABLE public.ride_listings
    ADD COLUMN created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
END $$;
