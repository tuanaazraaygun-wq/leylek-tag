/** GET /api/admin/kyc/pending — KYC başvuru satırı (read-only panel). */
export type KycStatusFilter = "all" | "pending" | "approved" | "rejected";

export const KYC_LIST_STATUSES = ["pending", "approved", "rejected", "needs_documents"] as const;
export type KycListStatus = (typeof KYC_LIST_STATUSES)[number];

export type KycPendingRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  kyc_status: string;
  kyc_submitted_at: string | null;
  kyc_approved_at: string | null;
  kyc_rejected_at: string | null;
  kyc_rejection_reason: string | null;
  is_verified: boolean | null;
  approved_vehicle_kinds: string[];
  pending_vehicle_kind: string | null;
  kyc_vehicle_kind: string | null;
  plate_number: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_color: string | null;
  license_photo_url: string | null;
  vehicle_photo_url: string | null;
  motorcycle_photo_url: string | null;
  selfie_url: string | null;
  ai_status: string | null;
  ai_warnings: string[];
};

export function isSafeKycImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const t = url.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }
  return lower.startsWith("https://") || lower.startsWith("http://");
}

export function kycVehicleKindLabel(kind: string | null | undefined): string {
  const k = (kind || "car").toLowerCase();
  if (k === "motorcycle" || k === "motor") return "Motosiklet";
  return "Otomobil";
}

export function kycDisplayField(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  return s || "—";
}

export function kycStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Bekleyen";
    case "approved":
      return "Onaylanan";
    case "rejected":
      return "Reddedilen";
    case "needs_documents":
      return "Eksik belge";
    default:
      return status;
  }
}

export function kycStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-400/35 bg-amber-500/[0.1] text-amber-100";
    case "approved":
      return "border-emerald-400/35 bg-emerald-500/[0.1] text-emerald-100";
    case "rejected":
      return "border-rose-400/35 bg-rose-500/[0.1] text-rose-100";
    case "needs_documents":
      return "border-cyan-400/35 bg-cyan-500/[0.1] text-cyan-100";
    default:
      return "border-slate-400/35 bg-slate-500/[0.1] text-slate-200";
  }
}

export function kycEmptyListMessage(filter: KycStatusFilter): string {
  switch (filter) {
    case "pending":
      return "Bekleyen KYC başvurusu yok.";
    case "approved":
      return "Onaylanan KYC başvurusu yok.";
    case "rejected":
      return "Reddedilen KYC başvurusu yok.";
    default:
      return "KYC kaydı yok.";
  }
}

export function kycCountLabel(filter: KycStatusFilter, count: number, loading: boolean): string {
  if (loading) return "Yükleniyor…";
  switch (filter) {
    case "pending":
      return `${count} bekleyen başvuru`;
    case "approved":
      return `${count} onaylanan başvuru`;
    case "rejected":
      return `${count} reddedilen başvuru`;
    default:
      return `${count} KYC kaydı`;
  }
}
