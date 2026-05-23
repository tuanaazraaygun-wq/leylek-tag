/**
 * Curated pseudo-live operations feed for the marketing homepage.
 * Replace `getCuratedOperationsFeed` internals with API/socket data when ready.
 */

export type OperationsFeedScope = "intracity" | "intercity";

export type OperationsFeedStatus =
  | "route_match"
  | "offer_active"
  | "match_confirmed"
  | "qr_verified"
  | "offer_flow_started";

export type OperationsFeedEvent = {
  id: string;
  city: string;
  district: string;
  /** Primary event line (city · district context is also shown separately). */
  message: string;
  status: OperationsFeedStatus;
  statusLabel: string;
  timeAgo: string;
  tone: "cyan" | "violet" | "emerald" | "blue";
  scope: OperationsFeedScope;
};

const INTRACITY_EVENTS: OperationsFeedEvent[] = [
  {
    id: "ank-cankaya-kizilay-route",
    city: "Ankara",
    district: "Çankaya",
    message: "Çankaya → Kızılay rota uyumu bulundu",
    status: "route_match",
    statusLabel: "Rota uyumu",
    timeAgo: "Az önce",
    tone: "cyan",
    scope: "intracity",
  },
  {
    id: "ank-cayyolu-offer",
    city: "Ankara",
    district: "Çayyolu",
    message: "Yolcu teklifi yayınlandı",
    status: "offer_active",
    statusLabel: "Teklif aktif",
    timeAgo: "1 dk",
    tone: "violet",
    scope: "intracity",
  },
  {
    id: "ist-kadikoy-flow",
    city: "İstanbul",
    district: "Kadıköy",
    message: "Şehir içi teklif akışı başladı",
    status: "offer_flow_started",
    statusLabel: "Akış aktif",
    timeAgo: "2 dk",
    tone: "blue",
    scope: "intracity",
  },
  {
    id: "izm-bornova-qr",
    city: "İzmir",
    district: "Bornova",
    message: "QR doğrulaması tamamlandı",
    status: "qr_verified",
    statusLabel: "Doğrulandı",
    timeAgo: "3 dk",
    tone: "emerald",
    scope: "intracity",
  },
  {
    id: "ist-besiktas-sisli-match",
    city: "İstanbul",
    district: "Beşiktaş",
    message: "Beşiktaş → Şişli eşleşme onaylandı",
    status: "match_confirmed",
    statusLabel: "Eşleşme sağlandı",
    timeAgo: "4 dk",
    tone: "emerald",
    scope: "intracity",
  },
  {
    id: "ank-ulus-offer",
    city: "Ankara",
    district: "Ulus",
    message: "Rota uyumlu teklif önerisi gönderildi",
    status: "offer_active",
    statusLabel: "Teklif aktif",
    timeAgo: "5 dk",
    tone: "violet",
    scope: "intracity",
  },
  {
    id: "ist-atasehir-qr",
    city: "İstanbul",
    district: "Ataşehir",
    message: "Başlangıç QR doğrulaması tamamlandı",
    status: "qr_verified",
    statusLabel: "Doğrulandı",
    timeAgo: "6 dk",
    tone: "emerald",
    scope: "intracity",
  },
  {
    id: "izm-karsiyaka-route",
    city: "İzmir",
    district: "Karşıyaka",
    message: "Karşıyaka → Konak rota uyumu bulundu",
    status: "route_match",
    statusLabel: "Rota uyumu",
    timeAgo: "7 dk",
    tone: "cyan",
    scope: "intracity",
  },
];

const INTERCITY_EVENTS: OperationsFeedEvent[] = [
  {
    id: "ank-ist-listing",
    city: "Ankara",
    district: "Merkez",
    message: "Ankara → İstanbul planlı rota ilanı aktif",
    status: "offer_active",
    statusLabel: "Teklif aktif",
    timeAgo: "12 dk",
    tone: "blue",
    scope: "intercity",
  },
  {
    id: "izm-bursa-match",
    city: "İzmir",
    district: "Bornova",
    message: "İzmir → Bursa eşleşme görüşmesi başladı",
    status: "offer_flow_started",
    statusLabel: "Akış aktif",
    timeAgo: "18 dk",
    tone: "violet",
    scope: "intercity",
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

/** Future hook point for live data (city-live-data / websocket). */
export async function loadHomeOperationsFeed(): Promise<{
  intracity: OperationsFeedEvent[];
  intercity: OperationsFeedEvent[];
}> {
  // TODO: merge live city dashboard events when backend feed is public-safe.
  return {
    intracity: getCuratedIntracityOperationsFeed(),
    intercity: getCuratedIntercityOperationsFeed(),
  };
}

export const statusBadgeStyles: Record<
  OperationsFeedStatus,
  { badge: string; dot: string }
> = {
  route_match: {
    badge: "bg-cyan-400/12 text-cyan-100 ring-cyan-400/25",
    dot: "bg-cyan-300 shadow-cyan-300/40",
  },
  offer_active: {
    badge: "bg-violet-400/12 text-violet-100 ring-violet-400/25",
    dot: "bg-violet-400 shadow-violet-400/40",
  },
  match_confirmed: {
    badge: "bg-emerald-400/12 text-emerald-100 ring-emerald-400/25",
    dot: "bg-emerald-300 shadow-emerald-300/40",
  },
  qr_verified: {
    badge: "bg-emerald-400/12 text-emerald-100 ring-emerald-400/25",
    dot: "bg-emerald-300 shadow-emerald-300/40",
  },
  offer_flow_started: {
    badge: "bg-blue-400/12 text-blue-100 ring-blue-400/25",
    dot: "bg-blue-400 shadow-blue-400/40",
  },
};
