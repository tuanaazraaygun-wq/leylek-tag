type FaqItem = {
  question: string;
  answer: string;
  highlights?: readonly string[];
  note?: string;
};

const faqs: readonly FaqItem[] = [
  {
    question: "Leylek TAG nedir?",
    answer:
      "Leylek TAG, aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onay mantığıyla buluşturan dijital bir yol paylaşımı platformudur.",
    highlights: [
      "Topluluk temelli masraf paylaşımı",
      "Karşılıklı onaylı eşleşme",
      "QR destekli doğrulama katmanları",
    ],
    note: "Ticari taksi veya profesyonel taşımacılık hizmeti sunmaz.",
  },
  {
    question: "Ödeme ve ücretler nasıl işler?",
    answer:
      "Platform uygulama içinde ödeme tahsilatı yapmaz. Yolculuk gideri, tarafların anlaşması doğrultusunda yolculuk sonunda doğrudan aralarında tamamlanır.",
    highlights: [
      "Uygulama üzerinden tahsilat yok",
      "Masraf paylaşımı karşılıklı mutabakatla",
      "Kart ile ödeme şu an aktif değil",
    ],
    note: "Ödeme yöntemleri ürün yol haritasında ayrıca değerlendirilir.",
  },
  {
    question: "Şehirler arası yolculuk ne zaman?",
    answer:
      "Şehirler arası planlı rota akışı geliştirme sürecindedir. Mevcut odak, şehir içi güvenli eşleşme ve teklif süreçlerinin pilot toplulukla doğrulanmasıdır.",
    highlights: ["Pilot öncelik: şehir içi", "Planlı uzun yol akışı hazırlık aşamasında"],
  },
  {
    question: "Şehir içi akış nasıl işler?",
    answer:
      "Rota, zaman ve koşullar teklif görüşmesinde netleştirilir. Karşılıklı onay sonrası eşleşme tamamlanır; doğrulama adımları mobil uygulamada yürütülür.",
    highlights: ["Teklif görüşmesi", "Karşılıklı onay", "QR ile doğrulama"],
    note: "Teklif, eşleşme ve doğrulama adımları uygulamada tamamlanır.",
  },
  {
    question: "Leylek Teklifi nedir?",
    answer:
      "Leylek Teklifi, yolculuk tekliflerinin karşılıklı görüşmeyle netleştirildiği ve onay sonrası kontrollü eşleşmeye geçilen ürün akışıdır.",
    highlights: ["Teklif netleştirme", "Karşılıklı onay", "Güven odaklı eşleşme"],
    note: "İşlem adımları mobil uygulama deneyiminde tamamlanır.",
  },
  {
    question: "Masraf paylaşımı ne demek?",
    answer:
      "Masraf paylaşımı, aynı yöne gidenlerin yolculuk giderlerini şeffaf biçimde konuşmasıdır; platform aracılığıyla tahsilat yapılmaz.",
    highlights: ["Karşılıklı anlaşma esaslı", "Şeffaf gider paylaşımı", "Platform tahsilatı yok"],
  },
  {
    question: "Güvenlik nasıl sağlanır?",
    answer:
      "Güven katmanları; karşılıklı onay, rota görünürlüğü, QR doğrulama ve topluluk sinyalleriyle desteklenen kontrollü eşleşme yaklaşımına dayanır.",
    highlights: ["QR doğrulama", "Güven Al sinyalleri", "Yolculuk öncesi netleştirme", "Destek kanalı"],
    note: "Şikayet ve güvenlik bildirimleri destek hattı üzerinden iletilebilir.",
  },
  {
    question: "Uygulama mağazalarında durum nedir?",
    answer:
      "Leylek TAG App Store ve Google Play'de yer alır. Güncel indirme bağlantılarına indirme sayfasından ulaşabilirsiniz.",
    highlights: ["App Store", "Google Play"],
    note: "Resmi mağaza bağlantıları indirme sayfasında paylaşılır.",
  },
];

function FaqChevronIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden>
      <path d="M5 7.5 10 12.5 15 7.5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FaqAnswerPanel({ faq }: { faq: FaqItem }) {
  return (
    <div
      className="motion-reduce:transition-none mt-3 origin-top rounded-xl border border-cyan-400/[0.12] bg-gradient-to-b from-black/55 to-slate-950/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_24px_-16px_rgba(34,211,238,0.35)] transition duration-200 ease-out group-open:translate-y-0 group-open:opacity-100 motion-reduce:transform-none md:px-3.5 md:py-3.5"
    >
      <p className="text-[12px] leading-relaxed text-slate-200/95 sm:text-[13px]">{faq.answer}</p>
      {faq.highlights?.length ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Özet maddeler">
          {faq.highlights.map((item) => (
            <li
              key={item}
              className="inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium leading-snug text-slate-300"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {faq.note ? (
        <p className="mt-2.5 border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-slate-500">
          {faq.note}
        </p>
      ) : null}
    </div>
  );
}

export function FaqSection() {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 md:gap-3.5">
      {faqs.map((faq) => (
        <details
          key={faq.question}
          className="glass-panel group rounded-2xl border border-white/[0.07] p-3.5 transition duration-200 hover:border-cyan-400/22 open:border-cyan-400/28 open:shadow-[0_0_32px_-20px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] open:ring-1 open:ring-cyan-400/15 sm:p-4 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="cursor-pointer list-none marker:hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 [&::-webkit-details-marker]:hidden">
            <span className="flex min-h-[44px] items-center justify-between gap-3 px-0.5 py-1">
              <span className="text-left text-[13px] font-bold leading-snug text-white sm:text-sm">{faq.question}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/22 bg-cyan-500/[0.08] text-cyan-100/90 shadow-[0_0_12px_-4px_rgba(34,211,238,0.35)] transition-transform duration-200 ease-out group-open:rotate-180 group-open:border-cyan-400/35 group-open:bg-cyan-500/[0.12] motion-reduce:transition-none">
                <FaqChevronIcon />
              </span>
            </span>
          </summary>
          <FaqAnswerPanel faq={faq} />
        </details>
      ))}
    </div>
  );
}
