import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { PageHero } from "@/components/page-hero";
import { getAllCityLandingLinks } from "@/lib/city-landing-content";

const PAGE_TITLE = "Şehirler | Leylek TAG";
const PAGE_DESCRIPTION =
  "Ankara, İstanbul, İzmir, Bursa, Antalya ve diğer şehirlerde yolculuk paylaşımı. Leylek TAG şehir sayfalarından bölgesel masraf paylaşımını keşfet.";

export const metadata: Metadata = {
  title: "Şehirler",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/sehirler",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/sehirler",
  },
};

export default function CitiesHubPage() {
  const cities = getAllCityLandingLinks();

  return (
    <>
      <PageHero
        eyebrow="şehirler"
        title="Leylek TAG şehirlerde"
        description="Şehrinde yolculuk paylaşımını keşfet. Aynı yöne giden yolcu ve sürücüler için karşılıklı onay ve masraf paylaşımı akışı."
        primaryHref="/indir"
        primaryLabel="Uygulamayı indir"
        secondaryHref="/nasil-calisir"
        secondaryLabel="Nasıl çalışır?"
        ctaHint="Teklif, eşleşme ve doğrulama adımları mobil uygulamada tamamlanır."
      />

      <section className="border-b border-white/[0.06] py-8 sm:py-10">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">uyum</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Leylek TAG, yolculuk paylaşımı ve masraf paylaşımı için topluluk odaklı bir platformdur; ticari
              taşımacılık hizmeti sunmaz.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {cities.length} şehir
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={city.href}
                  className="glass-panel group flex h-full flex-col rounded-2xl border border-white/[0.08] p-5 transition hover:border-cyan-400/30 hover:bg-cyan-500/[0.04]"
                >
                  <h2 className="text-lg font-black text-white">{city.cityName}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">{city.summary}</p>
                  <span className="mt-4 inline-flex min-h-[40px] items-center text-sm font-bold text-cyan-200/95 group-hover:text-cyan-50">
                    Şehri keşfet →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="glass-panel rounded-[2rem] border border-cyan-400/[0.14] p-8 ring-1 ring-cyan-400/[0.08] sm:p-10">
            <h2 className="text-2xl font-black text-white sm:text-3xl">Uygulamada yolculuk paylaşımını dene</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Şehir sayfasından detayları incele; teklif ve eşleşme adımlarını mobil uygulamada tamamla.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
              <ButtonLink href="/nasil-calisir" variant="secondary">
                Nasıl çalışır?
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
