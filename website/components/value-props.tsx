/** Premium güven katmanları — üst geniş ana kart + altta simetrik 2×2 grid (logic yok, yalnız sunum). */

function VerifiedLinkGraphic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="vp-route-glow" x1="0" y1="56" x2="320" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" stopOpacity={0} />
          <stop offset="0.42" stopColor="#38bdf8" stopOpacity={0.45} />
          <stop offset="0.58" stopColor="#0ea5e9" stopOpacity={0.38} />
          <stop offset="1" stopColor="#38bdf8" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d="M40 74 C 108 74, 120 42, 160 54 C 200 66, 212 92, 280 92"
        stroke="url(#vp-route-glow)"
        strokeWidth="14"
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M40 74 C 108 74, 118 46, 160 54 C 202 62, 214 92, 280 92"
        stroke="#67e8f9"
        strokeOpacity={0.28}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={40} cy={74} r={7} fill="#0c1220" stroke="#7dd3fc" strokeOpacity={0.55} strokeWidth={1.35} />
      <circle cx={280} cy={92} r={7} fill="#0c1220" stroke="#7dd3fc" strokeOpacity={0.55} strokeWidth={1.35} />
      <circle cx={40} cy={74} r={2.75} fill="#a5f3fc" fillOpacity={0.55} />
      <circle cx={280} cy={92} r={2.75} fill="#a5f3fc" fillOpacity={0.55} />
      <path
        d="M157 48h7a8 8 0 0 1 8 8v7.5a9 9 0 0 1-9 9h-12a9 9 0 0 1-9-9V62a14 14 0 1 1 13-13.95Z"
        fill="#08121f"
        stroke="#67e8f9"
        strokeOpacity={0.42}
        strokeWidth={1.15}
      />
      <path
        d="M156 61.75 160.85 67 169.85 54.5"
        stroke="#a5f3fc"
        strokeOpacity={0.88}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HudBaseline({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-full ${className}`} viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden>
      <path d="M0 20h400" stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
      <path
        d="M12 17h52l22-13h118l38 13h154"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
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
  cyan: "border-cyan-400/24 bg-[#0c1524]/94 text-cyan-200/90 ring-1 ring-cyan-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  amber:
    "border-amber-400/28 bg-[#141008]/94 text-amber-200/88 ring-1 ring-amber-400/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  violet:
    "border-violet-400/24 bg-[#110f18]/94 text-violet-200/88 ring-1 ring-violet-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  blue: "border-sky-400/24 bg-[#0c1220]/94 text-sky-200/88 ring-1 ring-sky-400/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
};

const layerCards = [
  {
    Icon: GlyphRoute,
    title: "Rota ve teklif görünümü",
    body: "Rota, zaman ve teklif çerçevesi iki tarafta aynı şekilde görünür.",
    accent: "cyan" as const,
  },
  {
    Icon: GlyphQr,
    title: "QR ile yolculuk doğrulama",
    body: "Biniş ve yol sonunda QR doğrulama adımlarıyla süreç teyit edilir.",
    accent: "amber" as const,
  },
  {
    Icon: GlyphComms,
    title: "Güven katmanı bildirimi",
    body: "Durum güncellemeleri ve güven katmanı kontrollü iletişimi destekler.",
    accent: "violet" as const,
  },
  {
    Icon: GlyphMinData,
    title: "Minimum veri paylaşımı",
    body: "Gereksiz kişisel detay paylaşımı azaltılır.",
    accent: "blue" as const,
  },
] as const;

const layerCardShell =
  "group relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.18rem] border border-white/[0.065] bg-gradient-to-br from-[#081222]/92 via-[#050a14]/90 to-black/[0.96] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_22px_56px_-38px_rgba(34,211,238,0.2)] ring-1 ring-white/[0.045] backdrop-blur-[18px] transition-[border-color,box-shadow] duration-300 ease-out hover:border-cyan-400/12 md:rounded-[1.22rem]";

export function ValueProps() {
  return (
    <div className="space-y-5 md:space-y-6 lg:space-y-7">
      <article className="group relative w-full overflow-hidden rounded-[1.4rem] border border-white/[0.068] bg-gradient-to-br from-[#081222]/94 via-[#050a14]/93 to-black/[0.96] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_34px_80px_-42px_rgba(0,198,255,0.42)] ring-1 ring-cyan-400/[0.11] backdrop-blur-[22px] transition-[border-color,box-shadow] duration-500 ease-out md:rounded-[1.55rem] xl:rounded-[1.65rem] hover:border-cyan-400/[0.12] hover:shadow-[0_42px_90px_-40px_rgba(34,211,238,0.26)]">
        <span
          className="pointer-events-none absolute inset-px rounded-[1.385rem] bg-[linear-gradient(145deg,rgba(34,211,238,0.1)_0%,transparent_40%,rgba(59,130,246,0.05)_92%)] opacity-95 md:rounded-[1.535rem]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-24 left-1/2 h-[19rem] w-[120%] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-8 p-7 sm:p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/28 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/88">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/88" aria-hidden />
              doğrulanmış bağlantı
            </span>
            <span className="rounded-full border border-white/[0.1] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400/95">
              ana güven katmanı
            </span>
          </div>
          <div>
            <h3 className="text-[1.575rem] font-bold leading-[1.12] tracking-tight text-white sm:text-[1.85rem] md:text-[2.05rem]">
              Kontrollü çift onaylı eşleşme
            </h3>
            <p className="mt-4 max-w-3xl text-[15px] leading-[1.65] text-slate-300/93">
              Sürücü ile yolcu, eşleşme sonrası aynı çerçevede doğrulanmış bilgi görür. Rota ve teklif şeffaflığı iki tarafta hizalanır;
              güven katmanları yolculuk başlamadan netleşir.
            </p>
          </div>
          <VerifiedLinkGraphic className="relative z-[1] w-full max-h-[7.75rem] object-contain text-cyan-200/92 sm:max-h-[8.75rem]" />
          <div className="space-y-2">
            <HudBaseline className="h-7 text-slate-500/95" />
          </div>
        </div>
      </article>

      <div>
        <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-200/72 md:mb-4">güven katmanları</p>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:gap-6">
          {layerCards.map(({ Icon, title, body, accent }) => (
            <li key={title} className="min-w-0">
              <article className={layerCardShell}>
                <span
                  className="pointer-events-none absolute inset-px rounded-[1.14rem] bg-[linear-gradient(155deg,rgba(34,211,238,0.06)_0%,transparent_45%,rgba(99,102,241,0.04)_100%)] opacity-90 md:rounded-[1.18rem]"
                  aria-hidden
                />
                <div className="relative flex h-full flex-col gap-3 p-5 sm:p-6">
                  <div className="flex items-start gap-3.5 sm:gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentIconWell[accent]}`}
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-semibold leading-snug tracking-tight text-white">{title}</h4>
                      <p className="mt-2 text-[13px] leading-snug text-slate-400/92">{body}</p>
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
