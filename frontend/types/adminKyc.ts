/**
 * GET /admin/kyc/pending — `requests[]` öğesi (flat; driver_details yok).
 */
export type PendingKycRequest = {
  user_id: string;
  name?: string | null;
  phone?: string | null;
  plate_number?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | number | null;
  vehicle_color?: string | null;
  vehicle_kind?: string | null;
  vehicle_photo_url?: string | null;
  motorcycle_photo_url?: string | null;
  license_photo_url?: string | null;
  selfie_url?: string | null;
  submitted_at?: string | null;
  ai_status?: string | null;
  ai_warnings?: string[] | null;
};

/** Thumbnail için güvenli http(s) URL; javascript:/data: vb. reddedilir. */
export function isSafeKycImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const t = url.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  return lower.startsWith('https://') || lower.startsWith('http://');
}

export function kycVehicleKindLabel(kind: string | null | undefined): string {
  const k = (kind || 'car').toLowerCase();
  if (k === 'motorcycle' || k === 'motor') return 'Motosiklet';
  return 'Otomobil';
}
