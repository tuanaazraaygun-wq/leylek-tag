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
    eyebrow: "Adım 1",
    title: "Teklif oluştur",
    description: "Yolcu veya sürücü olarak şehir içi ya da dışı teklifini aç.",
  },
  {
    eyebrow: "Adım 2",
    title: "Detayları netleştir",
    description: "Rota, zaman ve koşulları teklif görüşmesinde netleştir.",
  },
  {
    eyebrow: "Adım 3",
    title: "Karşılıklı onayla eşleş",
    description: "İki taraf onaylayınca güvenli eşleşme tamamlanır.",
  },
  {
    eyebrow: "Adım 4",
    title: "Yolculuğa başla",
    description: "QR ile doğrula; kontrollü şekilde yola çık.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="nasıl çalışır"
        title="Dört adımda tekliften yolculuğa."
        description="Teklifini aç, detayları netleştir, karşılıklı onayla eşleş; QR ile güvenli şekilde yola çık."
      />
      <section className="py-12">
        <Container>
          <div className="grid gap-5 md:grid-cols-2">
            {steps.map((step) => (
              <FeatureCard key={step.title} title={step.title} description={step.description} eyebrow={step.eyebrow} />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
