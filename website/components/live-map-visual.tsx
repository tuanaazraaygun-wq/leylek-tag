const points = [
  "left-[18%] top-[22%]",
  "left-[68%] top-[26%]",
  "left-[36%] top-[58%]",
  "left-[80%] top-[66%]",
];

const floatingCards = [
  {
    label: "Ankara → İstanbul · 3 boş koltuk",
    className: "left-5 top-7 animate-slow-float",
  },
  {
    label: "Yeni Muhabbet başladı",
    className: "right-5 top-24 animate-[slow-float_8s_ease-in-out_infinite]",
  },
  {
    label: "Şehir içi eşleşme hazırlanıyor",
    className: "left-8 bottom-28 animate-[slow-float_9s_ease-in-out_infinite]",
  },
];

export function LiveMapVisual() {
  return (
    <div className="glass-panel relative min-h-[460px] overflow-hidden rounded-[2rem] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(37,99,235,0.18),transparent_24%)]" />
      <div className="subtle-grid absolute inset-0 animate-[pulse-soft_7s_ease-in-out_infinite] opacity-70" />
      <div className="absolute inset-8 rounded-[2rem] border border-cyan-200/10" />
      <div className="absolute left-[12%] top-[32%] h-48 w-[78%] rotate-[-10deg] rounded-full border border-cyan-200/20 shadow-[0_0_80px_rgba(34,211,238,0.12)]" />
      <div className="absolute left-[22%] top-[36%] h-36 w-[55%] rotate-[18deg] rounded-full border border-blue-300/20" />
      <div className="absolute left-[21%] top-[26%] h-1 w-[48%] rotate-[5deg] rounded-full bg-gradient-to-r from-cyan-200 via-blue-400 to-transparent shadow-glow" />
      <div className="absolute left-[39%] top-[55%] h-1 w-[42%] -rotate-[13deg] rounded-full bg-gradient-to-r from-blue-400 via-cyan-200 to-transparent shadow-glow" />

      {floatingCards.map((card) => (
        <div
          key={card.label}
          className={`absolute z-10 rounded-2xl border border-white/12 bg-slate-950/60 px-4 py-3 text-xs font-bold text-cyan-50 shadow-soft-card backdrop-blur-xl ${card.className}`}
        >
          {card.label}
        </div>
      ))}

      {points.map((point, index) => (
        <div key={point} className={`absolute ${point}`}>
          <span className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-cyan-300/20" />
          <span className="relative block h-3.5 w-3.5 rounded-full border border-white/70 bg-cyan-200 shadow-glow" />
          <span className="absolute left-4 top-3 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-cyan-50 backdrop-blur">
            {index % 2 === 0 ? "güvenli eşleşme" : "aynı yön"}
          </span>
        </div>
      ))}

      <div className="absolute bottom-6 left-6 right-6 rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-soft-card backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">rota hissi</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-white">Konuş, doğrula, paylaş</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              QR doğrulama, Güven Al ve rota görünürlüğüyle kontrollü yolculuk paylaşımı.
            </p>
          </div>
          <span className="hidden rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 sm:inline-flex">
            canlı
          </span>
        </div>
      </div>
    </div>
  );
}
