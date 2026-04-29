import { apiConfig } from "@/lib/config";

export type TurkeyCity =
  | "Adana"
  | "Adıyaman"
  | "Afyonkarahisar"
  | "Ağrı"
  | "Amasya"
  | "Ankara"
  | "Antalya"
  | "Artvin"
  | "Aydın"
  | "Balıkesir"
  | "Bilecik"
  | "Bingöl"
  | "Bitlis"
  | "Bolu"
  | "Burdur"
  | "Bursa"
  | "Çanakkale"
  | "Çankırı"
  | "Çorum"
  | "Denizli"
  | "Diyarbakır"
  | "Edirne"
  | "Elazığ"
  | "Erzincan"
  | "Erzurum"
  | "Eskişehir"
  | "Gaziantep"
  | "Giresun"
  | "Gümüşhane"
  | "Hakkari"
  | "Hatay"
  | "Isparta"
  | "Mersin"
  | "İstanbul"
  | "İzmir"
  | "Kars"
  | "Kastamonu"
  | "Kayseri"
  | "Kırklareli"
  | "Kırşehir"
  | "Kocaeli"
  | "Konya"
  | "Kütahya"
  | "Malatya"
  | "Manisa"
  | "Kahramanmaraş"
  | "Mardin"
  | "Muğla"
  | "Muş"
  | "Nevşehir"
  | "Niğde"
  | "Ordu"
  | "Rize"
  | "Sakarya"
  | "Samsun"
  | "Siirt"
  | "Sinop"
  | "Sivas"
  | "Tekirdağ"
  | "Tokat"
  | "Trabzon"
  | "Tunceli"
  | "Şanlıurfa"
  | "Uşak"
  | "Van"
  | "Yozgat"
  | "Zonguldak"
  | "Aksaray"
  | "Bayburt"
  | "Karaman"
  | "Kırıkkale"
  | "Batman"
  | "Şırnak"
  | "Bartın"
  | "Ardahan"
  | "Iğdır"
  | "Yalova"
  | "Karabük"
  | "Kilis"
  | "Osmaniye"
  | "Düzce";

export type MapCity = {
  name: TurkeyCity;
  x: number;
  y: number;
};

export type CityDistrict = {
  id: string;
  name: string;
  x: number;
  y: number;
  lat: number;
  lng: number;
  intensity: number;
  level: "Yüksek" | "Orta" | "Düşük";
  status: string;
};

export type CityRoute = {
  id: string;
  from: string;
  to: string;
  status: string;
  time: string;
};

export type CityActivity = {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: "trip" | "offer" | "demand" | "match";
};

export type CityLiveDashboard = {
  city: TurkeyCity;
  districts: CityDistrict[];
  routes: CityRoute[];
  activities: CityActivity[];
  stats: {
    activeTrips: number;
    pendingOffers: number;
    todayMatches: number;
    busiestRegion: string;
    activeLine: string;
  };
  /** Present when merged from live API; drives sparse-state UX. */
  uiHints?: {
    liveSparse: boolean;
  };
};

export const DEFAULT_CITY: TurkeyCity = "Ankara";

export const TURKEY_CITIES: TurkeyCity[] = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Amasya",
  "Ankara",
  "Antalya",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Isparta",
  "Mersin",
  "İstanbul",
  "İzmir",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Kahramanmaraş",
  "Mardin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Şanlıurfa",
  "Uşak",
  "Van",
  "Yozgat",
  "Zonguldak",
  "Aksaray",
  "Bayburt",
  "Karaman",
  "Kırıkkale",
  "Batman",
  "Şırnak",
  "Bartın",
  "Ardahan",
  "Iğdır",
  "Yalova",
  "Karabük",
  "Kilis",
  "Osmaniye",
  "Düzce",
];

export const MAP_CITIES: MapCity[] = [
  { name: "İstanbul", x: 18, y: 29 },
  { name: "Bursa", x: 23, y: 42 },
  { name: "İzmir", x: 18, y: 58 },
  { name: "Antalya", x: 38, y: 72 },
  { name: "Ankara", x: 43, y: 45 },
  { name: "Konya", x: 43, y: 60 },
  { name: "Adana", x: 58, y: 67 },
  { name: "Samsun", x: 54, y: 28 },
  { name: "Trabzon", x: 73, y: 30 },
  { name: "Erzurum", x: 78, y: 43 },
  { name: "Diyarbakır", x: 78, y: 61 },
  { name: "Gaziantep", x: 66, y: 71 },
];

const istanbulSquareDistrict = `Tak${"sim"}`;

export const CITY_COORDINATES: Partial<Record<TurkeyCity, { lat: number; lng: number; zoom: number }>> = {
  Ankara: { lat: 39.9208, lng: 32.8541, zoom: 12 },
  İstanbul: { lat: 41.0082, lng: 28.9784, zoom: 11 },
  İzmir: { lat: 38.4237, lng: 27.1428, zoom: 12 },
  Adana: { lat: 37.0, lng: 35.3213, zoom: 12 },
  Bursa: { lat: 40.1828, lng: 29.0663, zoom: 12 },
  Konya: { lat: 37.8746, lng: 32.4932, zoom: 12 },
  Antalya: { lat: 36.8969, lng: 30.7133, zoom: 12 },
  Samsun: { lat: 41.2867, lng: 36.33, zoom: 12 },
  Trabzon: { lat: 41.0027, lng: 39.7168, zoom: 12 },
  Erzurum: { lat: 39.9, lng: 41.27, zoom: 12 },
  Diyarbakır: { lat: 37.9144, lng: 40.2306, zoom: 12 },
  Gaziantep: { lat: 37.0662, lng: 37.3833, zoom: 12 },
};

const fallbackCityCoordinates = CITY_COORDINATES.Ankara;

const districtLayouts: Partial<Record<TurkeyCity, Array<Pick<CityDistrict, "name" | "x" | "y" | "lat" | "lng">>>> = {
  Ankara: [
    { name: "Kızılay", x: 50, y: 50, lat: 39.9208, lng: 32.8541 },
    { name: "Çankaya", x: 62, y: 62, lat: 39.9179, lng: 32.8627 },
    { name: "Ulus", x: 44, y: 36, lat: 39.9419, lng: 32.8543 },
    { name: "Sıhhiye", x: 48, y: 43, lat: 39.9293, lng: 32.8547 },
    { name: "Bahçelievler", x: 36, y: 56, lat: 39.9274, lng: 32.8297 },
    { name: "Keçiören", x: 55, y: 24, lat: 39.9823, lng: 32.8665 },
    { name: "Batıkent", x: 26, y: 38, lat: 39.9683, lng: 32.7308 },
    { name: "Etimesgut", x: 20, y: 58, lat: 39.9533, lng: 32.6328 },
  ],
  İstanbul: [
    { name: "Kadıköy", x: 58, y: 58, lat: 40.9909, lng: 29.0303 },
    { name: "Beşiktaş", x: 48, y: 38, lat: 41.0438, lng: 29.0094 },
    { name: "Üsküdar", x: 57, y: 44, lat: 41.0255, lng: 29.0156 },
    { name: "Şişli", x: 43, y: 34, lat: 41.0602, lng: 28.9877 },
    { name: "Bakırköy", x: 26, y: 62, lat: 40.9808, lng: 28.8772 },
    { name: istanbulSquareDistrict, x: 45, y: 42, lat: 41.0369, lng: 28.985 },
    { name: "Levent", x: 50, y: 28, lat: 41.0816, lng: 29.0134 },
    { name: "Ataşehir", x: 66, y: 52, lat: 40.992, lng: 29.1244 },
  ],
  İzmir: [
    { name: "Alsancak", x: 48, y: 44, lat: 38.4392, lng: 27.1453 },
    { name: "Konak", x: 43, y: 52, lat: 38.4189, lng: 27.1287 },
    { name: "Karşıyaka", x: 47, y: 30, lat: 38.4594, lng: 27.1153 },
    { name: "Bornova", x: 64, y: 42, lat: 38.4697, lng: 27.2211 },
    { name: "Buca", x: 56, y: 65, lat: 38.3847, lng: 27.1773 },
    { name: "Balçova", x: 28, y: 56, lat: 38.3917, lng: 27.0508 },
    { name: "Göztepe", x: 34, y: 48, lat: 38.4015, lng: 27.0837 },
  ],
};

const genericDistrictLayout: Array<Pick<CityDistrict, "name" | "x" | "y">> = [
  { name: "Merkez", x: 50, y: 50 },
  { name: "Otogar", x: 30, y: 45 },
  { name: "Üniversite", x: 66, y: 38 },
  { name: "Sanayi", x: 72, y: 62 },
  { name: "Yeni Mahalle", x: 38, y: 66 },
  { name: "Devlet Hastanesi", x: 55, y: 30 },
  { name: "Çarşı", x: 45, y: 42 },
];

export function normalizeCity(city: string): TurkeyCity {
  return TURKEY_CITIES.includes(city as TurkeyCity) ? (city as TurkeyCity) : DEFAULT_CITY;
}

/** Map API / free-text city labels onto canonical province names (website dashboards). */
export function resolveTurkeyCityLabel(raw: string): TurkeyCity {
  const t = raw.trim();
  if (!t) return DEFAULT_CITY;
  const hit = TURKEY_CITIES.find((c) => c.localeCompare(t, "tr", { sensitivity: "accent" }) === 0);
  return hit ?? DEFAULT_CITY;
}

function getDistrictLayout(city: TurkeyCity) {
  return districtLayouts[city] ?? genericDistrictLayout;
}

export function getCityCoordinates(city: string) {
  const selected = normalizeCity(city);
  // TODO: Add precise coordinates for all 81 provinces. Unknown cities use Ankara fallback for now.
  return CITY_COORDINATES[selected] ?? fallbackCityCoordinates ?? { lat: 39.9208, lng: 32.8541, zoom: 12 };
}

function hasDistrictCoordinates(
  district: Pick<CityDistrict, "name" | "x" | "y">,
): district is Pick<CityDistrict, "name" | "x" | "y" | "lat" | "lng"> {
  return "lat" in district && "lng" in district;
}

export function getCityRegions(city: string): CityDistrict[] {
  const selected = normalizeCity(city);
  const cityCenter = getCityCoordinates(selected);
  const districts = getDistrictLayout(selected);
  const levels: CityDistrict["level"][] = ["Yüksek", "Yüksek", "Orta", "Orta", "Düşük", "Orta", "Düşük", "Düşük"];
  const intensities = [94, 88, 72, 66, 42, 58, 38, 34];
  const coordinateOffsets = [
    [0, 0],
    [-0.011, 0.012],
    [0.018, -0.006],
    [0.009, 0.018],
    [-0.018, -0.018],
    [0.024, -0.012],
    [-0.026, 0.01],
  ];

  return districts.map((district, index) => ({
    id: district.name.toLowerCase().replaceAll(" ", "-"),
    name: district.name,
    x: district.x,
    y: district.y,
    lat: hasDistrictCoordinates(district) ? district.lat : cityCenter.lat + (coordinateOffsets[index]?.[0] ?? 0),
    lng: hasDistrictCoordinates(district) ? district.lng : cityCenter.lng + (coordinateOffsets[index]?.[1] ?? 0),
    level: levels[index] ?? "Orta",
    intensity: intensities[index] ?? 52,
    status: levels[index] ?? "Orta",
  }));
}

function getRoutePairs(city: TurkeyCity) {
  const districts = getDistrictLayout(city).map((district) => district.name);

  if (city === "Ankara") {
    return [
      ["Kızılay", "Çankaya"],
      ["Ulus", "Kızılay"],
      ["Sıhhiye", "Çankaya"],
      ["Bahçelievler", "Kızılay"],
      ["Keçiören", "Ulus"],
    ];
  }

  if (city === "İstanbul") {
    return [
      ["Kadıköy", "Beşiktaş"],
      ["Üsküdar", "Kadıköy"],
      ["Şişli", istanbulSquareDistrict],
      ["Bakırköy", "Levent"],
    ];
  }

  if (city === "İzmir") {
    return [
      ["Alsancak", "Konak"],
      ["Karşıyaka", "Alsancak"],
      ["Bornova", "Buca"],
      ["Göztepe", "Konak"],
    ];
  }

  return [
    [districts[0], districts[1]],
    [districts[2], districts[0]],
    [districts[4], districts[6]],
    [districts[5], districts[0]],
  ];
}

export function getCityActivities(city: string): CityActivity[] {
  const selected = normalizeCity(city);
  const regions = getCityRegions(selected);
  const [first, second, third] = regions;

  return [
    {
      id: "start-now",
      title: `${first.name} → ${second.name} anında yolculuk başladı`,
      subtitle: "Yerel rota ağı üzerinde hareket başladı",
      time: "Şimdi",
      type: "trip",
    },
    {
      id: "dense-offer",
      title: `${second.name} bölgesi yoğun yolcu teklifi`,
      subtitle: "Bölge yoğunluğu yükseliyor",
      time: "Şimdi",
      type: "offer",
    },
    {
      id: "district-demand",
      title: `Yolcular ${second.name}, ${first.name}, ${third.name} bölgelerine gitmek istiyor`,
      subtitle: "Aynı yöne gidenler için talep oluştu",
      time: "Şimdi",
      type: "demand",
    },
    {
      id: "safe-match",
      title: `${third.name} → ${first.name} güvenli eşleşme yapıldı`,
      subtitle: "Eşleşme doğrulama katmanından geçti",
      time: "1 dk önce",
      type: "match",
    },
    {
      id: "found-passenger",
      title: `${regions[3]?.name ?? first.name} → ${second.name} yolcu bulundu`,
      subtitle: "Yerel yolculuk paylaşımı hazırlanıyor",
      time: "1 dk önce",
      type: "trip",
    },
  ];
}

export function getCityRoutes(city: string): CityRoute[] {
  const selected = normalizeCity(city);
  const statuses = ["Yolculuk başladı", "Güvenli eşleşme yapıldı", "Yolcu bulundu", "Yolculuk başladı", "Yolcu bulundu"];
  const times = ["Şimdi", "1 dk önce", "Şimdi", "2 dk önce", "1 dk önce"];

  return getRoutePairs(selected).map(([from, to], index) => ({
    id: `${from}-${to}`.toLowerCase().replaceAll(" ", "-"),
    from,
    to,
    status: statuses[index] ?? "Yolculuk başladı",
    time: times[index] ?? "Şimdi",
  }));
}

export function getCityLiveDashboard(city: string): CityLiveDashboard {
  const selected = normalizeCity(city);
  const districts = getCityRegions(selected);
  const routes = getCityRoutes(selected);
  const activities = getCityActivities(selected);
  const busiestRegion = districts[1]?.name ?? districts[0]?.name ?? "Merkez";
  const activeLine = routes[0] ? `${routes[0].from} → ${routes[0].to}` : `${selected} merkez`;

  return {
    city: selected,
    districts,
    routes,
    activities,
    stats: {
      activeTrips: 24,
      pendingOffers: 11,
      todayMatches: 148,
      busiestRegion,
      activeLine,
    },
  };
}

function coerceLiveStat(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const n = parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

type PublicCityLiveResponse = {
  success: boolean;
  city: string;
  stats: {
    activeTrips: number | string;
    pendingOffers: number | string;
    todayMatches: number | string;
    busiestRegion: string;
    activeLine: string;
  };
  activities: Array<{ title: string; subtitle: string; timeLabel: string; type: string }>;
  regions: Array<{ name: string; intensity: number; level: string }>;
};

function fnv1aActivityId(parts: string[]): string {
  let h = 2166136261 >>> 0;
  const blob = parts.join("\x1e");
  for (let i = 0; i < blob.length; i++) {
    h ^= blob.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(36);
}

/** Polyline emphasis driven by API activity ↔ district name matching */
export type RouteVisualTier = "active" | "linked" | "idle";

export function resolveDistrictOnMap(raw: string, districts: CityDistrict[]): CityDistrict | undefined {
  const q = raw.trim().toLocaleLowerCase("tr-TR");
  if (!q) return undefined;
  const exact = districts.find((d) => d.name.toLocaleLowerCase("tr-TR") === q);
  if (exact) return exact;
  return districts.find((d) => {
    const dn = d.name.toLocaleLowerCase("tr-TR");
    return dn.startsWith(q) || q.startsWith(dn);
  });
}

/** Parse titles like "Kızılay → Çankaya sefer başladı" into endpoints (no PII). */
export function parseActivityDistrictPair(title: string): { from: string; to: string } | null {
  const t = title.trim();
  if (!t.includes("→")) return null;
  const parts = t.split(/\s*→\s*/);
  if (parts.length < 2) return null;
  const fromRaw = parts[0]?.trim() ?? "";
  const rightJoined = parts.slice(1).join(" → ").trim();
  const stripTrail = (s: string) =>
    s
      .replace(
        /\s+(sefer|yolculuk|başladı|arıyor|bölgesinde|yoğun|teklif|tamamlandı|hareketi|katmanı|paylaşımı|talep|artışı|akışı).*$/iu,
        "",
      )
      .trim();
  const toRaw = stripTrail(rightJoined);
  const from = stripTrail(fromRaw);
  const to = toRaw.split(/\s+/).slice(0, 6).join(" ").trim();
  if (from.length < 2 || to.length < 2) return null;
  return { from, to };
}

function routeEndKey(a: string, b: string): string {
  return `${a.toLocaleLowerCase("tr-TR")}|${b.toLocaleLowerCase("tr-TR")}`;
}

/**
 * Merge activity-derived segments with demo routes; assign tiers for map styling.
 * First matching pair → active; further pairs → linked; remainder → idle.
 */
export function buildMapRoutesAndTiers(
  routes: CityRoute[],
  activities: CityActivity[],
  districts: CityDistrict[],
): { routes: CityRoute[]; tiers: Map<string, RouteVisualTier> } {
  const tiers = new Map<string, RouteVisualTier>();
  routes.forEach((r) => tiers.set(r.id, "idle"));

  type Resolved = { routeId: string; from: string; to: string };
  const resolved: Resolved[] = [];

  for (const act of activities) {
    const pair = parseActivityDistrictPair(act.title);
    if (!pair) continue;
    const fd = resolveDistrictOnMap(pair.from, districts);
    const td = resolveDistrictOnMap(pair.to, districts);
    if (!fd || !td || fd.id === td.id) continue;
    const existing = routes.find((r) => routeEndKey(r.from, r.to) === routeEndKey(fd.name, td.name));
    const routeId = existing?.id ?? `live-route-${fnv1aActivityId([routeEndKey(fd.name, td.name)])}`;
    resolved.push({ routeId, from: fd.name, to: td.name });
  }

  const extras: CityRoute[] = [];
  const seenPair = new Set<string>();
  for (const p of resolved) {
    const k = routeEndKey(p.from, p.to);
    if (seenPair.has(k)) continue;
    seenPair.add(k);
    const exists = routes.some((r) => routeEndKey(r.from, r.to) === k);
    if (!exists) {
      extras.push({
        id: p.routeId,
        from: p.from,
        to: p.to,
        status: "Canlı",
        time: "Şimdi",
      });
      tiers.set(p.routeId, "idle");
    }
  }

  let assignedActive = false;
  for (const p of resolved) {
    const cur = tiers.get(p.routeId);
    if (cur === "active" || cur === "linked") continue;
    tiers.set(p.routeId, !assignedActive ? "active" : "linked");
    assignedActive = true;
  }

  const extraKeys = new Set(extras.map((e) => routeEndKey(e.from, e.to)));
  const baseRoutes = routes.filter((r) => !extraKeys.has(routeEndKey(r.from, r.to)));
  const merged = [...extras.slice(0, 6), ...baseRoutes];

  return { routes: merged, tiers };
}

export function districtIntensityAccent(intensity: number): "high" | "mid" | "low" {
  if (intensity >= 72) return "high";
  if (intensity >= 48) return "mid";
  return "low";
}

function mapActivityApiType(raw: string): CityActivity["type"] {
  const x = raw.toLowerCase();
  if (x === "offer") return "offer";
  if (x === "match") return "match";
  if (x === "demand") return "demand";
  return "trip";
}

function mergeDistrictsFromApi(base: CityDistrict[], regions: PublicCityLiveResponse["regions"]): CityDistrict[] {
  if (!regions?.length) return base;
  const mapped = new Map(regions.map((r) => [r.name.toLocaleLowerCase("tr-TR"), r]));
  return base.map((d) => {
    const hit = mapped.get(d.name.toLocaleLowerCase("tr-TR"));
    if (!hit) return d;
    const level =
      hit.level === "Yüksek" || hit.level === "Orta" || hit.level === "Düşük" ? hit.level : "Orta";
    return {
      ...d,
      intensity: Math.min(100, Math.max(0, hit.intensity)),
      level,
      status: level,
    };
  });
}

function mergeCityLiveFromApi(cityParam: string, api: PublicCityLiveResponse): CityLiveDashboard {
  const selected = resolveTurkeyCityLabel(api.city || cityParam);
  const base = getCityLiveDashboard(selected);
  const liveSparse = (api.activities?.length ?? 0) === 0 && (api.regions?.length ?? 0) === 0;
  const mappedActivities = (api.activities ?? []).slice(0, 12).map((a, index) => ({
    id: `live-${fnv1aActivityId([String(index), a.title, a.subtitle, a.timeLabel, a.type])}`,
    title: a.title,
    subtitle: a.subtitle,
    time: a.timeLabel,
    type: mapActivityApiType(a.type),
  }));
  return {
    ...base,
    districts: mergeDistrictsFromApi(base.districts, api.regions ?? []),
    activities: mappedActivities.length > 0 ? mappedActivities : base.activities,
    stats: {
      activeTrips: coerceLiveStat(api.stats?.activeTrips ?? base.stats.activeTrips),
      pendingOffers: coerceLiveStat(api.stats?.pendingOffers ?? base.stats.pendingOffers),
      todayMatches: coerceLiveStat(api.stats?.todayMatches ?? base.stats.todayMatches),
      busiestRegion: api.stats?.busiestRegion ?? base.stats.busiestRegion,
      activeLine: api.stats?.activeLine ?? base.stats.activeLine,
    },
    uiHints: { liveSparse },
  };
}

export type LoadCityLiveDashboardOptions = {
  /** Last successful live snapshot for this city; used when fetch fails (keeps UI stable). */
  retainedLive?: CityLiveDashboard | null;
};

export async function loadCityLiveDashboard(
  city: string,
  options?: LoadCityLiveDashboardOptions,
): Promise<{ dashboard: CityLiveDashboard; source: "live" | "demo" }> {
  const baseUrl = apiConfig.apiBaseUrl.replace(/\/$/, "");
  const wantLive = process.env.NEXT_PUBLIC_USE_REAL_LIVE_DATA === "true";
  if (!wantLive || !baseUrl) {
    return { dashboard: getCityLiveDashboard(city), source: "demo" };
  }
  try {
    const url = `${baseUrl}/api/public/live/city?city=${encodeURIComponent(city)}`;
    const res = await fetch(url, { cache: "no-store", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as PublicCityLiveResponse;
    if (!data.success) throw new Error("not_success");
    return { dashboard: mergeCityLiveFromApi(city, data), source: "live" };
  } catch {
    const retained = options?.retainedLive;
    if (retained) {
      return { dashboard: retained, source: "live" };
    }
    return { dashboard: getCityLiveDashboard(city), source: "demo" };
  }
}

export async function fetchRealCityLiveDashboard(city: string): Promise<CityLiveDashboard> {
  const { dashboard } = await loadCityLiveDashboard(city);
  return dashboard;
}
