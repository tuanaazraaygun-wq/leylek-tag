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

export function useMuhabbetActiveTripRecovery() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname || '');
  const inFlightRef = useRef(false);
  const lastRedirectRef = useRef('');

  useEffect(() => {
    pathnameRef.current = pathname || '';
  }, [pathname]);

  const recover = useCallback(async (reason: string) => {
    if (inFlightRef.current) return;
    const currentPath = pathnameRef.current || '';
    if (currentPath.startsWith('/leylek-trip/')) return;

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
      if (!sessionId || !['ready', 'active'].includes(status)) return;
      if (lastRedirectRef.current === sessionId && pathnameRef.current.startsWith('/leylek-trip/')) return;

      console.log('[muhabbet-trip-recovery] redirect', { reason, session_id: sessionId, status });
      lastRedirectRef.current = sessionId;
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
