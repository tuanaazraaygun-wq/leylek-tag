/**
 * Branding görselleri `website/public/store/` altında.
 * App Store vitrin PNG'leri: yolcu1–5, surucu1–4, yolcu6.
 */

export const BRANDING_PATHS = {
  /** Navbar mark — PNG ikon (`/store`) */
  logoMark: "/store/leylektag-icon.png",
  logoMarkPngFallback: "/store/leylektag-icon.png",
  /** Hero + footer — önce geniş vitrin grafikleri, sonra kare ikon */
  logoHorizontal: "/store/feature-graphic.png",
  logoHorizontalPngFallback: "/store/leylektag-icon.png",
  favicon: "/store/leylektag-icon.png",
  icon192: "/store/leylektag-icon.png",
  icon512: "/store/leylektag-icon.png",
  appleTouch: "/store/leylektag-icon.png",
  ogImage: "/store/feature-graphic.png",
} as const;

export const LEGACY_FALLBACK_ICON = "/app-icon.png";

/** App Store vitrin sırası — 10 premium ekran. */
export const STORE_ALL_APP_SCREENSHOTS = [
  "/store/yolcu1.png",
  "/store/yolcu2.png",
  "/store/yolcu3.png",
  "/store/yolcu4.png",
  "/store/yolcu5.png",
  "/store/surucu1.png",
  "/store/surucu2.png",
  "/store/surucu3.png",
  "/store/surucu4.png",
  "/store/yolcu6.png",
] as const;

export const STORE_SCREENSHOTS = {
  hero: STORE_ALL_APP_SCREENSHOTS[0],
  /** Carousel / şerit bileşenleri için tam on görsel */
  previews: STORE_ALL_APP_SCREENSHOTS,
  featureWide: "/store/feature-graphic.png",
  sehirIciA: STORE_ALL_APP_SCREENSHOTS[5],
  sehirIciB: STORE_ALL_APP_SCREENSHOTS[7],
  downloadFlow: STORE_ALL_APP_SCREENSHOTS[9],
} as const;
