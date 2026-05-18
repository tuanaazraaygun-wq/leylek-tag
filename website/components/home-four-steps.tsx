"use client";

import { Container } from "@/components/container";

const STEPS = [
  {
    title: "Teklif oluştur",
    blurb: "Rolünü seç, rotayı yaz.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
    ),
  },
  {
    title: "Detayları netleştir",
    blurb: "Zaman, koltuk, masraf net.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path d="M4 6h16M4 12h10M4 18h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Onayla eşleş",
    blurb: "Karşılıklı onayla güvence.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path d="M7 12l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
    ),
  },
  {
    title: "Yola çık",
    blurb: "QR ile doğrula; süreci başlat.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path
          d="M5 17l4-8 4 5 4-9 2 12H5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

export function HomeFourSteps() {
  return (
    <section
      id="nasil-calisir-flow"
      className="section-seam depth-glass scroll-mt-28 py-11 sm:py-14 md:py-[4.85rem]"
      aria-labelledby="home-four-steps-heading"
    >
      <Container>
        <div className="mx-auto max-w-3xl px-3 text-center sm:px-0">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200/72">hızlı bakış</p>
          <h2
            id="home-four-steps-heading"
            className="mt-4 text-[1.675rem] font-black tracking-tight text-white sm:text-3xl md:text-[2.125rem]"
          >
            Sadece 4 adımda eşleş
          </h2>
          <p className="mx-auto mt-3.5 max-w-lg text-sm leading-relaxed text-slate-300/92 sm:text-base">
            Karmaşık süreç yok — tekliften yola çıkmaya kadar net bir çerçeve.
          </p>
        </div>

        <div className="home-four-steps-track relative mx-auto mt-12 max-w-6xl md:mt-14">
          <span className="home-four-steps-connector absolute left-[8%] right-[8%] top-[2.875rem] z-0 hidden h-px lg:left-[7%] lg:right-[7%] lg:block" aria-hidden />

          <div className="relative z-[1] grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 xl:gap-7">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                style={{
                  animationDelay: `${96 + i * 88}ms`,
                }}
                className={`home-step-card group relative animate-fade-in-up opacity-0 motion-reduce:animate-none motion-reduce:opacity-100`}
              >
                <div className="vitrin-card relative overflow-hidden rounded-[1.15rem] border border-white/[0.068] bg-white/[0.045] px-6 py-[1.375rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-md transition-[transform,border-color,box-shadow] duration-[460ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] will-change-transform [transform-style:preserve-3d] motion-reduce:!transform-none sm:min-h-[8.375rem] sm:py-7 lg:rounded-[1.25rem]">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-[6.65rem] w-[6.65rem] rounded-full bg-cyan-400/[0.07] blur-3xl transition-opacity duration-500 group-hover:bg-cyan-400/[0.11]" />

                  <div className="relative flex items-start gap-4 lg:flex-col lg:gap-5">
                    <div className="home-step-icon flex h-[3.15rem] w-[3.15rem] shrink-0 items-center justify-center rounded-2xl border border-cyan-400/[0.18] bg-gradient-to-br from-cyan-400/[0.12] via-white/[0.04] to-violet-500/[0.08] text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm transition-[transform,border-color] duration-450 group-hover:-translate-y-0.5 group-hover:border-cyan-300/[0.32] lg:h-[3.375rem] lg:w-[3.375rem]">
                      {step.icon}
                    </div>
                    <div className="min-w-0 text-left lg:pb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Adım {i + 1}</p>
                      <h3 className="mt-1 text-lg font-black leading-snug tracking-tight text-white sm:text-[1.15rem]">{step.title}</h3>
                      <p className="mt-2 text-[13px] leading-snug text-slate-400/82 sm:text-[0.9175rem]">{step.blurb}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
