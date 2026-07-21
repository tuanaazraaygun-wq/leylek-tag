"""
KYC document access redeem-and-stream orchestration (Phase D7-B2B).

Redeems first, then downloads object bytes via service-role storage.
Never emits signed/public URLs, storage locators, tokens, or document bytes in logs.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Collection

from services.kyc_document_access_redeem_service import (
    KycDocumentAccessRedeemCommand,
    KycDocumentAccessRedeemResult,
    KycDocumentAccessResolvedObject,
    redeem_kyc_document_access_grant,
)

KYC_DOCUMENT_ACCESS_STREAM_CONTENT_TYPE = "image/jpeg"
KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE = "storage_unavailable"


@dataclass(frozen=True, slots=True)
class KycDocumentAccessStreamResult:
    outcome_code: str
    content: bytes | None = None
    content_type: str | None = None
    redeem_result: KycDocumentAccessRedeemResult | None = None


def download_kyc_document_object_bytes(
    *,
    supabase_client: Any,
    resolved_object: KycDocumentAccessResolvedObject,
) -> bytes:
    """
    Service-role storage download only.

    Must not call create_signed_url or get_public_url.
    """
    raw = supabase_client.storage.from_(resolved_object.bucket).download(
        resolved_object.object_path
    )
    if isinstance(raw, memoryview):
        return raw.tobytes()
    if isinstance(raw, bytearray):
        return bytes(raw)
    if isinstance(raw, bytes):
        return raw
    if isinstance(raw, str):
        # Defensive: never treat a URL-like string as document bytes.
        raise TypeError("unexpected storage download payload type")
    raise TypeError("unexpected storage download payload type")


def stream_kyc_document_access_grant(
    *,
    supabase_client: Any,
    binding_secret_key: bytes,
    command: KycDocumentAccessRedeemCommand,
    allowed_public_hosts: Collection[str] | None = None,
) -> KycDocumentAccessStreamResult:
    redeem_result = redeem_kyc_document_access_grant(
        supabase_client=supabase_client,
        binding_secret_key=binding_secret_key,
        command=command,
        allowed_public_hosts=allowed_public_hosts,
    )

    if redeem_result.outcome_code != "redeemed":
        return KycDocumentAccessStreamResult(
            outcome_code=redeem_result.outcome_code,
            redeem_result=redeem_result,
        )

    resolved = redeem_result.resolved_object
    if resolved is None:
        return KycDocumentAccessStreamResult(
            outcome_code=KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE,
            redeem_result=redeem_result,
        )

    try:
        content = download_kyc_document_object_bytes(
            supabase_client=supabase_client,
            resolved_object=resolved,
        )
    except Exception:
        return KycDocumentAccessStreamResult(
            outcome_code=KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE,
            redeem_result=redeem_result,
        )

    if not content:
        return KycDocumentAccessStreamResult(
            outcome_code=KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE,
            redeem_result=redeem_result,
        )

    content_type = resolved.content_type or KYC_DOCUMENT_ACCESS_STREAM_CONTENT_TYPE
    return KycDocumentAccessStreamResult(
        outcome_code="redeemed",
        content=content,
        content_type=content_type,
        redeem_result=redeem_result,
    )


__all__ = [
    "KYC_DOCUMENT_ACCESS_STORAGE_UNAVAILABLE",
    "KYC_DOCUMENT_ACCESS_STREAM_CONTENT_TYPE",
    "KycDocumentAccessStreamResult",
    "download_kyc_document_object_bytes",
    "stream_kyc_document_access_grant",
]
