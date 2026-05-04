import { Container } from "@/components/container";

const STEPS: readonly {
  title: string;
  detail: string;
  done: boolean;
  pulse?: boolean;
}[] = [
  { title: "Teklif oluşturuldu", detail: "Rota ve koşullar kayıtta", done: true },
  { title: "Eşleşme bekleniyor", detail: "Karşılıklı onay sürecinde", done: false, pulse: true },
  { title: "QR ile yolculuk başlar", detail: "Biniş doğrulaması aktif", done: false },
];

export function DownloadAppFlowPreview() {
  return (
    <section id="uygulama-akisi" className="scroll-mt-28 py-12 sm:py-16">
      <Container>
        <p className="text-center text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">uygulama içi akış</p>
        <h2 className="mt-3 text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
          Uygulamada böyle ilerlersin
        </h2>
        <div className="mx-auto mt-10 flex justify-center">
          <div className="relative w-full max-w-[340px] rounded-[2.25rem] border border-white/15 bg-slate-950/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="mx-auto mb-5 h-1.5 w-[4.5rem] rounded-full bg-white/25" />
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Leylek Tag</p>
              <p className="mt-2 text-lg font-black text-white">Yolculuk akışı</p>
              <ol className="relative mt-6 space-y-5 border-l border-white/15 pl-6">
                {STEPS.map((step, i) => (
                  <li key={step.title} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black ${
                        step.done
                          ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-100"
                          : step.pulse === true
                            ? "motion-safe:animate-pulse border-cyan-400/60 bg-cyan-400/15 text-cyan-50"
                            : "border-white/20 bg-white/10 text-white/70"
                      }`}
                      aria-hidden
                    >
                      {step.done ? "✓" : i + 1}
                    </span>
                    <p className="font-black text-white">{step.title}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{step.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
            <p className="mt-4 text-center text-[11px] font-semibold text-slate-500">
              Özet görünüm · Gerçek ekranlar uygulamada
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
