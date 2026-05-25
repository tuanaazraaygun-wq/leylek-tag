import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { DownloadAppFlowPreview } from "@/components/download-app-flow-preview";
import { DownloadPageTrust } from "@/components/download-page-trust";
import { DownloadWebAppCompare } from "@/components/download-web-app-compare";
import { EarlyAccessForm } from "@/components/early-access-form";
import { PlayStoreScreenshotStrip } from "@/components/play-store-screenshot-strip";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";
import { StoreButton } from "@/components/store-button";

export const metadata: Metadata = {
  title: "Leylek TAG'i İndir | Yolculuk Paylaşımı",
  description:
    "Yolculuk paylaşımını şehirde dene. Teklif, eşleşme ve doğrulama adımları Leylek TAG mobil uygulamasında tamamlanır.",
};

const benefitCards = [
  {
    eyebrow: "yolcu için",
    title: "Rotanı paylaş, teklifleri gör",
    description:
      "Gideceğin rotayı uygulamada aç; uygun tekliflerle masraf paylaşımını karşılıklı görüşerek netleştir. Platform ticari taşımacılık hizmeti sunmaz.",
  },
  {
    eyebrow: "sürücü için",
    title: "Boş koltuğunu paylaş",
    description:
      "Planladığın rota üzerinde boş koltuğunu aynı yöne giden yolcularla paylaş; teklif ve karşılıklı onayla eşleş. Gelir taahhüdü veya profesyonel taşımacılık iddiası yoktur.",
  },
  {
    eyebrow: "güvenlik",
    title: "Güvenlik ve doğrulama",
    description:
      "Karşılıklı onay, QR ile yolculuk doğrulaması ve topluluk kurallarıyla kontrollü eşleşme akışı. Uygunluk kullanıcı sorumluluğundadır.",
  },
] as const;

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="indir"
        title="Leylek TAG'i indir"
        description="Yolculuk paylaşımını şehirde dene. Şehrinde yolculuk paylaşımı için uygulamayı indir."
        primaryHref="/indir#indir-magaza"
        primaryLabel="Uygulamayı indir"
        secondaryHref="/indir#uygulama-akisi"
        secondaryLabel="Uygulama akışını gör"
        ctaHint="Teklif, eşleşme ve doğrulama adımları mobil uygulamada tamamlanır."
      />

      <section className="border-y border-white/[0.06] bg-white/[0.02] py-10 sm:py-12">
        <Container>
          <DownloadPageTrust />
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container>
          <div className="glass-panel rounded-2xl border border-white/[0.08] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">uyum ve süreç</p>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
              <p>Leylek TAG yolculuk paylaşımı ve masraf paylaşımı deneyimi sunar.</p>
              <p>Uygulama içi işlemler, doğrulama ve teklif süreçleri mobil uygulamada tamamlanır.</p>
              <p>Uygunluk ve kurallar kullanıcı sorumluluğundadır.</p>
            </div>
          </div>
        </Container>
      </section>

      <PlayStoreScreenshotStrip />

      <DownloadWebAppCompare />

      <DownloadAppFlowPreview />

      <section id="indir-magaza" className="scroll-mt-28 py-12 sm:py-16">
        <Container>
          <div className="glass-panel rounded-[2rem] p-6 sm:p-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-start">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">indirme</p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
                  Resmi mağaza bağlantıları
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Google Play için erken erişim ve açık test süreçleri değerlendirilirken App Store yayını hazırlık
                  aşamasındadır. Bağlantılar hazır olduğunda buradan resmi sayfaya yönlendirileceksin; güncel haber
                  için erken erişim formunu kullanabilirsin.
                </p>
                <p className="mt-4 text-sm font-semibold text-emerald-200/90">
                  Beta sürecine dahil olarak geri bildirimle ürünün şekillenmesine katkı verebilirsin.
                </p>
                <div className="mt-8 flex w-full max-w-md flex-col gap-4">
                  <StoreButton eyebrow="iOS yakında" label="App Store" />
                  <StoreButton eyebrow="erken erişim / açık test" label="Google Play" />
                </div>
                <div className="mt-6">
                  <ButtonLink href="#erken-erisim" variant="secondary" className="w-full sm:w-auto sm:min-w-[240px]">
                    Beta için haber ver
                  </ButtonLink>
                </div>
              </div>
              <div className="grid gap-4">
                {benefitCards.map((card) => (
                  <FeatureCard key={card.title} {...card} />
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="erken-erisim" className="scroll-mt-28 py-12 sm:py-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">erken erişim</p>
              <h2 className="mt-4 text-3xl font-black leading-tight text-white">Uygulama açıldığında haber verelim.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Form gönderildiğinde yerel olarak onay görürsün; yayına yaklaştıkça seni bilgilendiririz.
              </p>
            </div>
            <EarlyAccessForm />
          </div>
        </Container>
      </section>
    </>
  );
}
