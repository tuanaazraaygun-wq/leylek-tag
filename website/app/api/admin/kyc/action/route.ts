import { NextResponse } from "next/server";

import { getSupabaseServiceRoleClient, verifyKycAdminRequest } from "@/lib/kyc-admin-auth";
import { executeKycAction, parseKycActionBody } from "@/lib/kyc-admin-mutations";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ERROR_MESSAGES: Record<string, string> = {
  invalid_body: "Geçersiz istek gövdesi.",
  bulk_not_allowed: "Toplu işlem desteklenmiyor.",
  invalid_action: "Geçersiz işlem.",
  invalid_user_id: "Geçersiz kullanıcı kimliği.",
  user_message_required: "Kullanıcı mesajı zorunlu.",
  user_not_found: "Kullanıcı bulunamadı.",
  not_pending: "Bu başvuru beklemede değil.",
  status_conflict: "Başvuru durumu değişmiş; listeyi yenileyin.",
  vehicle_kind_missing: "Başvuruda araç tipi bulunamadı.",
  db_error: "Veritabanı hatası.",
};

export async function POST(request: Request) {
  const identity = await verifyKycAdminRequest(request);
  if (identity instanceof NextResponse) {
    return identity;
  }

  const service = getSupabaseServiceRoleClient();
  if (!service) {
    return NextResponse.json(
      { success: false, error: "server_misconfigured" },
      { status: 503, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: ERROR_MESSAGES.invalid_body },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = parseKycActionBody(body);
  if ("error" in parsed) {
    const msg = ERROR_MESSAGES[parsed.error] ?? "Geçersiz istek.";
    return NextResponse.json(
      { success: false, error: parsed.error, message: msg },
      { status: 400, headers: NO_STORE },
    );
  }

  const result = await executeKycAction(service, identity, parsed);
  if (!result.ok) {
    const msg = ERROR_MESSAGES[result.error] ?? "İşlem başarısız.";
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        message: msg,
        detail: result.detail,
      },
      { status: result.status, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    {
      success: true,
      user_id: result.user_id,
      action: result.action,
      kyc_status: result.kyc_status,
    },
    { headers: NO_STORE },
  );
}
