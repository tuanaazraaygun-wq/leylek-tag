import type * as Location from 'expo-location';

export const MOCK_LOCATION_BLOCKED_CODE = 'MOCK_LOCATION_BLOCKED';

export const MOCK_LOCATION_BLOCKED_MESSAGE =
  'Sahte konum uygulaması tespit edildi.\nGüvenlik nedeniyle gerçek konumla devam edin.';

/** Android: expo-location mocked flag only. iOS → always false. */
export function isMockLocationFromExpo(
  location: Location.LocationObject | null | undefined,
): boolean {
  return location?.mocked === true;
}

export function setMockLocationQueryParam(q: URLSearchParams, isMock: boolean): void {
  if (isMock) {
    q.set('is_mock_location', 'true');
  }
}

/** JSON body alanı — yalnızca mocked ise ekle. */
export function mockLocationJsonField(isMock: boolean): { is_mock_location?: true } {
  return isMock ? { is_mock_location: true } : {};
}

export function buildUpdateLocationUrl(
  apiUrl: string,
  userId: string,
  coords: { latitude: number; longitude: number },
  isMock: boolean,
): string {
  const q = new URLSearchParams({
    user_id: String(userId),
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
  });
  setMockLocationQueryParam(q, isMock);
  return `${apiUrl}/user/update-location?${q.toString()}`;
}

export function isMockLocationBlockedPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.error_code === MOCK_LOCATION_BLOCKED_CODE) return true;
  const detail = d.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return (detail as Record<string, unknown>).error_code === MOCK_LOCATION_BLOCKED_CODE;
  }
  return false;
}

let lastMockBlockedAlertAt = 0;
const MOCK_ALERT_DEBOUNCE_MS = 60_000;

type AppAlertFn = (
  title: string,
  message: string,
  buttons?: { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }[],
  options?: { tone?: string; variant?: string; autoDismissMs?: number; cancelable?: boolean },
) => void;

/** Tek seferlik (debounced) uyarı; blocked ise true döner. */
export function maybeAlertMockLocationBlocked(
  alertFn: AppAlertFn,
  res: Response,
  data: unknown,
): boolean {
  if (!isMockLocationBlockedPayload(data)) {
    return false;
  }
  const now = Date.now();
  if (now - lastMockBlockedAlertAt < MOCK_ALERT_DEBOUNCE_MS) {
    return true;
  }
  lastMockBlockedAlertAt = now;

  let message = MOCK_LOCATION_BLOCKED_MESSAGE;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message.trim()) {
      message = d.message;
    } else if (d.detail && typeof d.detail === 'object' && !Array.isArray(d.detail)) {
      const det = d.detail as Record<string, unknown>;
      if (typeof det.message === 'string' && det.message.trim()) {
        message = det.message;
      }
    }
  }

  alertFn('Uyarı', message, [{ text: 'Tamam' }], { tone: 'warning' });
  return true;
}
