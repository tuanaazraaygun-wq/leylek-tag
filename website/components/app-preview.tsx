import { PremiumScreenshotCarousel } from "@/components/premium-screenshot-carousel";
import { DEFAULT_APP_SCREENSHOT_SLIDES } from "@/lib/app-screenshot-slides";

export function AppPreview() {
  return <PremiumScreenshotCarousel slides={DEFAULT_APP_SCREENSHOT_SLIDES} />;
}
