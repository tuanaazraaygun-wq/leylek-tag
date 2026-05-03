import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity-feed";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "Leylek Teklifi",
};

const features = [
  {
    title: "Teklifleri netleştir",
    description:
      "Şehir içi ve şehir dışı yolculuk tekliflerini teklif görüşmesiyle netleştir; koşullar yolculuk öncesi anlaşmaya döner.",
  },
  {
    title: "Karşılıklı onay",
    description:
      "Teklif doğrulama ve eşleşme onayı ile iki taraf güvenli eşleşmeye geçmeden önce birbirini onaylar.",
  },
  {
    title: "Kontrollü planlama",
    description:
      "Profil sinyalleri ve teklif akışı, aynı yöne gidenleri güvenli yolculuk planlamasında buluşturur.",
  },
];

export default function MuhabbetPage() {
  return (
    <>
      <PageHero
        eyebrow="leylek teklifi"
        title="Yolculuk tekliflerini güvenli eşleşmeye dönüştür."
        description="Leylek Teklifi, yolcu ve sürücülerin şehir içi veya şehir dışı yolculuk tekliflerini netleştirdiği, karşılıklı onayla eşleştiği güvenli teklif akışıdır."
        primaryLabel="Teklif Akışını Keşfet"
        ctaHint="Ücretsiz • 30 saniyede teklif oluştur"
      />
      <section className="border-t border-white/10 bg-white/[0.02] py-10 sm:py-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-12">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200/85">Nasıl çalışır?</h2>
              <ol className="mt-5 space-y-3 text-sm font-semibold text-slate-200">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-100">
                    1
                  </span>
                  <span>Teklif oluştur</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-100">
                    2
                  </span>
                  <span>Detayları netleştir</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-100">
                    3
                  </span>
                  <span>Karşılıklı onayla eşleş</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-black text-cyan-100">
                    4
                  </span>
                  <span>QR ile yolculuğa başla</span>
                </li>
              </ol>
            </div>
            <ul className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm leading-relaxed text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90" aria-hidden />
                Kişisel bilgiler paylaşılmadan eşleşme
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90" aria-hidden />
                Yolculuk öncesi tüm detaylar netleşir
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90" aria-hidden />
                Kontrollü ve güvenli teklif süreci
              </li>
            </ul>
          </div>
        </Container>
      </section>
      <section className="py-12">
        <Container>
          <p className="mb-8 max-w-2xl text-base leading-relaxed text-slate-300">
            Teklif ver, eşleş, yola çık. Sürücü ve yolcu karşılıklı onayla eşleşir; yolculuk başlamadan önce her şey netleşir.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              {features.map((feature) => (
                <FeatureCard key={feature.title} {...feature} eyebrow="teklif akışı" />
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
