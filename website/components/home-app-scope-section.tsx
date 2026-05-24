import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

const WEB_SCOPE = [
  "Ürün ve güvenlik bilgisi",
  "İndirme ve erken erişim",
  "Destek ve yasal kaynaklar",
] as const;

const APP_SCOPE = [
  "Yolculuk teklifi oluşturma",
  "Karşılıklı onay ve eşleşme",
  "QR ile doğrulama",
  "Güven görüşmesi ve koordinasyon",
] as const;

export function HomeAppScopeSection() {
  return (
    <section
      id="web-vitrin"
      className="depth-glass section-seam scroll-mt-28 py-10 sm:py-12 md:py-14"
      aria-labelledby="home-app-scope-heading"
    >
      <Container>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/78">web vitrin · uygulama akışı</p>
        <h2
          id="home-app-scope-heading"
          className="mt-3 max-w-2xl text-[1.35rem] font-bold leading-snug tracking-tight text-white sm:text-[1.5rem] md:text-[1.65rem]"
        >
          Keşif ve güven webde; işlem adımları uygulamada tamamlanır.
        </h2>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-400">
          Leylek TAG web sitesi bilgilendirme, indirme ve destek için tasarlanmıştır. Yolculuk teklifi, eşleşme ve
          doğrulama süreçleri mobil uygulamada yürütülür.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:gap-5">
          <div className="rounded-2xl border border-white/[0.08] bg-black/30 p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Web sitesi</p>
            <p className="mt-2 text-[15px] font-bold text-slate-100">Bilgi ve vitrin</p>
            <ul className="mt-4 space-y-2.5">
              {WEB_SCOPE.map((item) => (
                <li key={item} className="flex gap-2 text-[12px] text-slate-300">
                  <span className="text-cyan-400/80" aria-hidden>
                    ◆
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-2xl border border-cyan-400/28 bg-gradient-to-br from-cyan-500/[0.1] via-slate-950/80 to-violet-600/[0.08] p-5 shadow-[0_0_40px_-20px_rgba(34,211,238,0.35)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/85">Mobil uygulama</p>
            <p className="mt-2 text-[15px] font-bold text-white">Tam operasyonel akış</p>
            <ul className="mt-4 space-y-2.5">
              {APP_SCOPE.map((item) => (
                <li key={item} className="flex gap-2 text-[12px] font-medium text-slate-100">
                  <span className="text-emerald-300/90" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink href="/indir" className="w-full sm:w-auto sm:min-w-[200px]">
            Uygulamayı İndir
          </ButtonLink>
          <ButtonLink href="/nasil-calisir" variant="secondary" className="w-full sm:w-auto sm:min-w-[200px]">
            Nasıl Çalışır
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
