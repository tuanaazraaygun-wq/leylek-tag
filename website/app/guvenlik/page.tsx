import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Güvenlik",
};

const safetyItems = [
  {
    title: "QR doğrulama",
    description: "Buluşma ve yolculuk paylaşımı akışında doğrulama hissini güçlendiren net bir kontrol adımı.",
  },
  {
    title: "Güven Al",
    description: "Topluluk sinyallerini ve güven adımlarını görünür hale getirerek karar vermeyi kolaylaştırır.",
  },
  {
    title: "Güvenli iletişim",
    description: "Arama/iletişim adımları, eşleşme sonrası koordinasyonu uygulama deneyiminin içinde tutar.",
  },
  {
    title: "Topluluk ilkeleri",
    description: "Aynı yöne gidenlerin saygılı, şeffaf ve masraf paylaşımı odaklı hareket etmesini destekler.",
  },
];

export default function SafetyPage() {
  return (
    <>
      <PageHero
        eyebrow="güvenlik"
        title="Güvenli eşleşme, doğrulama ve topluluk sinyalleriyle başlar."
        description="Leylek Tag, yolculuk paylaşımını yalnızca rota üzerinden değil, güven katmanları ve iletişim netliği üzerinden de ele alır."
      />
      <section className="py-12">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {safetyItems.map((item) => (
              <FeatureCard key={item.title} {...item} eyebrow="güven" />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
