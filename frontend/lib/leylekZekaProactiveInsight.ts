/**
 * Yolcu proactive orb — availability-snapshot + tek seferlik orb ipucu (P3.3).
 * Harita/nearby-activity kullanılmaz; lat/lng gönderilmez.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

export const PROACTIVE_MIN_WAIT_MS = 45_000;
export const PROACTIVE_GLOBAL_COOLDOWN_MS = 90_000;
const ORB_PROACTIVE_MAX_LEN = 48;

const STORAGE_PREFIX = 'leylek_orb_proactive_v1';
const GLOBAL_COOLDOWN_KEY = `${STORAGE_PREFIX}:global_until`;

const PASSENGER_PRE_MATCH_STATUSES = new Set(['waiting', 'pending', 'offers_received']);

export type PassengerWaitInsight = {
  tagId: string;
  createdAt?: string | null;
  offersCount: number;
  status?: string;
};

export type AvailabilitySnapshotPayload = {
  message_hint?: string;
  signal?: string;
  has_data?: boolean;
  no_guarantee?: boolean;
};

export function isProactiveOrbEnabled(): boolean {
  const raw = (process.env.EXPO_PUBLIC_LEYLEK_PROACTIVE_ORB ?? '1').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

export function buildInsightStorageKey(tagId: string): string {
  return `${STORAGE_PREFIX}:${String(tagId).trim()}`;
}

export function parseInsightCreatedAtMs(createdAt?: string | null): number | null {
  if (!createdAt) return null;
  const ms = Date.parse(String(createdAt));
  return Number.isFinite(ms) ? ms : null;
}

export function shouldTriggerPassengerProactiveInsight(
  insight: PassengerWaitInsight | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!insight?.tagId) return false;
  const offers = Number(insight.offersCount);
  if (!Number.isFinite(offers) || offers !== 0) return false;
  const st = String(insight.status || '').trim().toLowerCase();
  if (!PASSENGER_PRE_MATCH_STATUSES.has(st)) return false;
  const createdMs = parseInsightCreatedAtMs(insight.createdAt);
  if (createdMs == null) return false;
  return nowMs - createdMs >= PROACTIVE_MIN_WAIT_MS;
}

export async function wasProactiveShownForTag(tagId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(buildInsightStorageKey(tagId));
    return v === '1' || v === 'shown';
  } catch {
    return false;
  }
}

export async function markProactiveShownForTag(tagId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(buildInsightStorageKey(tagId), 'shown');
  } catch {
    /* sessiz */
  }
}

export async function getGlobalCooldownUntilMs(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(GLOBAL_COOLDOWN_KEY);
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function setGlobalCooldownUntilMs(untilMs: number): Promise<void> {
  try {
    await AsyncStorage.setItem(GLOBAL_COOLDOWN_KEY, String(untilMs));
  } catch {
    /* sessiz */
  }
}

export async function fetchPassengerAvailabilitySnapshot(): Promise<AvailabilitySnapshotPayload | null> {
  try {
    const token = (await getPersistedAccessToken())?.trim();
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}/passenger/availability-snapshot`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; snapshot?: AvailabilitySnapshotPayload };
    if (!data?.ok || !data.snapshot) return null;
    const hint = String(data.snapshot.message_hint || '').trim();
    if (!hint) return null;
    return data.snapshot;
  } catch {
    return null;
  }
}

/** Orb kapsülü — mevcut shortenForOrb ile uyumlu max uzunluk. */
export function shortenProactiveOrbHint(messageHint: string): string | null {
  const t = String(messageHint || '').trim();
  if (!t) return null;
  if (t.length <= ORB_PROACTIVE_MAX_LEN) return t;
  const cut = t.slice(0, ORB_PROACTIVE_MAX_LEN - 1).trim();
  return cut.length > 12 ? `${cut}…` : null;
}
