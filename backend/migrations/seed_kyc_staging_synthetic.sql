-- KYC Staging — synthetic seed (local/staging only)
--
-- PURPOSE:
--   Deterministic synthetic users for KYC queue, detail, decision, and grant FK smoke.
--
-- NOT FOR PRODUCTION:
--   No production data. No auth.users dependency. No real PII.
--   Safe reapply: ON CONFLICT (id) DO NOTHING — never deletes non-synthetic rows.
--
-- Synthetic markers:
--   driver_details.synthetic = true
--   driver_details.fixture_key = "<fixture>"

-- Fixture UUID namespace: 11111111-1111-4111-8111-1111111111xx
-- Phone convention: +905550001xx (non-routable test range)

INSERT INTO public.users (
  id,
  phone,
  name,
  city,
  push_token,
  driver_details,
  driver_active_until,
  created_at,
  updated_at
) VALUES
  (
    '11111111-1111-4111-8111-111111111101'::uuid,
    '+90555000101',
    'Sentetik Sürücü Pending Car',
    'Ankara',
    NULL,
    jsonb_build_object(
      'synthetic', true,
      'fixture_key', 'pending_car',
      'kyc_status', 'pending',
      'kyc_submitted_at', '2026-07-14T12:00:00+00:00',
      'pending_vehicle_kind', 'car',
      'license_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111101/license_abcd1234.jpg',
      'vehicle_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111101/vehicle_abcd1234.jpg'
    ),
    NULL,
    '2026-07-14T11:00:00+00:00'::timestamptz,
    '2026-07-14T13:00:00+00:00'::timestamptz
  ),
  (
    '11111111-1111-4111-8111-111111111102'::uuid,
    '+90555000102',
    'Sentetik Sürücü Pending Moto',
    'İzmir',
    NULL,
    jsonb_build_object(
      'synthetic', true,
      'fixture_key', 'pending_motorcycle',
      'kyc_status', 'pending',
      'kyc_submitted_at', '2026-07-14T11:30:00+00:00',
      'pending_vehicle_kind', 'motorcycle',
      'license_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111102/license_abcd1234.jpg',
      'motorcycle_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111102/motorcycle_abcd1234.jpg',
      'selfie_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111102/selfie_abcd1234.jpg'
    ),
    NULL,
    '2026-07-14T11:00:00+00:00'::timestamptz,
    '2026-07-14T13:30:00+00:00'::timestamptz
  ),
  (
    '11111111-1111-4111-8111-111111111103'::uuid,
    '+90555000103',
    'Sentetik Sürücü Approved',
    'Bursa',
    NULL,
    jsonb_build_object(
      'synthetic', true,
      'fixture_key', 'approved_user',
      'kyc_status', 'approved',
      'kyc_submitted_at', '2026-06-01T10:00:00+00:00',
      'kyc_approved_at', '2026-06-02T10:00:00+00:00',
      'approved_vehicle_kinds', jsonb_build_array('car'),
      'is_verified', true,
      'license_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111103/license_abcd1234.jpg',
      'vehicle_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111103/vehicle_abcd1234.jpg'
    ),
    '2026-12-31T23:59:59+00:00'::timestamptz,
    '2026-06-01T09:00:00+00:00'::timestamptz,
    '2026-06-02T10:00:00+00:00'::timestamptz
  ),
  (
    '11111111-1111-4111-8111-111111111104'::uuid,
    '+90555000104',
    'Sentetik Sürücü Stale Pending',
    'Antalya',
    NULL,
    jsonb_build_object(
      'synthetic', true,
      'fixture_key', 'stale_pending',
      'kyc_status', 'pending',
      'kyc_submitted_at', '2026-07-10T08:00:00+00:00',
      'pending_vehicle_kind', 'car',
      'license_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111104/license_abcd1234.jpg',
      'vehicle_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111104/vehicle_abcd1234.jpg'
    ),
    NULL,
    '2026-07-10T07:00:00+00:00'::timestamptz,
    '2026-07-10T08:00:00+00:00'::timestamptz
  ),
  (
    '11111111-1111-4111-8111-111111111105'::uuid,
    '+90555000105',
    'Sentetik Sürücü Approve Target',
    'Eskişehir',
    NULL,
    jsonb_build_object(
      'synthetic', true,
      'fixture_key', 'approve_target',
      'kyc_status', 'pending',
      'kyc_submitted_at', '2026-07-15T09:00:00+00:00',
      'pending_vehicle_kind', 'car',
      'license_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111105/license_abcd1234.jpg',
      'vehicle_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111105/vehicle_abcd1234.jpg'
    ),
    NULL,
    '2026-07-15T08:00:00+00:00'::timestamptz,
    '2026-07-15T09:30:00+00:00'::timestamptz
  ),
  (
    '11111111-1111-4111-8111-111111111106'::uuid,
    '+90555000106',
    'Sentetik Sürücü Reject Target',
    'Konya',
    NULL,
    jsonb_build_object(
      'synthetic', true,
      'fixture_key', 'reject_target',
      'kyc_status', 'pending',
      'kyc_submitted_at', '2026-07-15T10:00:00+00:00',
      'pending_vehicle_kind', 'motorcycle',
      'license_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111106/license_abcd1234.jpg',
      'motorcycle_photo_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111106/motorcycle_abcd1234.jpg',
      'selfie_url', 'https://staging.invalid/kyc/11111111-1111-4111-8111-111111111106/selfie_abcd1234.jpg'
    ),
    NULL,
    '2026-07-15T09:00:00+00:00'::timestamptz,
    '2026-07-15T10:30:00+00:00'::timestamptz
  )
ON CONFLICT (id) DO NOTHING;
