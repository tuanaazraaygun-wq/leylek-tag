export type CityLandingFaq = {
  question: string;
  answer: string;
};

export type CityLandingContent = {
  slug: string;
  cityName: string;
  title: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  driverCta: string;
  passengerCta: string;
  faq: CityLandingFaq[];
  keywords: string[];
};

export const CITY_LANDING_SLUGS = ["ankara", "istanbul", "izmir"] as const;

export type CityLandingSlug = (typeof CITY_LANDING_SLUGS)[number];

const HOW_IT_WORKS_STEPS = [
  {
    eyebrow: "Adım 1",
    title: "Teklif oluştur",
    description: "Yolcu veya sürücü olarak şehir içi teklifini uygulamada aç.",
  },
  {
    eyebrow: "Adım 2",
    title: "Detayları netleştir",
    description: "Rota, zaman ve koşulları teklif görüşmesinde karşılıklı netleştir.",
  },
  {
    eyebrow: "Adım 3",
    title: "Karşılıklı onayla eşleş",
    description: "İki taraf onaylayınca kontrollü eşleşme tamamlanır.",
  },
  {
    eyebrow: "Adım 4",
    title: "Doğrula ve yola çık",
    description: "QR ile yolculuk doğrulamasını tamamlayıp yola çık.",
  },
] as const;

export const CITY_LANDING_HOW_IT_WORKS = HOW_IT_WORKS_STEPS;

export const CITY_LANDING_CONTENT: Record<CityLandingSlug, CityLandingContent> = {
  ankara: {
    slug: "ankara",
    cityName: "Ankara",
    title: "Ankara Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Ankara'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Ankara'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Başkentte günlük rotalar, kampüs ve iş güzergâhları için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir taahhüdü veya profesyonel taşımacılık iddiası yoktur.",
    faq: [
      {
        question: "Ankara'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "Ankara içi hangi rotalar destekleniyor?",
        answer:
          "Şehir içi eşleşme pilot kapsamda genişletilmektedir. Günlük güzergâhlar teklif görüşmesinde netleştirilir; platform belirli hat garantisi vermez.",
      },
      {
        question: "Ankara'da ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Ankara yolculuk paylaşımı",
      "Ankara masraf paylaşımı",
      "Ankara boş koltuk",
      "Leylek TAG Ankara",
    ],
  },
  istanbul: {
    slug: "istanbul",
    cityName: "İstanbul",
    title: "İstanbul Yolculuk Paylaşımı | Leylek TAG",
    description:
      "İstanbul'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "İstanbul'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Yoğun günlük trafikte benzer rotaya giden yolcu ve sürücüleri karşılıklı teklif, onay ve QR destekli doğrulama ile bir araya getirir.",
    passengerCta:
      "Yolcu olarak gideceğin ilçe veya güzergâhı uygulamada belirt; uygun tekliflerle masraf paylaşımını karşılıklı netleştir. Platform ticari taşımacılık hizmeti değildir.",
    driverCta:
      "Sürücü olarak planladığın rota üzerinde boş koltuğunu paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Profesyonel sürücülük veya gelir garantisi sunulmaz.",
    faq: [
      {
        question: "İstanbul'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif açarsın; rota ve zaman teklif görüşmesinde netleşir, karşılıklı onay sonrası doğrulama adımları uygulamada yürütülür.",
      },
      {
        question: "Avrupa ve Anadolu yakası arası eşleşme var mı?",
        answer:
          "Eşleşme teklif görüşmesindeki rota uyumuna bağlıdır. Platform belirli köprü veya hat garantisi vermez; taraflar koşulları karşılıklı netleştirir.",
      },
      {
        question: "İstanbul'da güvenlik nasıl sağlanır?",
        answer:
          "Karşılıklı onay, QR doğrulama, rota görünürlüğü ve topluluk sinyalleriyle desteklenen kontrollü eşleşme yaklaşımı uygulanır. Şikayetler destek kanalından iletilebilir.",
      },
    ],
    keywords: [
      "İstanbul yolculuk paylaşımı",
      "İstanbul masraf paylaşımı",
      "İstanbul boş koltuk",
      "Leylek TAG İstanbul",
    ],
  },
  izmir: {
    slug: "izmir",
    cityName: "İzmir",
    title: "İzmir Yolculuk Paylaşımı | Leylek TAG",
    description:
      "İzmir'de aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "İzmir'de aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Kordon, Bornova ve çevre ilçelerde günlük rotalar için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir taahhüdü veya profesyonel taşımacılık iddiası yoktur.",
    faq: [
      {
        question: "İzmir'de Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "İzmir içi hangi bölgeler kapsanıyor?",
        answer:
          "Şehir içi eşleşme pilot kapsamda genişletilmektedir. Günlük güzergâhlar teklif görüşmesinde netleştirilir; platform belirli hat garantisi vermez.",
      },
      {
        question: "İzmir'de ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "İzmir yolculuk paylaşımı",
      "İzmir masraf paylaşımı",
      "İzmir boş koltuk",
      "Leylek TAG İzmir",
    ],
  },
};

export function isCityLandingSlug(slug: string): slug is CityLandingSlug {
  return (CITY_LANDING_SLUGS as readonly string[]).includes(slug);
}

export function getCityLandingBySlug(slug: string): CityLandingContent | null {
  if (!isCityLandingSlug(slug)) return null;
  return CITY_LANDING_CONTENT[slug];
}
