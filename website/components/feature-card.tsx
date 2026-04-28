type FeatureCardProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function FeatureCard({ title, description, eyebrow }: FeatureCardProps) {
  return (
    <div className="glass-panel group relative overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40">
      <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition duration-300 group-hover:bg-cyan-300/20" />
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/15 bg-cyan-300/10 text-cyan-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M12 21C12 21 18 15.8 18 10.5C18 7.2 15.3 4.5 12 4.5C8.7 4.5 6 7.2 6 10.5C6 15.8 12 21 12 21Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 10.8C10.8 8.7 13.2 7.8 16 8.1C14.2 9.7 12.1 10.8 9.7 11.4C11.8 11.2 13.5 11.5 15 12.5C12.7 13.5 10.5 13.7 8.5 13.1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {eyebrow ? (
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{eyebrow}</p>
      ) : null}
      <h3 className="mt-3 text-xl font-black leading-tight text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}
