import { STORE_ALL_APP_SCREENSHOTS } from "@/lib/branding-assets";

/** App Store vitrin metinleri — sıra: yolcu1–5, surucu1–4, yolcu6. */
const THEMES_TR = [
  "Yolcu · sürücüye teklif gönder",
  "Yolcu · güvenli eşleşme ve canlı iletişim",
  "Yolcu · QR ile güvenli biniş",
  "Yolcu · QR ile yolculuk bitirme",
  "Yolcu · Leylek Zeka destek sistemi",
  "Sürücü · rol seçimi",
  "Sürücü · teklif değerlendirme",
  "Sürücü · güven iste ve görüntülü görüşme",
  "Sürücü · harita üzerinde aynı yön eşleşmeleri",
  "Yolcu · Leylek Zeka operasyon desteği",
] as const;

const SLIDE_ALTS = [
  "Leylek TAG yolcu ekranı — sürücüye teklif gönder",
  "Leylek TAG yolcu ekranı — güvenli eşleşme ve canlı iletişim",
  "Leylek TAG yolcu ekranı — QR ile güvenli biniş",
  "Leylek TAG yolcu ekranı — QR ile yolculuk bitirme",
  "Leylek TAG yolcu ekranı — Leylek Zeka destek sistemi",
  "Leylek TAG sürücü ekranı — rol seçimi",
  "Leylek TAG sürücü ekranı — teklif değerlendirme",
  "Leylek TAG sürücü ekranı — güven iste ve görüntülü görüşme",
  "Leylek TAG sürücü ekranı — harita eşleşmeleri",
  "Leylek TAG yolcu ekranı — Leylek Zeka operasyon desteği",
] as const;

export type AppScreenshotSlide = {
  src: string;
  alt: string;
  caption: string;
};

/** Şehir içi vitrin — yolcu teklif + eşleşme, sürücü rol + teklif. */
export const STORE_CITY_INTERIOR_SCREEN_INDEXES = [0, 1, 4, 5] as const;

export const DEFAULT_APP_SCREENSHOT_SLIDES: readonly AppScreenshotSlide[] = STORE_ALL_APP_SCREENSHOTS.map(
  (src, index) => ({
    src,
    alt: SLIDE_ALTS[index] ?? `Leylek TAG uygulama ekranı ${index + 1}`,
    caption: THEMES_TR[index] ?? `Leylek TAG ekran ${index + 1}`,
  }),
);

export function slidesForScreenshotIndexes(indexes: readonly number[]): AppScreenshotSlide[] {
  return indexes.map((i) => {
    const slide = DEFAULT_APP_SCREENSHOT_SLIDES[i];
    return slide ?? DEFAULT_APP_SCREENSHOT_SLIDES[0];
  });
}
