import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { IntercityLiveMap } from "@/components/intercity-live-map";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Şehirler Arası Yol Paylaşımı",
};

export default function IntercityPage() {
  return (
    <>
      <PageHero
        eyebrow="şehirler arası"
        title="Boş koltuk paylaşımıyla aynı yöne gidenleri buluştur."
        description="Kullanıcılar gidecekleri şehirleri, tarih/saat bilgisini, boş koltuk sayısını ve tahmini masraf paylaşımını net şekilde paylaşabilir."
        primaryLabel="Uygulamada Gör"
      />
      <section className="overflow-x-hidden py-10 sm:py-14 md:py-20">
        <Container className="min-w-0 max-w-full">
          <div className="flex min-w-0 flex-col gap-6 lg:gap-10">
            <SectionHeading
              eyebrow="şehirler arası dashboard"
              title="Türkiye genelinde uzun rota ve boş koltuk paylaşımı görünümü"
              description="Bu panel örnek gösterimle çalışır. Gerçek ilan verisi bağlandığında şehirler arası yolculuk paylaşımı ve masraf paylaşımı akışı aynı mimari üzerinden beslenecek."
            />
            <div className="min-w-0 max-w-full overflow-hidden">
              <IntercityLiveMap />
            </div>
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
