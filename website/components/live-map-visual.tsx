const points = [
  "left-[18%] top-[22%]",
  "left-[68%] top-[26%]",
  "left-[36%] top-[58%]",
  "left-[80%] top-[66%]",
];

const floatingCards = [
  {
    label: "Ankara → İstanbul · 3 boş koltuk",
    className: "left-3 top-5 max-w-[min(85vw,14rem)] sm:left-5 sm:top-7 sm:max-w-none animate-slow-float",
  },
  {
    label: "Yeni Muhabbet başladı",
    className: "right-3 top-20 max-w-[min(85vw,12rem)] sm:right-5 sm:top-24 sm:max-w-none animate-[slow-float_8s_ease-in-out_infinite]",
  },
  {
    label: "Şehir içi eşleşme hazırlanıyor",
    className: "left-4 bottom-24 max-w-[min(85vw,13rem)] sm:left-8 sm:bottom-28 sm:max-w-none animate-[slow-float_9s_ease-in-out_infinite]",
  },
];

export function LiveMapVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[360px] shrink-0 lg:mx-0 lg:max-w-none">
      <div className="glass-panel relative min-h-[320px] overflow-hidden rounded-2xl p-4 sm:min-h-[380px] sm:rounded-[1.75rem] sm:p-5 lg:min-h-[460px] lg:rounded-[2rem] lg:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(37,99,235,0.18),transparent_24%)]" />
        <div className="subtle-grid pointer-events-none absolute inset-0 animate-[pulse-soft_7s_ease-in-out_infinite] opacity-70" />
        <div className="pointer-events-none absolute inset-4 rounded-xl border border-cyan-200/10 sm:inset-6 sm:rounded-[1.75rem] lg:inset-8 lg:rounded-[2rem]" />
        <div className="pointer-events-none absolute left-[10%] top-[30%] h-36 w-[82%] rotate-[-10deg] rounded-full border border-cyan-200/20 shadow-[0_0_80px_rgba(34,211,238,0.12)] sm:h-48 sm:w-[78%]" />
        <div className="pointer-events-none absolute left-[20%] top-[34%] h-28 w-[58%] rotate-[18deg] rounded-full border border-blue-300/20 sm:h-36 sm:w-[55%]" />
        <div className="pointer-events-none absolute left-[19%] top-[26%] h-px w-[50%] rotate-[5deg] rounded-full bg-gradient-to-r from-cyan-200 via-blue-400 to-transparent shadow-glow sm:left-[21%] sm:top-[26%] sm:h-1 sm:w-[48%]" />
        <div className="pointer-events-none absolute left-[36%] top-[53%] h-px w-[44%] -rotate-[13deg] rounded-full bg-gradient-to-r from-blue-400 via-cyan-200 to-transparent shadow-glow sm:left-[39%] sm:top-[55%] sm:w-[42%]" />

        {floatingCards.map((card) => (
          <div
            key={card.label}
            className={`absolute z-10 hidden rounded-xl border border-white/12 bg-slate-950/60 px-3 py-2 text-[10px] font-bold leading-snug text-cyan-50 shadow-soft-card backdrop-blur-xl sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs md:block ${card.className}`}
          >
            {card.label}
          </div>
        ))}

        {points.map((point, index) => (
          <div key={point} className={`absolute ${point}`}>
            <span className="absolute hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-cyan-300/20 sm:block" />
            <span className="relative block h-3 w-3 rounded-full border border-white/70 bg-cyan-200 shadow-glow sm:h-3.5 sm:w-3.5" />
            <span className="absolute left-3 top-2 max-w-[min(28vw,7rem)] truncate rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-50 backdrop-blur sm:left-4 sm:top-3 sm:max-w-none sm:whitespace-nowrap sm:px-3 sm:py-1 sm:text-[11px]">
              {index % 2 === 0 ? "güvenli eşleşme" : "aynı yön"}
            </span>
          </div>
        ))}

        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-soft-card backdrop-blur-xl sm:bottom-6 sm:left-6 sm:right-6 sm:rounded-3xl sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80 sm:text-xs">rota hissi</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-base font-black text-white sm:text-lg">Konuş, doğrula, paylaş</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm sm:leading-6">
                QR doğrulama, Güven Al ve rota görünürlüğüyle kontrollü yolculuk paylaşımı.
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 sm:inline-flex">
              canlı
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
