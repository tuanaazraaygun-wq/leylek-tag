import { NextResponse } from "next/server";

import { getSupabaseServiceRoleClient, verifyKycAdminRequest } from "@/lib/kyc-admin-auth";
import {
  KYC_LIST_STATUSES,
  type KycListStatus,
  type KycPendingRow,
  type KycStatusFilter,
} from "@/lib/kyc-admin-types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const KYC_STATUS_SET = new Set<string>(KYC_LIST_STATUSES);

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function warningsList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
}

function vehicleKindsList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

function boolOrNull(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseStatusFilter(raw: string | null): KycStatusFilter {
  const s = (raw || "all").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return "all";
}

function mapKycRow(
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
    kyc_approved_at: strOrNull(dd.kyc_approved_at),
    kyc_rejected_at: strOrNull(dd.kyc_rejected_at),
    kyc_rejection_reason: strOrNull(dd.kyc_rejection_reason),
    is_verified: boolOrNull(dd.is_verified),
    approved_vehicle_kinds: vehicleKindsList(dd.approved_vehicle_kinds),
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

function rowSortTimestamp(row: KycPendingRow): number {
  const candidates = [row.kyc_submitted_at, row.kyc_approved_at, row.kyc_rejected_at];
  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best;
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

  const url = new URL(request.url);
  const statusFilter = parseStatusFilter(url.searchParams.get("status"));

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

  const allRows: KycPendingRow[] = [];
  for (const row of data ?? []) {
    const ddRaw = row.driver_details;
    if (!ddRaw || typeof ddRaw !== "object" || Array.isArray(ddRaw)) continue;
    const dd = ddRaw as Record<string, unknown>;
    const st = strOrNull(dd.kyc_status);
    if (!st || !KYC_STATUS_SET.has(st)) continue;
    allRows.push(mapKycRow(String(row.id), row.name, row.phone, dd));
  }

  const counts: Record<KycListStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    needs_documents: 0,
  };
  for (const r of allRows) {
    const st = r.kyc_status as KycListStatus;
    if (st in counts) counts[st] += 1;
  }

  const requests =
    statusFilter === "all"
      ? allRows
      : allRows.filter((r) => r.kyc_status === statusFilter);

  requests.sort((a, b) => rowSortTimestamp(b) - rowSortTimestamp(a));

  return NextResponse.json(
    {
      success: true,
      status_filter: statusFilter,
      total_count: requests.length,
      pending_count: counts.pending,
      counts,
      requests,
    },
    { headers: NO_STORE },
  );
}
