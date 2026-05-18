/**
 * Magic link ve OAuth redirect tabanı.
 * NEXT_PUBLIC_SITE_URL üretim/staging için sabit canonical origin kullanır (Supabase Redirect URL ile birebir eşleşmeli).
 *
 * --- Supabase Authentication → URL Configuration ---
 * Site URL (örnek):
 *   http://localhost:3000
 * Tek canonical redirect (OAuth + e‑posta bağlantısı):
 *   {origin}/support/admin
 *
 * Uyumluluk: tarayıcı eski adresi kullanırsa /admin/support Next tarafından /support/admin’e taşınır.
 * Redirect URLs (allowlist'e hepsini ekleyin):
 *   http://localhost:3000/support/admin
 *   http://127.0.0.1:3000/support/admin
 *   https://leylektag.com/support/admin
 */

/** Tek canonical pathname (leading slash ile). Bazı CDN/WAF yapıları /admin altını 404 yapabiliyor. */
export const ADMIN_SUPPORT_ROUTE_PATH = "/support/admin";

/** Public site origin; NEXT_PUBLIC_SITE_URL doluysa o, değilse tarayıcı (veya SSR fallback localhost). */
export function getSiteOriginForRedirect(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv && fromEnv.length > 0) {
    try {
      return new URL(fromEnv.endsWith("/") ? fromEnv.slice(0, -1) : fromEnv).origin;
    } catch {
      return fromEnv.replace(/\/$/, "");
    }
  }

  if (typeof window !== "undefined") return window.location.origin;

  return "http://localhost:3000";
}

/**
 * Admin OAuth + magic link callback URL’ü (aynı pathname).
 */
export function getAdminSupportMagicLinkRedirectTo(): string {
  const origin = getSiteOriginForRedirect();
  return `${origin.replace(/\/$/, "")}${ADMIN_SUPPORT_ROUTE_PATH}`;
}
