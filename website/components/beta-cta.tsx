import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { DOWNLOAD_PAGE_URL } from "@/lib/store-links";

export function BetaCta() {
  return (
    <section className="py-10 sm:py-14 md:py-20">
      <Container>
        <div className="glass-card relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#00C6FF]/22 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-gradient-to-br from-[#43E97B]/18 to-transparent blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/90">Hazır mısın?</p>
              <h2 className="mt-3 text-[1.45rem] font-bold leading-snug tracking-tight text-white sm:text-[1.75rem] md:text-[2rem]">
                Kontrollü eşleşme platformuna katıl.
              </h2>
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-slate-300 sm:text-sm">
                Şehir içi yolculuk paylaşımını deneyimlemek için uygulamayı indir; süreç ve güven katmanlarını
                incelemek için rehber sayfalarına göz at.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">
              <ButtonLink href={DOWNLOAD_PAGE_URL} className="w-full sm:w-auto">
                Uygulamayı İndir
              </ButtonLink>
              <ButtonLink href="/nasil-calisir" variant="secondary" className="w-full sm:w-auto">
                Nasıl Çalışır
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
