const trustBadges = [
  { label: "QR doğrulama", detail: "buluşma anında netlik" },
  { label: "Güven Al", detail: "topluluk sinyalleri" },
  { label: "Rota görünürlüğü", detail: "paylaşılan güzergah" },
  { label: "Teklifle netleştirme", detail: "detayları netleştir, sonra karar ver" },
];

export function TrustBadges() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {trustBadges.map((badge) => (
        <div
          key={badge.label}
          className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40 hover:bg-white/[0.1]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5L10 17L19 7"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-black text-white">{badge.label}</p>
              <p className="mt-0.5 text-xs text-slate-400">{badge.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
