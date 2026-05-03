/** UI-only label for route status strings from API (does not change request/response). */

export function displayRouteStatus(raw: string | undefined): string {
  if (!raw?.trim()) return "—";
  const s = raw.trim().toLowerCase();
  if (s === "yakında" || s === "yakinda") return "Süreçte";
  return raw.trim();
}
