import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { API_BASE_URL } from '../lib/backendConfig';
import { getPersistedAccessToken } from '../lib/sessionToken';
import type { MuhabbetTripSession } from '../lib/muhabbetTripTypes';

type ActiveTripResponse = {
  success?: boolean;
  session?: MuhabbetTripSession | null;
};

const TERMINAL_TRIP_STATUSES = new Set(['finished', 'cancelled', 'expired']);
const RECOVERABLE_TRIP_STATUSES = new Set(['ready', 'started', 'active']);
const SAME_SESSION_REDIRECT_COOLDOWN_MS = 30_000;

function pathnameTripSessionId(path: string): string | null {
  const raw = String(path || '').trim();
  const m = raw.match(/^\/leylek-trip\/([^/?#]+)/i);
  if (!m || !m[1]) return null;
  try {
    return decodeURIComponent(m[1]).trim().toLowerCase();
  } catch {
    return String(m[1]).trim().toLowerCase();
  }
}

export function useMuhabbetActiveTripRecovery() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname || '');
  const inFlightRef = useRef(false);
  /** Son başarılı replace(edilen) session + zaman (aynı session spam önleme). */
  const lastRedirectRef = useRef<{ sessionId: string; at: number } | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname || '';
  }, [pathname]);

  const recover = useCallback(async (reason: string) => {
    if (inFlightRef.current) return;
    const currentPath = pathnameRef.current || '';

    const pathSid = pathnameTripSessionId(currentPath);
    if (currentPath.startsWith('/leylek-trip/')) {
      if (pathSid) {
        console.log('[muhabbet-trip-recovery] skip duplicate', {
          reason: 'already_on_leylek_trip_route',
          pathname: currentPath,
          session_id: pathSid,
        });
      }
      return;
    }

    inFlightRef.current = true;
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) return;

      const base = API_BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/muhabbet/trip-sessions/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = (await res.json().catch(() => ({}))) as ActiveTripResponse;
      const sessionId = String(data?.session?.id || data?.session?.session_id || '').trim().toLowerCase();
      const status = String(data?.session?.status || '').trim().toLowerCase();

      if (!sessionId || TERMINAL_TRIP_STATUSES.has(status) || !RECOVERABLE_TRIP_STATUSES.has(status)) {
        if (sessionId && TERMINAL_TRIP_STATUSES.has(status)) {
          console.log('[muhabbet-trip-recovery] skip terminal', { reason, session_id: sessionId, status });
          lastRedirectRef.current = null;
        }
        return;
      }

      const refreshedPath = pathnameRef.current || '';
      const refreshedSid = pathnameTripSessionId(refreshedPath);
      if (
        refreshedPath.startsWith('/leylek-trip/') &&
        refreshedSid &&
        refreshedSid === sessionId
      ) {
        console.log('[muhabbet-trip-recovery] skip duplicate', {
          reason: 'already_viewing_same_session',
          session_id: sessionId,
        });
        return;
      }

      const now = Date.now();
      const last = lastRedirectRef.current;
      if (
        last &&
        last.sessionId === sessionId &&
        now - last.at < SAME_SESSION_REDIRECT_COOLDOWN_MS
      ) {
        console.log('[muhabbet-trip-recovery] skip duplicate', {
          reason: 'within_cooldown',
          session_id: sessionId,
          ms_since: now - last.at,
          cooldown_ms: SAME_SESSION_REDIRECT_COOLDOWN_MS,
          recover_reason: reason,
        });
        return;
      }

      console.log('[muhabbet-trip-recovery] redirect', { reason, session_id: sessionId, status });
      lastRedirectRef.current = { sessionId, at: now };
      router.replace(`/leylek-trip/${encodeURIComponent(sessionId)}` as Href);
    } catch {
      /* Recovery is best-effort; normal app navigation should continue. */
    } finally {
      inFlightRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    void recover('launch');
  }, [recover]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') void recover('foreground');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [recover]);
}
