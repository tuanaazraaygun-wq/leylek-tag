import Link from "next/link";
import { ActivityFeed } from "@/components/activity-feed";
import { HomeAppScopeSection } from "@/components/home-app-scope-section";
import { HomeTrustKycSection } from "@/components/home-trust-kyc-section";
import { HomeTrustSafetyProtocol } from "@/components/home-trust-safety-protocol";
import { BetaCta } from "@/components/beta-cta";
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
import { HeroShowcaseStack } from "@/components/hero-showcase-stack";
import { TrustArchitectureShowcase } from "@/components/trust-architecture-showcase";
import { HomeFourSteps } from "@/components/home-four-steps";
import { MobileStickyCta } from "@/components/mobile-sticky-cta";

function NasipPlayGlyph() {
  return (
    <svg className="h-4 w-4 shrink-0 text-cyan-100/92" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.5 7.85v8.3c0 .52.54.83.96.54l6.62-4.08a.65.65 0 0 0 0-1.1l-6.62-4.09a.62.62 0 0 0-.96.53Z" opacity={0.96} />
    </svg>
  );
}

const scenarios = [
  {
    href: "/sehir-ici",
    title: "Şehir içi",
    eyebrow: "günlük rota",
    description:
      "Yakın rota eşleşmesi, QR doğrulama ve Güven Al adımlarıyla şehir içinde kontrollü paylaşım.",
    tone: "cyan" as const,
    microStates: [
      { label: "QR aktif", active: true },
      { label: "Rota uyumu", active: true },
      { label: "Profil görünür", active: true },
    ],
  },
  {
    href: "/sehirler-arasi",
    title: "Şehirler arası",
    eyebrow: "planlı yol",
    description:
      "Uzun yol senaryoları için planlı eşleşme akışı; pilot kapsamda kademeli olarak genişletilir.",
    tone: "blue" as const,
    microStates: [
      { label: "Planlı rota", active: true },
      { label: "Ön teklif", active: true },
      { label: "Pilot aşama", active: true },
    ],
  },
];

export default function Home() {
  return (
    <>
      <MobileStickyCta />
      <HeroShell className="overflow-x-clip pb-12 pt-8 sm:pb-14 sm:pt-10 md:pb-16 md:pt-11 lg:pb-[4.75rem]">
        <HeroPremiumBackdrop />
        <Container>
          <div className="grid animate-fade-in-up grid-cols-1 gap-8 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:items-start lg:gap-6 xl:gap-8">
            <div className="min-w-0 px-px text-center lg:max-w-[36.75rem] lg:pr-1 lg:text-left">
              <div className="mx-auto lg:mx-0 lg:max-w-none">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200/78 sm:text-[11px]">
                  yolculuk paylaşımı
                </p>
              </div>
              <h1 className="mx-auto mt-4 max-w-[min(22rem,calc(100vw-2rem))] text-balance text-[clamp(1.75rem,calc(0.88rem+4.8vw),2.45rem)] font-black leading-[1.02] tracking-[-0.04em] text-white antialiased sm:max-w-2xl md:max-w-[min(40rem,calc(100vw-4rem))] md:text-[2.5rem] lg:mx-0 lg:max-w-[34rem]">
                <span className="block">Aynı yöne gidenlerle</span>
                <span className="mt-1 block tracking-tight md:mt-1.5">
                  <span className="bg-[linear-gradient(102deg,#e9fbff_0%,#73eafd_43%,#0e9fe6_73%,#0066ef_100%)] bg-clip-text text-transparent">
                    güvenli
                  </span>
                  <span className="mx-px font-semibold text-white/[0.77]">{` ve `}</span>
                  <span className="bg-[linear-gradient(102deg,#e9fbff_0%,#6be7fd_43%,#0d96de_73%,#005ee8_100%)] bg-clip-text text-transparent">
                    kontrollü
                  </span>
                </span>
                <span className="mt-1 block md:mt-2">eşleşme.</span>
              </h1>

              <div className="[&_ul]:mt-3 sm:[&_ul]:mt-4">
                <HeroTrustMicro />
              </div>

              <p className="mx-auto mt-4 max-w-lg text-[0.9375rem] leading-[1.62] text-slate-300 sm:mt-5 md:mx-0 md:max-w-[26rem]">
                Leylek TAG, rota odaklı eşleşme, QR doğrulama ve güven katmanlarıyla şehir içi yolculuk paylaşımını
                sadeleştirir.
              </p>

              <div className="mx-auto mt-5 flex max-w-xl flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3 md:mx-0 md:justify-start lg:max-w-none">
                <ButtonLink href="/indir" className="w-full px-8 !py-[0.9rem] text-center text-[0.9rem] sm:w-auto">
                  Uygulamayı İndir
                </ButtonLink>
                <ButtonLink
                  href="/nasil-calisir"
                  variant="secondary"
                  className="inline-flex w-full items-center justify-center gap-2 border-white/[0.072] bg-transparent px-6 !py-[0.72rem] text-[0.875rem] font-semibold tracking-tight shadow-none backdrop-blur-sm hover:bg-white/[0.028] sm:w-auto"
                >
                  <NasipPlayGlyph /> Nasıl Çalışır
                </ButtonLink>
              </div>

              <ul
                className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2 lg:mx-0 lg:justify-start"
                aria-label="Güven katmanları özeti"
              >
                {["Çift onay", "QR doğrulama", "Güven katmanı"].map((label) => (
                  <li key={label}>
                    <span className="inline-flex items-center rounded-full border border-cyan-400/22 bg-cyan-400/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-100/88">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative min-h-0 w-full lg:-mt-2 lg:flex lg:min-w-0 lg:justify-end lg:pr-2">
              <HeroShowcaseStack />
            </div>
          </div>

          <div id="hero-yol" className="scroll-mt-28 mt-10 min-w-0 w-full sm:mt-12 md:mt-14">
            <HeroEngagement />
          </div>

          <HeroScrollHint />
        </Container>
      </HeroShell>

      <ScrollReveal staggerDelayMs={40} className="w-full">
        <HomeTrustKycSection />
      </ScrollReveal>

      <section className="depth-ambient section-soft-vignette section-seam py-8 sm:py-10 md:py-12">
        <ScrollReveal staggerDelayMs={48}>
          <Container>
            <TrustArchitectureShowcase />
          </Container>
        </ScrollReveal>
      </section>

      <ScrollReveal staggerDelayMs={0} className="w-full">
        <HomeFourSteps />
      </ScrollReveal>

      <ScrollReveal staggerDelayMs={48} className="w-full">
        <RoleSelection />
      </ScrollReveal>

      <section className="depth-glass section-seam py-10 sm:py-12 md:py-14">
        <ScrollReveal staggerDelayMs={120}>
          <Container>
            <SectionHeading
              eyebrow="kullanım senaryoları"
              title="Şehir içi ve şehirler arası ihtiyaçlara göre planlanmış akışlar."
              description="Günlük rota paylaşımından planlı uzun yola kadar aynı güven katmanlarıyla ilerleyen senaryolar."
            />
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
              {scenarios.map((scenario) => (
                <Link
                  key={scenario.href}
                  href={scenario.href}
                  className="tap-highlight block rounded-[1.35rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                >
                  <ModeCard
                    title={scenario.title}
                    eyebrow={scenario.eyebrow}
                    description={scenario.description}
                    tone={scenario.tone}
                    microStates={scenario.microStates}
                  />
                </Link>
              ))}
            </div>
          </Container>
        </ScrollReveal>
      </section>

      <ScrollReveal staggerDelayMs={160} className="w-full">
        <HomeAppScopeSection />
      </ScrollReveal>

      <ScrollReveal staggerDelayMs={64} className="w-full">
        <HomeTrustSafetyProtocol />
      </ScrollReveal>

      <section className="depth-glass section-seam py-8 sm:py-10 md:py-11">
        <ScrollReveal staggerDelayMs={180}>
          <Container>
            <SectionHeading
              eyebrow="platform akışı"
              title="Pilot şehirlerde canlı rota ve eşleşme sinyalleri"
              description="Teklif, onay ve QR doğrulama adımları platform üzerinde izlenebilir; özet akış bilgilendirme amaçlıdır."
            />
            <div className="mt-6 max-w-3xl">
              <ActivityFeed variant="home" />
            </div>
          </Container>
        </ScrollReveal>
      </section>

      <section className="depth-well section-soft-vignette py-10 sm:py-12 md:py-14">
        <ScrollReveal staggerDelayMs={200}>
          <Container>
            <div className="mb-7 md:mb-8">
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

      <section className="depth-ambient py-10 sm:py-12 md:py-14">
        <ScrollReveal staggerDelayMs={240}>
          <Container>
            <div className="mb-7 md:mb-8">
              <SectionHeading
                eyebrow="sık sorulan sorular"
                title="Leylek TAG hakkında merak edilenler"
                description="Yolculuk paylaşımı, masraf paylaşımı, teklif süreci ve güvenli eşleşme akışına dair kısa yanıtlar."
              />
            </div>
            <FaqSection />
          </Container>
        </ScrollReveal>
      </section>

      <ScrollReveal staggerDelayMs={280} className="w-full">
        <BetaCta />
      </ScrollReveal>
    </>
  );
}
