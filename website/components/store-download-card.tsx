type StoreDownloadCardProps = {
  href: string;
  storeName: string;
  deviceLine: string;
  ctaLabel: string;
  variant: "apple" | "google";
  className?: string;
};

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.218-1.277 3.01-.784.792-2.04 1.38-3.17 1.294-.12-1.098.52-2.26 1.277-3.048.857-.888 2.336-1.52 3.17-1.256ZM20.25 17.04c-.57 1.32-1.25 2.58-2.25 3.78-1.01 1.2-2.19 2.52-3.78 2.53-1.42.01-1.82-.84-3.39-.84-1.57 0-2.02.82-3.4.86-1.55.04-2.73-1.25-3.74-2.45-2.03-2.47-3.58-6.98-1.5-10.03 1.04-1.5 2.89-2.45 4.9-2.48 1.53-.03 2.97.99 3.39.99.42 0 2.43-1.22 4.1-1.04.7.03 2.66.28 3.92 2.11-3.44 1.87-2.89 6.74 1.02 8.01Z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M3.6 2.4c-.33.2-.6.58-.6 1.05v17.1c0 .47.27.85.6 1.05l9.9-9.6L3.6 2.4Zm11.1 7.35 2.55-2.47 7.2 3.48-2.55 2.47-7.2-3.48Zm7.2 5.22-7.2 3.48 2.55 2.47 7.2-3.48-2.55-2.47ZM14.7 9.75l-7.2-3.48L4.95 8.74l9.75 9.46 7.2-3.48-7.2-4.97Z" />
    </svg>
  );
}

export function StoreDownloadCard({
  href,
  storeName,
  deviceLine,
  ctaLabel,
  variant,
  className = "",
}: StoreDownloadCardProps) {
  const isApple = variant === "apple";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_28px_80px_-36px_rgba(0,114,255,0.55)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_36px_96px_-28px_rgba(0,198,255,0.45)] sm:min-h-[180px] sm:p-7 ${className} ${
        isApple
          ? "border-white/14 bg-gradient-to-br from-slate-900/90 via-[#0c1829] to-cyan-950/80 hover:border-cyan-300/35"
          : "border-emerald-400/20 bg-gradient-to-br from-slate-900/90 via-[#0c1829] to-emerald-950/50 hover:border-emerald-300/35"
      }`}
    >
      <span
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100 ${
          isApple ? "bg-cyan-400/12 opacity-80" : "bg-emerald-400/10 opacity-80"
        }`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            isApple
              ? "border-cyan-300/25 bg-cyan-400/15 text-cyan-50"
              : "border-emerald-300/25 bg-emerald-400/15 text-emerald-50"
          }`}
        >
          {isApple ? <AppleGlyph /> : <PlayGlyph />}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
            isApple ? "bg-cyan-400/12 text-cyan-100/90" : "bg-emerald-400/12 text-emerald-100/90"
          }`}
        >
          Resmi mağaza
        </span>
      </div>
      <div className="relative mt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{deviceLine}</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-[1.65rem]">{storeName}</h3>
        <p
          className={`mt-4 inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-black text-slate-950 shadow-lg transition group-hover:brightness-110 ${
            isApple
              ? "bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-400"
              : "bg-gradient-to-r from-emerald-200 via-emerald-300 to-teal-400"
          }`}
        >
          {ctaLabel}
        </p>
      </div>
    </a>
  );
}
