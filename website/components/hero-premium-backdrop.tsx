/** Hero sahnesi için statik, SSR-only dekoratif arka katmanlar (işlev yok). */
export function HeroPremiumBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Taban */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#020611_0%,#070f1c_44%,#0b0718_74%,#05040c_100%)]" />
      {/* Sol kopya yıkamasi — yazı boşluğuna bağlanan radial */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_86%_at_14%_36%,rgba(56,189,248,0.065),transparent_58%)]" />
      {/* Üst cinematik sıcak-cool dengesi */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_82%_64%_at_92%_-2%,rgba(0,214,255,0.14),transparent_56%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_68%_58%_at_12%_18%,rgba(96,165,250,0.11),transparent_54%)]" />
      {/* Sağ rota alanı için ekstra mavi lobe (mouse drift HeroShell ile hareket eder; bu taban tint) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_70%_at_94%_30%,rgba(37,99,235,0.048),transparent_58%)]" />
      {/* Alt merkez hafif sıcak yıkama */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_48%_at_52%_100%,rgba(0,114,255,0.085),transparent_64%)]" />
      {/* Orta bölüm — çok hafif sis */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_52%_48%,rgba(241,249,255,0.024),transparent_62%)]" />
      {/* Rota şeridi — çok düşük opak */}
      <div className="absolute bottom-[-8%] left-[-6%] right-[-14%] top-[42%] opacity-[0.11] blur-[54px]" aria-hidden>
        <svg className="h-full w-full" viewBox="0 0 1200 560" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="hb-line-a" x1="0%" y1="0%" x2="100%" y2="40%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#0072ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M-40 392 C 260 396, 360 292, 520 274 S 740 392, 900 362 S 1100 196, 1280 238"
            fill="none"
            stroke="url(#hb-line-a)"
            strokeWidth="2.75"
          />
          <path
            d="M52 446 C 300 392, 480 472, 700 394 S 980 294, 1250 340"
            fill="none"
            stroke="#67e8f9"
            strokeOpacity="0.082"
            strokeWidth="20"
          />
        </svg>
      </div>
      <div className="subtle-grid absolute inset-x-[-8%] top-[-6%] h-[clamp(420px,78vh,640px)] max-w-none opacity-[0.162] md:opacity-[0.188]" />
      {/* Cinematik vignette — köşeler baskılı, kurumsal sakin */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_86%_70%_at_52%_48%,transparent_43%,rgba(2,11,26,0.55)_76%,rgba(4,8,17,0.82)_93%,#03050c_100%)]" aria-hidden />
    </div>
  );
}
