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
 *
 * Sosyal Medya Studio OAuth dönüşü (allowlist'e ekleyin):
 *   {origin}/support/social
 *
 * Navbar “Google ile giriş” ana sayfa dönüşü (Site URL / root):
 *   http://localhost:3000/
 *   https://leylektag.com/
 */

/** Tek canonical pathname (leading slash ile). Bazı CDN/WAF yapıları /admin altını 404 yapabiliyor. */
export const ADMIN_SUPPORT_ROUTE_PATH = "/support/admin";

/** KYC inceleme paneli (read-only; admin_users ile aynı yetki). */
export const KYC_ADMIN_ROUTE_PATH = "/support/kyc";

/** Admin bildirim merkezi (taslak-only; admin_users ile aynı yetki). */
export const NOTIFICATION_CENTER_ROUTE_PATH = "/support/notifications";

/** Admin operasyon hub — modül navigasyonu (Faz 0; mutation yok). */
export const OPS_HUB_ROUTE_PATH = "/support/ops";

/** Admin sosyal medya studio — statik taslak (paylaşım yok). */
export const SOCIAL_STUDIO_ROUTE_PATH = "/support/social";

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

/** KYC panel OAuth + magic link callback. */
export function getKycAdminMagicLinkRedirectTo(): string {
  const origin = getSiteOriginForRedirect();
  return `${origin.replace(/\/$/, "")}${KYC_ADMIN_ROUTE_PATH}`;
}

/** Bildirim merkezi OAuth + magic link callback. */
export function getNotificationCenterMagicLinkRedirectTo(): string {
  const origin = getSiteOriginForRedirect();
  return `${origin.replace(/\/$/, "")}${NOTIFICATION_CENTER_ROUTE_PATH}`;
}

/** Operasyon hub OAuth + magic link callback. */
export function getOpsHubMagicLinkRedirectTo(): string {
  const origin = getSiteOriginForRedirect();
  return `${origin.replace(/\/$/, "")}${OPS_HUB_ROUTE_PATH}`;
}

/** Sosyal medya studio OAuth + magic link callback. */
export function getSocialStudioMagicLinkRedirectTo(): string {
  const origin = getSiteOriginForRedirect();
  return `${origin.replace(/\/$/, "")}${SOCIAL_STUDIO_ROUTE_PATH}`;
}

/** Vitrin Google OAuth ana sayfa dönüşü (`${origin}/`). */
export function getWebsiteOAuthRedirectToHome(): string {
  const origin = getSiteOriginForRedirect();
  return `${origin.replace(/\/$/, "")}/`;
}
