/** GET /api/admin/kyc/pending — bekleyen başvuru satırı (read-only panel). */
export type KycPendingRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  kyc_status: string;
  kyc_submitted_at: string | null;
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
