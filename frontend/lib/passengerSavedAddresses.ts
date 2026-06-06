import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedAddressLabel = 'home' | 'work';

export type SavedAddress = {
  id: string;
  label: SavedAddressLabel;
  address: string;
  latitude: number;
  longitude: number;
  updatedAt: number;
  useFor: 'both';
};

export type SavedAddressesSnapshot = {
  home: SavedAddress | null;
  work: SavedAddress | null;
};

type SavedAddressesEnvelope = {
  v: 1;
  items: SavedAddress[];
};

const ENVELOPE_VERSION = 1 as const;

export function passengerSavedAddressesKey(userId: string): string {
  return `passenger_saved_addresses_${userId}`;
}

function normalizeUserId(userId: string): string | null {
  const uid = String(userId || '').trim();
  return uid || null;
}

function isValidCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSavedAddressLabel(value: unknown): value is SavedAddressLabel {
  return value === 'home' || value === 'work';
}

function normalizeAddress(address: unknown, fallback: string): string {
  const trimmed = String(address ?? '').trim();
  return trimmed || fallback;
}

function normalizeSavedAddress(raw: unknown): SavedAddress | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<SavedAddress>;
  if (!isSavedAddressLabel(item.label)) return null;
  if (!isValidCoord(item.latitude) || !isValidCoord(item.longitude)) return null;
  const updatedAt =
    typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : Date.now();
  return {
    id: String(item.id ?? item.label).trim() || item.label,
    label: item.label,
    address: normalizeAddress(item.address, item.label === 'home' ? 'Ev' : 'İş'),
    latitude: item.latitude,
    longitude: item.longitude,
    updatedAt,
    useFor: 'both',
  };
}

function parseEnvelope(raw: string | null): SavedAddressesEnvelope {
  if (!raw) return { v: ENVELOPE_VERSION, items: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<SavedAddressesEnvelope>;
    if (parsed?.v !== ENVELOPE_VERSION || !Array.isArray(parsed.items)) {
      return { v: ENVELOPE_VERSION, items: [] };
    }
    const byLabel = new Map<SavedAddressLabel, SavedAddress>();
    for (const rawItem of parsed.items) {
      const normalized = normalizeSavedAddress(rawItem);
      if (normalized) {
        byLabel.set(normalized.label, normalized);
      }
    }
    return { v: ENVELOPE_VERSION, items: Array.from(byLabel.values()) };
  } catch {
    return { v: ENVELOPE_VERSION, items: [] };
  }
}

function toSnapshot(items: SavedAddress[]): SavedAddressesSnapshot {
  let home: SavedAddress | null = null;
  let work: SavedAddress | null = null;
  for (const item of items) {
    if (item.label === 'home') home = item;
    if (item.label === 'work') work = item;
  }
  return { home, work };
}

async function readEnvelope(storageKey: string): Promise<SavedAddressesEnvelope> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return parseEnvelope(raw);
  } catch (e) {
    if (__DEV__) console.warn('passengerSavedAddresses readEnvelope', e);
    return { v: ENVELOPE_VERSION, items: [] };
  }
}

async function writeEnvelope(storageKey: string, items: SavedAddress[]): Promise<void> {
  try {
    const envelope: SavedAddressesEnvelope = { v: ENVELOPE_VERSION, items };
    await AsyncStorage.setItem(storageKey, JSON.stringify(envelope));
  } catch (e) {
    if (__DEV__) console.warn('passengerSavedAddresses writeEnvelope', e);
  }
}

export async function getSavedAddresses(userId: string): Promise<SavedAddressesSnapshot> {
  const uid = normalizeUserId(userId);
  if (!uid) return { home: null, work: null };
  const envelope = await readEnvelope(passengerSavedAddressesKey(uid));
  return toSnapshot(envelope.items);
}

export async function getSavedAddress(
  userId: string,
  label: SavedAddressLabel,
): Promise<SavedAddress | null> {
  const snapshot = await getSavedAddresses(userId);
  return label === 'home' ? snapshot.home : snapshot.work;
}

export async function saveSavedAddress(
  userId: string,
  point: Omit<SavedAddress, 'id' | 'updatedAt' | 'useFor'> & {
    id?: string;
    updatedAt?: number;
    useFor?: 'both';
  },
): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!uid || !isSavedAddressLabel(point.label)) return;
  const normalized = normalizeSavedAddress({
    ...point,
    id: point.id ?? point.label,
    updatedAt: point.updatedAt ?? Date.now(),
    useFor: 'both',
  });
  if (!normalized) return;

  const storageKey = passengerSavedAddressesKey(uid);
  const envelope = await readEnvelope(storageKey);
  const next = envelope.items.filter((item) => item.label !== normalized.label);
  next.push(normalized);
  await writeEnvelope(storageKey, next);
}

export async function removeSavedAddress(userId: string, label: SavedAddressLabel): Promise<void> {
  const uid = normalizeUserId(userId);
  if (!uid) return;
  const storageKey = passengerSavedAddressesKey(uid);
  const envelope = await readEnvelope(storageKey);
  const next = envelope.items.filter((item) => item.label !== label);
  await writeEnvelope(storageKey, next);
}
