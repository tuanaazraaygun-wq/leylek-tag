import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { PageHero } from "@/components/page-hero";
import { getAllGuides } from "@/lib/guide-content";

const PAGE_TITLE = "Rehber | Leylek TAG";
const PAGE_DESCRIPTION =
  "Yolculuk paylaşımı, masraf paylaşımı ve güvenli eşleşme rehberleri. Leylek TAG için bilgilendirici içerikler ve şehir sayfalarına bağlantılar.";

export const metadata: Metadata = {
  title: "Rehber",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/rehber",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/rehber",
  },
};

const POPULAR_CITY_LINKS = [
  { href: "/sehir/ankara", label: "Ankara" },
  { href: "/sehir/istanbul", label: "İstanbul" },
  { href: "/sehir/izmir", label: "İzmir" },
  { href: "/sehir/bursa", label: "Bursa" },
  { href: "/sehir/antalya", label: "Antalya" },
] as const;

export default function GuideHubPage() {
  const guides = getAllGuides();

  return (
    <>
      <PageHero
        eyebrow="rehber"
        title="Leylek TAG rehberleri"
        description="Yolculuk paylaşımı ve masraf paylaşımı hakkında net, güvenli bilgilendirme. Teklif ve eşleşme adımları mobil uygulamada tamamlanır."
        primaryHref="/indir"
        primaryLabel="Uygulamayı indir"
        secondaryHref="/sehirler"
        secondaryLabel="Şehirleri keşfet"
        ctaHint="Rehberler bilgilendirme amaçlıdır; ticari taşımacılık hizmeti sunulmaz."
      />

      <section className="border-b border-white/[0.06] py-8 sm:py-10">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">uyum</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Leylek TAG, yolculuk paylaşımı ve masraf paylaşımı için topluluk odaklı bir platformdur; ticari taşımacılık
              hizmeti sunmaz.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {guides.length} rehber
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/rehber/${guide.slug}`}
                  className="glass-panel group flex h-full flex-col rounded-2xl border border-white/[0.08] p-5 transition hover:border-cyan-400/30"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/75">{guide.category}</p>
                  <h2 className="mt-2 text-lg font-black text-white">{guide.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">{guide.cardSummary}</p>
                  <span className="mt-4 text-sm font-bold text-cyan-200/95 group-hover:text-cyan-50">Rehberi oku →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-t border-white/[0.06] py-10">
        <Container>
          <nav aria-label="Popüler şehir landing sayfaları">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Popüler şehirler</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {POPULAR_CITY_LINKS.map((city) => (
                <li key={city.href}>
                  <Link
                    href={city.href}
                    className="inline-flex min-h-[36px] items-center rounded-full border border-cyan-400/22 bg-cyan-400/[0.07] px-3 py-1.5 text-[12px] font-semibold text-cyan-100/90 transition hover:border-cyan-400/35"
                  >
                    {city.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/sehirler"
                  className="inline-flex min-h-[36px] items-center rounded-full border border-white/[0.1] px-3 py-1.5 text-[12px] font-semibold text-slate-300 hover:text-white"
                >
                  Tüm şehirler
                </Link>
              </li>
            </ul>
          </nav>
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
            <ButtonLink href="/nasil-calisir" variant="secondary">
              Nasıl çalışır?
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
