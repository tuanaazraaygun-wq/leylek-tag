/**
 * Branding görselleri `website/public/store/` altında — dosya yeniden adlandırılmaz.
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

/** `leylektag-yolcu-01 (1).png` — public URL güvenli biçimi */
export const STORE_YOLCU_01_ESCAPED = "/store/leylektag-yolcu-01%20(1).png";

/** Sekiz üretim ekranı — vitrin sırası (kart / carousel hep bu sırayla). */
export const STORE_ALL_APP_SCREENSHOTS = [
  "/store/leylektag-surucu-01.png",
  "/store/leylektag-surucu-02.png",
  "/store/leylektag-surucu-03.png",
  "/store/leylektag-surucu-04.png",
  STORE_YOLCU_01_ESCAPED,
  "/store/leylektag-yolcu-02.png",
  "/store/leylektag-yolcu-03.png",
  "/store/leylektag-yolcu-04.png",
] as const;

export const STORE_SCREENSHOTS = {
  hero: STORE_ALL_APP_SCREENSHOTS[0],
  /** Carousel / şerit bileşenleri için tam sekiz görsel */
  previews: STORE_ALL_APP_SCREENSHOTS,
  featureWide: "/store/feature-graphic.png",
  sehirIciA: STORE_ALL_APP_SCREENSHOTS[5],
  sehirIciB: STORE_ALL_APP_SCREENSHOTS[7],
  downloadFlow: STORE_ALL_APP_SCREENSHOTS[7],
} as const;
