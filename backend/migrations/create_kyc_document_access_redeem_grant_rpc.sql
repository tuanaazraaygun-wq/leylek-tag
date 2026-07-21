-- KYC Phase D7-B1 — atomic document access grant redemption RPC (artifact only)
-- Creates public.kyc_document_access_redeem_grant only.
--
-- MANUAL PREFLIGHT (required before staging apply):
--   * create_kyc_document_access_grants.sql applied.
--   * create_kyc_document_access_events.sql applied.
--   * create_kyc_document_access_redemption_commands.sql applied.
--   * Apply create_kyc_document_access_redeem_grant_rpc_grants.sql after this function exists.
--
-- Security posture:
--   * SECURITY DEFINER with fixed search_path and row_security disabled for atomic writes.
--   * No dynamic SQL. Schema-qualified references only.
--   * Never stores or returns bearer tokens, storage locators, signed URLs, or document bytes.
--   * service_role EXECUTE is granted in create_kyc_document_access_redeem_grant_rpc_grants.sql.

CREATE OR REPLACE FUNCTION public.kyc_document_access_redeem_grant(
  p_grant_reference_hash text,
  p_actor_admin_id text,
  p_request_id text,
  p_source_channel text,
  p_observed_source_binding_hash text,
  p_observed_application_record_version timestamptz
)
RETURNS TABLE (
  outcome_code text,
  grant_id uuid,
  application_id uuid,
  document_type text,
  state text,
  redeemed_at timestamptz,
  source_binding_hash text,
  application_record_version timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
#variable_conflict use_column
DECLARE
  v_grant public.kyc_document_access_grants%ROWTYPE;
  v_ledger public.kyc_document_access_redemption_commands%ROWTYPE;
  v_user_updated_at timestamptz;
  v_now timestamptz := now();
  v_fingerprint text;
  v_sqlstate text;
  v_diagnostics_message text;
  v_outcome_code text;
  v_out_grant_id uuid;
  v_out_application_id uuid;
  v_out_document_type text;
  v_out_state text;
  v_out_redeemed_at timestamptz;
  v_out_source_binding_hash text;
  v_out_application_record_version timestamptz;
BEGIN
  v_outcome_code := NULL;
  v_out_grant_id := NULL;
  v_out_application_id := NULL;
  v_out_document_type := NULL;
  v_out_state := NULL;
  v_out_redeemed_at := NULL;
  v_out_source_binding_hash := NULL;
  v_out_application_record_version := NULL;

  IF p_grant_reference_hash IS NULL
     OR char_length(trim(p_grant_reference_hash)) = 0
     OR char_length(p_grant_reference_hash) > 128
     OR p_grant_reference_hash !~ '^[0-9a-f]{64}$' THEN
    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_observed_source_binding_hash IS NULL
     OR char_length(trim(p_observed_source_binding_hash)) = 0
     OR char_length(p_observed_source_binding_hash) > 128
     OR p_observed_source_binding_hash !~ '^[0-9a-f]{64}$' THEN
    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_actor_admin_id IS NULL
     OR char_length(trim(p_actor_admin_id)) = 0
     OR char_length(p_actor_admin_id) > 128 THEN
    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_request_id IS NULL
     OR char_length(trim(p_request_id)) = 0
     OR char_length(p_request_id) > 128 THEN
    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_source_channel IS NULL
     OR p_source_channel NOT IN ('enterprise_bff', 'leylek_internal') THEN
    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_observed_application_record_version IS NULL THEN
    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT g.*
    INTO v_grant
    FROM public.kyc_document_access_grants AS g
   WHERE g.grant_reference_hash = p_grant_reference_hash
   FOR UPDATE;

  IF NOT FOUND THEN
    v_outcome_code := 'not_found_or_unauthorized';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF trim(v_grant.actor_admin_id) <> trim(p_actor_admin_id) THEN
    UPDATE public.kyc_document_access_grants AS g
       SET redemption_attempt_count = g.redemption_attempt_count + 1,
           last_redemption_attempt_at = v_now
     WHERE g.id = v_grant.id;

    v_outcome_code := 'not_found_or_unauthorized';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        v_grant.id::text,
        trim(p_actor_admin_id),
        trim(p_request_id),
        p_grant_reference_hash,
        p_observed_source_binding_hash,
        p_observed_application_record_version::text,
        p_source_channel
      ),
      'sha256'::text
    ),
    'hex'
  );

  INSERT INTO public.kyc_document_access_redemption_commands (
    grant_id,
    actor_admin_id,
    request_id,
    source_channel,
    request_fingerprint,
    status
  )
  SELECT
    v_grant.id,
    trim(p_actor_admin_id),
    trim(p_request_id),
    p_source_channel,
    v_fingerprint,
    'pending'
  ON CONFLICT ON CONSTRAINT uq_kdarc_grant_actor_request DO NOTHING;

  SELECT cmd.*
    INTO v_ledger
    FROM public.kyc_document_access_redemption_commands AS cmd
   WHERE cmd.grant_id = v_grant.id
     AND cmd.actor_admin_id = trim(p_actor_admin_id)
     AND cmd.request_id = trim(p_request_id)
   FOR UPDATE;

  -- Terminal completed ledger: fingerprint mismatch must not mutate success rows.
  IF v_ledger.request_fingerprint <> v_fingerprint THEN
    IF v_ledger.status = 'completed' THEN
      v_outcome_code := 'invalid_input';
      v_out_grant_id := NULL;
      v_out_application_id := NULL;
      v_out_document_type := NULL;
      v_out_state := NULL;
      v_out_redeemed_at := NULL;
      v_out_source_binding_hash := NULL;
      v_out_application_record_version := NULL;
      outcome_code := v_outcome_code;
      grant_id := v_out_grant_id;
      application_id := v_out_application_id;
      document_type := v_out_document_type;
      state := v_out_state;
      redeemed_at := v_out_redeemed_at;
      source_binding_hash := v_out_source_binding_hash;
      application_record_version := v_out_application_record_version;
      RETURN NEXT;
      RETURN;
    END IF;

    UPDATE public.kyc_document_access_redemption_commands AS cmd
       SET status = 'failed',
           terminal_outcome_code = 'invalid_input',
           failure_reason_code = 'idempotency_mismatch',
           completed_at = v_now
     WHERE cmd.id = v_ledger.id
       AND cmd.status <> 'completed';

    v_outcome_code := 'invalid_input';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_ledger.status = 'completed' THEN
    v_outcome_code := v_ledger.terminal_outcome_code;
    v_out_grant_id := v_ledger.result_grant_id;
    v_out_application_id := v_ledger.result_application_id;
    v_out_document_type := v_ledger.result_document_type;
    v_out_state := v_ledger.result_state;
    v_out_redeemed_at := v_ledger.result_redeemed_at;
    v_out_source_binding_hash := v_ledger.result_source_binding_hash;
    v_out_application_record_version := v_ledger.result_application_record_version;
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT u.updated_at
    INTO v_user_updated_at
    FROM public.users AS u
   WHERE u.id = v_grant.application_id
   FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.kyc_document_access_grants AS g
       SET redemption_attempt_count = g.redemption_attempt_count + 1,
           last_redemption_attempt_at = v_now
     WHERE g.id = v_grant.id;

    UPDATE public.kyc_document_access_redemption_commands AS cmd
       SET status = 'failed',
           terminal_outcome_code = 'not_found_or_unauthorized',
           failure_reason_code = 'record_version_stale',
           completed_at = v_now
     WHERE cmd.id = v_ledger.id;

    v_outcome_code := 'not_found_or_unauthorized';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_user_updated_at IS DISTINCT FROM v_grant.application_record_version
     OR p_observed_application_record_version IS DISTINCT FROM v_user_updated_at
     OR p_observed_source_binding_hash <> v_grant.source_binding_hash THEN
    BEGIN
      UPDATE public.kyc_document_access_grants AS g
         SET redemption_attempt_count = g.redemption_attempt_count + 1,
             last_redemption_attempt_at = v_now
       WHERE g.id = v_grant.id;

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
      )
      SELECT
        'kyc.document.view_failed',
        trim(p_actor_admin_id),
        v_grant.application_id,
        v_grant.document_type,
        trim(p_request_id),
        v_grant.id,
        v_grant.grant_reference_hash,
        v_grant.review_reason,
        'unavailable',
        'invalid_source_reference',
        p_source_channel;

      UPDATE public.kyc_document_access_redemption_commands AS cmd
         SET status = 'failed',
             terminal_outcome_code = 'not_found_or_unauthorized',
             failure_reason_code = 'source_binding_mismatch',
             completed_at = v_now
       WHERE cmd.id = v_ledger.id;
    EXCEPTION
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
          v_sqlstate = RETURNED_SQLSTATE,
          v_diagnostics_message = MESSAGE_TEXT;

        RAISE LOG
          'kyc_document_access_redeem_grant binding audit failed: sqlstate=% message=%',
          v_sqlstate,
          v_diagnostics_message;

        UPDATE public.kyc_document_access_redemption_commands AS cmd
           SET status = 'failed',
               terminal_outcome_code = 'audit_unavailable',
               failure_reason_code = NULL,
               completed_at = v_now
         WHERE cmd.id = v_ledger.id
           AND cmd.status = 'pending';

        v_outcome_code := 'audit_unavailable';
        v_out_grant_id := NULL;
        v_out_application_id := NULL;
        v_out_document_type := NULL;
        v_out_state := NULL;
        v_out_redeemed_at := NULL;
        v_out_source_binding_hash := NULL;
        v_out_application_record_version := NULL;
        outcome_code := v_outcome_code;
        grant_id := v_out_grant_id;
        application_id := v_out_application_id;
        document_type := v_out_document_type;
        state := v_out_state;
        redeemed_at := v_out_redeemed_at;
        source_binding_hash := v_out_source_binding_hash;
        application_record_version := v_out_application_record_version;
        RETURN NEXT;
        RETURN;
    END;

    v_outcome_code := 'not_found_or_unauthorized';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_grant.state = 'revoked' THEN
    UPDATE public.kyc_document_access_grants AS g
       SET redemption_attempt_count = g.redemption_attempt_count + 1,
           last_redemption_attempt_at = v_now
     WHERE g.id = v_grant.id;

    UPDATE public.kyc_document_access_redemption_commands AS cmd
       SET status = 'completed',
           terminal_outcome_code = 'grant_revoked',
           failure_reason_code = 'terminal_state_block',
           completed_at = v_now
     WHERE cmd.id = v_ledger.id;

    v_outcome_code := 'grant_revoked';
    v_out_grant_id := v_grant.id;
    v_out_application_id := v_grant.application_id;
    v_out_document_type := v_grant.document_type;
    v_out_state := v_grant.state;
    v_out_redeemed_at := NULL;
    v_out_source_binding_hash := v_grant.source_binding_hash;
    v_out_application_record_version := v_grant.application_record_version;
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_grant.state = 'expired'
     OR (v_grant.state = 'issued' AND v_now >= v_grant.expires_at) THEN
    IF v_grant.state = 'issued' THEN
      BEGIN
        UPDATE public.kyc_document_access_grants AS g
           SET state = 'expired',
               redemption_attempt_count = g.redemption_attempt_count + 1,
               last_redemption_attempt_at = v_now
         WHERE g.id = v_grant.id
         RETURNING g.id, g.application_id, g.document_type, g.state,
                   g.source_binding_hash, g.application_record_version
           INTO v_out_grant_id, v_out_application_id, v_out_document_type, v_out_state,
                v_out_source_binding_hash, v_out_application_record_version;

        v_out_redeemed_at := NULL;

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
        )
        SELECT
          'kyc.document.grant_expired',
          trim(p_actor_admin_id),
          v_out_application_id,
          v_out_document_type,
          trim(p_request_id),
          v_out_grant_id,
          v_grant.grant_reference_hash,
          v_grant.review_reason,
          'unavailable',
          'grant_expired',
          p_source_channel;

        UPDATE public.kyc_document_access_redemption_commands AS cmd
           SET status = 'completed',
               terminal_outcome_code = 'grant_expired',
               result_grant_id = v_out_grant_id,
               result_application_id = v_out_application_id,
               result_document_type = v_out_document_type,
               result_state = v_out_state,
               result_source_binding_hash = v_out_source_binding_hash,
               result_application_record_version = v_out_application_record_version,
               completed_at = v_now
         WHERE cmd.id = v_ledger.id;
      EXCEPTION
        WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS
            v_sqlstate = RETURNED_SQLSTATE,
            v_diagnostics_message = MESSAGE_TEXT;

          RAISE LOG
            'kyc_document_access_redeem_grant expiry audit failed: sqlstate=% message=%',
            v_sqlstate,
            v_diagnostics_message;

          UPDATE public.kyc_document_access_redemption_commands AS cmd
             SET status = 'failed',
                 terminal_outcome_code = 'audit_unavailable',
                 failure_reason_code = NULL,
                 completed_at = v_now
           WHERE cmd.id = v_ledger.id
             AND cmd.status = 'pending';

          v_outcome_code := 'audit_unavailable';
          v_out_grant_id := NULL;
          v_out_application_id := NULL;
          v_out_document_type := NULL;
          v_out_state := NULL;
          v_out_redeemed_at := NULL;
          v_out_source_binding_hash := NULL;
          v_out_application_record_version := NULL;
          outcome_code := v_outcome_code;
          grant_id := v_out_grant_id;
          application_id := v_out_application_id;
          document_type := v_out_document_type;
          state := v_out_state;
          redeemed_at := v_out_redeemed_at;
          source_binding_hash := v_out_source_binding_hash;
          application_record_version := v_out_application_record_version;
          RETURN NEXT;
          RETURN;
      END;
    ELSE
      BEGIN
        UPDATE public.kyc_document_access_grants AS g
           SET redemption_attempt_count = g.redemption_attempt_count + 1,
               last_redemption_attempt_at = v_now
         WHERE g.id = v_grant.id;

        v_out_grant_id := v_grant.id;
        v_out_application_id := v_grant.application_id;
        v_out_document_type := v_grant.document_type;
        v_out_state := v_grant.state;
        v_out_redeemed_at := NULL;
        v_out_source_binding_hash := v_grant.source_binding_hash;
        v_out_application_record_version := v_grant.application_record_version;

        UPDATE public.kyc_document_access_redemption_commands AS cmd
           SET status = 'completed',
               terminal_outcome_code = 'grant_expired',
               result_grant_id = v_out_grant_id,
               result_application_id = v_out_application_id,
               result_document_type = v_out_document_type,
               result_state = v_out_state,
               result_source_binding_hash = v_out_source_binding_hash,
               result_application_record_version = v_out_application_record_version,
               completed_at = v_now
         WHERE cmd.id = v_ledger.id;
      EXCEPTION
        WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS
            v_sqlstate = RETURNED_SQLSTATE,
            v_diagnostics_message = MESSAGE_TEXT;

          RAISE LOG
            'kyc_document_access_redeem_grant expiry finalization failed: sqlstate=% message=%',
            v_sqlstate,
            v_diagnostics_message;

          UPDATE public.kyc_document_access_redemption_commands AS cmd
             SET status = 'failed',
                 terminal_outcome_code = 'audit_unavailable',
                 failure_reason_code = NULL,
                 completed_at = v_now
           WHERE cmd.id = v_ledger.id
             AND cmd.status = 'pending';

          v_outcome_code := 'audit_unavailable';
          v_out_grant_id := NULL;
          v_out_application_id := NULL;
          v_out_document_type := NULL;
          v_out_state := NULL;
          v_out_redeemed_at := NULL;
          v_out_source_binding_hash := NULL;
          v_out_application_record_version := NULL;
          outcome_code := v_outcome_code;
          grant_id := v_out_grant_id;
          application_id := v_out_application_id;
          document_type := v_out_document_type;
          state := v_out_state;
          redeemed_at := v_out_redeemed_at;
          source_binding_hash := v_out_source_binding_hash;
          application_record_version := v_out_application_record_version;
          RETURN NEXT;
          RETURN;
      END;
    END IF;

    v_outcome_code := 'grant_expired';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_grant.state = 'redeemed' THEN
    UPDATE public.kyc_document_access_grants AS g
       SET redemption_attempt_count = g.redemption_attempt_count + 1,
           last_redemption_attempt_at = v_now
     WHERE g.id = v_grant.id;

    UPDATE public.kyc_document_access_redemption_commands AS cmd
       SET status = 'completed',
           terminal_outcome_code = 'grant_redeemed',
           result_grant_id = v_grant.id,
           result_application_id = v_grant.application_id,
           result_document_type = v_grant.document_type,
           result_state = v_grant.state,
           result_redeemed_at = v_grant.redeemed_at,
           result_source_binding_hash = v_grant.source_binding_hash,
           result_application_record_version = v_grant.application_record_version,
           failure_reason_code = 'terminal_state_block',
           completed_at = v_now
     WHERE cmd.id = v_ledger.id;

    v_outcome_code := 'grant_redeemed';
    v_out_grant_id := v_grant.id;
    v_out_application_id := v_grant.application_id;
    v_out_document_type := v_grant.document_type;
    v_out_state := v_grant.state;
    v_out_redeemed_at := v_grant.redeemed_at;
    v_out_source_binding_hash := v_grant.source_binding_hash;
    v_out_application_record_version := v_grant.application_record_version;
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_grant.state <> 'issued' THEN
    UPDATE public.kyc_document_access_grants AS g
       SET redemption_attempt_count = g.redemption_attempt_count + 1,
           last_redemption_attempt_at = v_now
     WHERE g.id = v_grant.id;

    UPDATE public.kyc_document_access_redemption_commands AS cmd
       SET status = 'failed',
           terminal_outcome_code = 'not_found_or_unauthorized',
           failure_reason_code = 'terminal_state_block',
           completed_at = v_now
     WHERE cmd.id = v_ledger.id;

    v_outcome_code := 'not_found_or_unauthorized';
    outcome_code := v_outcome_code;
    grant_id := v_out_grant_id;
    application_id := v_out_application_id;
    document_type := v_out_document_type;
    state := v_out_state;
    redeemed_at := v_out_redeemed_at;
    source_binding_hash := v_out_source_binding_hash;
    application_record_version := v_out_application_record_version;
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    UPDATE public.kyc_document_access_grants AS g
       SET state = 'redeemed',
           redeemed_at = v_now,
           redemption_attempt_count = g.redemption_attempt_count + 1,
           last_redemption_attempt_at = v_now
     WHERE g.id = v_grant.id
     RETURNING g.id, g.application_id, g.document_type, g.state, g.redeemed_at,
               g.source_binding_hash, g.application_record_version
       INTO v_out_grant_id, v_out_application_id, v_out_document_type, v_out_state,
            v_out_redeemed_at, v_out_source_binding_hash, v_out_application_record_version;

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
    )
    SELECT
      'kyc.document.redeemed',
      trim(p_actor_admin_id),
      v_out_application_id,
      v_out_document_type,
      trim(p_request_id),
      v_out_grant_id,
      p_grant_reference_hash,
      v_grant.review_reason,
      'viewed',
      NULL,
      p_source_channel;

    UPDATE public.kyc_document_access_redemption_commands AS cmd
       SET status = 'completed',
           terminal_outcome_code = 'redeemed',
           result_grant_id = v_out_grant_id,
           result_application_id = v_out_application_id,
           result_document_type = v_out_document_type,
           result_state = v_out_state,
           result_redeemed_at = v_out_redeemed_at,
           result_source_binding_hash = v_out_source_binding_hash,
           result_application_record_version = v_out_application_record_version,
           completed_at = v_now
     WHERE cmd.id = v_ledger.id;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_sqlstate = RETURNED_SQLSTATE,
        v_diagnostics_message = MESSAGE_TEXT;

      RAISE LOG
        'kyc_document_access_redeem_grant redemption failed: sqlstate=% message=%',
        v_sqlstate,
        v_diagnostics_message;

      UPDATE public.kyc_document_access_redemption_commands AS cmd
         SET status = 'failed',
             terminal_outcome_code = 'audit_unavailable',
                 failure_reason_code = NULL,
             completed_at = v_now
       WHERE cmd.id = v_ledger.id
         AND cmd.status = 'pending';

      v_outcome_code := 'audit_unavailable';
      v_out_grant_id := NULL;
      v_out_application_id := NULL;
      v_out_document_type := NULL;
      v_out_state := NULL;
      v_out_redeemed_at := NULL;
      v_out_source_binding_hash := NULL;
      v_out_application_record_version := NULL;
      outcome_code := v_outcome_code;
      grant_id := v_out_grant_id;
      application_id := v_out_application_id;
      document_type := v_out_document_type;
      state := v_out_state;
      redeemed_at := v_out_redeemed_at;
      source_binding_hash := v_out_source_binding_hash;
      application_record_version := v_out_application_record_version;
      RETURN NEXT;
      RETURN;
  END;

  v_outcome_code := 'redeemed';
  outcome_code := v_outcome_code;
  grant_id := v_out_grant_id;
  application_id := v_out_application_id;
  document_type := v_out_document_type;
  state := v_out_state;
  redeemed_at := v_out_redeemed_at;
  source_binding_hash := v_out_source_binding_hash;
  application_record_version := v_out_application_record_version;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.kyc_document_access_redeem_grant(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.kyc_document_access_redeem_grant(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) FROM PUBLIC;

COMMENT ON FUNCTION public.kyc_document_access_redeem_grant IS
  'KYC Phase D7-B1 — atomic opaque document access grant redemption. '
  'Persists grant state, idempotency ledger snapshots, and append-only audit events only. '
  'Never stores or returns bearer tokens, storage locators, signed URLs, or document bytes. '
  'service_role EXECUTE is granted in create_kyc_document_access_redeem_grant_rpc_grants.sql.';
