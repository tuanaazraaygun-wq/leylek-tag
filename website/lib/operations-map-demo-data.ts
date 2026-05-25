import {
  getTurkeyCityBySlug,
  getTurkeyCityLabel,
  type OperationsMapCitySlug,
} from "@/lib/turkey-cities";

export type { OperationsMapCitySlug };

export type OperationsMapCity = OperationsMapCitySlug;

export type DensityLevel = "dusuk" | "orta" | "yuksek";

export const DENSITY_LEVEL_LABELS: Record<DensityLevel, string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek",
};

export type SeverityLevel = "dusuk" | "orta" | "yuksek" | "kritik";

export const SEVERITY_LEVEL_LABELS: Record<SeverityLevel, string> = {
  dusuk: "Düşük",
  orta: "Orta",
  yuksek: "Yüksek",
  kritik: "Kritik",
};

export const OPERATIONS_MAP_INTELLIGENCE_DISCLAIMERS = [
  "Demo intelligence — gerçek kullanıcı verisi değildir.",
  "Operasyon önerileri admin onayı gerektirir.",
  "Otomatik push gönderilmez.",
] as const;

export type OperationsMapTimelineMinutes = 0 | 5 | 10 | 15;

export const OPERATIONS_MAP_TIMELINE_OPTIONS: { minutes: OperationsMapTimelineMinutes; label: string }[] = [
  { minutes: 0, label: "Şimdi" },
  { minutes: 5, label: "5 dk önce" },
  { minutes: 10, label: "10 dk önce" },
  { minutes: 15, label: "15 dk önce" },
];

export function getOperationsMapTimelineLabel(minutes: OperationsMapTimelineMinutes): string {
  if (minutes === 0) return "Demo timeline · son 15 dk · Şimdi";
  return `Demo timeline · son 15 dk · ${minutes} dk önce`;
}

export const PUSH_DRAFT_PACK_DISCLAIMERS = [
  "Bu taslaklar demo öneridir.",
  "Gönderim için Bildirim Merkezi'nde admin onayı gerekir.",
  "Otomatik push gönderilmez.",
] as const;

export type PushDraftTone = "kisa" | "dengeli" | "acil";

export type PushDraftVariation = {
  tone: PushDraftTone;
  toneLabel: string;
  title: string;
  message: string;
  targetDescription: string;
  riskNote: string;
  fullVariationText: string;
};

export type PushDraftPack = {
  cityLabel: string;
  regionName: string;
  severity: SeverityLevel;
  disclaimers: readonly string[];
  variations: PushDraftVariation[];
  fullPackText: string;
};

export function sanitizeOpsWorkflowQueryText(value: string | null | undefined, maxLen: number): string {
  if (!value) return "";
  return value.replace(/[\0-\x1F\x7F]/g, "").trim().slice(0, maxLen);
}

export function buildNotificationCenterPrefillQuery(params: {
  city: OperationsMapCity;
  tone: PushDraftTone;
  title: string;
  message: string;
  label?: string;
}): string {
  const search = new URLSearchParams();
  search.set("source", "ops-map");
  search.set("title", sanitizeOpsWorkflowQueryText(params.title, 80));
  search.set("body", sanitizeOpsWorkflowQueryText(params.message, 500));
  search.set("city", params.city);
  search.set("tone", params.tone);
  if (params.label) {
    search.set("label", sanitizeOpsWorkflowQueryText(params.label, 40));
  }
  return search.toString();
}

export function buildSocialStudioPrefillQuery(city: OperationsMapCity): string {
  const search = new URLSearchParams({
    source: "ops-map",
    city,
  });
  return search.toString();
}

export type RegionIntelligence = {
  region: OperationsMapRegion;
  severity: SeverityLevel;
  impactScore: number;
  urgency: SeverityLevel;
  safeSendNote: string;
};

export type OperationsMapIntelligence = {
  summary: {
    busiestRegion: string;
    highestGapRegion: string;
    balancedRegion: string;
    recommendedAction: string;
  };
  kpis: {
    demandScore: number;
    driverBalance: number;
    supplyGapScore: number;
    recommendationCount: number;
  };
  panel: {
    systemSuggestion: string;
    expectedImpact: string;
    riskLevel: SeverityLevel;
    suggestedMessage: string;
  };
  regions: RegionIntelligence[];
};

export type OperationsMapRegion = {
  id: string;
  city: OperationsMapCity;
  region: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  passengerLevel: DensityLevel;
  driverLevel: DensityLevel;
  supplyGap: DensityLevel;
  recommendation: string;
  suggestedPushDraft: string;
};

export const OPERATIONS_MAP_SECURITY_NOTES = [
  "Bu ekran demo/anonim operasyon simülasyonudur.",
  "Tekil kullanıcı konumu gösterilmez.",
  "Push otomatik gönderilmez.",
  "OSRM yalnızca rota/ETA için ileride kullanılacak; bu fazda çağrı yok.",
] as const;

export type OperationsMapDemoEvent = {
  id: string;
  city: OperationsMapCity;
  minutesAgo: number;
  message: string;
  tone: "info" | "warning" | "success";
};

const PILOT_CITY_SLUGS = new Set(["ankara", "istanbul", "izmir"]);

const PILOT_OPERATIONS_MAP_DEMO_EVENTS: OperationsMapDemoEvent[] = [
  {
    id: "ev-ankara-kizilay",
    city: "ankara",
    minutesAgo: 2,
    message: "Ankara · Kızılay hattında talep artışı",
    tone: "warning",
  },
  {
    id: "ev-ankara-etlik",
    city: "ankara",
    minutesAgo: 8,
    message: "Ankara · Etlik bölgesinde denge korunuyor",
    tone: "success",
  },
  {
    id: "ev-istanbul-kadikoy",
    city: "istanbul",
    minutesAgo: 3,
    message: "İstanbul · Kadıköy çevresinde sürücü dengesi iyi",
    tone: "success",
  },
  {
    id: "ev-istanbul-levent",
    city: "istanbul",
    minutesAgo: 5,
    message: "İstanbul · Levent hattında arz açığı yükseldi",
    tone: "warning",
  },
  {
    id: "ev-izmir-alsancak",
    city: "izmir",
    minutesAgo: 4,
    message: "İzmir · Alsancak için yönlendirme önerisi",
    tone: "info",
  },
  {
    id: "ev-izmir-bornova",
    city: "izmir",
    minutesAgo: 11,
    message: "İzmir · Bornova kampüs hattında sürücü çağrısı adayı",
    tone: "warning",
  },
  {
    id: "ev-ankara-batikent",
    city: "ankara",
    minutesAgo: 14,
    message: "Ankara · Batıkent rotasında talep orta seviyede",
    tone: "info",
  },
  {
    id: "ev-istanbul-bakirkoy",
    city: "istanbul",
    minutesAgo: 12,
    message: "İstanbul · Bakırköy hattı stabil — izleme modu",
    tone: "info",
  },
];

const PILOT_OPERATIONS_MAP_DEMO_REGIONS: OperationsMapRegion[] = [
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

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function levelFromHash(hash: number, slot: number): DensityLevel {
  const v = (hash >> (slot * 2)) & 3;
  if (v === 0) return "dusuk";
  if (v === 1 || v === 2) return "orta";
  return "yuksek";
}

const fallbackRegionCache = new Map<string, OperationsMapRegion[]>();
const fallbackEventCache = new Map<string, OperationsMapDemoEvent[]>();

function generateFallbackRegions(city: OperationsMapCity): OperationsMapRegion[] {
  const entry = getTurkeyCityBySlug(city);
  const name = entry?.name ?? city;
  const hash = hashSlug(city);

  const templates = [
    {
      suffix: "merkez",
      label: "Merkez",
      mapX: 48 + (hash % 12),
      mapY: 46 + ((hash >> 3) % 10),
      passengerSlot: 0,
      driverSlot: 1,
      gapSlot: 2,
      recommendation: "Merkez hattında anonim talep izleniyor — demo simülasyon.",
    },
    {
      suffix: "kampus",
      label: "Kampüs / eğitim hattı",
      mapX: 68 + ((hash >> 5) % 8),
      mapY: 32 + ((hash >> 7) % 12),
      passengerSlot: 3,
      driverSlot: 4,
      gapSlot: 5,
      recommendation: "Kampüs çevresinde yönlendirme önerisi hazırlanabilir (onay gerekir).",
    },
    {
      suffix: "ulasim",
      label: "Otogar / ulaşım hattı",
      mapX: 26 + ((hash >> 9) % 10),
      mapY: 58 + ((hash >> 11) % 10),
      passengerSlot: 6,
      driverSlot: 7,
      gapSlot: 8,
      recommendation: "Ulaşım hattında denge korunuyor — demo izleme modu.",
    },
  ] as const;

  return templates.map((tpl, index) => {
    const passengerLevel = levelFromHash(hash, tpl.passengerSlot);
    const driverLevel = levelFromHash(hash, tpl.driverSlot);
    const supplyGap = levelFromHash(hash, tpl.gapSlot);
    const lat = 36 + (hash % 9) + index * 0.01;
    const lng = 26 + ((hash >> 4) % 14) + index * 0.01;

    return {
      id: `${city}-${tpl.suffix}`,
      city,
      region: `${name} · ${tpl.label}`,
      lat,
      lng,
      mapX: tpl.mapX,
      mapY: tpl.mapY,
      passengerLevel,
      driverLevel,
      supplyGap,
      recommendation: tpl.recommendation,
      suggestedPushDraft: `${name} çevresinde yolculuk paylaşımı talebi artıyor. Yakındaki uygun sürücüler için yönlendirme önerisi hazırlanabilir.`,
    };
  });
}

function generateFallbackEvents(city: OperationsMapCity): OperationsMapDemoEvent[] {
  const name = getTurkeyCityLabel(city);
  return [
    {
      id: `ev-${city}-merkez`,
      city,
      minutesAgo: 3,
      message: `${name} · Merkez hattında talep izleniyor`,
      tone: "info",
    },
    {
      id: `ev-${city}-ulasim`,
      city,
      minutesAgo: 7,
      message: `${name} · Ulaşım hattında denge korunuyor`,
      tone: "success",
    },
    {
      id: `ev-${city}-kampus`,
      city,
      minutesAgo: 11,
      message: `${name} · Kampüs çevresinde yönlendirme önerisi`,
      tone: "warning",
    },
  ];
}

export function getOperationsMapCityLabel(city: OperationsMapCity): string {
  return getTurkeyCityLabel(city);
}

export function getOperationsMapRegionsByCity(city: OperationsMapCity): OperationsMapRegion[] {
  if (PILOT_CITY_SLUGS.has(city)) {
    return PILOT_OPERATIONS_MAP_DEMO_REGIONS.filter((r) => r.city === city);
  }
  const cached = fallbackRegionCache.get(city);
  if (cached) return cached;
  const generated = generateFallbackRegions(city);
  fallbackRegionCache.set(city, generated);
  return generated;
}

export function getOperationsMapDemoEventsByCity(city: OperationsMapCity): OperationsMapDemoEvent[] {
  if (PILOT_CITY_SLUGS.has(city)) {
    return PILOT_OPERATIONS_MAP_DEMO_EVENTS.filter((e) => e.city === city).sort((a, b) => a.minutesAgo - b.minutesAgo);
  }
  const cached = fallbackEventCache.get(city);
  if (cached) return cached;
  const generated = generateFallbackEvents(city);
  fallbackEventCache.set(city, generated);
  return generated;
}

export function getHighSupplyGapRegions(city: OperationsMapCity): OperationsMapRegion[] {
  return getOperationsMapRegionsByCity(city).filter((r) => r.supplyGap === "yuksek");
}

function levelScore(level: DensityLevel): number {
  if (level === "dusuk") return 1;
  if (level === "orta") return 2;
  return 3;
}

function severityRank(severity: SeverityLevel): number {
  if (severity === "kritik") return 4;
  if (severity === "yuksek") return 3;
  if (severity === "orta") return 2;
  return 1;
}

export function computeRegionSeverity(region: OperationsMapRegion): SeverityLevel {
  const passenger = levelScore(region.passengerLevel);
  const driver = levelScore(region.driverLevel);
  const gap = levelScore(region.supplyGap);
  const score = passenger + gap * 2 - driver;

  if (gap === 3 && passenger >= 2 && driver <= 2) return "kritik";
  if (score >= 7) return "kritik";
  if (score >= 5) return "yuksek";
  if (score >= 3) return "orta";
  return "dusuk";
}

function computeImpactScore(region: OperationsMapRegion): number {
  const base = 35 + levelScore(region.supplyGap) * 18 + levelScore(region.passengerLevel) * 10;
  const penalty = levelScore(region.driverLevel) * 4;
  return Math.min(98, Math.max(12, base - penalty));
}

function computeCityKpis(city: OperationsMapCity, regions: OperationsMapRegion[], regionIntel: RegionIntelligence[]) {
  const hash = hashSlug(city);
  const avgPassenger = regions.reduce((sum, r) => sum + levelScore(r.passengerLevel), 0) / regions.length;
  const avgDriver = regions.reduce((sum, r) => sum + levelScore(r.driverLevel), 0) / regions.length;
  const avgGap = regions.reduce((sum, r) => sum + levelScore(r.supplyGap), 0) / regions.length;
  const recommendationCount = regionIntel.filter((item) => item.severity !== "dusuk").length;

  return {
    demandScore: Math.min(99, Math.round(avgPassenger * 28 + (hash % 9) + 8)),
    driverBalance: Math.min(99, Math.round(100 - Math.abs(avgPassenger - avgDriver) * 14 - avgGap * 8)),
    supplyGapScore: Math.min(99, Math.round(avgGap * 30 + (hash % 5) + 6)),
    recommendationCount,
  };
}

function clampTimelineScore(value: number): number {
  return Math.min(99, Math.max(8, Math.round(value)));
}

export function applyTimelineToKpis(
  city: OperationsMapCity,
  kpis: OperationsMapIntelligence["kpis"],
  minutesAgo: OperationsMapTimelineMinutes,
): OperationsMapIntelligence["kpis"] {
  if (minutesAgo === 0) return kpis;

  const drift = hashSlug(`${city}:timeline:${minutesAgo}`) % 4;
  const recommendationDelta =
    minutesAgo === 15 ? 1 : minutesAgo === 5 && drift % 2 === 0 ? -1 : 0;

  return {
    demandScore: clampTimelineScore(kpis.demandScore - minutesAgo * 0.9 - drift),
    driverBalance: clampTimelineScore(kpis.driverBalance - minutesAgo * 0.55 + drift * 0.5),
    supplyGapScore: clampTimelineScore(kpis.supplyGapScore + minutesAgo * 0.65 + drift),
    recommendationCount: Math.max(0, kpis.recommendationCount + recommendationDelta),
  };
}

export function getTimelineEventHighlightIndex(
  events: OperationsMapDemoEvent[],
  timelineMinutes: OperationsMapTimelineMinutes,
): number {
  if (events.length === 0) return 0;

  const visible = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isTimelineEventVisible(event, timelineMinutes));

  if (visible.length === 0) return 0;

  let bestIdx = visible[0].index;
  let bestDist = Math.abs(visible[0].event.minutesAgo - timelineMinutes);

  for (const item of visible) {
    const dist = Math.abs(item.event.minutesAgo - timelineMinutes);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = item.index;
    }
  }

  return bestIdx;
}

export function isTimelineEventVisible(
  event: OperationsMapDemoEvent,
  timelineMinutes: OperationsMapTimelineMinutes,
): boolean {
  if (timelineMinutes === 0) return true;
  return event.minutesAgo >= timelineMinutes;
}

function expectedImpactLabel(severity: SeverityLevel): string {
  if (severity === "kritik") return "Yoğun talep ve arz açığı — sürücü yönlendirme taslakları öncelik kazanabilir (demo).";
  if (severity === "yuksek") return "Belirli hatlarda talep artışı — kontrollü bilgilendirme taslakları değerlendirilebilir (demo).";
  if (severity === "orta") return "Sınırlı etki — izleme ve rutin teklif akışı yeterli olabilir (demo).";
  return "Düşük etki — ek aksiyon gerekmiyor (demo simülasyon).";
}

export function getOperationsMapIntelligence(city: OperationsMapCity): OperationsMapIntelligence {
  const regions = getOperationsMapRegionsByCity(city);
  const regionIntel: RegionIntelligence[] = regions.map((region) => {
    const severity = computeRegionSeverity(region);
    return {
      region,
      severity,
      impactScore: computeImpactScore(region),
      urgency: severity,
      safeSendNote: "Demo intelligence — gerçek kullanıcı verisi değildir. Admin onayı gerekir; otomatik gönderim yok.",
    };
  });

  const busiest = regions.reduce((best, region) =>
    levelScore(region.passengerLevel) > levelScore(best.passengerLevel) ? region : best,
  );
  const highestGap = regions.reduce((best, region) =>
    levelScore(region.supplyGap) > levelScore(best.supplyGap) ? region : best,
  );
  const balanced = regions.reduce((best, region) => {
    const balanceScore =
      Math.abs(levelScore(region.passengerLevel) - levelScore(region.driverLevel)) + levelScore(region.supplyGap);
    const bestScore =
      Math.abs(levelScore(best.passengerLevel) - levelScore(best.driverLevel)) + levelScore(best.supplyGap);
    return balanceScore < bestScore ? region : best;
  });

  const top = [...regionIntel].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] ?? regionIntel[0];

  return {
    summary: {
      busiestRegion: busiest.region,
      highestGapRegion: highestGap.region,
      balancedRegion: balanced.region,
      recommendedAction: top?.region.recommendation ?? "Demo izleme modu — ek aksiyon gerekmez.",
    },
    kpis: computeCityKpis(city, regions, regionIntel),
    panel: {
      systemSuggestion: top?.region.recommendation ?? "Şehir genelinde demo izleme modu önerilir.",
      expectedImpact: expectedImpactLabel(top?.severity ?? "dusuk"),
      riskLevel: top?.severity ?? "dusuk",
      suggestedMessage: top?.region.suggestedPushDraft ?? "Demo intelligence mesajı — admin onayı gerekir.",
    },
    regions: regionIntel,
  };
}

function regionShortName(region: string): string {
  return region.split("/")[0]?.trim() || region;
}

function getPushDraftPackTargetRegionIntel(city: OperationsMapCity): RegionIntelligence {
  const intel = getOperationsMapIntelligence(city);
  const sorted = [...intel.regions].sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    const gapDelta = levelScore(b.region.supplyGap) - levelScore(a.region.supplyGap);
    if (gapDelta !== 0) return gapDelta;
    return b.impactScore - a.impactScore;
  });

  const fallbackRegion = getOperationsMapRegionsByCity(city)[0];
  return (
    sorted[0] ?? {
      region: fallbackRegion,
      severity: computeRegionSeverity(fallbackRegion),
      impactScore: computeImpactScore(fallbackRegion),
      urgency: computeRegionSeverity(fallbackRegion),
      safeSendNote: "Demo intelligence — gerçek kullanıcı verisi değildir.",
    }
  );
}

function buildPushDraftVariationText(variation: {
  toneLabel: string;
  title: string;
  message: string;
  targetDescription: string;
  riskNote: string;
}): string {
  return [
    `Ton: ${variation.toneLabel}`,
    `Başlık: ${variation.title}`,
    `Mesaj: ${variation.message}`,
    `Hedef: ${variation.targetDescription}`,
    `Risk: ${variation.riskNote}`,
  ].join("\n");
}

export function getOperationsMapPushDraftPack(
  city: OperationsMapCity,
  timelineMinutes: OperationsMapTimelineMinutes = 0,
): PushDraftPack {
  const target = getPushDraftPackTargetRegionIntel(city);
  const cityLabel = getOperationsMapCityLabel(city);
  const area = regionShortName(target.region.region);
  const drift = hashSlug(`${city}:${target.region.id}:pack:${timelineMinutes}`) % 3;
  const timelinePhrase =
    timelineMinutes === 0 ? "güncel demo ölçüm" : `demo timeline · ${timelineMinutes} dk önce`;

  const draftVariations: Omit<PushDraftVariation, "fullVariationText">[] = [
    {
      tone: "kisa",
      toneLabel: "Kısa",
      title: `${cityLabel} · yakın çevre`,
      message: [
        `${area} yakın çevresinde yolculuk paylaşımı talebi var. Uygun olduğunuzda uygulamayı kontrol edebilirsiniz.`,
        `${area} hattında yolculuk paylaşımı ihtiyacı izleniyor. Müsait olduğunuzda yakın çevre tekliflerine bakabilirsiniz.`,
        `${area} çevresinde talep artışı (demo). Uygun olduğunuzda teklif akışını inceleyin.`,
      ][drift],
      targetDescription: `${area} yakın çevresinde aktif sürücü adayları (demo hedef — tekil konum yok).`,
      riskNote: "Kısa metin — bağlam sınırlı; Bildirim Merkezi'nde admin onayı gerekir.",
    },
    {
      tone: "dengeli",
      toneLabel: "Dengeli",
      title: `${cityLabel} · ${area} yönlendirme`,
      message: [
        `${area} çevresinde yolculuk paylaşımı talebi artıyor (${timelinePhrase}). Uygun olduğunuzda yakın çevre tekliflerini inceleyebilirsiniz; zorunluluk yoktur.`,
        `${cityLabel} · ${area} hattında dengeli yolculuk paylaşımı ihtiyacı var. Yakın çevrede müsait sürücüler için bilgilendirme taslak adayı.`,
        `${area} bölgesinde yolculuk paylaşımı yoğunluğu yükseldi. Uygun olduğunuzda teklifleri gözden geçirebilirsiniz — gelir vaadi içermez.`,
      ][(drift + 1) % 3],
      targetDescription: `Öncelikli bölge yoğunluğuna göre anonim demo segment · ${timelinePhrase}.`,
      riskNote: "Dengeli ton — gelir vaadi yok, yanıltıcı ifade kullanılmaz.",
    },
    {
      tone: "acil",
      toneLabel: "Acil",
      title: `${cityLabel} · öncelikli hat`,
      message: [
        `${area} hattında yolculuk paylaşımı ihtiyacı yükseldi. Müsait olduğunuzda yakın çevre tekliflerine göz atmanız operasyon dengelemesine yardımcı olabilir.`,
        `${area} yakın çevresinde öncelikli yolculuk paylaşımı talebi (demo). Uygun olduğunuzda uygulamayı açmanız yeterli — baskı yoktur.`,
        `${cityLabel} · ${area} için acil demo yönlendirme taslağı. Yakın çevre tekliflerini uygun olduğunuzda değerlendirin.`,
      ][(drift + 2) % 3],
      targetDescription: `Yüksek arz açığı demo bölgesi · ${area} yakın çevre (anonim).`,
      riskNote: "Acil ton dikkatli kullanılmalı; otomatik push gönderilmez.",
    },
  ];

  const variations: PushDraftVariation[] = draftVariations.map((variation) => ({
    ...variation,
    fullVariationText: buildPushDraftVariationText(variation),
  }));

  const fullPackText = [
    `Push taslak paketi · ${cityLabel} · ${target.region.region}`,
    ...PUSH_DRAFT_PACK_DISCLAIMERS,
    "",
    variations.map((variation) => variation.fullVariationText).join("\n\n"),
  ].join("\n");

  return {
    cityLabel,
    regionName: target.region.region,
    severity: target.severity,
    disclaimers: PUSH_DRAFT_PACK_DISCLAIMERS,
    variations,
    fullPackText,
  };
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
