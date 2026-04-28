const values = [
  {
    title: "Kontrol sende",
    description:
      "Rota, zaman, konuşma ve uygulamada gör adımları net ilerler. Yolculuk paylaşımı kararı aceleye gelmez.",
  },
  {
    title: "Önce güven",
    description:
      "QR doğrulama, Güven Al ve sohbet ile anlaşma katmanları güvenli eşleşme deneyimini destekler.",
  },
  {
    title: "Aynı yöne gidenlerle paylaşım",
    description:
      "Şehir içi ve şehirler arası akışlarda aynı yöne gidenler, masraf paylaşımı fikri etrafında buluşur.",
  },
];

export function ValueProps() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {values.map((value, index) => (
        <article
          key={value.title}
          className="glass-panel group relative overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40"
        >
          <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-cyan-300/20" />
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-cyan-100 ring-1 ring-white/10">
            0{index + 1}
          </span>
          <h3 className="mt-5 text-2xl font-black tracking-tight text-white">{value.title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{value.description}</p>
        </article>
      ))}
    </div>
  );
}
