/**
 * UI'da gösterim için yalnızca ad (soyad gizli, profesyonel görünüm).
 */
export function displayFirstName(full: string | null | undefined, fallback = 'Kullanıcı'): string {
  if (full == null || typeof full !== 'string') return fallback;
  const t = full.trim();
  if (!t) return fallback;
  return t.split(/\s+/)[0] || fallback;
}
