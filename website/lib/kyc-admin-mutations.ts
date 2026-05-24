import type { SupabaseClient } from "@supabase/supabase-js";

import type { KycAdminIdentity } from "@/lib/kyc-admin-auth";
import {
  canonicalVehicleKind,
  normalizeKycVehicleKindsList,
  pendingVehicleKindFromDetails,
} from "@/lib/kyc-vehicle-kind";

export type KycReviewAction = "approve" | "reject" | "request_docs";

export type KycActionInput = {
  action: KycReviewAction;
  user_id: string;
  user_message?: string | null;
  admin_note?: string | null;
  expected_kyc_status?: string | null;
};

export type KycActionResult =
  | { ok: true; user_id: string; action: KycReviewAction; kyc_status: string }
  | { ok: false; status: number; error: string; detail?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_USER_MESSAGE = 2000;
const MAX_ADMIN_NOTE = 2000;

function nowIsoUtc(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function driverDetailsAsDict(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function trimField(v: unknown, maxLen: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function applyLastReviewFields(
  dd: Record<string, unknown>,
  identity: KycAdminIdentity,
  action: KycReviewAction,
  userMessage: string | null,
  adminNote: string | null,
): void {
  dd.kyc_last_reviewed_by = identity.email;
  dd.kyc_last_reviewed_at = nowIsoUtc();
  dd.kyc_last_review_action = action;
  dd.kyc_admin_note = adminNote;
  dd.kyc_user_message = userMessage;
}

function kindsToAddOnApprove(dd: Record<string, unknown>): string[] {
  const kinds: string[] = [];
  for (const key of ["pending_vehicle_kind", "kyc_vehicle_kind"] as const) {
    const c = canonicalVehicleKind(dd[key]);
    if (c && !kinds.includes(c)) kinds.push(c);
  }
  return kinds;
}

function applyRejectLikeUpdate(
  dd: Record<string, unknown>,
  rejectionReason: string,
): { kyc_status: string } {
  const approvedRemain = normalizeKycVehicleKindsList(dd.approved_vehicle_kinds);
  dd.pending_vehicle_kind = undefined;
  delete dd.pending_vehicle_kind;
  dd.kyc_rejection_reason = rejectionReason;
  dd.kyc_rejected_at = nowIsoUtc();

  if (approvedRemain.length > 0) {
    dd.kyc_status = "approved";
    dd.is_verified = true;
    dd.approved_vehicle_kinds = approvedRemain;
    return { kyc_status: "approved" };
  }

  dd.kyc_status = "rejected";
  dd.is_verified = false;
  return { kyc_status: "rejected" };
}

export function parseKycActionBody(body: unknown): KycActionInput | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.user_id)) {
    return { error: "bulk_not_allowed" };
  }
  const action = typeof b.action === "string" ? b.action.trim() : "";
  if (action !== "approve" && action !== "reject" && action !== "request_docs") {
    return { error: "invalid_action" };
  }
  const user_id = typeof b.user_id === "string" ? b.user_id.trim() : "";
  if (!user_id || !UUID_RE.test(user_id)) {
    return { error: "invalid_user_id" };
  }
  return {
    action,
    user_id,
    user_message: typeof b.user_message === "string" ? b.user_message : null,
    admin_note: typeof b.admin_note === "string" ? b.admin_note : null,
    expected_kyc_status:
      typeof b.expected_kyc_status === "string" ? b.expected_kyc_status.trim() : null,
  };
}

export async function executeKycAction(
  service: SupabaseClient,
  identity: KycAdminIdentity,
  input: KycActionInput,
): Promise<KycActionResult> {
  const userMessage = trimField(input.user_message, MAX_USER_MESSAGE);
  const adminNote = trimField(input.admin_note, MAX_ADMIN_NOTE);

  if (input.action === "reject" || input.action === "request_docs") {
    if (!userMessage) {
      return { ok: false, status: 400, error: "user_message_required" };
    }
  }

  const { data: row, error: readErr } = await service
    .from("users")
    .select("id, driver_details")
    .eq("id", input.user_id)
    .maybeSingle();

  if (readErr) {
    console.error("[kyc/action] user read failed", {
      admin: identity.email,
      user_id: input.user_id,
      message: readErr.message,
    });
    return { ok: false, status: 500, error: "db_error" };
  }
  if (!row) {
    return { ok: false, status: 404, error: "user_not_found" };
  }

  const dd = driverDetailsAsDict(row.driver_details);
  const currentStatus = String(dd.kyc_status ?? "").trim() || "none";

  if (input.expected_kyc_status && input.expected_kyc_status !== currentStatus) {
    return {
      ok: false,
      status: 409,
      error: "status_conflict",
      detail: `expected ${input.expected_kyc_status}, got ${currentStatus}`,
    };
  }
  if (currentStatus !== "pending") {
    return {
      ok: false,
      status: 409,
      error: "not_pending",
      detail: `current status is ${currentStatus}`,
    };
  }

  const now = nowIsoUtc();
  let resultStatus = "approved";

  if (input.action === "approve") {
    const kindsToAdd = kindsToAddOnApprove(dd);
    const primary = pendingVehicleKindFromDetails(dd);
    if (kindsToAdd.length === 0 && !primary) {
      return { ok: false, status: 400, error: "vehicle_kind_missing" };
    }
    const mergedKinds = normalizeKycVehicleKindsList(dd.approved_vehicle_kinds);
    for (const k of kindsToAdd.length > 0 ? kindsToAdd : primary ? [primary] : []) {
      if (!mergedKinds.includes(k)) mergedKinds.push(k);
    }
    dd.approved_vehicle_kinds = normalizeKycVehicleKindsList(mergedKinds);
    delete dd.pending_vehicle_kind;
    dd.kyc_status = "approved";
    dd.is_verified = true;
    dd.kyc_approved_at = now;
    resultStatus = "approved";
    applyLastReviewFields(dd, identity, "approve", userMessage, adminNote);

    const { error: updErr } = await service
      .from("users")
      .update({
        driver_details: dd,
        driver_active_until: addDaysIso(60),
        updated_at: now,
      })
      .eq("id", input.user_id);

    if (updErr) {
      console.error("[kyc/action] approve update failed", {
        admin: identity.email,
        user_id: input.user_id,
        message: updErr.message,
      });
      return { ok: false, status: 500, error: "db_error" };
    }

    return { ok: true, user_id: input.user_id, action: "approve", kyc_status: resultStatus };
  }

  const rejectionReason =
    input.action === "request_docs"
      ? `Eksik belge: ${userMessage!}`
      : userMessage!;

  const rejectResult = applyRejectLikeUpdate(dd, rejectionReason);
  resultStatus = rejectResult.kyc_status;
  applyLastReviewFields(
    dd,
    identity,
    input.action === "request_docs" ? "request_docs" : "reject",
    userMessage,
    adminNote,
  );

  const { error: updErr } = await service
    .from("users")
    .update({
      driver_details: dd,
      updated_at: now,
    })
    .eq("id", input.user_id);

  if (updErr) {
    console.error("[kyc/action] reject update failed", {
      admin: identity.email,
      user_id: input.user_id,
      message: updErr.message,
    });
    return { ok: false, status: 500, error: "db_error" };
  }

  return {
    ok: true,
    user_id: input.user_id,
    action: input.action,
    kyc_status: resultStatus,
  };
}
