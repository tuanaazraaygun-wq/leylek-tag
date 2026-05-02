import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

export function BetaCta() {
  return (
    <section className="py-10 sm:py-14 md:py-20">
      <Container>
        <div className="glass-card relative overflow-hidden rounded-[2rem] p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#00C6FF]/22 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-gradient-to-br from-[#43E97B]/18 to-transparent blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/90 sm:text-sm">erken erişim</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.025em] text-white sm:text-5xl">
                İlk kullanıcılar arasında yerini al.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80">
                Leylek Tag topluluğu büyürken şehir içi, Leylek Muhabbeti ve şehirler arası yolculuk paylaşımı akışlarını ilk deneyenlerden ol.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:w-full lg:flex-col">
              <ButtonLink href="/indir#erken-erisim" className="w-full sm:w-auto">
                Beta’ya Katıl
              </ButtonLink>
              <ButtonLink href="/indir" variant="secondary" className="w-full sm:w-auto">
                Uygulamayı İndir
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
