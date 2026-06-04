"use client";

import { StoreDownloadCard } from "@/components/store-download-card";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/store-links";

export function HomeHeroStoreStrip() {
  return (
    <div className="mx-auto mt-5 w-full max-w-xl md:mx-0 lg:max-w-none">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:text-left">
        App Store ve Google Play
      </p>
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        <StoreDownloadCard
          href={APP_STORE_URL}
          storeName="App Store"
          deviceLine="iPhone ve iPad"
          ctaLabel="App Store"
          variant="apple"
          size="compact"
          trackPlacement="home_hero_store"
        />
        <StoreDownloadCard
          href={GOOGLE_PLAY_URL}
          storeName="Google Play"
          deviceLine="Android"
          ctaLabel="Google Play"
          variant="google"
          size="compact"
          trackPlacement="home_hero_store"
        />
      </div>
    </div>
  );
}
