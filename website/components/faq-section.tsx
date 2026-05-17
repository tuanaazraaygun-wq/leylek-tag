const faqs = [
  {
    question: "Leylek TAG nedir?",
    answer:
      "Leylek TAG, yolcu ve sürücüleri karşılıklı teklif ve onay mantığıyla buluşturan, QR doğrulama destekli yolculuk eşleştirme platformudur.",
  },
  {
    question: "Ödeme ve ücretler nasıl işler?",
    answer:
      "Leylek TAG uygulama içinde ödeme tahsilatı yapmaz. Yolculuk ücreti, yolculuk sonunda taraflar arasında nakit olarak tamamlanır. Kart ile ödeme özelliği aktif değildir; ilerleyen süreçte uygun altyapı ile değerlendirilecektir.",
  },
  {
    question: "Şehirler arası yolculuk ne zaman?",
    answer:
      "Şehirler arası yolculuk akışı geliştirme sürecindedir. Planlı uzun yol eşleşmeleri yakında aktif edilecektir. Şu anda şehir içi yolculuk eşleşmesi önceliklidir.",
  },
  {
    question: "Şehir içi akış nasıl işler?",
    answer:
      "Kullanıcılar rota, zaman ve koşulları teklif görüşmesinde netleştirir. Karşılıklı onay ve QR ile yolculuk doğrulama adımları Leylek TAG mobil uygulamasında tamamlanır.",
  },
  {
    question: "Leylek Teklifi nedir?",
    answer:
      "Leylek Teklifi, yolculuk tekliflerini netleştirdiğiniz, karşılıklı onay ve teklif doğrulama ile güvenli eşleşmeye geçtiğiniz akıştır.",
  },
  {
    question: "Masraf paylaşımı ne demek?",
    answer:
      "Masraf paylaşımı, aynı yöne gidenlerin yolculuk giderlerini şeffaf ve karşılıklı anlaşmaya dayalı şekilde konuşmasıdır; tahsilat uygulama üzerinden yapılmaz.",
  },
  {
    question: "Güvenlik nasıl sağlanır?",
    answer:
      "QR ile yolculuk doğrulaması, Güven Al, rota görünürlüğü, detayları netleştirme ve yolculuk öncesi anlaşma ile güvenli eşleşme deneyimi desteklenir.",
  },
  {
    question: "Uygulama mağazalarında durum nedir?",
    answer:
      "Google Play tarafında erken erişim ve açık test süreçleri değerlendirilirken, App Store yayını hazırlık sürecindedir. Güncel bağlantılar için indirme sayfasını takip edebilirsin.",
  },
];

export function FaqSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {faqs.map((faq) => (
        <details
          key={faq.question}
          className="glass-panel group rounded-3xl p-5 transition duration-300 hover:border-cyan-200/40"
        >
          <summary className="cursor-pointer list-none text-base font-black text-white marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {faq.question}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-cyan-100 transition group-open:rotate-45">
                +
              </span>
            </span>
          </summary>
          <p className="mt-4 text-sm leading-7 text-slate-300">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
