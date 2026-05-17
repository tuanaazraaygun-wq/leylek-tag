import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { DownloadAppFlowPreview } from "@/components/download-app-flow-preview";
import { DownloadPageTrust } from "@/components/download-page-trust";
import { DownloadWebAppCompare } from "@/components/download-web-app-compare";
import { EarlyAccessForm } from "@/components/early-access-form";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";
import { StoreButton } from "@/components/store-button";

export const metadata: Metadata = {
  title: "Uygulamayı Aç | Leylek TAG",
  description:
    "Teklif oluşturma, karşılıklı onay ve QR ile yolculuk doğrulaması Leylek TAG uygulamasında tamamlanır. Web’de özet görünüm; süreç için uygulamaya geç.",
};

const downloadNotes = [
  {
    title: "Teklif ve rotalar",
    description: "Uygulamada teklifini oluştur; şehir içi akışta sürdür.",
  },
  {
    title: "Eşleşme ve görüşme",
    description: "Karşılıklı onay ve güvenli teklif görüşmesi adımlarını mobil deneyimde tamamla.",
  },
  {
    title: "QR ile doğrulama",
    description: "Yolculuk başlangıcı ve kontrol adımları QR doğrulamasıyla uygulama içinde yönetilir.",
  },
];

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="uygulama"
        title="Teklif ve eşleşme sürecini uygulamada tamamla"
        description="Karşılıklı onay, güvenli teklif görüşmesi ve QR ile yolculuk doğrulaması Leylek TAG mobil deneyiminde bir araya gelir."
        primaryHref="/indir#indir-magaza"
        primaryLabel="Uygulamayı Aç"
        secondaryHref="/indir#uygulama-akisi"
        secondaryLabel="Uygulama Akışını Gör"
        ctaHint="Web’de bilgilendirici içerik ve özet görünüm; tam akış için uygulamaya geç."
      />

      <section className="border-y border-white/[0.06] bg-white/[0.02] py-10 sm:py-12">
        <Container>
          <DownloadPageTrust />
        </Container>
      </section>

      <DownloadWebAppCompare />

      <DownloadAppFlowPreview />

      <section id="indir-magaza" className="scroll-mt-28 py-12 sm:py-16">
        <Container>
          <div className="glass-panel rounded-[2rem] p-6 sm:p-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-start">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">indirme</p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
                  Mağaza bağlantıları yayına bağlanma sürecinde
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Google Play için erken erişim ve açık test süreçleri değerlendirilirken, App Store yayını hazırlık sürecindedir. Bağlantılar hazır olduğunda tek dokunuşla resmi sayfaya yönlendireceğiz; güncel haber için erken erişim formunu kullanabilirsin.
                </p>
                <p className="mt-4 text-sm font-semibold text-emerald-200/90">
                  Beta sürecine dahil olarak geri bildirimle ürünün şekillenmesine katkı verebilirsin.
                </p>
                <div className="mt-8 flex w-full max-w-md flex-col gap-4">
                  <StoreButton eyebrow="hazırlık sürecinde" label="App Store" />
                  <StoreButton eyebrow="erken erişim / açık test" label="Google Play" />
                </div>
                <div className="mt-6">
                  <ButtonLink href="#erken-erisim" variant="secondary" className="w-full sm:w-auto sm:min-w-[240px]">
                    Beta için haber ver
                  </ButtonLink>
                </div>
              </div>
              <div className="grid gap-4">
                {downloadNotes.map((note) => (
                  <FeatureCard key={note.title} {...note} eyebrow="uygulama" />
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
