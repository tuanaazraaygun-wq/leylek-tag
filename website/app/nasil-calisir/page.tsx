import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Nasıl Çalışır",
};

const steps = [
  {
    title: "1. İhtiyacını seç",
    description: "Şehir içi hızlı eşleşme, Leylek Teklifi veya şehirler arası yol paylaşımı akışından birini seç.",
  },
  {
    title: "2. Rota ve zamanı netleştir",
    description: "Aynı yöne gidenlerle kalkış, varış ve uygun zaman bilgilerini sade biçimde paylaş.",
  },
  {
    title: "3. Netleştir ve doğrula",
    description: "Teklif konuşması, teklif doğrulama, QR doğrulama ve Güven Al adımlarıyla güven katmanını tamamla.",
  },
  {
    title: "4. Yolculuğu paylaş",
    description: "Boş koltuk paylaşımı ve tahmini masraf paylaşımı bilgileriyle planını uygulamada sürdür.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="nasıl çalışır"
        title="Yolculuk paylaşımı birkaç net adımda ilerler."
        description="Leylek Tag deneyimi hızlı eşleşme, teklif konuşmasıyla güvenme ve şehirler arası ilan akışlarını aynı modern çatı altında toplar."
      />
      <section className="py-12">
        <Container>
          <div className="grid gap-5 md:grid-cols-2">
            {steps.map((step) => (
              <FeatureCard key={step.title} {...step} eyebrow="adım" />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
