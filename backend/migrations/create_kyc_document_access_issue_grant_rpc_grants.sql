-- KYC Phase 5B4 — EXECUTE grants for issue-grant RPC (artifact only)
--
-- MANUAL PREFLIGHT:
--   * Apply create_kyc_document_access_issue_grant_rpc.sql first.
--   * Intended production caller: Supabase service_role only.
--   * Do not grant EXECUTE to anon or authenticated.

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
) FROM anon;

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
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.kyc_document_access_issue_grant(
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
) TO service_role;

COMMENT ON FUNCTION public.kyc_document_access_issue_grant IS
  'EXECUTE granted to service_role only. Enterprise/browser roles must not call this RPC directly.';
