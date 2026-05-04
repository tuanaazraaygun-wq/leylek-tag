const ITEMS = [
  "Karşılıklı onayla eşleşme",
  "QR ile doğrulanmış yolculuk",
  "Detayları netleştir, sürpriz yaşamadan yola çık",
] as const;

export function DownloadPageTrust() {
  return (
    <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-1 md:grid-cols-3 md:gap-4">
      {ITEMS.map((text) => (
        <li
          key={text}
          className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm font-semibold leading-snug text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <span className="shrink-0 text-emerald-300" aria-hidden>
            ✔
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
