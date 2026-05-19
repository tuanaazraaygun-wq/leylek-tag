function ValuePropGlyph({ variant }: { variant: "control" | "trust" | "routes" }) {
  const common = "h-7 w-7 text-slate-950";
  if (variant === "control") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3v3M12 18v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M3 12h3M18 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="3.75" stroke="currentColor" strokeWidth="1.85" opacity={0.9} />
        <circle cx="12" cy="12" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (variant === "trust") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s7-4.05 7-10a6.94 6.94 0 0 0-1.32-3.94L12 4.5 6.32 7.06A6.94 6.94 0 0 0 5 11c0 5.95 7 10 7 10Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 17.25c5.2-1.95 10.05-2.9 14.8-3.85"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M8.5 5.75 12 14l3.85-8.85"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="19" r="1.85" fill="currentColor" />
      <circle cx="18.5" cy="6.5" r="1.85" fill="currentColor" />
    </svg>
  );
}

function CockpitHudRule({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-8 w-full text-cyan-300/55 ${className}`} viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden>
      <path
        d="M6 13h36l14-10h34l22 10h94"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M0 17h200" stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} />
    </svg>
  );
}

const values = [
  {
    pillar: "Kontrol" as const,
    variant: "control" as const,
    title: "Kontrol sende",
    description:
      "Rota, zaman, teklif netleştirme ve uygulamada gör adımları net ilerler. Yolculuk paylaşımı kararı aceleye gelmez.",
  },
  {
    pillar: "Güven" as const,
    variant: "trust" as const,
    title: "Önce güven",
    description:
      "QR doğrulama, Güven Al ve yolculuk öncesi anlaşma katmanları güvenli eşleşme deneyimini destekler.",
  },
  {
    pillar: "Paylaşım" as const,
    variant: "routes" as const,
    title: "Aynı yöne gidenlerle paylaşım",
    description:
      "Şehir içi ve teklif akışlarında aynı yöne gidenler, masraf paylaşımı fikri etrafında buluşur.",
  },
];

export function ValueProps() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-7">
      {values.map((value) => (
        <article
          key={value.title}
          className="group relative cursor-default overflow-hidden rounded-[1.35rem] border border-white/[0.065] bg-gradient-to-b from-white/[0.055] via-slate-950/40 to-slate-950/75 p-[1.3rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_28px_64px_-40px_rgba(0,198,255,0.42)] backdrop-blur-[18px] transition-[border-color,box-shadow] duration-500 ease-out ring-1 ring-cyan-400/[0.1] sm:p-7 sm:ring-cyan-400/[0.12] md:rounded-[1.5rem] md:p-[1.65rem] hover:border-cyan-300/25 hover:ring-cyan-400/25"
        >
          <div
            className="pointer-events-none absolute inset-px rounded-[1.28rem] bg-[linear-gradient(135deg,rgba(34,211,238,0.11)_0%,transparent_38%,rgba(99,102,241,0.06)_100%)] opacity-90 md:rounded-[1.46rem]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-12 top-0 h-36 w-36 rounded-full bg-cyan-400/12 blur-3xl transition duration-500 group-hover:bg-cyan-400/18"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200/88">{value.pillar}</p>
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-200 to-sky-500 text-slate-950 shadow-[0_18px_36px_-14px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-2 ring-white/18 transition duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_22px_44px_-12px_rgba(34,211,238,0.48)]"
              aria-hidden
            >
              <ValuePropGlyph variant={value.variant} />
            </span>
          </div>
          <h3 className="relative mt-5 text-2xl font-black leading-tight tracking-tight text-white md:mt-6">
            {value.title}
          </h3>
          <p className="relative mt-3 text-sm leading-[1.72] text-white/[0.82]">{value.description}</p>
          <div className="relative mt-6 space-y-2.5">
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 transition-[width] duration-500 ease-out group-hover:w-[88%] group-hover:from-cyan-200 group-hover:via-sky-300" />
            </div>
            <CockpitHudRule className="opacity-80" />
          </div>
        </article>
      ))}
    </div>
  );
}
