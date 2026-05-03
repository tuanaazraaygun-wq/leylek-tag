"use client";

import { Container } from "@/components/container";

const STEPS = [
  {
    title: "Teklif oluştur",
    blurb: "Rolünü seç, rotanı yaz.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
    ),
  },
  {
    title: "Detayları netleştir",
    blurb: "Zaman, koltuk, masraf net.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path
          d="M4 6h16M4 12h10M4 18h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Onayla eşleş",
    blurb: "Karşılıklı onayla güvence.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
        <path
          d="M7 12l3 3 7-7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
    ),
  },
  {
    title: "Yola çık",
    blurb: "QR ile doğrula, başla.",
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
      className="relative scroll-mt-28 py-10 sm:py-14 md:py-20"
      aria-labelledby="home-four-steps-heading"
    >
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200/75">hızlı bakış</p>
          <h2
            id="home-four-steps-heading"
            className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl"
          >
            Sadece 4 adımda eşleş
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
            Karmaşık süreç yok — tekliften yola çıkmaya kadar net bir akış.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              style={{ animationDelay: `${80 + i * 95}ms` }}
              className="home-step-card group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] opacity-0 animate-fade-in-up motion-reduce:animate-none motion-reduce:opacity-100"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/25 to-violet-500/15 text-cyan-100 shadow-inner transition-transform duration-300 group-hover:scale-105">
                  {step.icon}
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Adım {i + 1}</p>
                  <h3 className="mt-1 text-lg font-black leading-tight text-white">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-white/70">{step.blurb}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
