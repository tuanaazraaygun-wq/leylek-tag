import { ActivityFeed } from "@/components/activity-feed";
import { AppPreview } from "@/components/app-preview";
import { AudienceSection } from "@/components/audience-section";
import { BetaCta } from "@/components/beta-cta";
import { BetaProcess } from "@/components/beta-process";
import { ButtonLink } from "@/components/button-link";
import { ComparisonSection } from "@/components/comparison-section";
import { Container } from "@/components/container";
import { FaqSection } from "@/components/faq-section";
import { ListingCard } from "@/components/listing-card";
import { LiveMapVisual } from "@/components/live-map-visual";
import { ModeCard } from "@/components/mode-card";
import { SectionHeading } from "@/components/section-heading";
import { SocialProofPlaceholder } from "@/components/social-proof-placeholder";
import { TrustBadges } from "@/components/trust-badges";
import { ValueProps } from "@/components/value-props";
import { getIntercityListings } from "@/lib/listings";
import { featurePillars } from "@/lib/mock-data";

const experiences = [
  {
    title: "Hızlı Yolculuk",
    eyebrow: "şehir içi",
    description:
      "Rota görünürlüğü, QR doğrulama ve Güven Al adımlarıyla şehir içinde kontrollü güvenli eşleşme.",
    tone: "cyan" as const,
  },
  {
    title: "Leylek Muhabbeti",
    eyebrow: "önce konuş",
    description:
      "Sohbet tabanlı tanışma, Leylek Anahtar ve sosyal güven katmanı ile yolculuk paylaşmadan önce anlaş.",
    tone: "violet" as const,
  },
  {
    title: "Şehirler Arası",
    eyebrow: "boş koltuk paylaşımı",
    description:
      "Aynı yöne gidenler için tarih, saat, boş koltuk ve tahmini masraf paylaşımı bilgisiyle ilan deneyimi.",
    tone: "blue" as const,
  },
];

export default function Home() {
  const listings = getIntercityListings();

  return (
    <>
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="absolute inset-0 -z-10 bg-radial-glow opacity-90" />
        <div className="subtle-grid absolute inset-x-0 top-0 -z-10 h-96 opacity-35" />
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="mb-6 flex flex-wrap gap-2">
                {featurePillars.slice(0, 4).map((pillar) => (
                  <span
                    key={pillar}
                    className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                  >
                    {pillar}
                  </span>
                ))}
              </div>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
                Yolculuk artık sadece gitmek değil.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                İstersen hemen eşleş, istersen konuşarak güvenle yolculuk paylaş. Leylek Tag, aynı yöne gidenleri daha net, güvenli ve kontrollü bir deneyimde buluşturur.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/indir">Uygulamayı İndir</ButtonLink>
                <ButtonLink href="/sehirler-arasi" variant="secondary">
                  Şehirler Arası İlanları Gör
                </ButtonLink>
                <ButtonLink href="/muhabbet" variant="ghost">
                  Leylek Muhabbeti Keşfet
                </ButtonLink>
              </div>
              <div className="mt-8">
                <TrustBadges />
              </div>
            </div>
            <LiveMapVisual />
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="neden leylek tag?"
              title="Yolculuk paylaşımında güven, kontrol ve topluluk aynı yerde."
              description="Leylek Tag, yalnızca bir rota ekranı değil; aynı yöne gidenlerin konuşarak, doğrulayarak ve net bilgilerle anlaşabildiği modern bir topluluk deneyimidir."
            />
          </div>
          <ValueProps />
        </Container>
      </section>

      <section className="py-14">
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
      </section>

      <section className="py-14">
        <Container>
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1fr]">
            <ActivityFeed />
            <div className="grid gap-5 sm:grid-cols-3">
              {experiences.map((experience) => (
                <ModeCard key={experience.title} {...experience} />
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="neden farklı?"
              title="Klasik yolculuk deneyiminden daha topluluk odaklı."
              description="Leylek Tag hızlı eşleşmeyi, sohbet ederek karar vermeyi, şehirler arası masraf paylaşımını ve güvenli eşleşme yaklaşımını aynı deneyimde toplar."
            />
          </div>
          <ComparisonSection />
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="uygulama ön izlemesi"
              title="Üç akış, tek premium mobil deneyim."
              description="Gerçek ekran görüntüsü kullanmadan hazırlanan bu cihaz mockup'ları şehir içi, Leylek Muhabbeti ve şehirler arası ilan deneyimini sade şekilde gösterir."
            />
          </div>
          <AppPreview />
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="şehirler arası"
              title="Şehirler arası yolculuklarda boş koltuklar değerlenir."
              description="Gideceğin rotayı, saati ve boş koltuk sayısını paylaş. Aynı yöne gidenlerle masrafı böl."
            />
            <ButtonLink href="/sehirler-arasi" variant="secondary">
              Tümünü Gör
            </ButtonLink>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          <p className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 text-sm leading-6 text-slate-300">
            İlanlar örnek gösterimdir. Canlı bağlantı için uygulama kullanılacaktır.
          </p>
        </Container>
      </section>

      <section className="py-14">
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
      </section>

      <section className="py-14">
        <Container>
          <SocialProofPlaceholder />
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <div className="mb-8">
            <SectionHeading
              eyebrow="sık sorulan sorular"
              title="Leylek Tag hakkında merak edilenler"
              description="Yolculuk paylaşımı, masraf paylaşımı, Leylek Muhabbeti ve güvenli eşleşme akışına dair kısa yanıtlar."
            />
          </div>
          <FaqSection />
        </Container>
      </section>

      <BetaCta />
    </>
  );
}
