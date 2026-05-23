import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";
import { phaseStyles, TRUST_SAFETY_PROTOCOL_STEPS } from "@/lib/trust-safety-protocol";

function ProtocolStepNode({ order, phase }: { order: number; phase: keyof typeof phaseStyles }) {
  const styles = phaseStyles[phase];

  return (
    <span
      className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-black tabular-nums ${styles.node}`}
    >
      {String(order).padStart(2, "0")}
    </span>
  );
}

function ProtocolStepRow({
  step,
  isLast,
}: {
  step: (typeof TRUST_SAFETY_PROTOCOL_STEPS)[number];
  isLast: boolean;
}) {
  const styles = phaseStyles[step.phase];
  const isSupport = step.phase === "support";

  return (
    <li className="relative flex gap-4 sm:gap-5">
      <div className="flex flex-col items-center">
        <ProtocolStepNode order={step.order} phase={step.phase} />
        {!isLast ? (
          <span
            className={`mt-1 w-px flex-1 min-h-[2.5rem] bg-gradient-to-b ${styles.connector} to-transparent`}
            aria-hidden
          />
        ) : null}
      </div>

      <article
        className={`mb-5 min-w-0 flex-1 rounded-2xl border px-4 py-3.5 sm:mb-6 sm:px-5 sm:py-4 ${
          isSupport
            ? "border-violet-400/14 bg-gradient-to-br from-violet-500/[0.05] to-slate-950/50"
            : "border-white/[0.07] bg-slate-950/35"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-100 sm:text-base">{step.title}</h3>
          <span
            className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.11em] ring-1 ring-inset ${styles.badge}`}
          >
            {step.statusLabel}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{step.description}</p>
        {step.supportPoints?.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {step.supportPoints.map((point) => (
              <li
                key={point}
                className="rounded-md border border-white/[0.06] bg-black/25 px-2 py-1 text-[10px] font-medium text-slate-300"
              >
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </li>
  );
}

export function HomeTrustSafetyProtocol() {
  return (
    <section
      className="depth-well section-seam scroll-mt-28 py-10 sm:py-12 md:py-14"
      aria-labelledby="trust-safety-protocol-heading"
    >
      <Container>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-12">
          <div className="lg:sticky lg:top-24">
            <SectionHeading
              eyebrow="güven protokolü"
              title="Kontrollü güven protokolü"
              description="Eşleşme, iletişim ve doğrulama adımları sıralı bir protokol olarak işler. Her adım tamamlanmadan süreç kontrolsüz ilerlemez."
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                6 adımlı akış
              </span>
              <span className="rounded-md border border-emerald-400/16 bg-emerald-400/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-100/85">
                Kontrollü eşleşme
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-slate-500">
              Uber Safety ve fintech uyumluluk panellerindeki gibi: sistematik, şeffaf ve adım adım izlenebilir bir
              güven çerçevesi.
            </p>
          </div>

          <div className="glass-panel relative overflow-hidden rounded-[1.35rem] p-4 sm:rounded-[1.5rem] sm:p-5 md:p-6">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/[0.06] blur-3xl"
              aria-hidden
            />
            <div className="relative border-b border-white/[0.06] pb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">protokol akışı</p>
              <p id="trust-safety-protocol-heading" className="mt-1 text-sm font-semibold text-white">
                Neden güvenli?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Kimlik → iletişim → doğrulama → destek katmanı
              </p>
            </div>

            <ol className="relative mt-4 list-none">
              {TRUST_SAFETY_PROTOCOL_STEPS.map((step, index) => (
                <ProtocolStepRow
                  key={step.id}
                  step={step}
                  isLast={index === TRUST_SAFETY_PROTOCOL_STEPS.length - 1}
                />
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}
