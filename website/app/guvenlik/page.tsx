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
    title: "Teklif görüşmesi ve koordinasyon",
    description: "Teklif netleştirme ve eşleşme sonrası koordinasyon uygulama deneyiminin içinde tutulur.",
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
        description="Leylek Tag, yolculuk paylaşımını yalnızca rota üzerinden değil, güven katmanları ve teklif netliği üzerinden de ele alır."
      />
      <section className="border-t border-white/10 py-10">
        <Container>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Karşılıklı onayla eşleşme",
              "Yolculuk öncesi detayları netleştirme",
              "QR ile biniş ve varış kontrolü",
              "Şikayet ve güvenlik akışı",
              "Kişisel bilgileri gereksiz paylaşmadan teklif süreci",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/90" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </section>
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
