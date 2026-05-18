function IconRoute() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M12 5l3.5 3.5M12 5 8.5 8.5M12 19l3.5-3.5M12 19l-3.5-3.5" />
      <circle cx={12} cy={12} r={2.25} />
    </svg>
  );
}

function IconMutualMini() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} aria-hidden>
      <circle cx={9} cy={10} r={2.75} />
      <circle cx={15} cy={14} r={2.75} />
      <path strokeLinecap="round" d="M6 19v-.75A3.25 3.25 0 0 1 9.25 15h1.25M18 19v-.75A3.25 3.25 0 0 0 14.75 15h-1.25" />
    </svg>
  );
}

function IconQrMini() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} aria-hidden>
      <path strokeLinecap="round" d="M7.75 8.75h-2a2 2 0 0 1-2-2v-2M16.75 17.75h2a2 2 0 0 0 2-2v-2M17.75 8.75V6.75a2 2 0 0 0-2-2h-2M6.75 17.75v2a2 2 0 0 0 2 2h2" />
      <path strokeLinecap="round" d="M14.75 13.75h5M14.75 17.75h5" opacity={0.45} />
    </svg>
  );
}

function IconShieldMini() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 21.25-8-3.25v-8.5c0-3.5 8-7 8-7s8 3.5 8 7v8.5l-8 3.25Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" opacity={0.75} />
    </svg>
  );
}

const items = [
  {
    title: "Rota uyumu",
    body: "Aynı yöne yakın seçenekler önce sıralanabilir.",
    Icon: IconRoute,
  },
  {
    title: "Karşılıklı onay",
    body: "Her iki taraf netleştikten sonra ilerlersin.",
    Icon: IconMutualMini,
  },
  {
    title: "QR doğrulama",
    body: "Başlangıç ve bitişte kontrollü teyit adımları.",
    Icon: IconQrMini,
  },
  {
    title: "Güven katmanları",
    body: "Şeffaf akışla geri bildirim süreçlerine açık model.",
    Icon: IconShieldMini,
  },
] as const;

type HeroShowcaseHighlightRailProps = {
  className?: string;
};

/** Ana sayfa hero sağında dikey özellik çipleri — dengeli sıra, tek genişlik ve tutarlı aralıklar (hero ile hizalı). */
export function HeroShowcaseHighlightRail({ className = "" }: HeroShowcaseHighlightRailProps) {
  return (
    <ul
      className={`mx-auto grid w-full min-w-0 grid-cols-2 gap-x-2.5 gap-y-3 sm:justify-items-stretch lg:mx-0 lg:grid-cols-1 lg:gap-x-0 lg:gap-y-3 ${className}`}
      aria-label="Ürün vurguları"
    >
      {items.map(({ title, body, Icon }) => (
        <li key={title} className="min-w-0">
          <div className="group relative rounded-xl transition duration-[380ms] ease-out will-change-transform motion-reduce:transform-none">
            <span
              className="pointer-events-none absolute -inset-px rounded-xl bg-[radial-gradient(ellipse_at_42%_-10%,rgba(34,211,238,0.18),transparent_62%)] opacity-0 blur-md transition-opacity duration-[420ms] group-hover:opacity-100 motion-reduce:opacity-0"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-[1px] rounded-[0.6875rem] bg-gradient-to-br from-cyan-400/14 via-white/[0.06] to-violet-500/10 opacity-[0.88] transition duration-300 group-hover:opacity-[0.96]" aria-hidden />
            <div className="relative flex min-h-[4.625rem] w-full gap-3 rounded-xl border border-white/[0.062] bg-slate-950/58 px-[0.8rem] py-[0.7rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition duration-[380ms] ease-out selection:bg-white/10 group-hover:-translate-y-[3px] group-hover:border-white/[0.1] group-hover:shadow-[0_18px_46px_-24px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] motion-reduce:transition-none motion-reduce:group-hover:-translate-y-0 motion-reduce:group-hover:shadow-none">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] border border-cyan-400/[0.19] bg-cyan-400/[0.058] text-cyan-100/93">
                <Icon />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[11px] font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-xs">{title}</p>
                <p className="mt-1 text-[10px] font-medium leading-snug text-slate-400/90 sm:text-[11px]">{body}</p>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
