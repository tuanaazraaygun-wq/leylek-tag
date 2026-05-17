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
        title="Şehirler arası akış geliştirme sürecinde"
        description="Şehirler arası yolculuk akışı geliştirme sürecindedir. Planlı uzun yol eşleşmeleri yakında aktif edilecektir. Şu anda şehir içi yolculuk eşleşmesi önceliklidir."
        primaryLabel="Uygulamada Gör"
      />
      <section className="overflow-x-hidden py-10 sm:py-14 md:py-20">
        <Container className="min-w-0 max-w-full">
          <div className="flex min-w-0 flex-col gap-6 lg:gap-10">
            <SectionHeading
              eyebrow="şehirler arası özet"
              title="Şehir dışı teklif görünümü (bilgilendirici)"
              description="Bu alan şehirler arası akış hazırlanırken özet bilgi sunar; bağlantı kurulduğunda özet yenilenebilir. Şu anda şehir içi yolculuk eşleşmesi önceliklidir."
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
