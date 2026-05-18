const trustBadges = [
  { label: "Karşılıklı onayla eşleşme", detail: "İki taraf onayı olmadan yolculuk başlamaz." },
  { label: "Yolculuk öncesi netleştirme", detail: "Masraf, rota ve zaman önceden şeffaftır." },
  { label: "QR ile doğrulama", detail: "Başlangıç ve bitişte kontrollü teyit akışı." },
  { label: "Güvenlik ve şikayet", detail: "Şikâyet kanalları topluluk güven sürecinin parçasıdır." },
  { label: "Minimal kişisel bilgi", detail: "Gereksiz paylaşım olmadan teklif süreci." },
];

export function TrustBadges() {
  const top = trustBadges.slice(0, 3);
  const bottom = trustBadges.slice(3);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {top.map((badge) => (
          <BadgeCard key={badge.label} badge={badge} />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-5 lg:gap-6">
        {bottom.map((badge) => (
          <div key={badge.label} className="w-full sm:min-w-[min(100%,340px)] sm:max-w-lg sm:flex-1 lg:max-w-xl">
            <BadgeCard badge={badge} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: { label: string; detail: string } }) {
  return (
    <div className="h-full rounded-2xl border border-white/[0.09] bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-sm transition duration-300 hover:border-cyan-400/35 hover:bg-white/[0.055] sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/[0.15] bg-cyan-400/[0.08] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-black leading-snug text-white sm:text-base">{badge.label}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400 sm:text-[14px]">{badge.detail}</p>
        </div>
      </div>
    </div>
  );
}
