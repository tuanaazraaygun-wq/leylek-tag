-- KYC staging SQL dry-run assertions (local disposable DB only)
-- Run after baseline + seed + grants + events apply sequence.

\set ON_ERROR_STOP on

-- Queue-compatible pending rows
DO $$
DECLARE
  pending_count integer;
BEGIN
  SELECT count(*) INTO pending_count
  FROM public.users u
  WHERE u.driver_details IS NOT NULL
    AND lower(u.driver_details->>'kyc_status') = 'pending';

  IF pending_count < 4 THEN
    RAISE EXCEPTION 'assert_pending_queue_rows_failed: expected >= 4 pending, got %', pending_count;
  END IF;
END $$;

-- Approved user excluded from pending queue selection
DO $$
DECLARE
  approved_in_pending integer;
BEGIN
  SELECT count(*) INTO approved_in_pending
  FROM public.users u
  WHERE u.driver_details IS NOT NULL
    AND lower(u.driver_details->>'kyc_status') = 'pending'
    AND u.driver_details->>'fixture_key' = 'approved_user';

  IF approved_in_pending <> 0 THEN
    RAISE EXCEPTION 'assert_approved_excluded_failed';
  END IF;
END $$;

-- record_version source: updated_at readable
DO $$
DECLARE
  rv text;
BEGIN
  SELECT u.updated_at::text INTO rv
  FROM public.users u
  WHERE u.id = '11111111-1111-4111-8111-111111111105'::uuid;

  IF rv IS NULL OR length(rv) = 0 THEN
    RAISE EXCEPTION 'assert_record_version_source_failed';
  END IF;
END $$;

-- Approve mutation simulation (optimistic concurrency on updated_at)
DO $$
DECLARE
  expected_version timestamptz;
  rows_updated integer;
BEGIN
  SELECT u.updated_at INTO expected_version
  FROM public.users u
  WHERE u.id = '11111111-1111-4111-8111-111111111105'::uuid;

  UPDATE public.users
  SET
    driver_details = jsonb_set(
      jsonb_set(
        jsonb_set(driver_details, '{kyc_status}', '"approved"'::jsonb, true),
        '{is_verified}', 'true'::jsonb, true
      ),
      '{kyc_approved_at}', to_jsonb(now()::text), true
    ),
    driver_active_until = now() + interval '60 days',
    updated_at = now()
  WHERE id = '11111111-1111-4111-8111-111111111105'::uuid
    AND updated_at = expected_version;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  IF rows_updated <> 1 THEN
    RAISE EXCEPTION 'assert_approve_optimistic_update_failed';
  END IF;
END $$;

-- Stale updated_at predicate prevents mutation
DO $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.users
  SET driver_details = jsonb_set(driver_details, '{kyc_status}', '"approved"'::jsonb, true)
  WHERE id = '11111111-1111-4111-8111-111111111104'::uuid
    AND updated_at = '2099-01-01T00:00:00+00:00'::timestamptz;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  IF rows_updated <> 0 THEN
    RAISE EXCEPTION 'assert_stale_version_should_not_update';
  END IF;
END $$;

-- Grant FK + TTL constraints
INSERT INTO public.kyc_document_access_grants (
  grant_reference_hash,
  application_id,
  document_type,
  actor_admin_id,
  request_id,
  review_reason,
  ttl_seconds,
  expires_at,
  source_binding_hash
) VALUES (
  'dryrun_grant_hash_001',
  '11111111-1111-4111-8111-111111111101'::uuid,
  'license',
  'admin-dryrun-001',
  'req-dryrun-001',
  'initial_review',
  90,
  now() + interval '90 seconds',
  'dryrun_binding_hash_001'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.kyc_document_access_grants (
      grant_reference_hash,
      application_id,
      document_type,
      actor_admin_id,
      request_id,
      review_reason,
      ttl_seconds,
      expires_at,
      source_binding_hash
    ) VALUES (
      'dryrun_grant_hash_invalid_ttl',
      '11111111-1111-4111-8111-111111111101'::uuid,
      'license',
      'admin-dryrun-001',
      'req-dryrun-invalid-ttl',
      'initial_review',
      30,
      now() + interval '30 seconds',
      'dryrun_binding_hash_invalid'
    );
    RAISE EXCEPTION 'assert_invalid_ttl_should_fail';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END $$;

-- Append-only event insert + mutation denial
INSERT INTO public.kyc_document_access_events (
  event_type,
  actor_admin_id,
  application_id,
  document_type,
  request_id,
  grant_reference_hash,
  review_reason,
  result,
  source_channel
) VALUES (
  'kyc.document.grant_issued',
  'admin-dryrun-001',
  '11111111-1111-4111-8111-111111111101'::uuid,
  'license',
  'req-dryrun-event-001',
  'dryrun_grant_hash_001',
  'initial_review',
  'allowed',
  'enterprise_bff'
);

DO $$
DECLARE
  event_id uuid;
BEGIN
  SELECT id INTO event_id
  FROM public.kyc_document_access_events
  WHERE request_id = 'req-dryrun-event-001'
  LIMIT 1;

  BEGIN
    UPDATE public.kyc_document_access_events
    SET result = 'denied'
    WHERE id = event_id;
    RAISE EXCEPTION 'assert_append_only_update_should_fail';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%append_only_violation%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    DELETE FROM public.kyc_document_access_events
    WHERE id = event_id;
    RAISE EXCEPTION 'assert_append_only_delete_should_fail';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE '%append_only_violation%' THEN
        RAISE;
      END IF;
  END;
END $$;

-- User delete restricted by grant FK
DO $$
BEGIN
  BEGIN
    DELETE FROM public.users
    WHERE id = '11111111-1111-4111-8111-111111111101'::uuid;
    RAISE EXCEPTION 'assert_user_delete_should_be_restricted';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;
END $$;

SELECT 'kyc_staging_dryrun_assertions_ok' AS status;
