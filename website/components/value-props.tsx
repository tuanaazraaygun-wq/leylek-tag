const values = [
  {
    title: "Kontrol sende",
    description:
      "Rota, zaman, teklif netleştirme ve uygulamada gör adımları net ilerler. Yolculuk paylaşımı kararı aceleye gelmez.",
  },
  {
    title: "Önce güven",
    description:
      "QR doğrulama, Güven Al ve yolculuk öncesi anlaşma katmanları güvenli eşleşme deneyimini destekler.",
  },
  {
    title: "Aynı yöne gidenlerle paylaşım",
    description:
      "Şehir içi ve şehirler arası akışlarda aynı yöne gidenler, masraf paylaşımı fikri etrafında buluşur.",
  },
];

export function ValueProps() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
      {values.map((value, index) => (
        <article
          key={value.title}
          className="glass-panel group relative cursor-default overflow-hidden rounded-3xl p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-200/40 hover:brightness-110 sm:p-6"
        >
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-cyan-300/20" />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-cyan-100 ring-1 ring-white/10">
            0{index + 1}
          </span>
          <h3 className="mt-5 text-2xl font-black tracking-tight text-white">{value.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/80">{value.description}</p>
        </article>
      ))}
    </div>
  );
}
