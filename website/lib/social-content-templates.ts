export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_CONTENT_TYPES = [
  "post",
  "story",
  "kampanya",
  "surucu_cagrisi",
  "yolcu_cagrisi",
] as const;
export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number];

export const SOCIAL_LANDING_CITY_SLUGS = [
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

export type SocialLandingCitySlug = (typeof SOCIAL_LANDING_CITY_SLUGS)[number];

export const SOCIAL_CITIES = ["genel", ...SOCIAL_LANDING_CITY_SLUGS] as const;
export type SocialCity = (typeof SOCIAL_CITIES)[number];

export const SOCIAL_TEMPLATE_CITIES: readonly SocialCity[] = SOCIAL_CITIES;

export const SOCIAL_TONES = ["kurumsal", "samimi", "kisa", "kampanya"] as const;
export type SocialTone = (typeof SOCIAL_TONES)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

export const SOCIAL_CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  post: "Gönderi (post)",
  story: "Story",
  kampanya: "Kampanya",
  surucu_cagrisi: "Sürücü çağrısı",
  yolcu_cagrisi: "Yolcu çağrısı",
};

export const SOCIAL_CITY_LABELS: Record<SocialCity, string> = {
  genel: "Genel",
  ankara: "Ankara",
  istanbul: "İstanbul",
  izmir: "İzmir",
  bursa: "Bursa",
  antalya: "Antalya",
  konya: "Konya",
  adana: "Adana",
  eskisehir: "Eskişehir",
  gaziantep: "Gaziantep",
  kayseri: "Kayseri",
  mersin: "Mersin",
  samsun: "Samsun",
};

export function getSocialCityCtaUrl(city: SocialCity): string {
  if (city === "genel") return "https://leylektag.com/indir";
  return `https://leylektag.com/sehir/${city}`;
}

const SOCIAL_CITY_HASHTAGS: Record<SocialLandingCitySlug, string> = {
  ankara: "#Ankara",
  istanbul: "#Istanbul",
  izmir: "#Izmir",
  bursa: "#Bursa",
  antalya: "#Antalya",
  konya: "#Konya",
  adana: "#Adana",
  eskisehir: "#Eskisehir",
  gaziantep: "#Gaziantep",
  kayseri: "#Kayseri",
  mersin: "#Mersin",
  samsun: "#Samsun",
};

export function isSocialCity(value: string): value is SocialCity {
  return (SOCIAL_CITIES as readonly string[]).includes(value);
}

/** Ops Map slug → Social Studio city; unsupported slugs return null (keep Genel). */
export function resolveSocialCityFromOpsMapSlug(slug: string | null | undefined): SocialCity | null {
  if (!slug) return null;
  if (isSocialCity(slug)) return slug;
  return null;
}

export const SOCIAL_TONE_LABELS: Record<SocialTone, string> = {
  kurumsal: "Kurumsal",
  samimi: "Samimi",
  kisa: "Kısa",
  kampanya: "Kampanya",
};

/** Admin panelinde gösterilecek yasak / riskli ifade uyarıları. */
export const SOCIAL_RISK_COPY_NOTES = [
  "“Taksi alternatifi” veya ticari taşımacılık iddiası kullanmayın.",
  "“Kazanç garantisi”, “günlük gelir” veya benzeri gelir vaadi vermeyin.",
  "Platform uygulama içi tahsilat yapmaz; ödeme taraflar arasında netleşir.",
  "Uygunluk ve kurallara uyum kullanıcı sorumluluğundadır; mevzuat iddiası abartmayın.",
  "Instagram / TikTok / X API kullanılmaz; içeriği yalnızca manuel kopyalayıp paylaşın.",
] as const;

export const SOCIAL_SAFE_HASHTAGS = [
  "#LeylekTAG",
  "#YolculukPaylasimi",
  "#MasrafPaylasimi",
  "#AyniYoneGidenler",
  "#GuvenliEslesme",
  "#BosKoltuk",
  "#SehirIci",
] as const;

export type SocialGeneratedContent = {
  caption: string;
  hashtags: string[];
  storyText: string;
  cta: string;
  variationLabel: string;
  platformNote: string;
};

type SocialTemplate = {
  id: string;
  platforms: readonly SocialPlatform[];
  contentTypes: readonly SocialContentType[];
  cities: readonly SocialCity[];
  tones: readonly SocialTone[];
  variationLabel: string;
  caption: (ctx: TemplateContext) => string;
  storyText: (ctx: TemplateContext) => string;
  extraHashtags?: readonly string[];
  cta: (ctx: TemplateContext) => string;
};

type TemplateContext = {
  platform: SocialPlatform;
  contentType: SocialContentType;
  city: SocialCity;
  tone: SocialTone;
  cityLabel: string;
};

function cityLabel(city: SocialCity): string {
  return SOCIAL_CITY_LABELS[city];
}

function platformNote(platform: SocialPlatform): string {
  switch (platform) {
    case "instagram":
      return "Instagram: caption + hashtag; görseli ayrı hazırlayın. Otomatik paylaşım yok.";
    case "tiktok":
      return "TikTok: kısa hook + açıklama; video metnini story alanından uyarlayabilirsiniz.";
    case "x":
      return "X: kısa metin tercih edin; gerekirse caption’ı kısaltın.";
  }
}

const TEMPLATES: SocialTemplate[] = [
  {
    id: "post-kurumsal-genel",
    platforms: ["instagram", "x"],
    contentTypes: ["post"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kurumsal"],
    variationLabel: "Kurumsal tanıtım",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? `${c}'da ` : ""}aynı yöne giden yolcu ve sürücüleri karşılıklı teklif ve onayla buluşturan Leylek TAG.\n\nYolculuk paylaşımı ve masraf paylaşımı topluluk kuralları çerçevesinde ilerler. Ticari taşımacılık hizmeti sunulmaz.`,
    storyText: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + " · " : ""}Leylek TAG — kontrollü yolculuk paylaşımı. Uygulamayı indir →`,
    cta: (ctx) => getSocialCityCtaUrl(ctx.city),
    extraHashtags: ["#LeylekTAG"],
  },
  {
    id: "post-samimi-genel",
    platforms: ["instagram", "tiktok"],
    contentTypes: ["post"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["samimi"],
    variationLabel: "Samimi tanıtım",
    caption: ({ cityLabel: c }) =>
      `Aynı yöne gidiyorsan boş koltuk veya rota paylaşımı Leylek TAG ile daha net.\n\n${c !== "Genel" ? c + "'da " : ""}teklifini aç, detayları konuş, karşılıklı onayla eşleş. Yolculuk paylaşımı — gelir vaadi yok, topluluk odaklı.`,
    storyText: () => "Boş koltuğun mu var? Rota mı arıyorsun? Leylek TAG’i dene →",
    cta: (ctx) => `Uygulamayı indir: ${getSocialCityCtaUrl(ctx.city)}`,
  },
  {
    id: "post-kisa-x",
    platforms: ["x", "tiktok"],
    contentTypes: ["post"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kisa"],
    variationLabel: "Kısa duyuru",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + ": " : ""}Aynı yöne gidenler için yolculuk paylaşımı — Leylek TAG. Karşılıklı teklif, onay, QR doğrulama.`,
    storyText: () => "Leylek TAG · yolculuk paylaşımı",
    cta: (ctx) => getSocialCityCtaUrl(ctx.city),
  },
  {
    id: "story-samimi",
    platforms: ["instagram", "tiktok"],
    contentTypes: ["story"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["samimi", "kisa"],
    variationLabel: "Story hook",
    caption: ({ cityLabel: c }) =>
      `Story metni aşağıda. ${c !== "Genel" ? c + " için " : ""}görsel üzerine kısa metin + kaydırma linki ekleyin.`,
    storyText: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + " · " : ""}Aynı yöne gidenler burada 👇\nYolculuk paylaşımı · Leylek TAG`,
    cta: (ctx) => `Link: ${getSocialCityCtaUrl(ctx.city)}`,
  },
  {
    id: "story-kampanya",
    platforms: ["instagram", "tiktok", "x"],
    contentTypes: ["story", "kampanya"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kampanya"],
    variationLabel: "Kampanya story",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + " pilot " : "Pilot "}topluluğa davet: Leylek TAG ile şehir içi yolculuk paylaşımını keşfet.\n\nOtomatik paylaşım yok — metni kopyalayıp kendi kanalınızda yayınlayın.`,
    storyText: () => "Pilot topluluk · Leylek TAG\nYolculuk paylaşımı · Şimdi dene",
    cta: (ctx) => `Detay: ${getSocialCityCtaUrl(ctx.city)}`,
    extraHashtags: ["#PilotTopluluk"],
  },
  {
    id: "kampanya-kurumsal",
    platforms: ["instagram", "x"],
    contentTypes: ["kampanya"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kurumsal", "kampanya"],
    variationLabel: "Kampanya duyurusu",
    caption: ({ cityLabel: c }) =>
      `Kampanya metni — ${c !== "Genel" ? c : "Türkiye geneli"}\n\nLeylek TAG: karşılıklı teklif ve onayla ilerleyen yolculuk paylaşımı platformu. Masraf paylaşımı taraflar arasında netleşir; platform tahsilat yapmaz.\n\nUygunluk ve kurallara uyum kullanıcı sorumluluğundadır.`,
    storyText: ({ cityLabel: c }) => `${c !== "Genel" ? c + " · " : ""}Kampanya · Leylek TAG`,
    cta: (ctx) =>
      ctx.city === "genel"
        ? "https://leylektag.com/indir · https://leylektag.com/nasil-calisir"
        : getSocialCityCtaUrl(ctx.city),
    extraHashtags: ["#LeylekTAG", "#YolculukPaylasimi"],
  },
  {
    id: "surucu-samimi",
    platforms: ["instagram", "tiktok", "x"],
    contentTypes: ["surucu_cagrisi"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["samimi", "kampanya"],
    variationLabel: "Sürücü çağrısı — samimi",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + "'da " : ""}zaten gideceğin rotada boş koltuğun mu var?\n\nLeylek TAG ile aynı yöne giden yolcularla masraf paylaşımını karşılıklı teklif ve onayla netleştir. Profesyonel taşımacılık veya gelir garantisi yoktur — topluluk temelli yolculuk paylaşımı.`,
    storyText: () => "Sürücüler: boş koltuğunu paylaş 🚗\nLeylek TAG · yolculuk paylaşımı",
    cta: (ctx) => `Sürücü olarak başla: ${getSocialCityCtaUrl(ctx.city)}`,
    extraHashtags: ["#BosKoltuk", "#Surucu"],
  },
  {
    id: "surucu-kurumsal",
    platforms: ["instagram", "x"],
    contentTypes: ["surucu_cagrisi"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kurumsal"],
    variationLabel: "Sürücü çağrısı — kurumsal",
    caption: ({ cityLabel: c }) =>
      `Sürücü daveti${c !== "Genel" ? ` · ${c}` : ""}\n\nPlanladığınız rota üzerinde boş koltuk paylaşımı için Leylek TAG uygulamasında teklif oluşturun. Eşleşme karşılıklı onay ve QR doğrulama adımlarıyla ilerler.`,
    storyText: ({ cityLabel: c }) => `${c !== "Genel" ? c + " · " : ""}Sürücü daveti · Leylek TAG`,
    cta: (ctx) => getSocialCityCtaUrl(ctx.city),
    extraHashtags: ["#BosKoltuk"],
  },
  {
    id: "yolcu-samimi",
    platforms: ["instagram", "tiktok", "x"],
    contentTypes: ["yolcu_cagrisi"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["samimi", "kisa"],
    variationLabel: "Yolcu çağrısı — samimi",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + "'da " : ""}aynı yöne mi gidiyorsun?\n\nLeylek TAG ile rota paylaşımı ve masraf paylaşımını karşılıklı teklif görüşmesiyle netleştir. Yolculuk paylaşımı topluluk kuralları çerçevesindedir.`,
    storyText: () => "Yolcu: rotanı paylaş, teklifleri gör 👋",
    cta: (ctx) => getSocialCityCtaUrl(ctx.city),
    extraHashtags: ["#Yolcu", "#MasrafPaylasimi"],
  },
  {
    id: "yolcu-kurumsal",
    platforms: ["instagram", "x"],
    contentTypes: ["yolcu_cagrisi"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kurumsal", "kampanya"],
    variationLabel: "Yolcu çağrısı — kurumsal",
    caption: ({ cityLabel: c }) =>
      `Yolcu daveti${c !== "Genel" ? ` · ${c}` : ""}\n\nGideceğiniz rotayı uygulamada paylaşın; uygun tekliflerle masraf paylaşımını karşılıklı netleştirin. Leylek TAG ticari taşımacılık hizmeti değildir.`,
    storyText: ({ cityLabel: c }) => `${c !== "Genel" ? c + " · " : ""}Yolcu daveti · Leylek TAG`,
    cta: (ctx) =>
      ctx.city === "genel"
        ? "https://leylektag.com/indir · https://leylektag.com/sehir-ici"
        : getSocialCityCtaUrl(ctx.city),
    extraHashtags: ["#YolculukPaylasimi"],
  },
  {
    id: "tiktok-kisa-kampanya",
    platforms: ["tiktok"],
    contentTypes: ["post", "kampanya", "yolcu_cagrisi", "surucu_cagrisi"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kisa", "kampanya"],
    variationLabel: "TikTok kısa hook",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + " · " : ""}Aynı yöne gidenler? Leylek TAG.\nYolculuk paylaşımı · karşılıklı onay · QR doğrulama`,
    storyText: () => "POV: Rotanı paylaştın, teklif geldi ✅\n#LeylekTAG",
    cta: (ctx) => `Bio link: ${getSocialCityCtaUrl(ctx.city)}`,
  },
  {
    id: "x-kisa-surucu",
    platforms: ["x"],
    contentTypes: ["post", "surucu_cagrisi", "kampanya"],
    cities: SOCIAL_TEMPLATE_CITIES,
    tones: ["kisa"],
    variationLabel: "X kısa sürücü",
    caption: ({ cityLabel: c }) =>
      `${c !== "Genel" ? c + ": " : ""}Boş koltuk paylaşımı · Leylek TAG. Yolculuk paylaşımı, karşılıklı teklif. Gelir vaadi yok.`,
    storyText: () => "Leylek TAG · yolculuk paylaşımı",
    cta: (ctx) => getSocialCityCtaUrl(ctx.city),
  },
];

function templateMatches(t: SocialTemplate, ctx: TemplateContext): boolean {
  if (!t.platforms.includes(ctx.platform)) return false;
  if (!t.contentTypes.includes(ctx.contentType)) return false;
  if (!t.tones.includes(ctx.tone)) return false;
  if (t.cities.includes(ctx.city) || t.cities.includes("genel")) return true;
  if (ctx.city === "genel") return t.cities.length > 0;
  return false;
}

function pickHashtags(template: SocialTemplate, city: SocialCity): string[] {
  const base: string[] = ["#LeylekTAG", "#YolculukPaylasimi"];
  if (city !== "genel") {
    const cityTag = SOCIAL_CITY_HASHTAGS[city];
    if (cityTag && !base.includes(cityTag)) base.push(cityTag);
  }
  for (const tag of SOCIAL_SAFE_HASHTAGS) {
    if (!base.includes(tag)) base.push(tag);
  }
  if (template.extraHashtags) {
    for (const tag of template.extraHashtags) {
      if (!base.includes(tag)) base.push(tag);
    }
  }
  return base.slice(0, 10);
}

export function buildSocialContent(
  platform: SocialPlatform,
  contentType: SocialContentType,
  city: SocialCity,
  tone: SocialTone,
  variationIndex: number,
): SocialGeneratedContent {
  const ctx: TemplateContext = {
    platform,
    contentType,
    city,
    tone,
    cityLabel: cityLabel(city),
  };

  let matched = TEMPLATES.filter((t) => templateMatches(t, ctx));

  if (matched.length === 0) {
    matched = TEMPLATES.filter(
      (t) =>
        t.platforms.includes(platform) &&
        t.contentTypes.includes(contentType) &&
        t.cities.includes("genel"),
    );
  }

  if (matched.length === 0) {
    matched = TEMPLATES.filter((t) => t.platforms.includes(platform));
  }

  const template = matched[variationIndex % matched.length] ?? TEMPLATES[0];

  return {
    caption: template.caption(ctx),
    hashtags: pickHashtags(template, city),
    storyText: template.storyText(ctx),
    cta: template.cta(ctx),
    variationLabel: template.variationLabel,
    platformNote: platformNote(platform),
  };
}

export function formatSocialCopyBundle(content: SocialGeneratedContent): string {
  const tags = content.hashtags.join(" ");
  return `${content.caption}\n\n${tags}\n\nStory / kısa metin:\n${content.storyText}\n\nCTA: ${content.cta}`;
}
