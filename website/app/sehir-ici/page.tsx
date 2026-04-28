import type { Metadata } from "next";
import { CityLiveMap } from "@/components/city-live-map";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Hızlı Yolculuk",
};

const steps = [
  {
    title: "Şehir içi hızlı eşleşme",
    description: "Yakındaki aynı yöne gidenler rota uyumuna göre görünür ve akış hızlıca başlar.",
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
        eyebrow="hızlı yolculuk"
        title="Şehir içinde aynı yöne gidenlerle hızlı ve güvenli eşleşme."
        description="Leylek Tag, rota odaklı eşleşme, QR doğrulama ve Güven Al katmanıyla şehir içi yolculuk paylaşımını sadeleştirir."
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
