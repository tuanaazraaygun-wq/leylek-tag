const audiences = [
  {
    title: "Günlük şehir içi yolculuk paylaşanlar",
    description: "Rota görünürlüğü ve güvenli eşleşme ile gündelik şehir içi planlarını daha kontrollü yönetmek isteyenler.",
  },
  {
    title: "Şehirler arası boş koltuk paylaşanlar",
    description: "Gideceği rotayı, saatini ve boş koltuk sayısını paylaşarak aynı yöne gidenlerle masraf paylaşımı yapmak isteyenler.",
  },
  {
    title: "Önce konuşup güvenmek isteyenler",
    description: "Leylek Muhabbeti ile yolculuk paylaşımı öncesinde sohbet ederek karar vermek isteyenler.",
  },
  {
    title: "Topluluk içinde yolculuk planlayanlar",
    description: "Tek seferlik eşleşmeden fazlasını, güvenli ve kontrollü bir topluluk deneyimiyle arayanlar.",
  },
];

export function AudienceSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {audiences.map((audience) => (
        <article
          key={audience.title}
          className="glass-panel group relative overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40"
        >
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-300/10 blur-3xl transition group-hover:bg-cyan-300/20" />
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/15 bg-cyan-300/10 text-cyan-100">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M7 11.5C8.8 8.6 11.9 7.2 16.5 7.2C14.9 9 12.8 10.4 10.3 11.3C12.8 11.1 15 11.6 16.8 12.8C13.2 14.4 9.8 14.6 6.6 13.4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 21C12 21 18 15.8 18 10.5C18 7.2 15.3 4.5 12 4.5C8.7 4.5 6 7.2 6 10.5C6 15.8 12 21 12 21Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h3 className="mt-5 text-lg font-black leading-tight text-white">{audience.title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{audience.description}</p>
        </article>
      ))}
    </div>
  );
}
