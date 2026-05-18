import { STORE_ALL_APP_SCREENSHOTS } from "@/lib/branding-assets";

const THEMES_TR = [
  "Sürücü · panel ve teklife hazırlık",
  "Sürücü · teklif oluşturma ve rota",
  "Teklif süreci · karşılıklı görüşün",
  "Doğrulama · QR ile kontrollü adım",
  "Yolcu · uygun görünürlük ve teklifler",
  "Şehir içi akış · eşleşme ve rota",
  "Karşılıklı onay · net süreç",
  "Tamamlanış · özeti ve kapanış adımları",
] as const;

export type AppScreenshotSlide = {
  src: string;
  alt: string;
  caption: string;
};

/** Şehir içi vitrine özgü sıra — sürücü ile yolcu akışından örnek kareler. */
export const STORE_CITY_INTERIOR_SCREEN_INDEXES = [0, 1, 4, 5] as const;

export const DEFAULT_APP_SCREENSHOT_SLIDES: readonly AppScreenshotSlide[] = STORE_ALL_APP_SCREENSHOTS.map(
  (src, index) => ({
    src,
    alt: `Leylek TAG uygulama ekranı ${index + 1}`,
    caption: THEMES_TR[index],
  }),
);

export function slidesForScreenshotIndexes(indexes: readonly number[]): AppScreenshotSlide[] {
  return indexes.map((i) => {
    const slide = DEFAULT_APP_SCREENSHOT_SLIDES[i];
    return slide ?? DEFAULT_APP_SCREENSHOT_SLIDES[0];
  });
}
