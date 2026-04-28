const rows = [
  {
    label: "Hızlı eşleşme",
    classic: "Genellikle tek akışa odaklanır",
    leylek: "Şehir içi, sohbet ve şehirler arası akışları birlikte düşünür",
  },
  {
    label: "Sohbet ederek karar verme",
    classic: "Karar çoğu zaman hızlı aksiyona sıkışır",
    leylek: "Leylek Muhabbeti ile önce konuşma ve anlaşma alanı açar",
  },
  {
    label: "Şehirler arası masraf paylaşımı",
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
    <div className="glass-panel overflow-hidden rounded-[2rem]">
      <div className="grid grid-cols-1 border-b border-white/10 sm:grid-cols-[1fr_1fr_1fr]">
        <div className="p-5 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200/80">özellik</div>
        <div className="border-t border-white/10 p-5 text-sm font-semibold text-slate-300 sm:border-l sm:border-t-0">
          Klasik yolculuk uygulamaları
        </div>
        <div className="border-t border-white/10 bg-cyan-300/10 p-5 text-sm font-black text-cyan-100 sm:border-l sm:border-t-0">
          Leylek Tag yaklaşımı
        </div>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-1 border-b border-white/10 last:border-b-0 sm:grid-cols-[1fr_1fr_1fr]">
          <div className="p-5 text-base font-black text-white">{row.label}</div>
          <div className="border-t border-white/10 p-5 text-sm leading-7 text-slate-400 sm:border-l sm:border-t-0">
            {row.classic}
          </div>
          <div className="border-t border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-slate-200 sm:border-l sm:border-t-0">
            {row.leylek}
          </div>
        </div>
      ))}
    </div>
  );
}
