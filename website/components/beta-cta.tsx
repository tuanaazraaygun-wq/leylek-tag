import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

export function BetaCta() {
  return (
    <section className="py-14">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-gradient-to-br from-cyan-300/18 via-white/[0.06] to-blue-500/14 p-8 shadow-soft-card sm:p-10">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/80">erken erişim</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.025em] text-white sm:text-5xl">
                İlk kullanıcılar arasında yerini al.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                Leylek Tag topluluğu büyürken şehir içi, Leylek Muhabbeti ve şehirler arası yolculuk paylaşımı akışlarını ilk deneyenlerden ol.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ButtonLink href="/indir#erken-erisim">Beta’ya Katıl</ButtonLink>
              <ButtonLink href="/indir" variant="secondary">
                Uygulamayı İndir
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
