const steps = [
  {
    title: "Ankara’da başlıyoruz",
    description: "İlk odak şehirde şehir içi, Leylek Teklifi ve şehirler arası akışları birlikte çalıştırıyoruz.",
  },
  {
    title: "İlk kullanıcılarla çalışan beta",
    description: "Erken erişim topluluğu ile güvenli eşleşme ve yolculuk paylaşımı deneyimini ölçüyoruz.",
  },
  {
    title: "Geri bildirimle geliştiriyoruz",
    description: "Kullanıcı deneyimini gerçek ihtiyaçlara göre sadeleştirip güçlendiriyoruz.",
  },
  {
    title: "Süreçte daha fazla şehir",
    description: "Topluluk büyüdükçe aynı yöne gidenleri daha fazla şehirde buluşturmayı hedefliyoruz.",
  },
];

export function BetaProcess() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {steps.map((step, index) => (
        <article key={step.title} className="relative rounded-3xl border border-white/10 bg-white/[0.05] p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/15 text-sm font-black text-cyan-100">
            {index + 1}
          </span>
          <h3 className="mt-5 text-lg font-black leading-tight text-white">{step.title}</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">{step.description}</p>
        </article>
      ))}
    </div>
  );
}
