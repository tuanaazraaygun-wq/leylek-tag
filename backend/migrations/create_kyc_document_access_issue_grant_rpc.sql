-- KYC Phase 5B4 — atomic document access grant issuance RPC (artifact only)
-- Creates public.kyc_document_access_issue_grant only. Does not apply grants/events tables.
--
-- MANUAL PREFLIGHT (required before staging apply):
--   * create_kyc_document_access_grants.sql and create_kyc_document_access_events.sql applied first.
--   * Apply create_kyc_document_access_issue_grant_rpc_grants.sql after this function exists.
--   * Staging verification required before production.
--
-- Security posture:
--   * SECURITY DEFINER with fixed search_path and row_security disabled for atomic RPC writes.
--   * No dynamic SQL. Schema-qualified references only.
--   * Intended caller: service_role via Supabase RPC only.
--   * No raw URLs, buckets, paths, tokens, or PII returned or persisted by this function.

CREATE OR REPLACE FUNCTION public.kyc_document_access_issue_grant(
  p_grant_reference_hash text,
  p_token_version smallint,
  p_application_id uuid,
  p_document_type text,
  p_actor_admin_id text,
  p_request_id text,
  p_review_reason text,
  p_ttl_seconds integer,
  p_source_binding_hash text,
  p_application_record_version timestamptz,
  p_source_channel text
)
RETURNS TABLE (
  outcome_code text,
  grant_id uuid,
  grant_reference_hash text,
  state text,
  issued_at timestamptz,
  expires_at timestamptz,
  ttl_seconds integer,
  is_reused boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_existing public.kyc_document_access_grants%ROWTYPE;
  v_user_updated_at timestamptz;
  v_driver_details jsonb;
  v_kyc_status text;
  v_document_url text;
  v_vehicle_kind text;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_grant_id uuid;
  v_issued_at timestamptz;
  v_state text;
  v_ttl integer;
  v_sqlstate text;
  v_diagnostics_message text;
BEGIN
  outcome_code := NULL;
  grant_id := NULL;
  grant_reference_hash := NULL;
  state := NULL;
  issued_at := NULL;
  expires_at := NULL;
  ttl_seconds := NULL;
  is_reused := FALSE;

  IF p_grant_reference_hash IS NULL
     OR char_length(trim(p_grant_reference_hash)) = 0
     OR char_length(p_grant_reference_hash) > 128
     OR p_grant_reference_hash !~ '^[0-9a-f]{64}$' THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_source_binding_hash IS NULL
     OR char_length(trim(p_source_binding_hash)) = 0
     OR char_length(p_source_binding_hash) > 128
     OR p_source_binding_hash !~ '^[0-9a-f]{64}$' THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_token_version IS NULL OR p_token_version < 1 THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_application_id IS NULL THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_actor_admin_id IS NULL
     OR char_length(trim(p_actor_admin_id)) = 0
     OR char_length(p_actor_admin_id) > 128 THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_request_id IS NULL
     OR char_length(trim(p_request_id)) = 0
     OR char_length(p_request_id) > 128 THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_document_type IS NULL
     OR p_document_type NOT IN ('license', 'vehicle_registration', 'selfie') THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_review_reason IS NULL
     OR p_review_reason NOT IN ('initial_review', 'recheck') THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_source_channel IS NULL
     OR p_source_channel NOT IN ('enterprise_bff', 'leylek_internal') THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_application_record_version IS NULL THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_ttl_seconds IS NULL
     OR p_ttl_seconds < 60
     OR p_ttl_seconds > 120 THEN
    outcome_code := 'invalid_input';
    RETURN NEXT;
    RETURN;
  END IF;

  v_ttl := p_ttl_seconds;

  SELECT g.*
    INTO v_existing
    FROM public.kyc_document_access_grants AS g
   WHERE g.actor_admin_id = trim(p_actor_admin_id)
     AND g.request_id = trim(p_request_id)
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.application_id = p_application_id
       AND v_existing.document_type = p_document_type
       AND v_existing.review_reason = p_review_reason
       AND v_existing.source_binding_hash = p_source_binding_hash
       AND v_existing.application_record_version IS NOT DISTINCT FROM p_application_record_version
       AND v_existing.grant_reference_hash = p_grant_reference_hash THEN
      outcome_code := 'duplicate_request';
      grant_id := v_existing.id;
      grant_reference_hash := v_existing.grant_reference_hash;
      state := v_existing.state;
      issued_at := v_existing.issued_at;
      expires_at := v_existing.expires_at;
      ttl_seconds := v_existing.ttl_seconds;
      is_reused := TRUE;
      RETURN NEXT;
      RETURN;
    END IF;

    outcome_code := 'request_conflict';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT u.updated_at, u.driver_details
    INTO v_user_updated_at, v_driver_details
    FROM public.users AS u
   WHERE u.id = p_application_id
   LIMIT 1;

  IF NOT FOUND THEN
    outcome_code := 'application_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_user_updated_at IS DISTINCT FROM p_application_record_version THEN
    outcome_code := 'record_version_stale';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_driver_details IS NULL OR jsonb_typeof(v_driver_details) <> 'object' THEN
    outcome_code := 'document_not_reviewable';
    RETURN NEXT;
    RETURN;
  END IF;

  v_kyc_status := lower(trim(coalesce(v_driver_details->>'kyc_status', '')));

  IF v_kyc_status NOT IN ('pending', 'needs_documents') THEN
    outcome_code := 'document_not_reviewable';
    RETURN NEXT;
    RETURN;
  END IF;

  v_vehicle_kind := lower(trim(coalesce(
    nullif(v_driver_details->>'pending_vehicle_kind', ''),
    nullif(v_driver_details->>'kyc_vehicle_kind', ''),
    nullif(v_driver_details->>'vehicle_kind', ''),
    ''
  )));

  IF v_vehicle_kind IN ('automobile') THEN
    v_vehicle_kind := 'car';
  ELSIF v_vehicle_kind IN ('motor', 'scooter') THEN
    v_vehicle_kind := 'motorcycle';
  END IF;

  IF p_document_type = 'license' THEN
    v_document_url := nullif(trim(coalesce(v_driver_details->>'license_photo_url', '')), '');
  ELSIF p_document_type = 'vehicle_registration' THEN
    IF v_vehicle_kind = 'motorcycle' THEN
      v_document_url := nullif(trim(coalesce(v_driver_details->>'motorcycle_photo_url', '')), '');
    ELSE
      v_document_url := nullif(trim(coalesce(v_driver_details->>'vehicle_photo_url', '')), '');
    END IF;
  ELSIF p_document_type = 'selfie' THEN
    v_document_url := nullif(trim(coalesce(v_driver_details->>'selfie_url', '')), '');
  END IF;

  IF v_document_url IS NULL THEN
    outcome_code := 'document_missing';
    RETURN NEXT;
    RETURN;
  END IF;

  v_expires_at := v_now + make_interval(secs => v_ttl);

  BEGIN
    INSERT INTO public.kyc_document_access_grants AS g (
      grant_reference_hash,
      token_version,
      application_id,
      document_type,
      actor_admin_id,
      request_id,
      review_reason,
      state,
      ttl_seconds,
      issued_at,
      expires_at,
      source_binding_hash,
      application_record_version
    ) VALUES (
      p_grant_reference_hash,
      p_token_version,
      p_application_id,
      p_document_type,
      trim(p_actor_admin_id),
      trim(p_request_id),
      p_review_reason,
      'issued',
      v_ttl,
      v_now,
      v_expires_at,
      p_source_binding_hash,
      p_application_record_version
    )
    RETURNING g.id, g.issued_at, g.state
      INTO v_grant_id, v_issued_at, v_state;

    INSERT INTO public.kyc_document_access_events (
      event_type,
      actor_admin_id,
      application_id,
      document_type,
      request_id,
      grant_id,
      grant_reference_hash,
      review_reason,
      result,
      reason_code,
      source_channel
    ) VALUES (
      'kyc.document.access_requested',
      trim(p_actor_admin_id),
      p_application_id,
      p_document_type,
      trim(p_request_id),
      v_grant_id,
      p_grant_reference_hash,
      p_review_reason,
      'allowed',
      NULL,
      p_source_channel
    );

    INSERT INTO public.kyc_document_access_events (
      event_type,
      actor_admin_id,
      application_id,
      document_type,
      request_id,
      grant_id,
      grant_reference_hash,
      review_reason,
      result,
      reason_code,
      source_channel
    ) VALUES (
      'kyc.document.grant_issued',
      trim(p_actor_admin_id),
      p_application_id,
      p_document_type,
      trim(p_request_id),
      v_grant_id,
      p_grant_reference_hash,
      p_review_reason,
      'allowed',
      NULL,
      p_source_channel
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT g.*
        INTO v_existing
        FROM public.kyc_document_access_grants AS g
       WHERE g.actor_admin_id = trim(p_actor_admin_id)
         AND g.request_id = trim(p_request_id)
       LIMIT 1;

      IF FOUND
         AND v_existing.application_id = p_application_id
         AND v_existing.document_type = p_document_type
         AND v_existing.review_reason = p_review_reason
         AND v_existing.source_binding_hash = p_source_binding_hash
         AND v_existing.application_record_version IS NOT DISTINCT FROM p_application_record_version
         AND v_existing.grant_reference_hash = p_grant_reference_hash THEN
        outcome_code := 'duplicate_request';
        grant_id := v_existing.id;
        grant_reference_hash := v_existing.grant_reference_hash;
        state := v_existing.state;
        issued_at := v_existing.issued_at;
        expires_at := v_existing.expires_at;
        ttl_seconds := v_existing.ttl_seconds;
        is_reused := TRUE;
        RETURN NEXT;
        RETURN;
      END IF;

      outcome_code := 'request_conflict';
      RETURN NEXT;
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_sqlstate = RETURNED_SQLSTATE,
        v_diagnostics_message = MESSAGE_TEXT;

      RAISE LOG
        'kyc_document_access_issue_grant issuance failed: sqlstate=% message=%',
        v_sqlstate,
        v_diagnostics_message;

      outcome_code := 'audit_unavailable';
      RETURN NEXT;
      RETURN;
  END;

  outcome_code := 'issued';
  grant_id := v_grant_id;
  grant_reference_hash := p_grant_reference_hash;
  state := v_state;
  issued_at := v_issued_at;
  expires_at := v_expires_at;
  ttl_seconds := v_ttl;
  is_reused := FALSE;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.kyc_document_access_issue_grant(
  text,
  smallint,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  timestamptz,
  text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.kyc_document_access_issue_grant(
  text,
  smallint,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  timestamptz,
  text
) FROM PUBLIC;

COMMENT ON FUNCTION public.kyc_document_access_issue_grant IS
  'KYC Phase 5B4 — atomic opaque document access grant issuance. '
  'Persists grant metadata and append-only audit events only. '
  'Never stores or returns document URLs, storage locators, buckets, bytes, tokens, or PII. '
  'service_role EXECUTE is granted in create_kyc_document_access_issue_grant_rpc_grants.sql.';
