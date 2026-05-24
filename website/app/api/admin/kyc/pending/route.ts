import { NextResponse } from "next/server";

import { getSupabaseServiceRoleClient, verifyKycAdminRequest } from "@/lib/kyc-admin-auth";
import type { KycPendingRow } from "@/lib/kyc-admin-types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function warningsList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
}

function mapPendingRow(
  userId: string,
  name: unknown,
  phone: unknown,
  dd: Record<string, unknown>,
): KycPendingRow {
  return {
    user_id: userId,
    name: strOrNull(name),
    phone: strOrNull(phone),
    kyc_status: strOrNull(dd.kyc_status) ?? "pending",
    kyc_submitted_at: strOrNull(dd.kyc_submitted_at),
    pending_vehicle_kind: strOrNull(dd.pending_vehicle_kind),
    kyc_vehicle_kind: strOrNull(dd.kyc_vehicle_kind),
    plate_number: strOrNull(dd.plate_number),
    vehicle_brand: strOrNull(dd.vehicle_brand),
    vehicle_model: strOrNull(dd.vehicle_model),
    vehicle_year: strOrNull(dd.vehicle_year),
    vehicle_color: strOrNull(dd.vehicle_color),
    license_photo_url: strOrNull(dd.license_photo_url),
    vehicle_photo_url: strOrNull(dd.vehicle_photo_url),
    motorcycle_photo_url: strOrNull(dd.motorcycle_photo_url),
    selfie_url: strOrNull(dd.selfie_url),
    ai_status: strOrNull(dd.ai_status),
    ai_warnings: warningsList(dd.ai_warnings),
  };
}

export async function GET(request: Request) {
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

  const { data, error } = await service
    .from("users")
    .select("id, name, phone, driver_details")
    .not("driver_details", "is", null);

  if (error) {
    console.error("[kyc/pending] users select failed", {
      admin: identity.email,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { success: false, error: "db_error" },
      { status: 500, headers: NO_STORE },
    );
  }

  const requests: KycPendingRow[] = [];
  for (const row of data ?? []) {
    const ddRaw = row.driver_details;
    if (!ddRaw || typeof ddRaw !== "object" || Array.isArray(ddRaw)) continue;
    const dd = ddRaw as Record<string, unknown>;
    if (strOrNull(dd.kyc_status) !== "pending") continue;
    requests.push(mapPendingRow(String(row.id), row.name, row.phone, dd));
  }

  requests.sort((a, b) => {
    const ta = a.kyc_submitted_at ? Date.parse(a.kyc_submitted_at) : 0;
    const tb = b.kyc_submitted_at ? Date.parse(b.kyc_submitted_at) : 0;
    return tb - ta;
  });

  return NextResponse.json(
    {
      success: true,
      pending_count: requests.length,
      requests,
    },
    { headers: NO_STORE },
  );
}
