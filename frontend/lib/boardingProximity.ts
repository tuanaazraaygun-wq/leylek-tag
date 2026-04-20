/**
 * Biniş yakınlığı — yolcu/sürücü haritada zaten kullanılan GPS noktaları ile Haversine (m).
 */

export const BOARDING_NEAR_ENTER_M = 100;
export const BOARDING_NEAR_EXIT_M = 130;
/** Yakınlık sürekli bu kadar ms boyunca "içeride" kalmalı */
export const BOARDING_STABLE_MS = 10_000;
/** "Hayır" sonrası otomatik tekrar sormadan önce bekleme */
export const BOARDING_DECLINE_COOLDOWN_MS = 90_000;
/** Aynı oturumda birkaç kez hayır sonrası daha uzun bekleme (modal yerine banner) */
export const BOARDING_DECLINE_COOLDOWN_LONG_MS = 4 * 60_000;
/** Bu kadar "Hayır"tan sonra tam ekran modal yerine üst banner */
export const BOARDING_DECLINES_BEFORE_BANNER_ONLY = 2;

export function haversineMetersLatLng(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}
