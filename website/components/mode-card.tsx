type ModeCardProps = {
  title: string;
  eyebrow: string;
  description: string;
  tone: "cyan" | "violet" | "blue";
};

const toneStyles = {
  cyan: {
    shell: "hover:border-cyan-300/38",
    icon: "from-cyan-200 to-blue-400",
    glow: "bg-cyan-300/20",
    ring: "ring-cyan-400/[0.11]",
    edge: "from-cyan-400/[0.12]",
  },
  violet: {
    shell: "hover:border-violet-300/36",
    icon: "from-violet-200 to-cyan-300",
    glow: "bg-violet-300/20",
    ring: "ring-violet-400/[0.1]",
    edge: "from-violet-400/[0.11]",
  },
  blue: {
    shell: "hover:border-blue-300/36",
    icon: "from-blue-200 to-cyan-300",
    glow: "bg-blue-300/20",
    ring: "ring-sky-400/[0.1]",
    edge: "from-sky-400/[0.11]",
  },
};

function ModeCardHud({ iconClass }: { iconClass: string }) {
  return (
    <svg className={`h-7 w-full ${iconClass}`} viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden>
      <path
        d="M4 16h40c8-8 16-8 24 0h24c10-9 20-9 30 0h78"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <path d="M0 20h200" stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
    </svg>
  );
}

export function ModeCard({ title, eyebrow, description, tone }: ModeCardProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={`glass-card tap-highlight group relative cursor-default overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-gradient-to-b from-white/[0.045] via-slate-950/35 to-slate-950/80 p-[1.3rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.056),0_24px_60px_-36px_rgba(0,114,255,0.42)] backdrop-blur-[17px] transition-all duration-300 ease-out ring-1 ring-inset ring-white/[0.04] sm:p-6 md:rounded-[1.5rem] md:p-[1.65rem] ${styles.shell} ${styles.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-px rounded-[1.28rem] bg-gradient-to-br ${styles.edge} via-transparent to-transparent opacity-90 md:rounded-[1.46rem]`}
        aria-hidden
      />
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-95 ${styles.glow}`} />
      <div
        className={`relative flex h-14 w-14 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-gradient-to-br ${styles.icon} text-slate-950 shadow-[0_16px_32px_-10px_rgba(0,0,0,0.45)] ring-2 ring-white/16 transition-transform duration-300 group-hover:scale-[1.04]`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M4 15.5C8.8 7.5 14.6 5 21 5C17.7 8.6 13.8 11.2 9.4 12.8C13.1 12.2 16.5 12.7 19.5 14.5C14.6 17 9.6 17.7 4.5 16.4L4 15.5Z"
            fill="currentColor"
          />
          <path
            d="M8 18.5L12 21L16 18.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="relative mt-[1.125rem] text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/88 sm:mt-6">
        {eyebrow}
      </p>
      <h3 className="relative mt-3 text-2xl font-black tracking-tight text-white">{title}</h3>
      <p className="relative mt-3 break-words text-sm leading-[1.68] text-white/[0.82]">{description}</p>
      <div className="relative mt-6 space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
          <div className={`h-full w-[66%] rounded-full bg-gradient-to-r ${styles.icon} transition-[width] duration-300 ease-out group-hover:w-full`} />
        </div>
        <ModeCardHud iconClass={tone === "violet" ? "text-violet-300/65" : tone === "blue" ? "text-sky-300/62" : "text-cyan-300/60"} />
      </div>
    </div>
  );
}
