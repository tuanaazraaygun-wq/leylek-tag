import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { PageHero } from "@/components/page-hero";
import { SectionHeading } from "@/components/section-heading";
import {
  COMMUNITY_CHANNEL_GUARDRAILS,
  COMMUNITY_CITY_SLUGS,
  getCommunityCityBySlug,
  getOtherCommunityCityLinks,
} from "@/lib/community-city-content";
import { DOWNLOAD_PAGE_URL } from "@/lib/store-links";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return COMMUNITY_CITY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = getCommunityCityBySlug(slug);
  if (!content) return {};

  return {
    title: content.title,
    description: content.description,
    keywords: content.keywords,
    alternates: {
      canonical: `/topluluk/${content.slug}`,
    },
    openGraph: {
      title: content.metaTitle,
      description: content.description,
      url: `/topluluk/${content.slug}`,
    },
  };
}

function CityFaqList({ faq }: { faq: { question: string; answer: string }[] }) {
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

export default async function CommunityCityPage({ params }: PageProps) {
  const { slug } = await params;
  const content = getCommunityCityBySlug(slug);
  if (!content) notFound();

  const otherCities = getOtherCommunityCityLinks(content.slug);

  return (
    <>
      <PageHero
        eyebrow={`${content.cityName} · leylek topluluk`}
        title={content.heroTitle}
        description={content.heroSubtitle}
        primaryHref={DOWNLOAD_PAGE_URL}
        primaryLabel="Uygulamayı indir"
        secondaryHref="/muhabbet"
        secondaryLabel="Leylek Teklifi nasıl çalışır?"
        ctaHint="Kanal akışı mobil uygulamada yürütülür. Web sayfası bilgilendirme vitrinidir; canlı mesaj akışı yoktur."
      />

      <section className="border-b border-white/[0.06] py-8 sm:py-10">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">yasal not</p>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100/90">
                {content.pilotStatus}
              </span>
            </div>
            <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-300">
              <p>{content.intro}</p>
              <p>
                Leylek Topluluk, topluluk odaklı yolculuk ve masraf paylaşımı için tasarlanmıştır;{" "}
                <span className="font-semibold text-slate-200">taksi veya ticari taşımacılık hizmeti sunmaz</span>.
              </p>
              <p>
                Platform <span className="font-semibold text-slate-200">uygulama içinde ödeme tahsilatı yapmaz</span>
                ; masraf paylaşımı tarafların karşılıklı anlaşmasıyla topluluk kuralları içinde ilerler.
              </p>
              <p className="text-slate-400">
                Güven Ağı daveti yalnızca mobil uygulamada çift taraflı onayla tamamlanır. Yolculuk veya teklif taslağı
                uygulamada oluşturulur.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.02] py-10 sm:py-12">
        <Container>
          <SectionHeading
            eyebrow="kurallar"
            title="Güvenli kanal ilkeleri"
            description={`${content.cityName} kanalı; kişisel veri kaçışını ve ride-hail algısını azaltacak şekilde sınırlandırılır.`}
          />
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {COMMUNITY_CHANNEL_GUARDRAILS.map((rule) => (
              <li
                key={rule}
                className="flex gap-2.5 rounded-xl border border-white/[0.07] bg-slate-950/40 px-4 py-3 text-[13px] leading-relaxed text-slate-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90" aria-hidden />
                {rule}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {content.plannedSubChannels.length > 0 ? (
        <section className="py-10 sm:py-12">
          <Container>
            <SectionHeading
              eyebrow="pilot planı"
              title={`${content.cityName} alt kanalları`}
              description="Aşağıdaki alt kanallar bilgilendirme amaçlıdır. Açılış sırası pilot geri bildirimine göre netleşir."
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {content.plannedSubChannels.map((channel) => (
                <li
                  key={channel.name}
                  className="glass-panel rounded-2xl border border-white/[0.08] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{content.cityName}</p>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100/90">
                      {channel.status}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-white">{channel.name}</h2>
                  <p className="mt-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    {channel.scope}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
                    Alt kanal uygulamada açıldığında buradan duyurulacaktır.
                  </p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      <section className={`${content.plannedSubChannels.length > 0 ? "border-t border-white/[0.06]" : ""} py-10 sm:py-12`}>
        <Container>
          <SectionHeading
            eyebrow="sık sorulanlar"
            title={`${content.cityName} topluluk kanalı hakkında`}
            description="Pilot plan, kanal kuralları ve uygulama sınırları."
          />
          <div className="mt-8">
            <CityFaqList faq={content.faq} />
          </div>
        </Container>
      </section>

      <section className="border-t border-white/[0.06] py-10 sm:py-12">
        <Container>
          <SectionHeading
            eyebrow="ilgili sayfalar"
            title="Diğer kaynaklar"
            description="Topluluk kanalı ile yolculuk paylaşımı sayfaları farklı amaçlara hizmet eder."
          />
          <nav className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap" aria-label="İlgili sayfalar">
            <Link
              href="/topluluk"
              className="glass-panel flex min-h-[44px] items-center rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] font-semibold text-cyan-100/95 transition hover:border-cyan-400/30"
            >
              ← Leylek Topluluk
            </Link>
            <Link
              href={content.rideShareHref}
              className="glass-panel flex min-h-[44px] items-center rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] font-semibold text-cyan-100/95 transition hover:border-cyan-400/30"
            >
              {content.cityName} yolculuk paylaşımı
            </Link>
          </nav>
          {otherCities.length > 0 ? (
            <>
              <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                diğer pilot şehirler
              </p>
              <nav
                className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
                aria-label="Diğer pilot topluluk şehirleri"
              >
                {otherCities.map((city) => (
                  <Link
                    key={city.slug}
                    href={city.href}
                    className="glass-panel flex min-h-[44px] flex-col justify-center rounded-xl border border-white/[0.08] px-4 py-3 transition hover:border-cyan-400/30"
                  >
                    <span className="text-[13px] font-semibold text-cyan-100/95">{city.cityName}</span>
                    <span className="mt-0.5 text-[10px] font-medium text-slate-500">{city.pilotStatus}</span>
                  </Link>
                ))}
              </nav>
            </>
          ) : null}
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-cyan-400/[0.14] p-8 ring-1 ring-cyan-400/[0.08] sm:p-10">
            <span
              className="pointer-events-none absolute inset-px rounded-[calc(2rem-1px)] bg-[linear-gradient(135deg,rgba(34,211,238,0.08)_0%,transparent_50%)] opacity-95"
              aria-hidden
            />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/82">sonraki adım</p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                {content.cityName} kanalı uygulamada açıldığında haberdar ol
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                Bugün teklif, eşleşme ve güven adımlarını uygulama içinde inceleyebilirsin. Kanal pilot aşamasında
                kontrollü biçimde devreye alınacaktır.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href={DOWNLOAD_PAGE_URL}>Uygulamayı indir</ButtonLink>
                <ButtonLink href="/muhabbet" variant="secondary">
                  Leylek Teklifi nasıl çalışır?
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
