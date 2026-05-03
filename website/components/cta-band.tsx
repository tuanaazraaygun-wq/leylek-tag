import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

export function CtaBand() {
  return (
    <section className="py-14">
      <Container>
        <div className="glass-panel rounded-[2rem] p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">hazır olduğunda</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
                Aynı yöne gidenlerle güvenli eşleşmeyi keşfet.
              </h2>
              <p className="mt-4 max-w-2xl text-slate-300">
                Leylek Tag, yolculuk paylaşımı fikrini teklif görüşmesi, doğrulama ve topluluk güveniyle bir araya getirir.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ButtonLink href="/indir">Uygulamayı İndir</ButtonLink>
              <ButtonLink href="/sehirler-arasi" variant="secondary">
                İlanları Gör
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
