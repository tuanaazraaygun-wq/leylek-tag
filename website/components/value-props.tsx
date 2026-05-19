/** Premium güven katmanları — aydınlık kurumsal panel + 2×2 grid (logic yok, yalnız sunum). */

function VerifiedLinkGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="vp-route-glow" x1="0" y1="60" x2="320" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" stopOpacity={0} />
          <stop offset="0.38" stopColor="#67e8f9" stopOpacity={0.55} />
          <stop offset="0.52" stopColor="#22d3ee" stopOpacity={0.5} />
          <stop offset="0.62" stopColor="#3b82f6" stopOpacity={0.38} />
          <stop offset="1" stopColor="#38bdf8" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="vp-shield-fill" x1="160" y1="36" x2="162" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e3a5f" stopOpacity={0.95} />
          <stop offset="1" stopColor="#0f2744" stopOpacity={0.98} />
        </linearGradient>
      </defs>
      <path
        d="M36 78 C 104 78, 118 44, 160 56 C 202 68, 216 96, 284 96"
        stroke="url(#vp-route-glow)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity={0.48}
      />
      <path
        d="M36 78 C 104 78, 116 48, 160 56 C 204 64, 218 96, 284 96"
        stroke="#a5f3fc"
        strokeOpacity={0.38}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={36} cy={78} r={7.5} fill="#132337" stroke="#7dd3fc" strokeOpacity={0.7} strokeWidth={1.4} />
      <circle cx={284} cy={96} r={7.5} fill="#132337" stroke="#7dd3fc" strokeOpacity={0.7} strokeWidth={1.4} />
      <circle cx={36} cy={78} r={3.25} fill="#e0f2fe" fillOpacity={0.65} />
      <circle cx={284} cy={96} r={3.25} fill="#e0f2fe" fillOpacity={0.65} />
      <circle cx={160} cy={56} r={5} fill="#164e63" stroke="#67e8f9" strokeOpacity={0.55} strokeWidth={1.2} />
      <circle cx={160} cy={56} r={2} fill="#bae6fd" fillOpacity={0.75} />

      <path
        d="M159 41h8a9 9 0 0 1 9 9v9a11 11 0 0 1-11 11h-13a11 11 0 0 1-11-11V61a17 17 0 1 1 16-17.98Z"
        fill="url(#vp-shield-fill)"
        stroke="#7dd3fc"
        strokeOpacity={0.55}
        strokeWidth={1.25}
      />
      <path
        d="M156.5 65.5 161.5 71.5 172.5 56"
        stroke="#e0f2fe"
        strokeOpacity={0.95}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={161} cy={64} r={10} fill="none" stroke="#38bdf8" strokeOpacity={0.15} strokeWidth={1} />
    </svg>
  );
}

function HudBaseline({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-full ${className}`} viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden>
      <path d="M0 22h400" stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      <path
        d="M12 19h52l22-14h118l38 14h154"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.14}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphQr({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M5 5h7v7H5V5Zm7 14h7v7h-7v-7Z" opacity={0.95} />
      <path strokeLinecap="round" d="M19 6v12M6 19h6" opacity={0.35} strokeDasharray="1.75 3" />
    </svg>
  );
}

function GlyphRoute({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M4 18h9M4 12h13M4 6h17" opacity={0.35} />
      <circle cx={17} cy={6} r={2.75} opacity={0.85} strokeLinecap="round" />
      <circle cx={10} cy={12} r={2.75} opacity={0.78} strokeLinecap="round" />
      <circle cx={13} cy={18} r={2.75} opacity={0.78} strokeLinecap="round" />
    </svg>
  );
}

function GlyphComms({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 17.75v-11A2 2 0 0 1 8.75 4.75h12.25l-3 3H8.75a1 1 0 0 0-1 1v9"
        opacity={0.88}
      />
      <path strokeLinecap="round" d="M9.75 14.75h11.5a2 2 0 0 0 2-2v-9.5" opacity={0.35} />
    </svg>
  );
}

function GlyphMinData({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} aria-hidden>
      <path strokeLinecap="round" d="M8 8h8v8H8z" opacity={0.32} />
      <path strokeLinecap="round" d="M10.25 10.25h3.5v3.5h-3.5z" opacity={0.9} />
    </svg>
  );
}

type LayerAccent = "cyan" | "amber" | "violet" | "blue";

const accentIconWell: Record<LayerAccent, string> = {
  cyan:
    "border-sky-400/35 bg-gradient-to-br from-sky-500/18 to-blue-950/35 text-sky-100 ring-1 ring-sky-400/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  amber:
    "border-amber-300/28 bg-gradient-to-br from-amber-500/12 via-cyan-500/10 to-slate-900/35 text-amber-50 ring-1 ring-cyan-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
  violet:
    "border-violet-400/30 bg-gradient-to-br from-cyan-500/12 via-violet-500/14 to-indigo-950/40 text-violet-100 ring-1 ring-violet-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
  blue:
    "border-slate-400/28 bg-gradient-to-br from-sky-500/12 to-slate-800/55 text-slate-100 ring-1 ring-slate-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]",
};

const layerCards = [
  {
    Icon: GlyphRoute,
    title: "Rota ve teklif",
    body: "Rota ve teklif iki tarafta aynı şekilde görünür.",
    accent: "cyan" as const,
  },
  {
    Icon: GlyphQr,
    title: "QR doğrulama",
    body: "QR adımları başlangıç ve bitişi doğrular.",
    accent: "amber" as const,
  },
  {
    Icon: GlyphComms,
    title: "Güven katmanı",
    body: "Güven katmanı durumları görünür tutar.",
    accent: "violet" as const,
  },
  {
    Icon: GlyphMinData,
    title: "Minimum veri",
    body: "Gereksiz kişisel veri paylaşımı azaltılır.",
    accent: "blue" as const,
  },
] as const;

const layerCardShell =
  "group relative flex h-full min-h-[10.75rem] min-w-0 flex-col overflow-hidden rounded-[1.2rem] border border-white/[0.11] bg-gradient-to-br from-[#152743]/92 via-[#101b32]/88 to-[#0c1528]/93 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(15,118,209,0.06),0_20px_50px_-36px_rgba(56,189,248,0.35)] ring-1 ring-cyan-400/[0.07] backdrop-blur-[18px] transition-[border-color,box-shadow] duration-300 ease-out hover:border-sky-300/22 hover:shadow-[0_24px_56px_-32px_rgba(56,189,248,0.28)] md:rounded-[1.26rem]";

export function ValueProps() {
  return (
    <div className="relative isolate mx-auto w-full max-w-[min(100%,92rem)] space-y-6 md:space-y-8 lg:space-y-10">
      <div className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 overflow-visible sm:-inset-x-12 lg:-inset-x-16" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[22rem] w-[min(120%,72rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(56,189,248,0.12)_0%,rgba(59,130,246,0.06)_38%,transparent_68%)]" />
        <div className="absolute bottom-[-4rem] right-[-2rem] h-[18rem] w-[clamp(14rem,40vw,26rem)] bg-[radial-gradient(ellipse_at_80%_100%,rgba(99,102,241,0.1)_0%,transparent_62%)]" />
        <div className="absolute left-[8%] top-1/2 h-[1px] w-[84%] -translate-y-8 bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.12)_20%,rgba(148,163,184,0.12)_80%,transparent)]" />
      </div>

      <article className="group relative w-full overflow-hidden rounded-[1.45rem] border border-white/[0.14] bg-gradient-to-br from-[#142a4d]/95 via-[#102040]/93 to-[#0a1629]/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(56,189,248,0.06),0_28px_64px_-40px_rgba(34,211,238,0.45),0_12px_40px_-28px_rgba(59,130,246,0.25)] ring-1 ring-sky-400/[0.12] backdrop-blur-[26px] transition-[border-color,box-shadow] duration-300 ease-out md:rounded-[1.6rem] lg:rounded-[1.72rem] hover:border-sky-200/20 hover:shadow-[0_32px_70px_-36px_rgba(34,211,238,0.35)]">
        <span
          className="pointer-events-none absolute inset-px rounded-[1.435rem] bg-[linear-gradient(125deg,rgba(255,255,255,0.08)_0%,transparent_35%,transparent_62%,rgba(56,189,248,0.07)_100%)] opacity-[0.85] md:rounded-[1.585rem]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-px rounded-[1.435rem] shadow-[inset_0_0_48px_-12px_rgba(56,189,248,0.08)] md:rounded-[1.585rem]"
          aria-hidden
        />

        <div className="relative flex flex-col gap-8 px-7 py-8 sm:px-9 sm:py-10 lg:flex-row lg:items-center lg:gap-12 lg:px-11 lg:py-11 xl:gap-14">
          <div className="flex min-w-0 flex-1 flex-col gap-6 lg:max-w-[52%]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/35 bg-sky-400/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-200 shadow-[0_0_12px_rgba(125,211,252,0.55)]" aria-hidden />
                doğrulanmış bağlantı
              </span>
              <span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300/95">
                ana güven katmanı
              </span>
            </div>

            <div>
              <h3 className="text-[clamp(1.45rem,2.8vw,2rem)] font-semibold leading-[1.2] tracking-[-0.02em] text-white">
                Doğrulanmış kontrollü eşleşme
              </h3>
              <p className="mt-3 max-w-xl text-[15px] leading-[1.72] text-slate-300/95">
                Aynı çerçevede hizalı bilgi, rota ve teklif şeffaflığı; güven katmanları başlamadan netleşir.
              </p>
            </div>

            <div className="hidden lg:block">
              <HudBaseline className="h-8 text-slate-400/80" />
            </div>
          </div>

          <div className="relative flex min-w-0 flex-1 flex-col justify-center lg:max-w-[48%]">
            <span
              className="pointer-events-none absolute -right-6 top-1/2 h-[11rem] w-[11rem] -translate-y-1/2 rounded-full bg-cyan-400/[0.09] blur-3xl lg:-right-4"
              aria-hidden
            />
            <VerifiedLinkGraphic className="relative z-[1] mx-auto w-full max-w-md object-contain sm:max-w-lg" />
            <div className="mt-5 lg:mt-6">
              <HudBaseline className="h-8 text-slate-400/80 lg:hidden" />
            </div>
          </div>
        </div>
      </article>

      <div>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200/80 md:mb-5">güven katmanları</p>
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-5 md:gap-6 lg:gap-7 [grid-auto-rows:1fr]">
          {layerCards.map(({ Icon, title, body, accent }) => (
            <li key={title} className="flex min-h-0 min-w-0">
              <article className={layerCardShell}>
                <span
                  className="pointer-events-none absolute inset-px rounded-[1.16rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.06)_0%,transparent_42%,rgba(56,189,248,0.05)_100%)] opacity-95 md:rounded-[1.22rem]"
                  aria-hidden
                />
                <div className="relative flex h-full flex-col p-6 sm:p-7">
                  <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.95rem] ${accentIconWell[accent]}`}
                      aria-hidden
                    >
                      <Icon className="h-[1.35rem] w-[1.35rem]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-medium leading-snug tracking-tight text-white">{title}</h4>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300/92">{body}</p>
                    </div>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
