export const TURKEY_GEOGRAPHIC_REGIONS = [
  "Marmara",
  "Ege",
  "İç Anadolu",
  "Karadeniz",
  "Akdeniz",
  "Doğu Anadolu",
  "Güneydoğu Anadolu",
] as const;

export type TurkeyGeographicRegion = (typeof TURKEY_GEOGRAPHIC_REGIONS)[number];

export type TurkeyCityEntry = {
  slug: string;
  name: string;
  region: TurkeyGeographicRegion;
};

/** 81 il — slug tabanlı; ağır string union yok. */
export const TURKEY_CITIES: TurkeyCityEntry[] = [
  { slug: "adana", name: "Adana", region: "Akdeniz" },
  { slug: "adiyaman", name: "Adıyaman", region: "Güneydoğu Anadolu" },
  { slug: "afyonkarahisar", name: "Afyonkarahisar", region: "Ege" },
  { slug: "agri", name: "Ağrı", region: "Doğu Anadolu" },
  { slug: "amasya", name: "Amasya", region: "Karadeniz" },
  { slug: "ankara", name: "Ankara", region: "İç Anadolu" },
  { slug: "antalya", name: "Antalya", region: "Akdeniz" },
  { slug: "artvin", name: "Artvin", region: "Karadeniz" },
  { slug: "aydin", name: "Aydın", region: "Ege" },
  { slug: "balikesir", name: "Balıkesir", region: "Marmara" },
  { slug: "bilecik", name: "Bilecik", region: "Marmara" },
  { slug: "bingol", name: "Bingöl", region: "Doğu Anadolu" },
  { slug: "bitlis", name: "Bitlis", region: "Doğu Anadolu" },
  { slug: "bolu", name: "Bolu", region: "Marmara" },
  { slug: "burdur", name: "Burdur", region: "Akdeniz" },
  { slug: "bursa", name: "Bursa", region: "Marmara" },
  { slug: "canakkale", name: "Çanakkale", region: "Marmara" },
  { slug: "cankiri", name: "Çankırı", region: "İç Anadolu" },
  { slug: "corum", name: "Çorum", region: "Karadeniz" },
  { slug: "denizli", name: "Denizli", region: "Ege" },
  { slug: "diyarbakir", name: "Diyarbakır", region: "Güneydoğu Anadolu" },
  { slug: "edirne", name: "Edirne", region: "Marmara" },
  { slug: "elazig", name: "Elazığ", region: "Doğu Anadolu" },
  { slug: "erzincan", name: "Erzincan", region: "Doğu Anadolu" },
  { slug: "erzurum", name: "Erzurum", region: "Doğu Anadolu" },
  { slug: "eskisehir", name: "Eskişehir", region: "İç Anadolu" },
  { slug: "gaziantep", name: "Gaziantep", region: "Güneydoğu Anadolu" },
  { slug: "giresun", name: "Giresun", region: "Karadeniz" },
  { slug: "gumushane", name: "Gümüşhane", region: "Karadeniz" },
  { slug: "hakkari", name: "Hakkari", region: "Doğu Anadolu" },
  { slug: "hatay", name: "Hatay", region: "Akdeniz" },
  { slug: "isparta", name: "Isparta", region: "Akdeniz" },
  { slug: "mersin", name: "Mersin", region: "Akdeniz" },
  { slug: "istanbul", name: "İstanbul", region: "Marmara" },
  { slug: "izmir", name: "İzmir", region: "Ege" },
  { slug: "kars", name: "Kars", region: "Doğu Anadolu" },
  { slug: "kastamonu", name: "Kastamonu", region: "Karadeniz" },
  { slug: "kayseri", name: "Kayseri", region: "İç Anadolu" },
  { slug: "kirklareli", name: "Kırklareli", region: "Marmara" },
  { slug: "kirsehir", name: "Kırşehir", region: "İç Anadolu" },
  { slug: "kocaeli", name: "Kocaeli", region: "Marmara" },
  { slug: "konya", name: "Konya", region: "İç Anadolu" },
  { slug: "kutahya", name: "Kütahya", region: "Ege" },
  { slug: "malatya", name: "Malatya", region: "Doğu Anadolu" },
  { slug: "manisa", name: "Manisa", region: "Ege" },
  { slug: "kahramanmaras", name: "Kahramanmaraş", region: "Akdeniz" },
  { slug: "mardin", name: "Mardin", region: "Güneydoğu Anadolu" },
  { slug: "mugla", name: "Muğla", region: "Ege" },
  { slug: "mus", name: "Muş", region: "Doğu Anadolu" },
  { slug: "nevsehir", name: "Nevşehir", region: "İç Anadolu" },
  { slug: "nigde", name: "Niğde", region: "İç Anadolu" },
  { slug: "ordu", name: "Ordu", region: "Karadeniz" },
  { slug: "rize", name: "Rize", region: "Karadeniz" },
  { slug: "sakarya", name: "Sakarya", region: "Marmara" },
  { slug: "samsun", name: "Samsun", region: "Karadeniz" },
  { slug: "siirt", name: "Siirt", region: "Güneydoğu Anadolu" },
  { slug: "sinop", name: "Sinop", region: "Karadeniz" },
  { slug: "sivas", name: "Sivas", region: "İç Anadolu" },
  { slug: "tekirdag", name: "Tekirdağ", region: "Marmara" },
  { slug: "tokat", name: "Tokat", region: "Karadeniz" },
  { slug: "trabzon", name: "Trabzon", region: "Karadeniz" },
  { slug: "tunceli", name: "Tunceli", region: "Doğu Anadolu" },
  { slug: "sanliurfa", name: "Şanlıurfa", region: "Güneydoğu Anadolu" },
  { slug: "usak", name: "Uşak", region: "Ege" },
  { slug: "van", name: "Van", region: "Doğu Anadolu" },
  { slug: "yozgat", name: "Yozgat", region: "İç Anadolu" },
  { slug: "zonguldak", name: "Zonguldak", region: "Karadeniz" },
  { slug: "aksaray", name: "Aksaray", region: "İç Anadolu" },
  { slug: "bayburt", name: "Bayburt", region: "Karadeniz" },
  { slug: "karaman", name: "Karaman", region: "İç Anadolu" },
  { slug: "kirikkale", name: "Kırıkkale", region: "İç Anadolu" },
  { slug: "batman", name: "Batman", region: "Güneydoğu Anadolu" },
  { slug: "sirnak", name: "Şırnak", region: "Güneydoğu Anadolu" },
  { slug: "bartin", name: "Bartın", region: "Karadeniz" },
  { slug: "ardahan", name: "Ardahan", region: "Doğu Anadolu" },
  { slug: "igdir", name: "Iğdır", region: "Doğu Anadolu" },
  { slug: "yalova", name: "Yalova", region: "Marmara" },
  { slug: "karabuk", name: "Karabük", region: "Karadeniz" },
  { slug: "kilis", name: "Kilis", region: "Güneydoğu Anadolu" },
  { slug: "osmaniye", name: "Osmaniye", region: "Akdeniz" },
  { slug: "duzce", name: "Düzce", region: "Marmara" },
];

export const TURKEY_CITY_SLUGS = TURKEY_CITIES.map((c) => c.slug);

export type OperationsMapCitySlug = string;

export const OPERATIONS_MAP_POPULAR_CITY_SLUGS = [
  "istanbul",
  "ankara",
  "izmir",
  "bursa",
  "antalya",
  "konya",
  "adana",
] as const;

const cityBySlug = new Map(TURKEY_CITIES.map((c) => [c.slug, c]));

export function getTurkeyCityBySlug(slug: string): TurkeyCityEntry | undefined {
  return cityBySlug.get(slug);
}

export function getTurkeyCityLabel(slug: string): string {
  return cityBySlug.get(slug)?.name ?? slug;
}

export function isTurkeyCitySlug(slug: string): boolean {
  return cityBySlug.has(slug);
}

export function normalizeTurkeyCitySearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function filterTurkeyCities(options: {
  query?: string;
  region?: TurkeyGeographicRegion | "all";
}): TurkeyCityEntry[] {
  const q = options.query ? normalizeTurkeyCitySearch(options.query) : "";
  return TURKEY_CITIES.filter((city) => {
    if (options.region && options.region !== "all" && city.region !== options.region) return false;
    if (!q) return true;
    const name = normalizeTurkeyCitySearch(city.name);
    return name.includes(q) || city.slug.includes(q);
  });
}
