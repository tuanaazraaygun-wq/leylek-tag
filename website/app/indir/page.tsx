import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { EarlyAccessForm } from "@/components/early-access-form";
import { FeatureCard } from "@/components/feature-card";
import { PageHero } from "@/components/page-hero";
import { StoreButton } from "@/components/store-button";

export const metadata: Metadata = {
  title: "Uygulamayı İndir ve Beta Süreci",
  description:
    "Leylek Tag beta süreci, uygulama indirme hazırlığı ve erken erişim formu. Yolculuk paylaşımı topluluğuna ilk katılanlardan ol.",
};

const downloadNotes = [
  {
    title: "Hızlı Yolculuk",
    description: "Şehir içi rota odaklı güvenli eşleşme deneyimini uygulamada başlat.",
  },
  {
    title: "Leylek Teklifi",
    description: "Şehir dışı teklifleri teklif görüşmesiyle netleştir; karşılıklı onay ve güvenli eşleşmeyi keşfet.",
  },
  {
    title: "Şehirler Arası İlanlar",
    description: "Boş koltuk paylaşımı ve masraf paylaşımı ilanlarını uygulamada görüntüle.",
  },
];

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="indir"
        title="Beta sürecindeyiz. Leylek Tag çok yakında uygulamada."
        description="Web sitesi keşif ve erken erişim alanıdır. Güvenli eşleşme, teklif görüşmesi, doğrulama ve uygulamada gör adımları mobil deneyimde tamamlanacaktır."
        primaryLabel="Erken Erişim Formuna Git"
        primaryHref="#erken-erisim"
      />
      <section className="py-12">
        <Container>
          <div className="glass-panel rounded-[2rem] p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">mobil deneyim</p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-white">Mağaza bağlantıları yayına hazırlanıyor</h2>
                <p className="mt-4 leading-7 text-slate-300">
                  App Store ve Google Play bağlantıları yayına alındığında bu alan doğrudan resmi indirme sayfalarına bağlanacak. Test beta erişimi için erken erişim formunu kullanabilirsin.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <StoreButton eyebrow="yakında" label="App Store" />
                  <StoreButton eyebrow="yakında" label="Google Play" />
                  <ButtonLink href="#erken-erisim" variant="secondary">
                    Test beta için haber ver
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

      <section id="erken-erisim" className="py-12">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">beta süreci</p>
              <h2 className="mt-4 text-3xl font-black leading-tight text-white">İlk kullanıcılar arasında yerini al.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Erken erişim formu şimdilik yalnızca yerel başarı mesajı gösterir. Canlı kayıt bağlantısı launch backend hazır olduğunda eklenecektir.
              </p>
            </div>
            <EarlyAccessForm />
          </div>
        </Container>
      </section>
    </>
  );
}
