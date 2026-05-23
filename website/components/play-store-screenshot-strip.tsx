import { Container } from "@/components/container";
import { PremiumScreenshotCarousel } from "@/components/premium-screenshot-carousel";
import { DEFAULT_APP_SCREENSHOT_SLIDES } from "@/lib/app-screenshot-slides";

export function PlayStoreScreenshotStrip() {
  return (
    <section
      id="play-vitrin"
      className="scroll-mt-24 border-y border-white/[0.06] bg-[#060d18]/72 py-12 sm:py-16 md:scroll-mt-28"
    >
      <Container>
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">App Store vitrin</p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
          App Store ile birebir — premium ürün ekranları
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-400">
          Yolcu ve sürücü akışları: teklif, güvenli eşleşme, QR doğrulama, görüntülü görüşme ve Leylek Zeka desteği. Görseller mağaza vitriniyle aynı sıra ve kadrajda sunulur.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-center text-xs font-semibold leading-relaxed text-cyan-200/85">
          iOS App Store inceleme süreciyle uyumlu vitrin — güncel sürüm ekranları.
        </p>
        <div className="mt-12">
          <PremiumScreenshotCarousel slides={DEFAULT_APP_SCREENSHOT_SLIDES} />
        </div>
      </Container>
    </section>
  );
}
