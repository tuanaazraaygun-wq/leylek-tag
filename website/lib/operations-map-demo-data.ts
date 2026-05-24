export const OPERATIONS_MAP_CITIES = ["ankara", "istanbul", "izmir"] as const;

export type OperationsMapCity = (typeof OPERATIONS_MAP_CITIES)[number];

export type DensityLevel = "dusuk" | "orta" | "yuksek";

export const OPERATIONS_MAP_CITY_LABELS: Record<OperationsMapCity, string> = {
  ankara: "Ankara",
  istanbul: "İstanbul",
  izmir: "İzmir",
};

export const DENSITY_LEVEL_LABELS: Record<DensityLevel, string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek",
};

export type OperationsMapRegion = {
  id: string;
  city: OperationsMapCity;
  region: string;
  lat: number;
  lng: number;
  /** Mock harita konumu (%), gerçek konum değil — bölgesel yoğunluk göstergesi. */
  mapX: number;
  mapY: number;
  passengerLevel: DensityLevel;
  driverLevel: DensityLevel;
  supplyGap: DensityLevel;
  recommendation: string;
  suggestedPushDraft: string;
};

export const OPERATIONS_MAP_SECURITY_NOTES = [
  "Tekil kullanıcı konumu gösterilmez.",
  "Sadece anonim bölgesel yoğunluk (demo veri).",
  "Push otomatik gönderilmez; taslak metinler yalnızca öneridir.",
  "OSRM yalnızca rota/ETA için ileride kullanılacak; bu fazda çağrı yok.",
] as const;

export const OPERATIONS_MAP_DEMO_REGIONS: OperationsMapRegion[] = [
  {
    id: "ankara-cankaya",
    city: "ankara",
    region: "Çankaya / Kızılay hattı",
    lat: 39.9208,
    lng: 32.8541,
    mapX: 58,
    mapY: 42,
    passengerLevel: "yuksek",
    driverLevel: "orta",
    supplyGap: "yuksek",
    recommendation: "Sürücü yönlendirme bildirimi için aday bölge (onay gerekir).",
    suggestedPushDraft: "Çankaya hattında talep yoğun — boş koltuğun varsa teklif aç.",
  },
  {
    id: "ankara-etimesgut",
    city: "ankara",
    region: "Etimesgut / Batıkent",
    lat: 39.9498,
    lng: 32.6742,
    mapX: 28,
    mapY: 55,
    passengerLevel: "orta",
    driverLevel: "dusuk",
    supplyGap: "orta",
    recommendation: "Yolcu yoğunluğu artıyor; sürücü çağrısı taslak hazırlanabilir.",
    suggestedPushDraft: "Batıkent rotasında yolcu talebi — masraf paylaşımı için teklif oluştur.",
  },
  {
    id: "ankara-kestel",
    city: "ankara",
    region: "Keçiören / Etlik",
    lat: 39.9714,
    lng: 32.861,
    mapX: 62,
    mapY: 22,
    passengerLevel: "orta",
    driverLevel: "orta",
    supplyGap: "dusuk",
    recommendation: "Denge bölgesi — izleme modunda tut.",
    suggestedPushDraft: "Etlik hattında dengeli talep — rutin teklif akışı yeterli.",
  },
  {
    id: "istanbul-kadikoy",
    city: "istanbul",
    region: "Kadıköy / Moda",
    lat: 40.9819,
    lng: 29.0576,
    mapX: 72,
    mapY: 68,
    passengerLevel: "yuksek",
    driverLevel: "orta",
    supplyGap: "yuksek",
    recommendation: "Anadolu yakası talep yoğun; sürücü yönlendirme önceliği.",
    suggestedPushDraft: "Kadıköy hattında yoğun talep — aynı yöne giden sürücülere teklif çağrısı.",
  },
  {
    id: "istanbul-levent",
    city: "istanbul",
    region: "Levent / Maslak",
    lat: 41.08,
    lng: 29.01,
    mapX: 48,
    mapY: 28,
    passengerLevel: "yuksek",
    driverLevel: "dusuk",
    supplyGap: "yuksek",
    recommendation: "Avrupa yakası iş çıkışı — arz açığı yüksek.",
    suggestedPushDraft: "Levent rotasında yolcu talebi artıyor — boş koltuk paylaşımı için uygulamayı aç.",
  },
  {
    id: "istanbul-bakirkoy",
    city: "istanbul",
    region: "Bakırköy / Yeşilköy",
    lat: 40.978,
    lng: 28.877,
    mapX: 22,
    mapY: 52,
    passengerLevel: "orta",
    driverLevel: "orta",
    supplyGap: "dusuk",
    recommendation: "Dengeli bölge — genel bilgilendirme yeterli.",
    suggestedPushDraft: "Bakırköy hattında stabil talep — teklif akışını sürdür.",
  },
  {
    id: "izmir-konak",
    city: "izmir",
    region: "Konak / Alsancak",
    lat: 38.4192,
    lng: 27.1287,
    mapX: 35,
    mapY: 62,
    passengerLevel: "yuksek",
    driverLevel: "orta",
    supplyGap: "orta",
    recommendation: "Kordon hattı talep yoğun; sürücü çağrısı değerlendirilebilir.",
    suggestedPushDraft: "Alsancak rotasında yolcu talebi — masraf paylaşımı için teklif aç.",
  },
  {
    id: "izmir-bornova",
    city: "izmir",
    region: "Bornova / Evka",
    lat: 38.4633,
    lng: 27.215,
    mapX: 68,
    mapY: 38,
    passengerLevel: "orta",
    driverLevel: "dusuk",
    supplyGap: "yuksek",
    recommendation: "Kampüs / iş hattı — sürücü yönlendirme adayı.",
    suggestedPushDraft: "Bornova hattında arz açığı — boş koltuğunu paylaş.",
  },
  {
    id: "izmir-karsiyaka",
    city: "izmir",
    region: "Karşıyaka / Bostanlı",
    lat: 38.46,
    lng: 27.12,
    mapX: 28,
    mapY: 30,
    passengerLevel: "orta",
    driverLevel: "orta",
    supplyGap: "dusuk",
    recommendation: "Dengeli bölge — demo izleme.",
    suggestedPushDraft: "Karşıyaka hattında dengeli talep — rutin akış.",
  },
];

export function getOperationsMapRegionsByCity(city: OperationsMapCity): OperationsMapRegion[] {
  return OPERATIONS_MAP_DEMO_REGIONS.filter((r) => r.city === city);
}

export function densityLevelColor(level: DensityLevel, kind: "passenger" | "driver" | "gap" | "routing"): string {
  const base: Record<DensityLevel, string> = {
    dusuk: kind === "gap" ? "bg-emerald-400/70" : "bg-slate-400/50",
    orta: kind === "passenger" ? "bg-cyan-400/75" : kind === "driver" ? "bg-indigo-400/70" : "bg-amber-400/70",
    yuksek:
      kind === "passenger"
        ? "bg-rose-400/85 shadow-[0_0_18px_rgba(251,113,133,0.55)]"
        : kind === "driver"
          ? "bg-violet-400/80 shadow-[0_0_16px_rgba(167,139,250,0.45)]"
          : kind === "routing"
            ? "bg-amber-300/90 shadow-[0_0_20px_rgba(252,211,77,0.5)]"
            : "bg-orange-400/85 shadow-[0_0_18px_rgba(251,146,60,0.5)]",
  };
  return base[level];
}
