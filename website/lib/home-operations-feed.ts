/**
 * Curated pseudo-live operations feed for the marketing homepage.
 * Swap curated arrays for API/socket aggregation via `loadHomeOperationsFeed`.
 */

export type OperationsFeedScope = "intracity" | "intercity";

export type OperationsFeedStatus =
  | "route_match"
  | "offer_active"
  | "match_confirmed"
  | "qr_verified"
  | "offer_flow_started"
  | "trust_session";

export type OperationsFeedEvent = {
  id: string;
  city: string;
  district: string;
  /** Primary operation line. */
  headline: string;
  /** Secondary system state (awaiting step, channel ready, etc.). */
  subline: string;
  status: OperationsFeedStatus;
  statusLabel: string;
  /** Relative time label, e.g. "2 dk önce", "şimdi". */
  timeLabel: string;
  tone: "cyan" | "violet" | "emerald" | "blue";
  scope: OperationsFeedScope;
};

export type OperationsMicroStat = {
  id: string;
  label: string;
  value: string;
  hint: string;
};

const INTRACITY_EVENTS: OperationsFeedEvent[] = [
  {
    id: "ank-cankaya-kizilay-route",
    city: "Ankara",
    district: "Çankaya",
    headline: "Kızılay yönüne rota uyumu bulundu",
    subline: "QR başlangıç doğrulaması bekleniyor",
    status: "route_match",
    statusLabel: "Rota uyumu",
    timeLabel: "2 dk önce",
    tone: "cyan",
    scope: "intracity",
  },
  {
    id: "ank-cayyolu-offer",
    city: "Ankara",
    district: "Çayyolu",
    headline: "Yolcu teklifi rota uyumuna göre yayında",
    subline: "Sürücü eşleşmesi bekleniyor",
    status: "offer_active",
    statusLabel: "Teklif aktif",
    timeLabel: "şimdi",
    tone: "violet",
    scope: "intracity",
  },
  {
    id: "ist-kadikoy-flow",
    city: "İstanbul",
    district: "Kadıköy",
    headline: "Şehir içi teklif akışı başlatıldı",
    subline: "Sesli/yazılı iletişim hazır",
    status: "offer_flow_started",
    statusLabel: "Akış aktif",
    timeLabel: "4 dk önce",
    tone: "blue",
    scope: "intracity",
  },
  {
    id: "izm-bornova-qr",
    city: "İzmir",
    district: "Bornova",
    headline: "QR başlangıç doğrulaması tamamlandı",
    subline: "Yolculuk güven katmanına geçti",
    status: "qr_verified",
    statusLabel: "Doğrulandı",
    timeLabel: "6 dk önce",
    tone: "emerald",
    scope: "intracity",
  },
  {
    id: "ist-besiktas-sisli-match",
    city: "İstanbul",
    district: "Beşiktaş",
    headline: "Beşiktaş → Şişli eşleşme onaylandı",
    subline: "Görüntülü güven görüşmesi tamamlandı",
    status: "match_confirmed",
    statusLabel: "Eşleşme sağlandı",
    timeLabel: "8 dk önce",
    tone: "emerald",
    scope: "intracity",
  },
  {
    id: "ank-ulus-offer",
    city: "Ankara",
    district: "Ulus",
    headline: "Rota uyumlu teklif önerisi gönderildi",
    subline: "Leylek Zeka rota skoru uygulandı",
    status: "offer_active",
    statusLabel: "Teklif aktif",
    timeLabel: "9 dk önce",
    tone: "violet",
    scope: "intracity",
  },
  {
    id: "ist-atasehir-trust",
    city: "İstanbul",
    district: "Ataşehir",
    headline: "Güven görüşmesi oturumu başlatıldı",
    subline: "Profil görünürlüğü doğrulandı",
    status: "trust_session",
    statusLabel: "Güven oturumu",
    timeLabel: "11 dk önce",
    tone: "cyan",
    scope: "intracity",
  },
  {
    id: "izm-karsiyaka-route",
    city: "İzmir",
    district: "Karşıyaka",
    headline: "Karşıyaka → Konak rota uyumu bulundu",
    subline: "Teklif optimizasyonu önerisi hazır",
    status: "route_match",
    statusLabel: "Rota uyumu",
    timeLabel: "13 dk önce",
    tone: "cyan",
    scope: "intracity",
  },
];

const INTERCITY_EVENTS: OperationsFeedEvent[] = [
  {
    id: "ank-ist-listing",
    city: "Ankara",
    district: "Merkez",
    headline: "Ankara → İstanbul planlı rota ilanı aktif",
    subline: "Uzun yol teklif akışı · ikincil öncelik",
    status: "offer_active",
    statusLabel: "Teklif aktif",
    timeLabel: "18 dk önce",
    tone: "blue",
    scope: "intercity",
  },
  {
    id: "izm-bursa-match",
    city: "İzmir",
    district: "Bornova",
    headline: "İzmir → Bursa eşleşme görüşmesi başladı",
    subline: "Planlı rota onayı bekleniyor",
    status: "offer_flow_started",
    statusLabel: "Akış aktif",
    timeLabel: "24 dk önce",
    tone: "violet",
    scope: "intercity",
  },
];

/** Pilot-scope micro stats — not user/traffic totals. */
const MICRO_STATS: OperationsMicroStat[] = [
  {
    id: "active-offers",
    label: "Aktif şehir içi teklifler",
    value: "12",
    hint: "pilot olay",
  },
  {
    id: "route-matches",
    label: "Rota uyumları",
    value: "9",
    hint: "pilot olay",
  },
  {
    id: "qr-steps",
    label: "QR doğrulama adımları",
    value: "6",
    hint: "pilot olay",
  },
  {
    id: "trust-sessions",
    label: "Güven görüşmeleri",
    value: "4",
    hint: "pilot olay",
  },
];

/** Curated intracity events — swap body for live API when connected. */
export function getCuratedIntracityOperationsFeed(): OperationsFeedEvent[] {
  return INTRACITY_EVENTS;
}

/** Secondary intercity stream — shown collapsed on homepage. */
export function getCuratedIntercityOperationsFeed(): OperationsFeedEvent[] {
  return INTERCITY_EVENTS;
}

/** Pilot-scope operation summaries for the homepage panel header. */
export function getCuratedOperationsMicroStats(): OperationsMicroStat[] {
  return MICRO_STATS;
}

/** Future hook point for live data (city-live-data / websocket). */
export async function loadHomeOperationsFeed(): Promise<{
  intracity: OperationsFeedEvent[];
  intercity: OperationsFeedEvent[];
  microStats: OperationsMicroStat[];
}> {
  // TODO: merge live city dashboard events when backend feed is public-safe.
  return {
    intracity: getCuratedIntracityOperationsFeed(),
    intercity: getCuratedIntercityOperationsFeed(),
    microStats: getCuratedOperationsMicroStats(),
  };
}

export const statusBadgeStyles: Record<
  OperationsFeedStatus,
  { badge: string; dot: string; row: string }
> = {
  route_match: {
    badge: "bg-cyan-400/10 text-cyan-100/95 ring-cyan-400/22",
    dot: "bg-cyan-300/90",
    row: "border-cyan-400/10",
  },
  offer_active: {
    badge: "bg-violet-400/10 text-violet-100/95 ring-violet-400/22",
    dot: "bg-violet-400/90",
    row: "border-violet-400/10",
  },
  match_confirmed: {
    badge: "bg-emerald-400/10 text-emerald-100/95 ring-emerald-400/22",
    dot: "bg-emerald-300/90",
    row: "border-emerald-400/10",
  },
  qr_verified: {
    badge: "bg-emerald-400/10 text-emerald-100/95 ring-emerald-400/22",
    dot: "bg-emerald-300/90",
    row: "border-emerald-400/10",
  },
  offer_flow_started: {
    badge: "bg-blue-400/10 text-blue-100/95 ring-blue-400/22",
    dot: "bg-blue-400/90",
    row: "border-blue-400/10",
  },
  trust_session: {
    badge: "bg-cyan-400/10 text-cyan-100/95 ring-cyan-400/22",
    dot: "bg-cyan-300/90",
    row: "border-cyan-400/10",
  },
};
