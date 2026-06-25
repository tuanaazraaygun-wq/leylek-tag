/**
 * RC-SCALE-B1 — Shared in-flight + TTL cache for active-tag resume probes.
 * Deduplicates GET /passenger/active-tag + GET /driver/active-tag across boot,
 * role-select, foreground, and deferred bootstrap.
 */
import { API_BASE_URL } from './backendConfig';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { perfLog } from '../utils/perfDiagLog';

export const ACTIVE_TAG_RESUME_TTL_MS = 2000;

export type ActiveTagSideSnapshot = {
  json: Record<string, unknown>;
  responseOk: boolean;
};

export type ActiveTagResumeSnapshot = {
  userId: string;
  fetchedAt: number;
  passenger: ActiveTagSideSnapshot;
  driver: ActiveTagSideSnapshot;
};

export type GetActiveTagResumeSnapshotOptions = {
  /** Bypass TTL cache and fetch fresh data. */
  forceRefresh?: boolean;
  /** Per-request timeout; omit for plain fetch (resume hot path). */
  timeoutMs?: number;
  ttlMs?: number;
};

let cachedSnapshot: ActiveTagResumeSnapshot | null = null;
let inflightUserId: string | null = null;
let inflightPromise: Promise<ActiveTagResumeSnapshot> | null = null;

async function fetchSide(
  url: string,
  timeoutMs?: number,
): Promise<ActiveTagSideSnapshot> {
  try {
    const res =
      timeoutMs != null
        ? await fetchWithTimeout(url, { timeoutMs })
        : await fetch(url);
    if (!res) {
      return { json: {}, responseOk: false };
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { json, responseOk: res.ok };
  } catch {
    return { json: {}, responseOk: false };
  }
}

async function fetchSnapshotFromNetwork(
  userId: string,
  timeoutMs?: number,
): Promise<ActiveTagResumeSnapshot> {
  const enc = encodeURIComponent(userId);
  const [passenger, driver] = await Promise.all([
    fetchSide(`${API_BASE_URL}/passenger/active-tag?user_id=${enc}`, timeoutMs),
    fetchSide(`${API_BASE_URL}/driver/active-tag?user_id=${enc}`, timeoutMs),
  ]);
  const snapshot: ActiveTagResumeSnapshot = {
    userId,
    fetchedAt: Date.now(),
    passenger,
    driver,
  };
  perfLog('RESUME_COORD_FETCH', {
    userId,
    timeoutMs: timeoutMs ?? null,
    passengerOk: passenger.responseOk,
    driverOk: driver.responseOk,
  });
  return snapshot;
}

export function getCachedActiveTagResumeSnapshot(): ActiveTagResumeSnapshot | null {
  return cachedSnapshot;
}

export function isActiveTagResumeSnapshotStale(
  snapshot: ActiveTagResumeSnapshot | null,
  userId: string,
  ttlMs: number = ACTIVE_TAG_RESUME_TTL_MS,
): boolean {
  if (!snapshot || snapshot.userId !== userId) return true;
  return Date.now() - snapshot.fetchedAt >= ttlMs;
}

export function invalidateActiveTagResumeSnapshot(userId?: string): void {
  if (!userId || cachedSnapshot?.userId === userId) {
    cachedSnapshot = null;
  }
  if (!userId || inflightUserId === userId) {
    inflightUserId = null;
    inflightPromise = null;
  }
}

export async function getActiveTagResumeSnapshot(
  userId: string,
  options: GetActiveTagResumeSnapshotOptions = {},
): Promise<ActiveTagResumeSnapshot> {
  const uid = String(userId || '').trim();
  if (!uid) {
    return {
      userId: '',
      fetchedAt: Date.now(),
      passenger: { json: {}, responseOk: false },
      driver: { json: {}, responseOk: false },
    };
  }

  const ttlMs = options.ttlMs ?? ACTIVE_TAG_RESUME_TTL_MS;
  const now = Date.now();

  if (
    !options.forceRefresh &&
    cachedSnapshot &&
    cachedSnapshot.userId === uid &&
    now - cachedSnapshot.fetchedAt < ttlMs
  ) {
    perfLog('RESUME_COORD_CACHE_HIT', {
      userId: uid,
      age_ms: now - cachedSnapshot.fetchedAt,
      ttl_ms: ttlMs,
    });
    return cachedSnapshot;
  }

  if (inflightPromise && inflightUserId === uid) {
    perfLog('RESUME_COORD_INFLIGHT_JOIN', { userId: uid });
    return inflightPromise;
  }

  inflightUserId = uid;
  inflightPromise = fetchSnapshotFromNetwork(uid, options.timeoutMs)
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      return snapshot;
    })
    .finally(() => {
      if (inflightUserId === uid) {
        inflightUserId = null;
        inflightPromise = null;
      }
    });

  return inflightPromise;
}
