const ITEMS = [
  "Karşılıklı onay olmadan eşleşme yok",
  "Yolculuk öncesi tüm detaylar netleşir",
  "QR ile doğrulanmış güvenli yolculuk",
] as const;

export function HeroTrustStrip() {
  return (
    <ul
      className="mt-5 flex max-w-xl flex-col gap-2.5 text-left text-[13px] font-semibold leading-snug text-white/72 sm:mt-6 md:flex-row md:flex-wrap md:items-start md:gap-x-8 md:gap-y-2"
      aria-label="Güven özeti"
    >
      {ITEMS.map((text) => (
        <li key={text} className="flex gap-2 md:max-w-[min(100%,220px)] lg:max-w-none">
          <span className="shrink-0 text-emerald-300/95" aria-hidden>
            ✔
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
