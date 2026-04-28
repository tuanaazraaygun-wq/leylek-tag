import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity-feed";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Leylek Muhabbet",
};

const features = [
  {
    title: "Önce konuş",
    description: "Yolculuk paylaşmadan önce chat tabanlı tanışma alanı ile beklentiler netleşir.",
  },
  {
    title: "Leylek Anahtar",
    description: "Sosyal güven katmanı, eşleşme öncesinde iki taraf için daha kontrollü bir kapı açar.",
  },
  {
    title: "Topluluk hissi",
    description: "Profil sinyalleri ve konuşma akışı, aynı yöne gidenleri daha insani bir deneyimde buluşturur.",
  },
];

export default function MuhabbetPage() {
  return (
    <>
      <PageHero
        eyebrow="leylek muhabbet"
        title="Önce konuş, sonra güvenerek yolculuk paylaş."
        description="Leylek Muhabbet, chat tabanlı eşleşme ve Leylek Anahtar yaklaşımıyla yolculuk paylaşımına sosyal bir güven katmanı ekler."
        primaryLabel="Leylek Muhabbeti Keşfet"
      />
      <section className="py-12">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} eyebrow="muhabbet" />
              ))}
            </div>
            <ActivityFeed />
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
