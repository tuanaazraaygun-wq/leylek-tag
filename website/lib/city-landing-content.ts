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

export const CITY_LANDING_SLUGS = [
  "ankara",
  "istanbul",
  "izmir",
  "bursa",
  "antalya",
  "konya",
  "adana",
  "eskisehir",
  "gaziantep",
  "kayseri",
  "mersin",
  "samsun",
] as const;

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
      "Ankara'da Kızılay, Çankaya, Keçiören, Yenimahalle ve Çayyolu güzergâhlarında yolculuk paylaşımı. Leylek TAG ile yolcu ve sürücüyü uygulamada buluşturun; ticari taşımacılık değildir.",
    heroTitle: "Ankara'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Kızılay, Çankaya, Keçiören, Yenimahalle ve Çayyolu rotalarında günlük yol paylaşımı; karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
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
          "Şehir içi eşleşme kullanılabilirliği bölgeye göre değişebilir. Günlük güzergâhlar teklif görüşmesinde netleştirilir; platform belirli hat garantisi vermez.",
      },
      {
        question: "Ankara'da ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Ankara yolculuk paylaşımı",
      "Ankara yol paylaşımı",
      "Kızılay yolculuk paylaşımı",
      "Çankaya masraf paylaşımı",
      "Keçiören boş koltuk",
      "Yenimahalle yol paylaşımı",
      "Çayyolu yolculuk paylaşımı",
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
          "Şehir içi eşleşme kullanılabilirliği bölgeye göre değişebilir. Günlük güzergâhlar teklif görüşmesinde netleştirilir; platform belirli hat garantisi vermez.",
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
  bursa: {
    slug: "bursa",
    cityName: "Bursa",
    title: "Bursa Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Bursa'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Bursa'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Nilüfer, Osmangazi ve üniversite güzergâhlarında günlük rotalar için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Uygunluk ve kurallar kullanıcı sorumluluğundadır; Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir garantisi veya profesyonel taşımacılık iddiası yoktur.",
    faq: [
      {
        question: "Bursa'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "Bursa içi hangi güzergâhlar uygun?",
        answer:
          "Günlük iş, kampüs ve ilçe rotaları teklif görüşmesinde netleştirilir. Platform belirli hat garantisi vermez; uygunluk tarafların karşılıklı onayına bağlıdır.",
      },
      {
        question: "Bursa'da ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Bursa yolculuk paylaşımı",
      "Bursa masraf paylaşımı",
      "Bursa boş koltuk",
      "Leylek TAG Bursa",
    ],
  },
  antalya: {
    slug: "antalya",
    cityName: "Antalya",
    title: "Antalya Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Antalya'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Antalya'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Konyaaltı, Lara ve merkez ilçelerde günlük rotalar için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun tekliflerle masraf paylaşımını karşılıklı netleştir. Uygunluk ve kurallar kullanıcı sorumluluğundadır; platform ticari taşımacılık hizmeti değildir.",
    driverCta:
      "Sürücü olarak planladığın rota üzerinde boş koltuğunu paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Kazanç vaadi veya profesyonel sürücülük iddiası sunulmaz.",
    faq: [
      {
        question: "Antalya'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif açarsın; rota ve zaman teklif görüşmesinde netleşir, karşılıklı onay sonrası doğrulama adımları uygulamada yürütülür.",
      },
      {
        question: "Antalya'da hangi bölgeler kapsanıyor?",
        answer:
          "Şehir içi eşleşme kullanılabilirliği bölgeye göre değişebilir. Güzergâh uyumu teklif görüşmesinde belirlenir; platform rota garantisi vermez.",
      },
      {
        question: "Antalya'da güvenlik nasıl sağlanır?",
        answer:
          "Karşılıklı onay, QR doğrulama ve topluluk sinyalleriyle desteklenen kontrollü eşleşme uygulanır. Şikayetler destek kanalından iletilebilir.",
      },
    ],
    keywords: [
      "Antalya yolculuk paylaşımı",
      "Antalya masraf paylaşımı",
      "Antalya boş koltuk",
      "Leylek TAG Antalya",
    ],
  },
  konya: {
    slug: "konya",
    cityName: "Konya",
    title: "Konya Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Konya'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Konya'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Selçuklu, Meram ve kampüs çevresi günlük rotalar için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir taahhüdü veya profesyonel taşımacılık iddiası yoktur.",
    faq: [
      {
        question: "Konya'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "Konya içi hangi rotalar destekleniyor?",
        answer:
          "Günlük güzergâhlar teklif görüşmesinde netleştirilir. Platform belirli hat garantisi vermez; uygunluk ve kurallar kullanıcı sorumluluğundadır.",
      },
      {
        question: "Konya'da ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Konya yolculuk paylaşımı",
      "Konya masraf paylaşımı",
      "Konya boş koltuk",
      "Leylek TAG Konya",
    ],
  },
  adana: {
    slug: "adana",
    cityName: "Adana",
    title: "Adana Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Adana'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Adana'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Seyhan, Çukurova ve günlük iş güzergâhları için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun tekliflerle masraf paylaşımını karşılıklı netleştir. Uygunluk ve kurallar kullanıcı sorumluluğundadır; platform ticari taşımacılık hizmeti değildir.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir garantisi sunulmaz.",
    faq: [
      {
        question: "Adana'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif açarsın; rota ve zaman teklif görüşmesinde netleşir, karşılıklı onay sonrası doğrulama adımları uygulamada yürütülür.",
      },
      {
        question: "Adana içi eşleşme nasıl belirlenir?",
        answer:
          "Rota uyumu teklif görüşmesinde netleştirilir. Platform belirli ilçe veya hat garantisi vermez; taraflar koşulları karşılıklı onaylar.",
      },
      {
        question: "Adana'da ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Adana yolculuk paylaşımı",
      "Adana masraf paylaşımı",
      "Adana boş koltuk",
      "Leylek TAG Adana",
    ],
  },
  eskisehir: {
    slug: "eskisehir",
    cityName: "Eskişehir",
    title: "Eskişehir Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Eskişehir'de aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Eskişehir'de aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Odunpazarı, Tepebaşı ve üniversite güzergâhlarında günlük rotalar için karşılıklı teklif, onay ve QR destekli doğrulama.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Profesyonel taşımacılık veya gelir vaadi yoktur.",
    faq: [
      {
        question: "Eskişehir'de Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "Eskişehir'de kampüs rotaları uygun mu?",
        answer:
          "Üniversite ve şehir içi günlük rotalar teklif görüşmesinde netleştirilir. Uygunluk ve kurallar kullanıcı sorumluluğundadır; platform hat garantisi vermez.",
      },
      {
        question: "Eskişehir'de ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Eskişehir yolculuk paylaşımı",
      "Eskişehir masraf paylaşımı",
      "Eskişehir boş koltuk",
      "Leylek TAG Eskişehir",
    ],
  },
  gaziantep: {
    slug: "gaziantep",
    cityName: "Gaziantep",
    title: "Gaziantep Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Gaziantep'te aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Gaziantep'te aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Şehitkamil, Şahinbey ve merkez günlük güzergâhları için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun tekliflerle masraf paylaşımını karşılıklı netleştir. Uygunluk ve kurallar kullanıcı sorumluluğundadır; platform ticari taşımacılık hizmeti değildir.",
    driverCta:
      "Sürücü olarak planladığın rota üzerinde boş koltuğunu paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Kazanç garantisi sunulmaz.",
    faq: [
      {
        question: "Gaziantep'te Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif açarsın; rota ve zaman teklif görüşmesinde netleşir, karşılıklı onay sonrası doğrulama adımları uygulamada yürütülür.",
      },
      {
        question: "Gaziantep içi hangi rotalar uygun?",
        answer:
          "Günlük iş ve ilçe rotaları teklif görüşmesinde netleştirilir. Platform belirli hat garantisi vermez; taraflar koşulları karşılıklı onaylar.",
      },
      {
        question: "Gaziantep'te ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Gaziantep yolculuk paylaşımı",
      "Gaziantep masraf paylaşımı",
      "Gaziantep boş koltuk",
      "Leylek TAG Gaziantep",
    ],
  },
  kayseri: {
    slug: "kayseri",
    cityName: "Kayseri",
    title: "Kayseri Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Kayseri'de aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Kayseri'de aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Kocasinan, Melikgazi ve günlük iş güzergâhları için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir taahhüdü veya profesyonel taşımacılık iddiası yoktur.",
    faq: [
      {
        question: "Kayseri'de Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "Kayseri içi hangi bölgeler kapsanıyor?",
        answer:
          "Şehir içi eşleşme kullanılabilirliği bölgeye göre değişebilir. Güzergâh uyumu teklif görüşmesinde belirlenir; uygunluk kullanıcı sorumluluğundadır.",
      },
      {
        question: "Kayseri'de ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Kayseri yolculuk paylaşımı",
      "Kayseri masraf paylaşımı",
      "Kayseri boş koltuk",
      "Leylek TAG Kayseri",
    ],
  },
  mersin: {
    slug: "mersin",
    cityName: "Mersin",
    title: "Mersin Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Mersin'de aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Mersin'de aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Yenişehir, Mezitli ve sahil hattı günlük rotalar için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun tekliflerle masraf paylaşımını karşılıklı netleştir. Uygunluk ve kurallar kullanıcı sorumluluğundadır; platform ticari taşımacılık hizmeti değildir.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Profesyonel sürücülük veya gelir vaadi sunulmaz.",
    faq: [
      {
        question: "Mersin'de Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif açarsın; rota ve zaman teklif görüşmesinde netleşir, karşılıklı onay sonrası doğrulama adımları uygulamada yürütülür.",
      },
      {
        question: "Mersin'de sahil ve merkez rotaları uygun mu?",
        answer:
          "Günlük güzergâhlar teklif görüşmesinde netleştirilir. Platform rota garantisi vermez; taraflar koşulları karşılıklı onaylar.",
      },
      {
        question: "Mersin'de ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Mersin yolculuk paylaşımı",
      "Mersin masraf paylaşımı",
      "Mersin boş koltuk",
      "Leylek TAG Mersin",
    ],
  },
  samsun: {
    slug: "samsun",
    cityName: "Samsun",
    title: "Samsun Yolculuk Paylaşımı | Leylek TAG",
    description:
      "Samsun'da aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG. Şehir içi masraf paylaşımı için uygulamayı indir.",
    heroTitle: "Samsun'da aynı yöne gidenlerle kontrollü yolculuk paylaşımı.",
    heroSubtitle:
      "Atakum, İlkadım ve günlük iş güzergâhları için karşılıklı teklif, onay ve QR destekli doğrulama akışı.",
    passengerCta:
      "Yolcu olarak gideceğin rotayı uygulamada paylaş; uygun sürücü teklifleriyle masraf paylaşımını karşılıklı görüşerek netleştir. Leylek TAG ticari taşımacılık hizmeti sunmaz.",
    driverCta:
      "Sürücü olarak boş koltuğunu aynı yöne giden yolcularla paylaş; teklif görüşmesi ve karşılıklı onay sonrası yolculuğa geç. Gelir garantisi veya profesyonel taşımacılık iddiası yoktur.",
    faq: [
      {
        question: "Samsun'da Leylek TAG nasıl kullanılır?",
        answer:
          "Uygulamayı indirip teklif oluşturursun; rota ve koşullar karşılıklı görüşmeyle netleşir, onay sonrası QR doğrulama adımları uygulamada tamamlanır.",
      },
      {
        question: "Samsun içi hangi rotalar destekleniyor?",
        answer:
          "Günlük güzergâhlar teklif görüşmesinde netleştirilir. Platform belirli hat garantisi vermez; uygunluk ve kurallar kullanıcı sorumluluğundadır.",
      },
      {
        question: "Samsun'da ödeme nasıl işler?",
        answer:
          "Platform uygulama içinde tahsilat yapmaz. Masraf paylaşımı, tarafların karşılıklı anlaşması doğrultusunda yolculuk sonrasında aralarında tamamlanır.",
      },
    ],
    keywords: [
      "Samsun yolculuk paylaşımı",
      "Samsun masraf paylaşımı",
      "Samsun boş koltuk",
      "Leylek TAG Samsun",
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

export type CityLandingLink = {
  slug: CityLandingSlug;
  cityName: string;
  href: string;
};

/** Aktif şehir hariç diğer landing sayfaları — iç linkleme için. */
export function getOtherCityLandingLinks(excludeSlug: string): CityLandingLink[] {
  return CITY_LANDING_SLUGS.filter((slug) => slug !== excludeSlug).map((slug) => ({
    slug,
    cityName: CITY_LANDING_CONTENT[slug].cityName,
    href: `/sehir/${slug}`,
  }));
}

export type CityLandingHubCard = CityLandingLink & {
  summary: string;
};

/** Tüm şehir landing sayfaları — /sehirler hub için. */
export function getAllCityLandingLinks(): CityLandingHubCard[] {
  return CITY_LANDING_SLUGS.map((slug) => {
    const content = CITY_LANDING_CONTENT[slug];
    return {
      slug,
      cityName: content.cityName,
      href: `/sehir/${slug}`,
      summary: content.heroSubtitle,
    };
  });
}
