/**
 * Push ile /leylek-trip açılmadan önce oturum ön-yüklemesi — boş state flash’ını azaltır.
 */
import type { MuhabbetTripSession } from './muhabbetTripTypes';
import { API_BASE_URL } from './backendConfig';
import { getPersistedAccessToken } from './sessionToken';

function normalizeSessionId(value?: string | null): string {
  const sid = String(value || '').trim().toLowerCase();
  if (!sid || sid === 'undefined' || sid === 'null') return '';
  return sid;
}

let prefetched: { sessionId: string; session: MuhabbetTripSession; at: number } | null = null;
const PREFETCH_TTL_MS = 45_000;

/**
 * Bildirimden gitmeden önce çağrılır — trip REST ile session çekilir, ekran mount’ta tüketilir.
 */
export async function refreshSessionFromServerForPush(sessionId: string, action: string): Promise<void> {
  const sid = normalizeSessionId(sessionId);
  if (!sid) return;
  try {
    const token = await getPersistedAccessToken();
    if (!token) return;
    const base = API_BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      session?: MuhabbetTripSession;
      detail?: string;
    };
    if (!res.ok || !data.success || !data.session) return;
    prefetched = { sessionId: sid, session: data.session, at: Date.now() };
    console.log('[leylek_session_refresh]', JSON.stringify({ action, sessionId: sid }));
  } catch {
    /* sessiz — ekran kendi loadSession ile dener */
  }
}

/** Tek kullanımlık: eşleşen session_id için prefetch varsa döner ve siler */
export function takePrefetchedMuhabbetTripSession(sessionId: string): MuhabbetTripSession | null {
  const sid = normalizeSessionId(sessionId);
  if (!sid || !prefetched || prefetched.sessionId !== sid) return null;
  if (Date.now() - prefetched.at > PREFETCH_TTL_MS) {
    prefetched = null;
    return null;
  }
  const s = prefetched.session;
  prefetched = null;
  return s;
}
