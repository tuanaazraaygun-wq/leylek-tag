import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

export type OfferSeenSource = 'socket' | 'poll' | 'push' | 'requests' | 'unknown';

const reportedTagIds = new Set<string>();

/** EXPO_PUBLIC_DISPATCH_OFFER_SEEN_TELEMETRY=1 — default off, no network when disabled. */
export function isOfferSeenTelemetryEnabled(): boolean {
  return (process.env.EXPO_PUBLIC_DISPATCH_OFFER_SEEN_TELEMETRY ?? '0').trim() === '1';
}

/** One-shot per tag_id per app session; non-fatal on failure. */
export async function reportDriverOfferSeen(
  driverId: string,
  tagId: string,
  source: OfferSeenSource = 'unknown',
): Promise<void> {
  if (!isOfferSeenTelemetryEnabled()) return;

  const tid = String(tagId || '').trim();
  const did = String(driverId || '').trim();
  if (!tid || !did) return;
  if (reportedTagIds.has(tid)) return;
  reportedTagIds.add(tid);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const tok = await getPersistedAccessToken();
    if (tok?.trim()) {
      headers.Authorization = `Bearer ${tok.trim()}`;
    }

    const q = new URLSearchParams({ user_id: did });
    await fetchWithTimeout(`${API_BASE_URL}/driver/offer-seen?${q.toString()}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tag_id: tid, source }),
      timeoutMs: 8000,
    });
  } catch {
    /* telemetry only — do not affect dispatch UX */
  }
}
