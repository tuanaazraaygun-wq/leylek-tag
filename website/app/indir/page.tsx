import type { Metadata } from "next";
import { Container } from "@/components/container";
import { DownloadAppFlowPreview } from "@/components/download-app-flow-preview";
import { DownloadStoreTrust } from "@/components/download-store-trust";
import { DownloadWebAppCompare } from "@/components/download-web-app-compare";
import { PlayStoreScreenshotStrip } from "@/components/play-store-screenshot-strip";
import { StoreDownloadCard } from "@/components/store-download-card";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/store-links";

export const metadata: Metadata = {
  title: "İndir",
  description:
    "Leylek TAG mobil uygulamasını resmi mağazalardan indirin. Teklif, eşleşme ve doğrulama adımları uygulamada tamamlanır; kullanılabilirlik bölgeye göre değişebilir.",
  alternates: {
    canonical: "/indir",
  },
  openGraph: {
    title: "Leylek TAG'i İndir | Yolculuk Paylaşımı",
    description:
      "Leylek TAG mobil uygulamasını resmi mağazalardan indirin. Teklif, eşleşme ve doğrulama adımları uygulamada tamamlanır; kullanılabilirlik bölgeye göre değişebilir.",
    url: "/indir",
  },
};

export default function DownloadPage() {
  return (
    <>
      <section id="indir-magaza" className="relative scroll-mt-28 overflow-hidden py-12 sm:py-16 md:py-[4.5rem]">
        <div className="absolute inset-x-0 top-0 -z-10 h-[min(520px,70vh)] bg-radial-glow opacity-90" aria-hidden />
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">resmi mağazalar</p>
            <h1 className="mt-4 text-[1.85rem] font-black leading-[1.06] tracking-[-0.03em] text-white sm:text-[2.35rem] md:text-[2.65rem]">
              Leylek TAG&apos;i İndirin
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-base">
              Leylek TAG&apos;i resmi App Store ve Google Play mağazalarından güvenle indirebilirsiniz.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">
              Teklif, eşleşme ve doğrulama adımları mobil uygulamada tamamlanır.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-2">
            <StoreDownloadCard
              href={APP_STORE_URL}
              storeName="App Store"
              deviceLine="iPhone ve iPad için indir"
              ctaLabel="App Store'dan İndir"
              variant="apple"
              trackPlacement="download_page"
            />
            <StoreDownloadCard
              href={GOOGLE_PLAY_URL}
              storeName="Google Play"
              deviceLine="Android cihazlar için indir"
              ctaLabel="Google Play'den İndir"
              variant="google"
              trackPlacement="download_page"
            />
          </div>
        </Container>
      </section>

      <DownloadStoreTrust />

      <PlayStoreScreenshotStrip />

      <DownloadWebAppCompare />

      <DownloadAppFlowPreview />
    </>
  );
}
