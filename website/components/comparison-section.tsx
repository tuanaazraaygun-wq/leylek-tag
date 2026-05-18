const rows = [
  {
    label: "Eşleşme süreci",
    classic: "Genellikle tek akışa odaklanır",
    leylek: "Şehir içi ve teklif akışlarını birlikte düşünür",
  },
  {
    label: "Teklif görüşmesiyle karar verme",
    classic: "Karar çoğu zaman hızlı aksiyona sıkışır",
    leylek: "Leylek Teklifi ile teklif netleştirme ve yolculuk öncesi anlaşma alanı açar",
  },
  {
    label: "Masraf paylaşımı",
    classic: "Uzun rota ve boş koltuk paylaşımı sınırlı kalabilir",
    leylek: "Rota, saat, boş koltuk ve masraf paylaşımı bilgisini görünür yapar",
  },
  {
    label: "Güven odaklı topluluk",
    classic: "Platform hissi ön plandadır",
    leylek: "Güvenli eşleşme, doğrulama ve topluluk sinyallerini öne çıkarır",
  },
];

export function ComparisonSection() {
  return (
    <div className="comparison-table-shell overflow-hidden rounded-[1.5rem] border border-white/[0.068] shadow-[inset_0_1px_0_rgba(255,255,255,0.042),0_32px_80px_-54px_rgba(0,114,255,0.28)] backdrop-blur-[11px] sm:rounded-[1.875rem]">
      <div className="max-h-none overflow-visible">
        <div className="sticky top-0 z-[4] grid grid-cols-1 gap-px border-b border-white/[0.058] bg-slate-950/[0.94] backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/78 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.06fr)]">
          <div className="comparison-header-cell px-5 py-[1.135rem] text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200/74 sm:text-xs">
            Özellik
          </div>
          <div className="comparison-header-cell border-t border-white/[0.06] px-5 py-[1.135rem] text-[13px] font-semibold uppercase tracking-[0.15em] text-slate-300/88 sm:border-l sm:border-t-0 sm:text-sm">
            Klasik yolculuk uygulamaları
          </div>
          <div className="comparison-leylek-header relative px-5 py-[1.135rem] text-[13px] font-black uppercase tracking-[0.08em] text-cyan-50 sm:border-l sm:border-white/[0.06] sm:text-sm md:tracking-normal">
            <span className="relative z-[1]">Leylek TAG yaklaşımı</span>
            <span
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.14] via-cyan-400/[0.065] to-sky-500/[0.05] opacity-90"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/[0.42] to-transparent"
              aria-hidden
            />
          </div>
        </div>

        {rows.map((row, index) => {
          const zebra = index % 2 === 1;
          return (
            <div
              key={row.label}
              className={`comparison-row group/row grid grid-cols-1 gap-px border-b border-white/[0.045] bg-white/[0.02] last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.06fr)] ${
                zebra ? "comparison-row--zebra" : ""
              }`}
            >
              <div className="comparison-cell px-5 py-5 text-base font-black leading-snug tracking-tight text-white sm:text-[1.02rem]">
                {row.label}
              </div>
              <div className="comparison-cell classic-col border-t border-white/[0.05] px-5 py-5 text-[13px] leading-[1.7] text-slate-400 transition-colors duration-300 sm:border-l sm:border-t-0 sm:text-[13.75px]">
                {row.classic}
              </div>
              <div className="comparison-cell comparison-leylek-cell relative border-t border-white/[0.058] px-5 py-5 text-[13px] font-medium leading-[1.72] text-slate-100 transition-[background-color,color,box-shadow] duration-300 sm:border-l sm:border-t-0 sm:text-[13.75px] md:tracking-normal">
                {row.leylek}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
