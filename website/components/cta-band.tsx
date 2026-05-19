import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

export function CtaBand() {
  return (
    <section className="py-14">
      <Container>
        <div className="glass-panel relative overflow-hidden rounded-[2rem] border border-cyan-400/[0.14] p-8 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.08),0_28px_80px_-44px_rgba(0,198,255,0.42)] ring-1 ring-cyan-400/[0.08] sm:p-10">
          <span
            className="pointer-events-none absolute inset-px rounded-[calc(2rem-1px)] bg-[linear-gradient(135deg,rgba(34,211,238,0.09)_0%,transparent_45%,rgba(99,102,241,0.06)_100%)] opacity-[0.95]"
            aria-hidden
          />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/82">yüklenmeye hazır</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
                Aynı yöne gidenlerle güvenli eşleşmeyi keşfet.
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-[1.75] text-slate-300/95">
                Leylek TAG; karşılıklı teklif ve onay, QR ile doğrulama ve güven katmanlarıyla yolculuk paylaşımını tek akışta
                toplar.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ButtonLink href="/indir">Uygulamayı indir</ButtonLink>
              <ButtonLink href="/nasil-calisir" variant="secondary">
                Nasıl çalışır?
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
