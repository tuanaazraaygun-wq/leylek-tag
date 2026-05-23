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

/** Yatay iPad App Store vitrin — yalnızca güven mimarisi showcase bölümü. */
export const IPAD_SHOWCASE_SCREENSHOTS = [
  "/store/ipad-showcase/yolcu.ipad1.png",
  "/store/ipad-showcase/yolcu.ipad2.png",
  "/store/ipad-showcase/yolcu.ipad3.png",
  "/store/ipad-showcase/yolcu.ipad4.png",
  "/store/ipad-showcase/yolcu.ipad5.png",
  "/store/ipad-showcase/surucu.ipad1.png",
  "/store/ipad-showcase/surucu.ipad2.png",
  "/store/ipad-showcase/surucu.ipad3.png",
  "/store/ipad-showcase/surucu.ipad4.png",
  "/store/ipad-showcase/surucu.ipad5.png",
] as const;

/** iPad yatay export boyutu (2752×2064). */
export const IPAD_SHOWCASE_IMAGE_WIDTH = 2752;
export const IPAD_SHOWCASE_IMAGE_HEIGHT = 2064;
