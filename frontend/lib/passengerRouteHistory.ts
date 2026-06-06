import AsyncStorage from '@react-native-async-storage/async-storage';

export type RouteHistorySource = 'gps' | 'map' | 'search' | 'saved' | 'recent';

export type RouteHistoryPoint = {
  address: string;
  latitude: number;
  longitude: number;
  usedAt: number;
  source?: RouteHistorySource;
};

type RouteHistoryEnvelope = {
  v: 1;
  items: RouteHistoryPoint[];
};

export const MAX_RECENT_PICKUPS = 5;
export const MAX_RECENT_DESTINATIONS = 8;

const ENVELOPE_VERSION = 1 as const;

export function passengerRecentPickupsKey(userId: string): string {
  return `passenger_recent_pickups_${userId}`;
}

export function passengerRecentDestinationsKey(userId: string): string {
  return `passenger_recent_destinations_${userId}`;
}

function normalizeUserId(userId: string): string | null {
  const uid = String(userId || '').trim();
  return uid || null;
}

function isValidCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeAddress(address: unknown, fallback: string): string {
  const trimmed = String(address ?? '').trim();
  return trimmed || fallback;
}

function coordDedupeKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function parseEnvelope(raw: string | null): RouteHistoryEnvelope {
  if (!raw) return { v: ENVELOPE_VERSION, items: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<RouteHistoryEnvelope>;
    if (parsed?.v !== ENVELOPE_VERSION || !Array.isArray(parsed.items)) {
      return { v: ENVELOPE_VERSION, items: [] };
    }
    const items = parsed.items
      .filter(
        (item): item is RouteHistoryPoint =>
          !!item &&
          isValidCoord(item.latitude) &&
          isValidCoord(item.longitude) &&
          typeof item.usedAt === 'number' &&
          Number.isFinite(item.usedAt),
      )
      .map((item) => ({
        address: normalizeAddress(item.address, 'Seçilen konum'),
        latitude: item.latitude,
        longitude: item.longitude,
        usedAt: item.usedAt,
        ...(item.source ? { source: item.source } : {}),
      }));
    return { v: ENVELOPE_VERSION, items };
  } catch {
    return { v: ENVELOPE_VERSION, items: [] };
  }
}

function normalizeIncomingPoint(
  point: Omit<RouteHistoryPoint, 'usedAt'> & { usedAt?: number },
  addressFallback: string,
): RouteHistoryPoint | null {
  if (!isValidCoord(point.latitude) || !isValidCoord(point.longitude)) {
    return null;
  }
  const usedAt =
    typeof point.usedAt === 'number' && Number.isFinite(point.usedAt) ? point.usedAt : Date.now();
  return {
    address: normalizeAddress(point.address, addressFallback),
    latitude: point.latitude,
    longitude: point.longitude,
    usedAt,
    ...(point.source ? { source: point.source } : {}),
  };
}

function dedupeAndPrepend(
  items: RouteHistoryPoint[],
  next: RouteHistoryPoint,
  max: number,
): RouteHistoryPoint[] {
  const key = coordDedupeKey(next.latitude, next.longitude);
  const filtered = items.filter(
    (item) => coordDedupeKey(item.latitude, item.longitude) !== key,
  );
  return [next, ...filtered].slice(0, max);
}

async function readList(storageKey: string): Promise<RouteHistoryPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return parseEnvelope(raw).items;
  } catch (e) {
    if (__DEV__) console.warn('passengerRouteHistory readList', e);
    return [];
  }
}

async function writeList(storageKey: string, items: RouteHistoryPoint[]): Promise<void> {
  try {
    const envelope: RouteHistoryEnvelope = { v: ENVELOPE_VERSION, items };
    await AsyncStorage.setItem(storageKey, JSON.stringify(envelope));
  } catch (e) {
    if (__DEV__) console.warn('passengerRouteHistory writeList', e);
  }
}

async function pushRecent(
  userId: string,
  storageKeyFn: (uid: string) => string,
  point: Omit<RouteHistoryPoint, 'usedAt'> & { usedAt?: number },
  max: number,
  addressFallback: string,
): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  const normalized = normalizeIncomingPoint(point, addressFallback);
  if (!normalized) return;
  const storageKey = storageKeyFn(uid);
  const items = await readList(storageKey);
  const next = dedupeAndPrepend(items, normalized, max);
  await writeList(storageKey, next);
}

export async function getRecentPickups(userId: string): Promise<RouteHistoryPoint[]> {
  const uid = normalizeUserId(userId);
  if (!uid) return [];
  return readList(passengerRecentPickupsKey(uid));
}

export async function getRecentDestinations(userId: string): Promise<RouteHistoryPoint[]> {
  const uid = normalizeUserId(userId);
  if (!uid) return [];
  return readList(passengerRecentDestinationsKey(uid));
}

export async function pushRecentPickup(
  userId: string,
  point: Omit<RouteHistoryPoint, 'usedAt'> & { usedAt?: number },
): Promise<void> {
  await pushRecent(userId, passengerRecentPickupsKey, point, MAX_RECENT_PICKUPS, 'Konumum');
}

export async function pushRecentDestination(
  userId: string,
  point: Omit<RouteHistoryPoint, 'usedAt'> & { usedAt?: number },
): Promise<void> {
  await pushRecent(userId, passengerRecentDestinationsKey, point, MAX_RECENT_DESTINATIONS, 'Seçilen konum');
}

export async function clearRecentPickups(userId: string): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  try {
    await AsyncStorage.removeItem(passengerRecentPickupsKey(uid));
  } catch (e) {
    if (__DEV__) console.warn('passengerRouteHistory clearRecentPickups', e);
  }
}

export async function clearRecentDestinations(userId: string): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  try {
    await AsyncStorage.removeItem(passengerRecentDestinationsKey(uid));
  } catch (e) {
    if (__DEV__) console.warn('passengerRouteHistory clearRecentDestinations', e);
  }
}
