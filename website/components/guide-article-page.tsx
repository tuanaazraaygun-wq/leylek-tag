import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import {
  GUIDE_POPULAR_CITY_LINKS,
  getOtherGuideNavLinks,
  type GuideArticle,
} from "@/lib/guide-content";

function GuideFaqList({ faq }: { faq: GuideArticle["faq"] }) {
  return (
    <div className="mt-8 grid gap-3 md:grid-cols-2">
      {faq.map((item) => (
        <details
          key={item.question}
          className="glass-panel group rounded-2xl border border-white/[0.07] p-3.5 sm:p-4 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="cursor-pointer list-none">
            <span className="flex min-h-[44px] items-center justify-between gap-3">
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

type GuideArticlePageProps = {
  article: GuideArticle;
};

export function GuideArticlePage({ article }: GuideArticlePageProps) {
  const otherGuides = getOtherGuideNavLinks(article.slug);

  return (
    <>
      <section className="border-b border-white/[0.06] py-10 sm:py-12">
        <Container>
          <Link
            href="/rehber"
            className="text-sm font-semibold text-cyan-300/90 transition hover:text-cyan-100"
          >
            ← Tüm rehberler
          </Link>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{article.category}</p>
          <h1 className="mt-3 max-w-3xl text-[1.75rem] font-black leading-tight text-white sm:text-4xl">{article.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">{article.intro}</p>
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container>
          <div className="glass-panel mb-8 rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">uyum</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Leylek TAG, yolculuk paylaşımı ve masraf paylaşımı için topluluk odaklı bir platformdur; ticari taşımacılık
              hizmeti sunmaz. Uygulama içi işlemler mobil uygulamada tamamlanır.
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-8">
            {article.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-lg font-black text-white sm:text-xl">{section.heading}</h2>
                {section.paragraphs?.map((p) => (
                  <p key={p} className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-[15px]">
                    {p}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/90" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>

          <h2 className="mt-12 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Sık sorulanlar</h2>
          <GuideFaqList faq={article.faq} />

          <section className="mt-12 border-t border-white/[0.06] pt-10">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">İlgili rehberler</h2>
            <p className="mt-2 text-sm text-slate-400">Yolculuk paylaşımı ve masraf paylaşımı hakkında diğer rehberler.</p>
            <nav className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="İlgili rehberler">
              {otherGuides.map((guide) => (
                <Link
                  key={guide.slug}
                  href={guide.href}
                  className="glass-panel rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] font-semibold text-cyan-100/95 transition hover:border-cyan-400/30"
                >
                  {guide.title}
                </Link>
              ))}
            </nav>
            <p className="mt-3">
              <Link href="/rehber" className="text-sm font-semibold text-cyan-200/90 hover:underline">
                Tüm rehberler →
              </Link>
            </p>
          </section>

          <section className="mt-10 border-t border-white/[0.06] pt-10">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Şehrinde keşfet</h2>
            <p className="mt-2 text-sm text-slate-400">Popüler şehirlerde yolculuk paylaşımı sayfaları.</p>
            <nav className="mt-4" aria-label="Popüler şehirler">
              <ul className="flex flex-wrap gap-2">
                {GUIDE_POPULAR_CITY_LINKS.map((city) => (
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
          </section>
        </Container>
      </section>

      <section className="pb-14 pt-2">
        <Container>
          <div className="glass-panel rounded-[2rem] border border-cyan-400/[0.14] p-8 ring-1 ring-cyan-400/[0.08] sm:p-10">
            <h2 className="text-2xl font-black text-white">Sonraki adım</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Rehberi okuduktan sonra uygulamayı indirip teklif ve eşleşme akışını deneyebilirsin.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
              <ButtonLink href="/nasil-calisir" variant="secondary">
                Nasıl çalışır?
              </ButtonLink>
              <ButtonLink href="/guvenlik" variant="secondary">
                Güvenlik
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
