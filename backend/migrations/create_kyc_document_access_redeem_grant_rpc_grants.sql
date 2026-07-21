-- KYC Phase D7-B1 — EXECUTE grants for redeem-grant RPC (artifact only)
--
-- MANUAL PREFLIGHT:
--   * Apply create_kyc_document_access_redeem_grant_rpc.sql first.
--   * Intended production caller: Supabase service_role only.
--   * Do not grant EXECUTE to anon or authenticated.

REVOKE ALL ON FUNCTION public.kyc_document_access_redeem_grant(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.kyc_document_access_redeem_grant(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) FROM anon;

REVOKE ALL ON FUNCTION public.kyc_document_access_redeem_grant(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.kyc_document_access_redeem_grant(
  text,
  text,
  text,
  text,
  text,
  timestamptz
) TO service_role;

COMMENT ON FUNCTION public.kyc_document_access_redeem_grant IS
  'EXECUTE granted to service_role only. Enterprise/browser roles must not call this RPC directly.';
