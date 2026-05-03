import { apiConfig } from "@/lib/config";
import { resolveTurkeyCityLabel, type TurkeyCity } from "@/lib/city-live-data";

/** Province coordinates for Leaflet intercity routes (demo; refine via API later). */
export const INTERCITY_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Ankara: { lat: 39.9208, lng: 32.8541 },
  İstanbul: { lat: 41.0082, lng: 28.9784 },
  Adıyaman: { lat: 37.7648, lng: 38.2786 },
  İzmir: { lat: 38.4237, lng: 27.1428 },
  Eskişehir: { lat: 39.7767, lng: 30.5206 },
  Adana: { lat: 37.0, lng: 35.3213 },
  Bursa: { lat: 40.1828, lng: 29.0663 },
  Antalya: { lat: 36.8969, lng: 30.7133 },
  Konya: { lat: 37.8746, lng: 32.4932 },
  Samsun: { lat: 41.2867, lng: 36.33 },
  Gaziantep: { lat: 37.0662, lng: 37.3833 },
};

export type IntercityRouteKind = "sürücü" | "yolcu";

export type IntercityRouteStatus = "aktif" | "eşleşiyor" | "yakında";

export type IntercityRouteItem = {
  id: string;
  fromCity: TurkeyCity;
  toCity: TurkeyCity;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  dateTime: string;
  seats: number;
  suggestedCost: string;
  type: IntercityRouteKind;
  status: IntercityRouteStatus;
};

/** @deprecated Renamed to IntercityRouteItem — kept for older imports */
export type IntercityRoute = IntercityRouteItem;

export type IntercityStats = {
  /** aktif ilan */
  activeListings: string;
  /** bekleyen eşleşme */
  pendingMatches: string;
  /** bugün açılan rota */
  routesOpenedToday: string;
  /** en yoğun hat */
  busiestLine: string;
};

export type IntercityActivityItem = {
  id: string;
  text: string;
};

export type IntercityRouteInfoPreview = {
  id: string;
  title: string;
  detail: string;
};

export type IntercityTelemetry = {
  busiestLine: string;
  averageSuggestedCost: string;
  disclaimer: string;
};

export type IntercityDashboard = {
  routes: IntercityRouteItem[];
  stats: IntercityStats;
  /** Bottom-left HUD: canlı ilan akışı satırları */
  activityFeed: IntercityActivityItem[];
  /** Bottom-right HUD: özet rota kartları */
  routeInfoPreviews: IntercityRouteInfoPreview[];
  telemetry: IntercityTelemetry;
  uiHints?: {
    liveSparse: boolean;
  };
};

function coordFor(city: string) {
  const c = INTERCITY_CITY_COORDINATES[city];
  if (!c) {
    return INTERCITY_CITY_COORDINATES.Ankara;
  }
  return c;
}

function buildRoute(partial: Omit<IntercityRouteItem, "fromLat" | "fromLng" | "toLat" | "toLng">): IntercityRouteItem {
  const from = coordFor(partial.fromCity);
  const to = coordFor(partial.toCity);

  return {
    ...partial,
    fromLat: from.lat,
    fromLng: from.lng,
    toLat: to.lat,
    toLng: to.lng,
  };
}

const DEMO_ROUTES_RAW: Omit<IntercityRouteItem, "fromLat" | "fromLng" | "toLat" | "toLng">[] = [
  {
    id: "ankara-istanbul",
    fromCity: "Ankara",
    toCity: "İstanbul",
    dateTime: "Cuma, 19:30",
    seats: 3,
    suggestedCost: "650 ₺",
    type: "sürücü",
    status: "aktif",
  },
  {
    id: "ankara-adiyaman",
    fromCity: "Ankara",
    toCity: "Adıyaman",
    dateTime: "Cumartesi, 08:00",
    seats: 2,
    suggestedCost: "840 ₺",
    type: "sürücü",
    status: "aktif",
  },
  {
    id: "izmir-eskisehir",
    fromCity: "İzmir",
    toCity: "Eskişehir",
    dateTime: "Cumartesi, 10:00",
    seats: 2,
    suggestedCost: "520 ₺",
    type: "yolcu",
    status: "eşleşiyor",
  },
  {
    id: "adana-ankara",
    fromCity: "Adana",
    toCity: "Ankara",
    dateTime: "Pazar, 09:45",
    seats: 1,
    suggestedCost: "680 ₺",
    type: "sürücü",
    status: "aktif",
  },
  {
    id: "bursa-izmir",
    fromCity: "Bursa",
    toCity: "İzmir",
    dateTime: "bugün 18:30",
    seats: 1,
    suggestedCost: "430 ₺",
    type: "sürücü",
    status: "yakında",
  },
  {
    id: "antalya-konya",
    fromCity: "Antalya",
    toCity: "Konya",
    dateTime: "Pazar, 14:10",
    seats: 2,
    suggestedCost: "390 ₺",
    type: "yolcu",
    status: "eşleşiyor",
  },
  {
    id: "samsun-ankara",
    fromCity: "Samsun",
    toCity: "Ankara",
    dateTime: "Pazartesi, 07:15",
    seats: 3,
    suggestedCost: "560 ₺",
    type: "sürücü",
    status: "aktif",
  },
  {
    id: "gaziantep-adana",
    fromCity: "Gaziantep",
    toCity: "Adana",
    dateTime: "Cuma, 21:00",
    seats: 2,
    suggestedCost: "410 ₺",
    type: "yolcu",
    status: "aktif",
  },
];

function demoDashboard(): IntercityDashboard {
  const routes = DEMO_ROUTES_RAW.map(buildRoute);

  const stats: IntercityStats = {
    activeListings: "38",
    pendingMatches: "14",
    routesOpenedToday: "26",
    busiestLine: "Ankara → İstanbul",
  };

  const activityFeed: IntercityActivityItem[] = [
    { id: "a1", text: "Ankara → İstanbul · 3 boş koltuk" },
    { id: "a2", text: "Adana → Ankara · önerilen masraf güncellendi" },
    { id: "a3", text: "İzmir → Eskişehir · aynı yöne gidenler aranıyor" },
    { id: "a4", text: "Bursa → İzmir · güvenli eşleşme başladı" },
  ];

  const routeInfoPreviews: IntercityRouteInfoPreview[] = [
    {
      id: "preview-adiyaman",
      title: "Ankara → Adıyaman",
      detail: "2 boş koltuk · önerilen masraf 840 ₺",
    },
    {
      id: "preview-bursa-izmir",
      title: "Bursa → İzmir",
      detail: "1 boş koltuk · bugün 18:30",
    },
  ];

  const telemetry: IntercityTelemetry = {
    busiestLine: stats.busiestLine,
    averageSuggestedCost: "720 ₺",
    disclaimer: "Özet şehir dışı teklif görünümü · Canlı bağlantıyla güncellenir",
  };

  return {
    routes,
    stats,
    activityFeed,
    routeInfoPreviews,
    telemetry,
  };
}

export function getIntercityRoutes(): IntercityRouteItem[] {
  return demoDashboard().routes;
}

export function getIntercityStats(): IntercityStats {
  return demoDashboard().stats;
}

export function getIntercityActivity(): IntercityActivityItem[] {
  return demoDashboard().activityFeed;
}

export function getIntercityDashboard(): IntercityDashboard {
  return demoDashboard();
}

/** @deprecated Use getIntercityDashboard() */
export function getDemoIntercityDashboard(): IntercityDashboard {
  return getIntercityDashboard();
}

export async function fetchRealIntercityDashboard(): Promise<IntercityDashboard> {
  const { dashboard } = await loadIntercityDashboard();
  return dashboard;
}

type PublicIntercityResponse = {
  success: boolean;
  stats: {
    activeListings: string;
    pendingMatches: string;
    todayRoutes: string;
    busiestRoute: string;
  };
  routes: Array<{
    id: string;
    fromCity: string;
    toCity: string;
    dateTime: string;
    seats: number;
    suggestedCost: string;
    type: string;
    status: string;
  }>;
  activities: Array<{ title: string; subtitle: string; timeLabel: string; type: string }>;
};

function mapIntercityRole(raw: string): IntercityRouteKind {
  const x = raw.trim().toLowerCase();
  return x === "yolcu" ? "yolcu" : "sürücü";
}

function mapIntercityStatus(raw: string): IntercityRouteStatus {
  const x = raw.trim().toLowerCase();
  if (x === "yakında" || x === "yakinda") return "yakında";
  if (x === "eşleşiyor" || x === "eslesiyor") return "eşleşiyor";
  return "aktif";
}

function averageSuggestedCostFromRoutes(routes: IntercityRouteItem[]): string {
  const nums = routes
    .map((r) => {
      const digits = r.suggestedCost.replace(/[^\d]/g, "");
      return digits ? parseInt(digits, 10) : NaN;
    })
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (!nums.length) return "—";
  const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  return `${avg} ₺`;
}

function fnv1aFeedId(parts: string[]): string {
  let h = 2166136261 >>> 0;
  const blob = parts.join("\x1e");
  for (let i = 0; i < blob.length; i++) {
    h ^= blob.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(36);
}

/** Short HUD line from API activity (no PII). */
function compactActivityHudLine(a: { title: string; subtitle: string }): string {
  const sub = (a.subtitle ?? "").trim();
  const ti = (a.title ?? "").trim();
  if (sub.length > 0 && sub.length <= 96) {
    return sub.includes("→") ? sub : `${sub} · ${ti}`.slice(0, 96).trim();
  }
  return ti.slice(0, 96) || "Şehirler arası ilan";
}

function mergeIntercityFromApi(data: PublicIntercityResponse): IntercityDashboard {
  const demo = demoDashboard();

  const liveSparse = (data.routes?.length ?? 0) === 0 && (data.activities?.length ?? 0) === 0;

  const mappedRoutes: IntercityRouteItem[] = (data.routes ?? []).map((r) =>
    buildRoute({
      id: r.id,
      fromCity: resolveTurkeyCityLabel(r.fromCity),
      toCity: resolveTurkeyCityLabel(r.toCity),
      dateTime: r.dateTime,
      seats: typeof r.seats === "number" && r.seats > 0 ? r.seats : 1,
      suggestedCost: r.suggestedCost?.trim() || "—",
      type: mapIntercityRole(r.type),
      status: mapIntercityStatus(r.status),
    }),
  );

  const routes = mappedRoutes.length > 0 ? mappedRoutes : demo.routes;

  const stats: IntercityStats = {
    activeListings: data.stats?.activeListings ?? "0",
    pendingMatches: data.stats?.pendingMatches ?? "0",
    routesOpenedToday: data.stats?.todayRoutes ?? "0",
    busiestLine: data.stats?.busiestRoute ?? "—",
  };

  const activityFeed: IntercityActivityItem[] =
    data.activities?.length > 0
      ? data.activities.slice(0, 8).map((a, index) => ({
          id: `live-${fnv1aFeedId([String(index), a.subtitle, a.title, a.timeLabel])}`,
          text: compactActivityHudLine(a),
        }))
      : demo.activityFeed;

  const routeInfoPreviews: IntercityRouteInfoPreview[] =
    routes.length >= 2
      ? routes.slice(0, 2).map((route) => ({
          id: `pv-${route.id}`,
          title: `${route.fromCity} → ${route.toCity}`,
          detail: `${route.seats} boş koltuk · ${route.suggestedCost} · ${route.dateTime}`,
        }))
      : demo.routeInfoPreviews;

  const telemetry: IntercityTelemetry = {
    busiestLine: stats.busiestLine,
    averageSuggestedCost: averageSuggestedCostFromRoutes(routes),
    disclaimer: "Canlı şehir dışı teklif özeti · Rota verisi bağlandığında güncellenir",
  };

  return { routes, stats, activityFeed, routeInfoPreviews, telemetry, uiHints: { liveSparse } };
}

export type LoadIntercityDashboardOptions = {
  retainedLive?: IntercityDashboard | null;
};

export async function loadIntercityDashboard(
  options?: LoadIntercityDashboardOptions,
): Promise<{ dashboard: IntercityDashboard; source: "live" | "demo" }> {
  const baseUrl = apiConfig.apiBaseUrl.replace(/\/$/, "");
  const wantLive = process.env.NEXT_PUBLIC_USE_REAL_LIVE_DATA === "true";
  if (!wantLive || !baseUrl) {
    return { dashboard: demoDashboard(), source: "demo" };
  }
  try {
    const url = `${baseUrl}/api/public/live/intercity`;
    const res = await fetch(url, { cache: "no-store", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as PublicIntercityResponse;
    if (!data.success) throw new Error("not_success");
    const merged = mergeIntercityFromApi(data);
    return {
      dashboard: {
        ...merged,
        telemetry: {
          ...merged.telemetry,
          disclaimer: "Canlı veri · şehirler arası ilan özeti",
        },
      },
      source: "live",
    };
  } catch {
    const retained = options?.retainedLive;
    if (retained) {
      return { dashboard: retained, source: "live" };
    }
    return { dashboard: demoDashboard(), source: "demo" };
  }
}
