export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type GuideFaq = {
  question: string;
  answer: string;
};

export type GuideArticle = {
  slug: GuideSlug;
  title: string;
  description: string;
  category: string;
  cardSummary: string;
  intro: string;
  sections: GuideSection[];
  faq: GuideFaq[];
};

export const GUIDE_SLUGS = [
  "yolculuk-paylasimi-nedir",
  "masraf-paylasimi-nasil-calisir",
  "guvenli-yolculuk-paylasimi-ipuclari",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export const GUIDE_ARTICLES: Record<GuideSlug, GuideArticle> = {
  "yolculuk-paylasimi-nedir": {
    slug: "yolculuk-paylasimi-nedir",
    title: "Yolculuk Paylaşımı Nedir?",
    description:
      "Yolculuk paylaşımı ve masraf paylaşımı ne anlama gelir? Leylek TAG topluluk odaklı eşleşme modelini güvenli ve net şekilde açıklar.",
    category: "Başlangıç",
    cardSummary: "Aynı yöne gidenler için topluluk temelli paylaşım modeli ve temel kavramlar.",
    intro:
      "Yolculuk paylaşımı; aynı yöne giden yolcu ve sürücünün rotayı, zamanı ve masraf paylaşımını karşılıklı görüşerek netleştirdiği topluluk odaklı bir modeldir. Leylek TAG bu süreci teklif, onay ve uygulama içi doğrulama adımlarıyla destekler; ticari taşımacılık hizmeti sunmaz.",
    sections: [
      {
        heading: "Temel kavram",
        paragraphs: [
          "Yolculuk paylaşımında amaç, zaten gidilecek bir rota üzerinde boş koltuğun veya uygun bir teklifin paylaşılmasıdır. Platform, tarafları buluşturan bir vitrin ve süreç aracıdır; yolculuğu tek başına organize eden bir taşımacılık firması değildir.",
        ],
      },
      {
        heading: "Masraf paylaşımı ile ilişkisi",
        paragraphs: [
          "Masraf paylaşımı, yakıt ve yol masraflarının taraflar arasında karşılıklı anlaşmayla netleşmesidir. Leylek TAG uygulama içinde tahsilat yapmaz; ödeme ve paylaşım koşulları yolculuk öncesinde görüşülür.",
        ],
      },
      {
        heading: "Karşılıklı onay neden önemli?",
        bullets: [
          "Tek taraflı eşleşme yoktur; iki taraf onaylamadan süreç ilerlemez.",
          "Rota ve zaman teklif görüşmesinde netleştirilir.",
          "QR doğrulama gibi adımlar mobil uygulamada tamamlanır.",
        ],
      },
      {
        heading: "Leylek TAG farkı",
        paragraphs: [
          "Leylek TAG; şehir içi ve planlı rotalar için yolculuk paylaşımını sadeleştirmeyi hedefler. Web sitesi bilgilendirme sunar; teklif, eşleşme ve doğrulama mobil uygulamada yürütülür.",
        ],
      },
    ],
    faq: [
      {
        question: "Yolculuk paylaşımı taksi veya profesyonel taşımacılık mı?",
        answer:
          "Hayır. Leylek TAG topluluk temelli yolculuk ve masraf paylaşımı için tasarlanmıştır; ticari taşımacılık hizmeti sunmaz ve sürücülük mesleği iddiası taşımaz.",
      },
      {
        question: "Süreç nerede tamamlanır?",
        answer:
          "Teklif oluşturma, karşılıklı onay ve doğrulama adımları Leylek TAG mobil uygulamasında tamamlanır.",
      },
    ],
  },
  "masraf-paylasimi-nasil-calisir": {
    slug: "masraf-paylasimi-nasil-calisir",
    title: "Masraf Paylaşımı Nasıl Çalışır?",
    description:
      "Masraf paylaşımı nasıl netleşir? Leylek TAG’de teklif görüşmesi, karşılıklı onay ve taraflar arası anlaşma adımlarını öğrenin.",
    category: "Başlangıç",
    cardSummary: "Teklif görüşmesi, onay ve taraflar arası netleşme — platform tahsilat yapmaz.",
    intro:
      "Masraf paylaşımı; yolculuk öncesinde tarafların yakıt ve yol giderlerini nasıl paylaşacağını karşılıklı görüşerek belirlemesidir. Leylek TAG bu görüşmeyi teklif akışı içinde kolaylaştırır; ödeme platform üzerinden tahsil edilmez.",
    sections: [
      {
        heading: "Teklif aşaması",
        paragraphs: [
          "Yolcu veya sürücü uygulamada teklif oluşturur. Rota, kalkış zamanı ve boş koltuk gibi bilgiler teklif görüşmesinde paylaşılır; masraf paylaşımı bu aşamada konuşulur.",
        ],
      },
      {
        heading: "Karşılıklı netleşme",
        bullets: [
          "Koşullar iki tarafın onayı olmadan kesinleşmez.",
          "Belirsiz kalan noktalar yolculuk öncesi görüşülür.",
          "Platform belirli bir ücret veya gelir taahhüdü vermez.",
        ],
      },
      {
        heading: "Ödeme ve platform rolü",
        paragraphs: [
          "Leylek TAG uygulama içi ödeme altyapısı sunmaz. Masraf paylaşımı, tarafların anlaştığı yöntemle yolculuk sonrasında aralarında tamamlanır. Bu şeffaflık, sürecin topluluk temelli kalmasına yardımcı olur.",
        ],
      },
      {
        heading: "Şeffaflık ipuçları",
        bullets: [
          "Teklif metninde rota ve zamanı açık yazın.",
          "Masraf kalemlerini (yakıt, köprü vb.) mümkünse önceden konuşun.",
          "Anlaşmazlık durumunda destek kanallarına başvurun.",
        ],
      },
    ],
    faq: [
      {
        question: "Platform masrafı otomatik böler mi?",
        answer:
          "Hayır. Masraf paylaşımı taraflar arasında netleşir; platform yalnızca teklif ve eşleşme sürecini destekler.",
      },
      {
        question: "Gelir veya kazanç garantisi var mı?",
        answer:
          "Hayır. Leylek TAG gelir veya kazanç garantisi sunmaz; paylaşım topluluk kuralları ve karşılıklı anlaşma çerçevesindedir.",
      },
    ],
  },
  "guvenli-yolculuk-paylasimi-ipuclari": {
    slug: "guvenli-yolculuk-paylasimi-ipuclari",
    title: "Güvenli Yolculuk Paylaşımı İçin İpuçları",
    description:
      "Yolculuk paylaşımında güvenli karar verme: doğrulama, karşılıklı onay, QR kontrolü ve kişisel bilgi paylaşımına dikkat.",
    category: "Güven",
    cardSummary: "Doğrulama, onay, QR ve topluluk kurallarıyla kontrollü süreç.",
    intro:
      "Güvenli yolculuk paylaşımı; acele karar vermek yerine profili incelemek, koşulları netleştirmek ve uygulama içi adımları tamamlamakla desteklenir. Leylek TAG güven katmanları sunar; kesin sonuç veya hukuki garanti iddiası taşımaz.",
    sections: [
      {
        heading: "Karar vermeden önce",
        bullets: [
          "Profil ve teklif detaylarını uygulama içinde inceleyin.",
          "Rota ve zamanı yazılı olarak netleştirin.",
          "Kişisel bilgileri gereksiz yere paylaşmayın.",
        ],
      },
      {
        heading: "Doğrulama ve QR",
        paragraphs: [
          "Yolculuk başlangıcı ve doğrulama adımları QR ile uygulama içinde yürütülür. Bu adımlar süreci daha kontrollü hale getirir; yine de tarafların dikkatli olması gerekir.",
        ],
      },
      {
        heading: "Karşılıklı onay",
        paragraphs: [
          "Eşleşme yalnızca iki taraf onayladığında tamamlanır. Tek taraflı baskı veya belirsiz tekliflere itibar etmeyin; şüpheli durumları destek kanallarına bildirin.",
        ],
      },
      {
        heading: "Topluluk ve destek",
        bullets: [
          "Topluluk kurallarına uygun hareket edin.",
          "Sorun yaşarsanız /support üzerinden yardım alın.",
          "Hesap ve veri hakları için KVKK sayfasını inceleyin.",
        ],
      },
      {
        heading: "Gerçekçi beklenti",
        paragraphs: [
          "Leylek TAG güvenli süreçleri destekler; her senaryoda risk sıfır değildir. Uygunluk ve kurallara uyum kullanıcı sorumluluğundadır.",
        ],
      },
    ],
    faq: [
      {
        question: "Güvenlik garanti edilir mi?",
        answer:
          "Hayır. Platform kontrollü adımlar sunar; kesin güvenlik veya hukuki garanti iddiası verilmez.",
      },
      {
        question: "Şüpheli teklif görürsem ne yapmalıyım?",
        answer:
          "Eşleşmeyi onaylamayın ve gerekirse destek ekibiyle iletişime geçin. Kişisel veya finansal baskı içeren tekliflere itibar etmeyin.",
      },
    ],
  },
};

export function isGuideSlug(slug: string): slug is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(slug);
}

export function getGuideBySlug(slug: string): GuideArticle | null {
  if (!isGuideSlug(slug)) return null;
  return GUIDE_ARTICLES[slug];
}

export function getAllGuides(): GuideArticle[] {
  return GUIDE_SLUGS.map((slug) => GUIDE_ARTICLES[slug]);
}

export type GuideNavLink = {
  slug: GuideSlug;
  title: string;
  href: string;
};

export const GUIDE_POPULAR_CITY_LINKS = [
  { href: "/sehir/ankara", label: "Ankara" },
  { href: "/sehir/istanbul", label: "İstanbul" },
  { href: "/sehir/izmir", label: "İzmir" },
  { href: "/sehir/bursa", label: "Bursa" },
] as const;

/** Tüm rehberler — iç linkleme için. */
export function getGuideNavLinks(): GuideNavLink[] {
  return GUIDE_SLUGS.map((slug) => ({
    slug,
    title: GUIDE_ARTICLES[slug].title,
    href: `/rehber/${slug}`,
  }));
}

/** Aktif rehber hariç diğer rehberler. */
export function getOtherGuideNavLinks(excludeSlug: GuideSlug): GuideNavLink[] {
  return getGuideNavLinks().filter((link) => link.slug !== excludeSlug);
}
