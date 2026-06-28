import Constants from 'expo-constants';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { perfLog } from '../utils/perfDiagLog';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

export type OfferSeenSource = 'socket' | 'poll' | 'push' | 'requests' | 'unknown';

const reportedTagIds = new Set<string>();

/** EXPO_PUBLIC_DISPATCH_OFFER_SEEN_TELEMETRY=1 or app.json extra.dispatchOfferSeenTelemetry=1 */
export function isOfferSeenTelemetryEnabled(): boolean {
  const envValue = process.env.EXPO_PUBLIC_DISPATCH_OFFER_SEEN_TELEMETRY;
  const extraValue = (
    Constants.expoConfig?.extra as { dispatchOfferSeenTelemetry?: string } | undefined
  )?.dispatchOfferSeenTelemetry;
  return String(envValue ?? extraValue ?? '0').trim() === '1';
}

export function normalizeOfferSeenSource(source: unknown): OfferSeenSource {
  const s = String(source || '').trim().toLowerCase();
  if (s === 'socket' || s === 'poll' || s === 'push' || s === 'requests') {
    return s;
  }
  return 'unknown';
}

/** Dev/diag client funnel log — no network; gated by perfDiagLog. */
export function logDispatchFunnelClient(step: string, fields: Record<string, unknown>): void {
  perfLog('[dispatch_funnel]', JSON.stringify({ step, ts: Date.now(), ...fields }));
}

function logOfferSeenClient(step: string, fields: Record<string, unknown>): void {
  logDispatchFunnelClient(step, fields);
}

/** One-shot per tag_id per app session; non-fatal on failure. */
export async function reportDriverOfferSeen(
  driverId: string,
  tagId: string,
  source: OfferSeenSource = 'unknown',
): Promise<void> {
  const tid = String(tagId || '').trim();
  const did = String(driverId || '').trim();
  if (!tid || !did) return;

  const normalizedSource = normalizeOfferSeenSource(source);

  if (reportedTagIds.has(tid)) {
    logOfferSeenClient('driver_seen_client_skip', {
      tag_id: tid,
      driver_id: did.slice(0, 13),
      source: normalizedSource,
      reason: 'session_dedupe',
    });
    return;
  }
  reportedTagIds.add(tid);

  logOfferSeenClient('driver_seen_client', {
    tag_id: tid,
    driver_id: did.slice(0, 13),
    source: normalizedSource,
    telemetry_enabled: isOfferSeenTelemetryEnabled(),
  });

  if (!isOfferSeenTelemetryEnabled()) return;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const tok = await getPersistedAccessToken();
    if (tok?.trim()) {
      headers.Authorization = `Bearer ${tok.trim()}`;
    }

    const q = new URLSearchParams({ user_id: did });
    const res = await fetchWithTimeout(`${API_BASE_URL}/driver/offer-seen?${q.toString()}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tag_id: tid, source: normalizedSource }),
      timeoutMs: 8000,
    });
    logOfferSeenClient('driver_seen_client_ack', {
      tag_id: tid,
      driver_id: did.slice(0, 13),
      source: normalizedSource,
      http_ok: res.ok,
      http_status: res.status,
    });
  } catch {
    /* telemetry only — do not affect dispatch UX */
    logOfferSeenClient('driver_seen_client_error', {
      tag_id: tid,
      driver_id: did.slice(0, 13),
      source: normalizedSource,
    });
  }
}
