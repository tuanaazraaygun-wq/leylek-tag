const items = ["Karşılıklı onay", "QR doğrulama", "Rota netliği"] as const;

/** Headline altı kısa güven ipuçları — istatistik/iddaya yok. */
export function HeroTrustMicro() {
  return (
    <ul className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/88 sm:mt-7 sm:gap-x-3 md:justify-start">
      {items.map((label, i) => (
        <li key={label} className="flex items-center gap-2 sm:gap-3">
          {i > 0 ? <span className="hidden h-px w-6 bg-gradient-to-r from-transparent via-white/18 to-transparent sm:block" aria-hidden /> : null}
          <span className="whitespace-nowrap text-cyan-100/78">{label}</span>
        </li>
      ))}
    </ul>
  );
}
