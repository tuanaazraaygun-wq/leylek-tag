const ITEMS = ["Kontrol sende", "Güvenli eşleşme", "Sürpriz yok"] as const;

export function HeroTrustStrip() {
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 sm:mt-10 sm:px-6">
      <p className="text-center text-sm font-black text-white sm:text-left md:text-base">
        Kullanıcılar neden Leylek Tag&apos;i tercih ediyor?
      </p>
      <ul
        className="mt-4 flex flex-col gap-2.5 text-left text-[13px] font-semibold leading-snug text-white/78 sm:mt-5 md:flex-row md:flex-wrap md:justify-between md:gap-x-6"
        aria-label="Tercih nedenleri"
      >
        {ITEMS.map((text) => (
          <li key={text} className="flex gap-2 md:flex-1 md:justify-center lg:justify-start">
            <span className="shrink-0 text-emerald-300/95" aria-hidden>
              ✔
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
