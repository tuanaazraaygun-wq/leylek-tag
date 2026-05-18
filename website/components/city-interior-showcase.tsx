import { Container } from "@/components/container";
import { CityInteriorCarousel } from "@/components/city-interior-carousel";
import { STORE_CITY_INTERIOR_SCREEN_INDEXES, slidesForScreenshotIndexes } from "@/lib/app-screenshot-slides";

export function CityInteriorShowcase() {
  const slides = slidesForScreenshotIndexes(STORE_CITY_INTERIOR_SCREEN_INDEXES);

  return (
    <section className="border-y border-white/[0.06] bg-gradient-to-b from-white/[0.03] via-transparent to-transparent py-10 sm:py-12 md:py-14">
      <Container>
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">şehir içi vitrin</p>
        <h2 className="mt-3 max-w-2xl text-2xl font-black tracking-tight text-white sm:text-3xl md:text-[2.05rem]">
          Şehir içi öncelikli akış: uygun görünür, sonra netleştirilir
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Mobil uygulamada yakın ve aynı yöne uygun seçenekler önce düzenlenebilir; teklif, karşılıklı onay ve QR doğrulama adımları sunucu destekli süreç modeliyle tutarlı ilerler. Aşağıdaki sıra sürücü ile yolcu panellerinden eş zamanlı seçilen üretim ekranlarıdır.
        </p>
        <div className="mt-8 sm:mt-9">
          <CityInteriorCarousel slides={slides} autoplayMs={14_400} />
        </div>
      </Container>
    </section>
  );
}
