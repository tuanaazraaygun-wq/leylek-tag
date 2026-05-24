/** Backend server.py _canonical_vehicle_kind / _normalize_kyc_vehicle_kinds_list portu. */

export function canonicalVehicleKind(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  if (s === "car") return "car";
  if (s === "motorcycle" || s === "motor" || s === "moto") return "motorcycle";
  return null;
}

export function normalizeKycVehicleKindsList(raw: unknown): string[] {
  const out: string[] = [];
  let parsed: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      parsed = null;
    }
  }
  const seq = Array.isArray(parsed) ? parsed : Array.isArray(raw) ? raw : null;
  if (!seq) return out;
  for (const x of seq) {
    const c = canonicalVehicleKind(x);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

export function pendingVehicleKindFromDetails(dd: Record<string, unknown>): string | null {
  return (
    canonicalVehicleKind(dd.pending_vehicle_kind) ?? canonicalVehicleKind(dd.kyc_vehicle_kind)
  );
}
