const faqs = [
  {
    question: "Leylek Tag nedir?",
    answer:
      "Leylek Tag, aynı yöne gidenlerin yolculuk paylaşımı, teklif konuşması ve güvenli eşleşme katmanlarıyla buluşmasını hedefleyen bir topluluk platformudur.",
  },
  {
    question: "Şehirler arası yol paylaşımı nasıl çalışır?",
    answer:
      "Kullanıcılar gidecekleri rota, tarih/saat, boş koltuk ve tahmini masraf paylaşımı bilgisini ilan olarak paylaşır. Canlı bağlantı uygulama içinde kullanılacaktır.",
  },
  {
    question: "Leylek Teklifi nedir?",
    answer:
      "Leylek Teklifi, şehir dışı yolculuk tekliflerini konuşarak netleştirdiğiniz, karşılıklı onay ve teklif doğrulama ile güvenli eşleşmeye geçtiğiniz akıştır.",
  },
  {
    question: "Masraf paylaşımı ne demek?",
    answer:
      "Masraf paylaşımı, aynı yöne gidenlerin yolculuk giderlerini şeffaf ve karşılıklı anlaşmaya dayalı şekilde paylaşmasıdır.",
  },
  {
    question: "Güvenlik nasıl sağlanır?",
    answer:
      "QR doğrulama, Güven Al, rota görünürlüğü, detayları netleştirme ve yolculuk öncesi anlaşma ile topluluk sinyalleri güvenli eşleşme deneyimini destekler.",
  },
  {
    question: "Uygulama ne zaman yayında?",
    answer:
      "Web sitesi keşif alanıdır. Yayın takvimi netleştiğinde indirme sayfası ve beta topluluğu üzerinden duyurulacaktır.",
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
