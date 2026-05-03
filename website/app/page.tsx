import Image from "next/image";
import { ActivityFeed } from "@/components/activity-feed";
import { AppPreview } from "@/components/app-preview";
import { AudienceSection } from "@/components/audience-section";
import { BetaCta } from "@/components/beta-cta";
import { BetaProcess } from "@/components/beta-process";
import { ButtonLink } from "@/components/button-link";
import { ComparisonSection } from "@/components/comparison-section";
import { Container } from "@/components/container";
import { HeroEngagement } from "@/components/hero-engagement";
import { ScrollReveal } from "@/components/scroll-reveal";
import { FaqSection } from "@/components/faq-section";
import { LiveMapVisual } from "@/components/live-map-visual";
import { ModeCard } from "@/components/mode-card";
import { RoleSelection } from "@/components/role-selection";
import { SectionHeading } from "@/components/section-heading";
import { SocialProofPlaceholder } from "@/components/social-proof-placeholder";
import { TrustBadges } from "@/components/trust-badges";
import { ValueProps } from "@/components/value-props";
import { featurePillars } from "@/lib/mock-data";
import { HeroTrustStrip } from "@/components/hero-trust-strip";
import { HomeLivePulse } from "@/components/home-live-pulse";
import { IntercityList } from "@src/components/IntercityList";

const experiences = [
  {
    title: "Hızlı Yolculuk",
    eyebrow: "şehir içi teklif",
    description:
      "Rota görünürlüğü, QR doğrulama ve Güven Al adımlarıyla şehir içinde kontrollü güvenli eşleşme.",
    tone: "cyan" as const,
  },
  {
    title: "Leylek Teklifi",
    eyebrow: "önce teklif",
    description:
      "Teklif görüşmesi, karşılıklı onay ve yolculuk öncesi anlaşma ile şehir dışı yolculuk tekliflerini güvenli eşleşmeye dönüştür.",
    tone: "violet" as const,
  },
  {
    title: "Şehirler Arası",
    eyebrow: "şehir dışı teklif",
    description:
      "Aynı yöne gidenler için tarih, saat, boş koltuk ve tahmini masraf paylaşımı bilgisiyle ilan deneyimi.",
    tone: "blue" as const,
  },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-x-hidden pt-10 pb-12 md:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10 max-w-[100vw] overflow-x-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#050b14_0%,#0a1628_42%,#120a22_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_88%_8%,rgba(0,198,255,0.272),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_12%_32%,rgba(108,99,255,0.255),transparent_52%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_100%,rgba(0,114,255,0.102),transparent_60%)]" />
        </div>
        <div className="subtle-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[22rem] max-w-[100vw] overflow-x-hidden opacity-30 sm:h-[28rem] sm:opacity-35 md:h-[32rem]" />
        <Container>
          <div className="grid animate-fade-in-up grid-cols-1 items-start gap-8 md:gap-12 lg:grid-cols-2 lg:items-center lg:gap-10 xl:gap-12">
            <div className="min-w-0">
              <div className="mb-6 flex flex-col items-center gap-6 sm:mb-8 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#00C6FF] via-[#6C63FF] to-[#FF7A18] opacity-50 blur-lg" />
                  <div className="relative rounded-2xl bg-gradient-to-br from-[#00C6FF] via-[#6C63FF] to-[#0072FF] p-[3px] shadow-xl">
                    <Image
                      src="/app-icon.png"
                      alt=""
                      width={96}
                      height={96}
                      className="rounded-[13px] bg-[#0a1628] object-cover [filter:drop-shadow(0_0_20px_rgba(0,198,255,0.55))_drop-shadow(0_0_28px_rgba(108,99,255,0.35))]"
                      priority
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="mb-6 flex flex-wrap justify-center gap-2 sm:justify-start">
                    {featurePillars.slice(0, 4).map((pillar) => (
                      <span
                        key={pillar}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 shadow-sm backdrop-blur-md sm:text-xs"
                      >
                        {pillar}
                      </span>
                    ))}
                  </div>
                  <h1 className="max-w-4xl break-words text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-6xl">
                    Aynı yöne gidenlerle eşleş, yolculuğu güvenle paylaş.
                  </h1>
                  <p className="mt-5 max-w-full break-words text-sm leading-relaxed text-white/80 sm:mt-6 sm:max-w-xl sm:text-base">
                    Leylek Tag, yolcu ve sürücülerin şehir içi ve şehir dışı yolculuk tekliflerini netleştirip karşılıklı onayla güvenli eşleşmesini sağlar.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex w-full max-w-xl flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-start">
                <div className="flex w-full flex-col sm:w-auto sm:max-w-none">
                  <ButtonLink href="/indir" className="w-full sm:w-auto sm:min-w-[200px]">
                    Uygulamayı İndir
                  </ButtonLink>
                </div>
                <ButtonLink href="/muhabbet" variant="secondary" className="w-full sm:w-auto">
                  Teklif Akışını Keşfet
                </ButtonLink>
                <ButtonLink href="/sehirler-arasi" variant="ghost" className="w-full sm:w-auto">
                  Şehirler Arası İlanları Gör
                </ButtonLink>
              </div>
              <p className="mt-3 max-w-xl text-center text-[11px] leading-relaxed text-white/58 sm:text-left sm:text-xs">
                Ücretsiz • 30 saniyede teklif oluştur • Gerçek zamanlı eşleşme
              </p>
              <p className="mt-4 max-w-xl text-center text-xs leading-relaxed text-white/55 sm:text-left">
                Ücretsiz • Güvenli eşleşme • QR ile kontrollü yolculuk
              </p>
              <HeroTrustStrip />
              <div className="mt-10">
                <TrustBadges />
              </div>
            </div>
            <div className="min-w-0 w-full lg:min-h-0">
              <LiveMapVisual />
            </div>
          </div>
          <HomeLivePulse />
          <div className="mt-8 min-w-0 w-full md:mt-10">
            <HeroEngagement />
          </div>
        </Container>
      </section>

      <ScrollReveal>
        <RoleSelection />
      </ScrollReveal>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
            <div className="mb-8">
              <SectionHeading
                eyebrow="neden leylek tag?"
                title="Yolculuk paylaşımında güven, kontrol ve topluluk aynı yerde."
                description="Leylek Tag, yalnızca bir rota ekranı değil; aynı yöne gidenlerin detayları netleştirerek, doğrulayarak ve şeffaf bilgiyle anlaşabildiği modern bir topluluk deneyimidir."
              />
            </div>
            <ValueProps />
          </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="kimler için?"
              title="Leylek Tag, yolculuk paylaşımını farklı ihtiyaçlar için bir araya getirir."
              description="Günlük şehir içi planlardan şehirler arası boş koltuk paylaşımına kadar, aynı yöne gidenleri topluluk içinde daha kontrollü buluşturur."
            />
          </div>
          <AudienceSection />
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[0.8fr_1fr]">
            <ActivityFeed />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-8">
              {experiences.map((experience) => (
                <ModeCard key={experience.title} {...experience} />
              ))}
            </div>
          </div>
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="neden farklı?"
              title="Klasik yolculuk deneyiminden daha topluluk odaklı."
              description="Leylek Tag hızlı eşleşmeyi, teklif görüşmesiyle karar vermeyi, şehirler arası masraf paylaşımını ve güvenli eşleşme yaklaşımını aynı deneyimde toplar."
            />
          </div>
          <ComparisonSection />
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="uygulama ön izlemesi"
              title="Üç akış, tek premium mobil deneyim."
              description="Gerçek ekran görüntüsü kullanmadan hazırlanan bu cihaz mockup'ları şehir içi, Leylek Teklifi ve şehirler arası ilan deneyimini sade şekilde gösterir."
            />
          </div>
          <AppPreview />
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/85 sm:text-sm">canlı · şehirler arası</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Şehirler Arası Yol Paylaşımı</h2>
            <p className="mt-3 max-w-2xl break-words text-sm leading-relaxed text-white/80 sm:text-base">
              Güncel ilanlar api.leylektag.com üzerinden canlı olarak yüklenir.
            </p>
          </div>
          <IntercityList />
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="beta süreci"
              title="Önce kontrollü test, sonra daha geniş topluluk."
              description="Leylek Tag’i ilk kullanıcılarla birlikte geliştiriyoruz. Geri bildirimler, şehirler ve kullanım senaryoları ürün yönünü belirliyor."
            />
          </div>
          <BetaProcess />
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <SocialProofPlaceholder />
        </Container>
        </ScrollReveal>
      </section>

      <section className="py-10 sm:py-14 md:py-20">
        <ScrollReveal>
          <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="sık sorulan sorular"
              title="Leylek Tag hakkında merak edilenler"
              description="Yolculuk paylaşımı, masraf paylaşımı, Leylek Teklifi ve güvenli eşleşme akışına dair kısa yanıtlar."
            />
          </div>
          <FaqSection />
        </Container>
        </ScrollReveal>
      </section>

      <ScrollReveal>
        <BetaCta />
      </ScrollReveal>
    </>
  );
}
