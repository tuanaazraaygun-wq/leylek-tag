/**
 * Rota yükleme / hata UI — LiveMapView + DriverOfferScreen ile paylaşılır (görsel tutarlılık).
 * Rota kaynağı veya fiyatlama mantığına dokunmaz.
 */

/** Yükleme göstergesi en az bu kadar ms görünsün (flicker önlemi) */
export const ROUTE_LOADING_MIN_VISIBLE_MS = 420;

/** Geçici hata / yarış sonrası “alınamadı” yalnız bu kadar süre sonra */
export const ROUTE_UNAVAILABLE_REVEAL_DELAY_MS = 1200;

export const ROUTE_LOADING_UI = {
  textColor: '#166534',
  dotColor: '#22c55e',
  letterSpacing: 0.15,
  dotStaggerMs: 100,
  dotTimingMs: 420,
  dotMinOpacity: 0.3,
  dotMaxOpacity: 1,
  fontWeight: '600' as const,
  /** LiveMap üst kart */
  fontSizeMap: 14,
  fontSizeMapCompact: 12.5,
  /** Teklif kartı */
  fontSizeOffer: 13,
  fontSizeOfferCompact: 11.5,
  dotSizeMap: 4,
  dotSizeMapCompact: 3.5,
  dotSizeOffer: 3.5,
  dotSizeOfferCompact: 3,
  dotGapMap: 3.5,
  dotGapMapCompact: 3,
  dotGapOffer: 3,
  textToDotsMap: 6,
  textToDotsOffer: 5,
} as const;
