import { ActivityFeed } from "@/components/activity-feed";
import { AppPreview } from "@/components/app-preview";
import { AudienceSection } from "@/components/audience-section";
import { BetaCta } from "@/components/beta-cta";
import { BetaProcess } from "@/components/beta-process";
import { ButtonLink } from "@/components/button-link";
import { ComparisonSection } from "@/components/comparison-section";
import { Container } from "@/components/container";
import { HeroEngagement } from "@/components/hero-engagement";
import { HeroPremiumBackdrop } from "@/components/hero-premium-backdrop";
import { HeroScrollHint } from "@/components/hero-scroll-hint";
import { HeroShell } from "@/components/hero-shell";
import { HeroTrustMicro } from "@/components/hero-trust-micro";
import { ScrollReveal } from "@/components/scroll-reveal";
import { FaqSection } from "@/components/faq-section";
import { ModeCard } from "@/components/mode-card";
import { RoleSelection } from "@/components/role-selection";
import { SectionHeading } from "@/components/section-heading";
import { SocialProofPlaceholder } from "@/components/social-proof-placeholder";
import { HeroShowcaseStack } from "@/components/hero-showcase-stack";
import { ValueProps } from "@/components/value-props";
import { HeroTrustStrip } from "@/components/hero-trust-strip";
import { HomeFourSteps } from "@/components/home-four-steps";
import { MobileStickyCta } from "@/components/mobile-sticky-cta";
import { SectionMidCta } from "@/components/section-mid-cta";

function NasipPlayGlyph() {
  return (
    <svg className="h-4 w-4 shrink-0 text-cyan-100/92" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.5 7.85v8.3c0 .52.54.83.96.54l6.62-4.08a.65.65 0 0 0 0-1.1l-6.62-4.09a.62.62 0 0 0-.96.53Z" opacity={0.96} />
    </svg>
  );
}

const experiences = [
  {
    title: "Şehir içi",
    eyebrow: "şehir içi teklif",
    description:
      "Rota görünürlüğü, QR doğrulama ve Güven Al adımlarıyla şehir içinde kontrollü güvenli eşleşme.",
    tone: "cyan" as const,
  },
  {
    title: "Leylek Teklifi",
    eyebrow: "önce teklif",
    description:
      "Teklif görüşmesi, karşılıklı onay ve yolculuk öncesi anlaşma ile yolculuk tekliflerini güvenli eşleşmeye dönüştür.",
    tone: "violet" as const,
  },
];

export default function Home() {
  return (
    <>
      <MobileStickyCta />
      <HeroShell className="overflow-x-clip pb-14 pt-10 sm:pb-16 sm:pt-10 md:pb-20 md:pt-12 lg:pb-[5.25rem]">
        <HeroPremiumBackdrop />
        <Container>
          <div className="grid animate-fade-in-up grid-cols-1 gap-10 md:gap-11 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:items-start lg:gap-6 xl:gap-8">
            <div className="min-w-0 px-px text-center lg:max-w-[36.75rem] lg:pr-1 lg:text-left">
              <div className="mx-auto lg:mx-0 lg:max-w-none">
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-cyan-200/78 sm:text-xs">yolculuk paylaşımı</p>
              </div>
              <h1 className="mx-auto mt-[1.125rem] max-w-[min(22rem,calc(100vw-2rem))] text-balance text-[clamp(2rem,calc(0.92rem+5.2vw),2.62rem)] font-black leading-[0.99] tracking-[-0.044em] text-white antialiased contrast-more:tracking-normal sm:max-w-2xl sm:leading-[0.988] md:max-w-[min(42rem,calc(100vw-4rem))] md:text-[2.825rem] md:leading-[0.985] lg:mx-0 lg:max-w-[36rem] xl:text-[2.9375rem]">
                <span className="block">Aynı yöne gidenlerle</span>
                <span className="mt-[0.4rem] block tracking-tight md:mt-2">
                  <span className="bg-[linear-gradient(102deg,#e9fbff_0%,#73eafd_43%,#0e9fe6_73%,#0066ef_100%)] bg-clip-text text-transparent [text-decoration:none] [text-shadow:none]">
                    güvenli
                  </span>
                  <span className="mx-px font-semibold text-white/[0.77]">{` ve `}</span>
                  <span className="bg-[linear-gradient(102deg,#e9fbff_0%,#6be7fd_43%,#0d96de_73%,#005ee8_100%)] bg-clip-text text-transparent [text-decoration:none] [text-shadow:none]">
                    kontrollü
                  </span>
                </span>
                <span className="mt-[0.375rem] block md:mt-3">eşleşme.</span>
              </h1>

              <div className="[&_ul]:mt-4 sm:[&_ul]:mt-[1.125rem]">
                <HeroTrustMicro />
              </div>

              <p className="mx-auto mt-5 max-w-lg text-[0.9575rem] leading-[1.66] tracking-[0.01em] text-slate-300 sm:mt-6 sm:text-base md:mx-0 md:max-w-[26.5rem]">
                Leylek TAG, rota odaklı eşleşme, QR doğrulama ve güven katmanlarıyla şehir içi yolculuk paylaşımını sadeleştirir.
              </p>

              <div className="mx-auto mt-[1.375rem] flex max-w-xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-[0.9375rem] md:mx-0 md:justify-start lg:max-w-none">
                <ButtonLink href="/indir" className="w-full px-9 !py-[0.96rem] text-center text-[0.9375rem] sm:w-auto">
                  Uygulamayı İndir
                </ButtonLink>
                <ButtonLink
                  href="/nasil-calisir"
                  variant="secondary"
                  className="inline-flex w-full items-center justify-center gap-2.5 border-white/[0.072] bg-transparent px-[1.825rem] !py-[0.78rem] text-[0.9rem] font-semibold tracking-tight shadow-none backdrop-blur-sm hover:bg-white/[0.028] hover:shadow-none sm:w-auto sm:justify-center sm:gap-2"
                >
                  <NasipPlayGlyph /> Nasıl Çalışır?
                </ButtonLink>
              </div>

              <HeroTrustStrip />
            </div>

            <div className="relative min-h-0 w-full lg:-mt-2 lg:flex lg:min-w-0 lg:justify-end lg:pr-2">
              <HeroShowcaseStack />
            </div>
          </div>

          <div id="hero-yol" className="scroll-mt-28 mt-14 min-w-0 w-full sm:mt-16 md:mt-[4.25rem]">
            <HeroEngagement />
          </div>

          <HeroScrollHint />
        </Container>
      </HeroShell>

      <ScrollReveal staggerDelayMs={0} className="w-full">
        <HomeFourSteps />
      </ScrollReveal>

      <ScrollReveal staggerDelayMs={48} className="w-full">
        <RoleSelection />
      </ScrollReveal>

      <SectionMidCta />

      <section className="depth-ambient section-soft-vignette section-seam py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={96}>
          <Container>
            <div className="mb-8 md:mb-10">
              <SectionHeading
                eyebrow="neden leylek tag?"
                title="Yolculuk paylaşımında güven, kontrol ve topluluk aynı yerde."
                description="Leylek TAG yalnızca bir rota ekranı değil; aynı yöne gidenlerin detayları netleştirerek, doğrulayarak ve şeffaf bilgiyle anlaşabildiği modern bir topluluk deneyimidir."
              />
            </div>
            <ValueProps />
          </Container>
        </ScrollReveal>
      </section>

      <section className="depth-well section-seam py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={140}>
          <Container>
            <div className="mb-8 md:mb-10">
              <SectionHeading
                eyebrow="kimler için?"
                title="Leylek TAG, yolculuk paylaşımını farklı ihtiyaçlar için bir araya getirir."
                description="Günlük şehir içi planlardan teklif görüşmesine kadar, aynı yöne gidenleri topluluk içinde daha kontrollü buluşturur."
              />
            </div>
            <AudienceSection />
          </Container>
        </ScrollReveal>
      </section>

      <SectionMidCta />

      <section className="depth-glass section-seam py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={182}>
          <Container>
            <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[0.8fr_1fr]">
              <ActivityFeed />
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6 lg:grid-cols-2 lg:gap-8">
                {experiences.map((experience) => (
                  <ModeCard key={experience.title} {...experience} />
                ))}
              </div>
            </div>
          </Container>
        </ScrollReveal>
      </section>

      <section className="depth-well section-soft-vignette py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={226}>
          <Container>
            <div className="mb-8 md:mb-10">
              <SectionHeading
                eyebrow="neden farklı?"
                title="Klasik yolculuk deneyiminden daha topluluk odaklı."
                description="Leylek TAG teklif görüşmesiyle karar vermeyi, masraf paylaşımını şeffaf şekilde konuşmayı ve güvenli eşleşme yaklaşımını aynı deneyimde bir araya getirir."
              />
            </div>
            <ComparisonSection />
          </Container>
        </ScrollReveal>
      </section>

      <SectionMidCta />

      <section className="depth-ambient section-seam py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={274}>
          <Container>
            <div className="mb-8 md:mb-10">
              <SectionHeading
                eyebrow="uygulama vitrini"
                title="Sekiz profesyonel ekran · backend destekli üründen sıralı seçki"
                description="Gerçek sürücü ve yolcu panelleri: teklif yönetimi, karşılıklı onay ve QR doğrulama ile şehir içi eşleşme hissi masaüstünde ve mobilde carousel ile tam kadraj (contain)."
              />
            </div>
            <AppPreview />
          </Container>
        </ScrollReveal>
      </section>

      <SectionMidCta />

      <section className="depth-glass py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={318}>
          <Container>
            <div className="mb-8 md:mb-10">
              <SectionHeading
                eyebrow="beta süreci"
                title="Önce kontrollü beta, sonra daha geniş topluluk."
                description="Leylek TAG’i ilk kullanıcılarla birlikte geliştiriyoruz. Geri bildirimler, şehirler ve kullanım senaryoları ürün yönünü belirliyor."
              />
            </div>
            <BetaProcess />
          </Container>
        </ScrollReveal>
      </section>

      <section className="depth-well section-seam py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={366}>
          <Container>
            <SocialProofPlaceholder />
          </Container>
        </ScrollReveal>
      </section>

      <SectionMidCta />

      <section className="depth-ambient py-11 sm:py-14 md:py-[4.75rem]">
        <ScrollReveal staggerDelayMs={412}>
          <Container>
            <div className="mb-8 md:mb-10">
              <SectionHeading
                eyebrow="sık sorulan sorular"
                title="Leylek TAG hakkında merak edilenler"
                description="Yolculuk paylaşımı, masraf paylaşımı, Leylek Teklifi ve güvenli eşleşme akışına dair kısa yanıtlar."
              />
            </div>
            <FaqSection />
          </Container>
        </ScrollReveal>
      </section>

      <ScrollReveal staggerDelayMs={468} className="w-full">
        <BetaCta />
      </ScrollReveal>
    </>
  );
}
