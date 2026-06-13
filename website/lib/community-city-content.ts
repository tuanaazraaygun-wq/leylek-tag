export type CommunityPlannedSubChannel = {
  name: string;
  scope: "ilçe" | "güzergâh";
  status: string;
};

export type CommunityCityFaq = {
  question: string;
  answer: string;
};

export type CommunityCityContent = {
  slug: string;
  cityName: string;
  /** Short title for metadata template (%s | Leylek TAG) */
  title: string;
  /** Full Open Graph title */
  metaTitle: string;
  description: string;
  heroTitle: string;
  heroSubtitle: string;
  pilotStatus: string;
  intro: string;
  plannedSubChannels: CommunityPlannedSubChannel[];
  faq: CommunityCityFaq[];
  keywords: string[];
  rideShareHref: string;
};

export const COMMUNITY_CITY_SLUGS = ["ankara", "istanbul", "izmir"] as const;

export type CommunityCitySlug = (typeof COMMUNITY_CITY_SLUGS)[number];

export const COMMUNITY_CHANNEL_GUARDRAILS = [
  "Özel mesaj (DM) yok",
  "Telefon, WhatsApp veya harici iletişim bilgisi paylaşımı yok",
  "Link, Instagram kullanıcı adı ve harici sosyal yönlendirme yok",
  "Fotoğraf ve video paylaşımı yok",
  "Metin odaklı, moderasyonlu kanal akışı",
  "Raporla ve engelle — uygulama içinde",
] as const;

export const COMMUNITY_CITY_CONTENT: Record<CommunityCitySlug, CommunityCityContent> = {
  ankara: {
    slug: "ankara",
    cityName: "Ankara",
    title: "Ankara Topluluk Kanalı",
    metaTitle: "Ankara Topluluk Kanalı | Leylek TAG",
    description:
      "Ankara için planlanan Leylek Topluluk kanalı: metin odaklı rota niyet paylaşımı, pilot aşamada kontrollü açılış. DM ve harici iletişim yok; taksi veya uygulama içi tahsilat değildir.",
    heroTitle: "Ankara topluluk kanalı — pilot planı",
    heroSubtitle:
      "Ankara genelinde yolcu ve sürücü niyetinin metin odaklı, moderasyonlu kanallarda paylaşılması hedeflenir. Kanal pilot kapsamda uygulamada kontrollü biçimde açılacaktır.",
    pilotStatus: "Pilot öncelik",
    intro:
      "Ankara kanalı; Çankaya, Mamak ve Kızılay gibi alt kanallarla kademeli genişlemeyi planlar. Web sayfası bilgilendirme vitrinidir; canlı mesaj akışı henüz web sitesinde yoktur.",
    plannedSubChannels: [
      { name: "Çankaya", scope: "ilçe", status: "Planlanıyor" },
      { name: "Mamak", scope: "ilçe", status: "Planlanıyor" },
      { name: "Kızılay", scope: "güzergâh", status: "Planlanıyor" },
    ],
    faq: [
      {
        question: "Ankara topluluk kanalı şu an aktif mi?",
        answer:
          "Hayır. Kanal pilot planı kapsamındadır; canlı akış uygulamada kontrollü açılışla devreye alınacaktır. Web sayfası yalnızca bilgilendirme amaçlıdır.",
      },
      {
        question: "Ankara kanalında mesajlaşma nasıl işler?",
        answer:
          "Özel mesaj yoktur. Metin odaklı kanal akışı moderasyonlu ilerler; telefon, link ve sosyal medya paylaşımı kanal kurallarına aykırıdır.",
      },
      {
        question: "Güven Ağı ve teklif süreci nerede tamamlanır?",
        answer:
          "Güven Ağı daveti ve yolculuk/teklif taslağı yalnızca mobil uygulamada, karşılıklı onay adımlarıyla oluşturulur.",
      },
    ],
    keywords: [
      "Ankara topluluk kanalı",
      "Ankara yol paylaşımı topluluk",
      "Leylek Topluluk Ankara",
      "Ankara rota niyet kanalı",
    ],
    rideShareHref: "/sehir/ankara",
  },
  istanbul: {
    slug: "istanbul",
    cityName: "İstanbul",
    title: "İstanbul Topluluk Kanalı",
    metaTitle: "İstanbul Topluluk Kanalı | Leylek TAG",
    description:
      "İstanbul için planlanan Leylek Topluluk kanalı: şehir bazlı metin odaklı rota niyet paylaşımı, pilot aşamada kontrollü açılış. Taksi veya uygulama içi tahsilat değildir.",
    heroTitle: "İstanbul topluluk kanalı — pilot planı",
    heroSubtitle:
      "İstanbul genelinde aynı yöne giden yolcu ve sürücü niyetinin metin odaklı kanallarda paylaşılması planlanır. Kanal pilot kapsamda uygulamada kontrollü biçimde açılacaktır.",
    pilotStatus: "Planlanıyor",
    intro:
      "İstanbul kanalı şehir geneli pilot olarak değerlendirilir; ilçe ve güzergâh kanalları açılış sırası pilot geri bildirimine göre netleşir. Web sayfası bilgilendirme vitrinidir.",
    plannedSubChannels: [],
    faq: [
      {
        question: "İstanbul topluluk kanalı ne zaman açılır?",
        answer:
          "Açılış tarihi pilot planına bağlıdır. Kanal uygulamada devreye girdiğinde bu sayfadan duyurulacaktır; web sitesinde canlı akış bulunmaz.",
      },
      {
        question: "İstanbul kanalında hangi paylaşımlar yasaktır?",
        answer:
          "Telefon, WhatsApp, link, Instagram kullanıcı adı, fotoğraf, video ve özel mesaj paylaşımı yasaktır. Akış metin odaklı ve moderasyonludur.",
      },
      {
        question: "Masraf paylaşımı kanalda mı yapılır?",
        answer:
          "Masraf paylaşımı topluluk kuralları çerçevesinde taraflar arasında netleşir. Platform uygulama içinde ödeme tahsilatı yapmaz; teklif taslağı uygulamada oluşturulur.",
      },
    ],
    keywords: [
      "İstanbul topluluk kanalı",
      "İstanbul yol paylaşımı topluluk",
      "Leylek Topluluk İstanbul",
    ],
    rideShareHref: "/sehir/istanbul",
  },
  izmir: {
    slug: "izmir",
    cityName: "İzmir",
    title: "İzmir Topluluk Kanalı",
    metaTitle: "İzmir Topluluk Kanalı | Leylek TAG",
    description:
      "İzmir için planlanan Leylek Topluluk kanalı: metin odaklı rota niyet paylaşımı, pilot aşamada kontrollü açılış. DM ve harici iletişim yok; ticari taşımacılık değildir.",
    heroTitle: "İzmir topluluk kanalı — pilot planı",
    heroSubtitle:
      "İzmir genelinde yolcu ve sürücü niyetinin metin odaklı, moderasyonlu kanallarda paylaşılması hedeflenir. Kanal pilot kapsamda uygulamada kontrollü biçimde açılacaktır.",
    pilotStatus: "Planlanıyor",
    intro:
      "İzmir kanalı pilot şehirler arasında planlanmıştır. Alt ilçe kanalları açılış önceliği pilot topluluk geri bildirimine göre belirlenir. Web sayfası bilgilendirme vitrinidir.",
    plannedSubChannels: [],
    faq: [
      {
        question: "İzmir topluluk kanalı aktif mi?",
        answer:
          "Henüz değil. Kanal pilot planı kapsamındadır; canlı akış mobil uygulamada kontrollü açılışla başlayacaktır.",
      },
      {
        question: "İzmir kanalında yolcu/sürücü etiketi var mı?",
        answer:
          "Planlanan modelde paylaşımlarda yolcu veya sürücü niyeti netleştirilir. Detaylar kanal kuralları ve uygulama içi akışla yürütülür.",
      },
      {
        question: "Web sitesinden kanala katılabilir miyim?",
        answer:
          "Hayır. Kanallar mobil uygulamada devreye alınacaktır. Web sayfası yalnızca kanal planını ve kuralları anlatır.",
      },
    ],
    keywords: [
      "İzmir topluluk kanalı",
      "İzmir yol paylaşımı topluluk",
      "Leylek Topluluk İzmir",
    ],
    rideShareHref: "/sehir/izmir",
  },
};

export function getCommunityCityBySlug(slug: string): CommunityCityContent | undefined {
  if (!(COMMUNITY_CITY_SLUGS as readonly string[]).includes(slug)) return undefined;
  return COMMUNITY_CITY_CONTENT[slug as CommunityCitySlug];
}

export type CommunityCityLink = {
  slug: CommunityCitySlug;
  cityName: string;
  href: string;
  pilotStatus: string;
};

export function getOtherCommunityCityLinks(excludeSlug: string): CommunityCityLink[] {
  return COMMUNITY_CITY_SLUGS.filter((slug) => slug !== excludeSlug).map((slug) => {
    const content = COMMUNITY_CITY_CONTENT[slug];
    return {
      slug,
      cityName: content.cityName,
      href: `/topluluk/${slug}`,
      pilotStatus: content.pilotStatus,
    };
  });
}

/** Şehir kapsamlı planlanan kanallar için hub linki (ilçe/güzergâh kartları linklenmez). */
export function getCommunityCityHrefForChannel(name: string, scope: string): string | null {
  if (scope !== "şehir") return null;
  const match = COMMUNITY_CITY_SLUGS.find((slug) => COMMUNITY_CITY_CONTENT[slug].cityName === name);
  return match ? `/topluluk/${match}` : null;
}

/** Pilot topluluk şehirleri için /sehir cross-link (ankara, istanbul, izmir). */
export function getCommunityHrefForCityLandingSlug(slug: string): string | null {
  if (!(COMMUNITY_CITY_SLUGS as readonly string[]).includes(slug)) return null;
  return `/topluluk/${slug}`;
}

export type PilotCityDualLink = {
  cityName: string;
  communityHref: string;
  rideShareHref: string;
  pilotStatus: string;
};

export function getPilotCommunityCityDualLinks(): PilotCityDualLink[] {
  return COMMUNITY_CITY_SLUGS.map((slug) => {
    const content = COMMUNITY_CITY_CONTENT[slug];
    return {
      cityName: content.cityName,
      communityHref: `/topluluk/${slug}`,
      rideShareHref: content.rideShareHref,
      pilotStatus: content.pilotStatus,
    };
  });
}
