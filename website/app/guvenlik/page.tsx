import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";

const PAGE_TITLE = "Güvenlik | Leylek TAG";
const PAGE_DESCRIPTION =
  "Doğrulama, karşılıklı onay, QR kontrolü, destek kanalı ve KVKK odaklı kullanıcı kontrolü. Leylek TAG yolculuk paylaşımı için topluluk odaklı bir platformdur.";

export const metadata: Metadata = {
  title: "Güvenlik",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/guvenlik",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/guvenlik",
  },
};

const trustStoryline = [
  {
    eyebrow: "doğrulama",
    title: "Doğrulama",
    description:
      "Kimlik ve profil adımlarıyla temel doğrulama katmanı sunulur. Karar vermeden önce profil ve teklif bilgilerini uygulama içinde inceleyebilirsin.",
  },
  {
    eyebrow: "eşleşme",
    title: "Karşılıklı onay",
    description:
      "Eşleşme, iki tarafın onayıyla ilerler. Tek taraflı eşleşme yoktur; yolculuk paylaşımı karşılıklı mutabakatla netleşir.",
  },
  {
    eyebrow: "kontrol",
    title: "QR ve uygulama içi kontrol",
    description:
      "Yolculuk başlangıcı ve doğrulama adımları QR ile uygulama içinde yürütülür. Web sitesi bilgilendirme amaçlıdır.",
  },
  {
    eyebrow: "destek",
    title: "Destek kanalı",
    description:
      "Süreç veya hesap sorularında destek kanallarına ulaşabilirsin. Leylek Zeka bilgilendirme sağlar; yanıtlar müsaitlik durumuna göre destek ekibinden gelir.",
  },
  {
    eyebrow: "uyum",
    title: "KVKK ve kullanıcı kontrolü",
    description:
      "Kişisel veriler, gizlilik ve hesap silme süreçleri KVKK ve ilgili sayfalarda açıklanır. Uygunluk ve kurallara uyum kullanıcı sorumluluğundadır.",
  },
] as const;

const POPULAR_CITY_LINKS = [
  { href: "/sehir/ankara", label: "Ankara" },
  { href: "/sehir/istanbul", label: "İstanbul" },
  { href: "/sehir/izmir", label: "İzmir" },
  { href: "/sehir/bursa", label: "Bursa" },
  { href: "/sehir/antalya", label: "Antalya" },
] as const;

export default function SafetyPage() {
  return (
    <>
      <PageHero
        eyebrow="güvenlik"
        title="Güven katmanlarıyla kontrollü yolculuk paylaşımı"
        description="Doğrulama, karşılıklı onay, uygulama içi kontrol ve topluluk odaklı süreçlerle yolculuk paylaşımını netleştirir."
        primaryHref="/indir"
        primaryLabel="Uygulamayı indir"
        secondaryHref="/nasil-calisir"
        secondaryLabel="Nasıl çalışır?"
        ctaHint="Güvenlik adımları ve teklif süreçleri mobil uygulamada tamamlanır."
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
              <p className="text-slate-400">
                Platform güvenli süreçleri destekler; kesin sonuç veya hukuki garanti iddiası sunulmaz.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trustStoryline.map((item) => (
              <FeatureCard key={item.title} title={item.title} description={item.description} eyebrow={item.eyebrow} />
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-cyan-400/[0.14] p-8 ring-1 ring-cyan-400/[0.08] sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/82">sonraki adım</p>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Güvenli akışı uygulamada dene
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Teklif, onay ve doğrulama adımlarını mobil uygulamada tamamla; şehir sayfalarından bölgesel yolculuk
              paylaşımına göz at.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
              <ButtonLink href="/support" variant="secondary">
                Destek
              </ButtonLink>
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
