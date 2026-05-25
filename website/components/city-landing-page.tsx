import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import {
  CITY_LANDING_HOW_IT_WORKS,
  getOtherCityLandingLinks,
  type CityLandingContent,
} from "@/lib/city-landing-content";
import { getGuideNavLinks } from "@/lib/guide-content";

function CityFaqList({ faq }: { faq: CityLandingContent["faq"] }) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 md:gap-3.5">
      {faq.map((item) => (
        <details
          key={item.question}
          className="glass-panel group rounded-2xl border border-white/[0.07] p-3.5 transition duration-200 hover:border-cyan-400/22 open:border-cyan-400/28 sm:p-4 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="cursor-pointer list-none marker:hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            <span className="flex min-h-[44px] items-center justify-between gap-3 px-0.5 py-1">
              <span className="text-left text-[13px] font-bold leading-snug text-white sm:text-sm">{item.question}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/22 bg-cyan-500/[0.08] text-cyan-100/90 transition-transform duration-200 group-open:rotate-180">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden>
                  <path d="M5 7.5 10 12.5 15 7.5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
          </summary>
          <p className="mt-3 rounded-xl border border-cyan-400/[0.12] bg-black/40 px-3 py-3 text-[12px] leading-relaxed text-slate-200/95 sm:text-[13px]">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

type CityLandingPageProps = {
  content: CityLandingContent;
};

export function CityLandingPage({ content }: CityLandingPageProps) {
  const otherCities = getOtherCityLandingLinks(content.slug);
  const guideLinks = getGuideNavLinks();

  return (
    <>
      <PageHero
        eyebrow={`${content.cityName} · yolculuk paylaşımı`}
        title={content.heroTitle}
        description={content.heroSubtitle}
        primaryHref="/indir"
        primaryLabel="Uygulamayı indir"
        secondaryHref="/nasil-calisir"
        secondaryLabel="Nasıl çalışır?"
        ctaHint="Yolculuk paylaşımını şehirde dene. Teklif, eşleşme ve doğrulama adımları mobil uygulamada tamamlanır."
      />

      <section className="border-y border-white/[0.06] bg-white/[0.02] py-10 sm:py-12">
        <Container>
          <SectionHeading
            eyebrow={content.cityName}
            title={`${content.cityName} için Leylek TAG`}
            description="Topluluk temelli masraf paylaşımı; karşılıklı teklif ve onay mantığıyla ilerler. Platform ticari taşımacılık hizmeti sunmaz."
          />
        </Container>
      </section>

      <section className="py-12">
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            <FeatureCard
              eyebrow="yolcu için"
              title="Teklif aç, masrafı netleştir"
              description={content.passengerCta}
            />
            <FeatureCard
              eyebrow="sürücü için"
              title="Boş koltuğunu paylaş"
              description={content.driverCta}
            />
          </div>
        </Container>
      </section>

      <section className="border-t border-white/[0.06] py-12">
        <Container>
          <SectionHeading
            eyebrow="nasıl çalışır"
            title="Dört adımda tekliften yolculuğa"
            description={`${content.cityName} içi akışta teklif, karşılıklı onay ve QR doğrulama adımları uygulamada yürütülür.`}
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {CITY_LANDING_HOW_IT_WORKS.map((step) => (
              <FeatureCard
                key={step.title}
                eyebrow={step.eyebrow}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-white/[0.06] bg-gradient-to-b from-slate-950/40 to-black/20 py-10 sm:py-12">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">güvenlik ve uyum</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Leylek TAG; karşılıklı onay, QR doğrulama ve topluluk sinyalleriyle desteklenen kontrollü eşleşme
              yaklaşımını benimser. Yasal mevzuata uygunluk kullanıcı ve platform kuralları çerçevesindedir. Kişisel
              verilerin işlenmesi hakkında bilgi için{" "}
              <Link href="/kvkk" className="font-semibold text-cyan-200/90 underline-offset-2 hover:underline">
                KVKK metnini
              </Link>{" "}
              inceleyebilirsin.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-12">
        <Container>
          <SectionHeading
            eyebrow="sık sorulanlar"
            title={`${content.cityName} hakkında sorular`}
            description="Şehir içi yolculuk paylaşımı ve uygulama akışına dair kısa yanıtlar."
          />
          <div className="mt-8">
            <CityFaqList faq={content.faq} />
          </div>
        </Container>
      </section>

      <section className="border-t border-white/[0.06] py-12">
        <Container>
          <SectionHeading
            eyebrow="rehberler"
            title="İlgili rehberler"
            description={`${content.cityName} için yolculuk paylaşımı ve masraf paylaşımı hakkında bilgilendirici içerikler.`}
          />
          <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="İlgili rehberler">
            {guideLinks.map((guide) => (
              <Link
                key={guide.slug}
                href={guide.href}
                className="glass-panel flex min-h-[44px] flex-col justify-center rounded-xl border border-white/[0.08] px-4 py-3 transition hover:border-cyan-400/30 hover:text-cyan-50"
              >
                <span className="text-[13px] font-semibold leading-snug text-cyan-100/95">{guide.title}</span>
              </Link>
            ))}
          </nav>
          <p className="mt-4">
            <Link href="/rehber" className="text-sm font-semibold text-cyan-200/90 hover:text-cyan-50 hover:underline">
              Tüm rehberler →
            </Link>
          </p>
        </Container>
      </section>

      <section className="border-t border-white/[0.06] py-12">
        <Container>
          <SectionHeading
            eyebrow="diğer şehirler"
            title="Diğer şehirlerde Leylek TAG"
            description="Aynı yöne giden yolcu ve sürücüler için yolculuk paylaşımı ve masraf paylaşımı — diğer şehir sayfalarına göz at."
          />
          <nav
            className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
            aria-label="Diğer şehir landing sayfaları"
          >
            {otherCities.map((city) => (
              <Link
                key={city.slug}
                href={city.href}
                className="glass-panel flex min-h-[44px] items-center justify-center rounded-xl border border-white/[0.08] px-3 py-3 text-center text-[13px] font-semibold text-cyan-100/95 transition hover:border-cyan-400/30 hover:text-cyan-50"
              >
                {city.cityName}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-cyan-400/[0.14] p-8 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08),0_28px_80px_-44px_rgba(0,198,255,0.42)] ring-1 ring-cyan-400/[0.08] sm:p-10">
            <span
              className="pointer-events-none absolute inset-px rounded-[calc(2rem-1px)] bg-[linear-gradient(135deg,rgba(34,211,238,0.09)_0%,transparent_45%,rgba(99,102,241,0.06)_100%)] opacity-[0.95]"
              aria-hidden
            />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/82">yolculuk paylaşımı</p>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
                  Yolculuk paylaşımını şehirde dene
                </h2>
                <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-slate-300/95">
                  {content.cityName} içinde aynı yöne giden yolcu ve sürücüler için karşılıklı teklif, onay ve QR
                  doğrulama akışı. Masraf paylaşımı taraflar arasında netleşir; platform ticari taşımacılık hizmeti
                  sunmaz.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
                <ButtonLink href="/nasil-calisir" variant="secondary">
                  Nasıl çalışır?
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-10 pt-2">
        <Container>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-cyan-200/90 underline-offset-4 hover:text-cyan-100 hover:underline"
          >
            ← Ana sayfaya dön
          </Link>
        </Container>
      </section>
    </>
  );
}
