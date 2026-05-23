const trustItems = [
  {
    title: "Görüntülü güven görüşmesi",
    description: "Yolculuk öncesi yüz yüze tanışma adımı",
  },
  {
    title: "Sesli ve yazılı iletişim",
    description: "Uygulama içi kontrollü mesajlaşma ve arama",
  },
  {
    title: "Profil görünürlüğü",
    description: "Doğrulanmış profil sinyalleri ve güven katmanı",
  },
  {
    title: "Rota uyumlu öneri teklif",
    description: "Aynı yön ve rota eşleşmesine göre akıllı teklif",
  },
  {
    title: "QR başlangıç/bitiş doğrulaması",
    description: "Yolculuk başlangıç ve bitiş noktasında doğrulama",
  },
];

export function HomeCommunicationTrust() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/75">
        güven ve iletişim
      </p>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {trustItems.map((item) => (
          <li
            key={item.title}
            className="flex gap-2.5 rounded-xl border border-white/[0.06] bg-slate-950/35 px-3 py-2.5"
          >
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/90 shadow-[0_0_8px_rgba(103,232,249,0.45)]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-slate-100">{item.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
