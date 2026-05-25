import type { Metadata } from "next";
import { CityInteriorShowcase } from "@/components/city-interior-showcase";
import { CityLiveMap } from "@/components/city-live-map";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Şehir İçi",
  description:
    "Şehir içi yolculuk paylaşımı ve masraf paylaşımı. Rota odaklı eşleşme, karşılıklı onay ve QR doğrulama Leylek TAG mobil uygulamasında.",
  alternates: {
    canonical: "/sehir-ici",
  },
  openGraph: {
    title: "Şehir İçi Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Şehir içi yolculuk paylaşımı ve masraf paylaşımı. Rota odaklı eşleşme, karşılıklı onay ve QR doğrulama Leylek TAG mobil uygulamasında.",
    url: "/sehir-ici",
  },
};

const steps = [
  {
    title: "Şehir içi kontrollü eşleşme",
    description: "Yakındaki aynı yöne gidenler rota uyumuna göre görünür; süreç karşılıklı onayla ilerler.",
  },
  {
    title: "Rota ve QR doğrulama",
    description: "Paylaşılan rota bilgisi ve QR doğrulama, buluşma anını daha net hale getirir.",
  },
  {
    title: "Güven Al ve iletişim",
    description: "Topluluk sinyalleri, Güven Al adımı ve arama/iletişim seçenekleri birlikte çalışır.",
  },
];

export default function CityPage() {
  return (
    <>
      <PageHero
        eyebrow="şehir içi"
        title="Şehir içinde aynı yöne gidenlerle güvenli ve kontrollü eşleşme."
        description="Leylek TAG, rota odaklı eşleşme, QR doğrulama ve Güven Al katmanıyla şehir içi yolculuk paylaşımını sadeleştirir."
      />
      <section className="py-12">
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <FeatureCard key={step.title} {...step} eyebrow="akış" />
            ))}
          </div>
        </Container>
      </section>
      <CityInteriorShowcase />
      <section className="py-12">
        <Container>
          <div className="mx-auto max-w-[1600px]">
            <CityLiveMap />
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
