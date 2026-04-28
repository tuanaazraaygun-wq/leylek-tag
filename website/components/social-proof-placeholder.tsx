export function SocialProofPlaceholder() {
  return (
    <div className="glass-panel relative overflow-hidden rounded-[2rem] p-8 text-center sm:p-10">
      <div className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">sosyal kanıt</p>
        <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.025em] text-white">
          Beta kullanıcı yorumları yakında burada yer alacak.
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Gerçek kullanıcı deneyimleri paylaşılmadan önce sahte yorum kullanmıyoruz. İlk beta geri bildirimleri geldikçe bu alan güncellenecek.
        </p>
      </div>
    </div>
  );
}
