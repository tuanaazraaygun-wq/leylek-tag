type ModeCardProps = {
  title: string;
  eyebrow: string;
  description: string;
  tone: "cyan" | "violet" | "blue";
};

const toneStyles = {
  cyan: {
    shell: "hover:border-cyan-200/50",
    icon: "from-cyan-200 to-blue-400",
    glow: "bg-cyan-300/20",
  },
  violet: {
    shell: "hover:border-violet-200/50",
    icon: "from-violet-200 to-cyan-300",
    glow: "bg-violet-300/20",
  },
  blue: {
    shell: "hover:border-blue-200/50",
    icon: "from-blue-200 to-cyan-300",
    glow: "bg-blue-300/20",
  },
};

export function ModeCard({ title, eyebrow, description, tone }: ModeCardProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={`glass-card tap-highlight group relative cursor-default overflow-hidden p-5 transition-all duration-300 ease-out sm:p-6 md:p-7 ${styles.shell}`}
    >
      <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-90 ${styles.glow}`} />
      <div
        className={`flex h-14 w-14 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-gradient-to-br ${styles.icon} text-slate-950 shadow-lg ring-2 ring-white/15 transition-transform duration-300 group-hover:scale-105`}
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
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/90">{eyebrow}</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{title}</h3>
      <p className="mt-3 break-words text-sm leading-relaxed text-white/80">{description}</p>
      <div className="mt-6 h-1.5 rounded-full bg-white/10">
        <div className={`h-full w-2/3 rounded-full bg-gradient-to-r ${styles.icon} transition duration-300 group-hover:w-full`} />
      </div>
    </div>
  );
}
