const previews = [
  {
    title: "Şehir içi yolculuk",
    eyebrow: "rota hazır",
    primary: "Kadıköy → Levent",
    meta: "12 dk içinde güvenli eşleşme",
    accent: "from-cyan-200 to-blue-400",
  },
  {
    title: "Leylek Teklifi",
    eyebrow: "teklif açık",
    primary: "Önce netleştir, sonra anlaş",
    meta: "Eşleşme onayı bekliyor",
    accent: "from-violet-200 to-cyan-300",
  },
  {
    title: "Şehirler arası ilan",
    eyebrow: "boş koltuk",
    primary: "Ankara → İstanbul",
    meta: "3 koltuk · masraf paylaşımı",
    accent: "from-blue-200 to-cyan-300",
  },
];

export function AppPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {previews.map((preview) => (
        <article
          key={preview.title}
          className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-3 shadow-soft-card transition duration-300 hover:-translate-y-2 hover:border-cyan-200/40"
        >
          <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/80 p-4">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/20" />
            <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${preview.accent} opacity-20 blur-3xl`} />
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{preview.eyebrow}</p>
              <h3 className="mt-4 text-xl font-black leading-tight text-white">{preview.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{preview.primary}</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="h-2.5 rounded-full bg-white/10">
                <div className={`h-full w-3/4 rounded-full bg-gradient-to-r ${preview.accent}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.06] p-3">
                  <p className="text-[11px] text-slate-400">Durum</p>
                  <p className="mt-1 text-xs font-bold text-white">hazır</p>
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-3">
                  <p className="text-[11px] text-slate-400">Güven</p>
                  <p className="mt-1 text-xs font-bold text-cyan-100">aktif</p>
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-200/10 bg-cyan-300/10 p-3 text-xs font-semibold text-cyan-50">
                {preview.meta}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
