import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

const PAGE_TITLE = "Nasıl Çalışır | Leylek TAG";
const PAGE_DESCRIPTION =
  "Rotanı oluştur, teklifleri değerlendir, karşılıklı onayla eşleş. Teklif, doğrulama ve takip adımları Leylek TAG mobil uygulamasında tamamlanır.";

export const metadata: Metadata = {
  title: "Nasıl Çalışır",
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

const steps = [
  {
    eyebrow: "Adım 1",
    title: "Rotanı oluştur",
    description:
      "Yolcu veya sürücü olarak gideceğin rotayı uygulamada paylaş. Yolculuk paylaşımı teklifini aç; platform ticari taşımacılık hizmeti sunmaz.",
  },
  {
    eyebrow: "Adım 2",
    title: "Teklifleri değerlendir",
    description:
      "Uygun tekliflerle rota, zaman ve masraf paylaşımını teklif görüşmesinde karşılıklı netleştir.",
  },
  {
    eyebrow: "Adım 3",
    title: "Karşılıklı onayla",
    description:
      "İki taraf onayladığında kontrollü eşleşme tamamlanır. Gelir veya taşımacılık taahhüdü verilmez; topluluk odaklı akış ilerler.",
  },
  {
    eyebrow: "Adım 4",
    title: "Uygulama içinde takip et",
    description:
      "QR doğrulama ve yolculuk adımları mobil uygulamada yürütülür. Web görünümü bilgilendiricidir; tam süreç uygulamada tamamlanır.",
  },
] as const;

const POPULAR_CITY_LINKS = [
  { href: "/sehir/ankara", label: "Ankara" },
  { href: "/sehir/istanbul", label: "İstanbul" },
  { href: "/sehir/izmir", label: "İzmir" },
  { href: "/sehir/bursa", label: "Bursa" },
  { href: "/sehir/antalya", label: "Antalya" },
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="nasıl çalışır"
        title="Dört adımda yolculuk paylaşımı"
        description="Rotanı oluştur, teklifleri değerlendir, karşılıklı onayla eşleş; doğrulama ve takip adımlarını mobil uygulamada tamamla."
        primaryHref="/indir"
        primaryLabel="Uygulamayı indir"
        secondaryHref="/guvenlik"
        secondaryLabel="Güvenlik"
        ctaHint="Teklif, eşleşme ve doğrulama adımları mobil uygulamada tamamlanır."
      />

      <section className="border-b border-white/[0.06] py-8 sm:py-10">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">uyum</p>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
              <p>
                Leylek TAG, yolculuk paylaşımı ve masraf paylaşımı için topluluk odaklı bir platformdur; ticari
                taşımacılık hizmeti sunmaz.
              </p>
              <p>Uygulama içi işlemler mobil uygulamada tamamlanır.</p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          <div className="grid gap-5 md:grid-cols-2">
            {steps.map((step) => (
              <FeatureCard key={step.title} title={step.title} description={step.description} eyebrow={step.eyebrow} />
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-cyan-400/[0.14] p-8 ring-1 ring-cyan-400/[0.08] sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/82">sonraki adım</p>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Yolculuk paylaşımını uygulamada dene
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Şehrinde aynı yöne giden yolcu ve sürücüler için teklif, onay ve doğrulama akışı mobil uygulamada ilerler.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
            </div>
            <nav className="mt-8" aria-label="Popüler şehir landing sayfaları">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Şehirlerde keşfet</p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {POPULAR_CITY_LINKS.map((city) => (
                  <li key={city.href}>
                    <Link
                      href={city.href}
                      className="inline-flex min-h-[36px] items-center rounded-full border border-cyan-400/22 bg-cyan-400/[0.07] px-3 py-1.5 text-[12px] font-semibold text-cyan-100/90 transition hover:border-cyan-400/35 hover:text-cyan-50"
                    >
                      {city.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </Container>
      </section>
    </>
  );
}
