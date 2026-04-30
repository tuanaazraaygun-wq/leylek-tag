import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter, type Href } from 'expo-router';
import { getOrCreateSocket } from '../contexts/SocketContext';
import {
  ensureMuhabbetTripSocketReady,
  isMuhabbetSocketRegisteredForUser,
} from '../lib/muhabbetTripSocketEnsure';
import { notifyAuthTokenBecameAvailableForSocket } from '../lib/socketRegisterScheduler';
import { takePrefetchedMuhabbetTripSession } from '../lib/muhabbetTripPushSessionPrefetch';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import type {
  MuhabbetTripCallSocketPayload,
  MuhabbetTripFinishSocketPayload,
  MuhabbetTripSession,
  MuhabbetTripSessionSocketPayload,
} from '../lib/muhabbetTripTypes';
import LeylekTripLiveRideChrome from './LeylekTripLiveRideChrome';
import MuhabbetTripCallScreen from './MuhabbetTripCallScreen';
import MuhabbetTripQrCodeModal from './MuhabbetTripQrCodeModal';
import MuhabbetTripQrScanModal from './MuhabbetTripQrScanModal';

type LeylekTripScreenProps = {
  apiBaseUrl: string;
  sessionId: string;
};

type Coord = { latitude: number; longitude: number };
type TripActionEvent = 'muhabbet_trip_start' | 'muhabbet_trip_cancel' | 'muhabbet_trip_finish';
type CallState = 'idle' | 'incoming' | 'outgoing' | 'active';
type QrMode = 'boarding' | 'finish';
type ForceFinishPrompt = { requesterUserId: string; targetUserId: string } | null;
type FinishResult = { paymentMethod: 'cash' | 'card' | null } | null;
const TERMINAL_TRIP_STATUSES = new Set(['finished', 'cancelled', 'expired']);
const MUHABBET_SAFE_ROUTE = '/' as Href;

function normalizeMuhabbetSessionId(value?: string | null): string {
  const sid = String(value || '').trim().toLowerCase();
  if (!sid || sid === 'undefined' || sid === 'null') return '';
  return sid;
}

function isMuhabbetTripRestOk(rest: { ok: boolean; json: Record<string, unknown> }): boolean {
  return rest.ok && rest.json.success === true;
}

const OPTIMISTIC_LOCK_MS = 1500;

function optimisticLockFresh(locks: Record<string, number>, key: string, now: number): boolean {
  const t = locks[key];
  return t != null && now - t < OPTIMISTIC_LOCK_MS;
}

/** Poll sırasında gelen eski session, optimistic UI ile çakışmasın diye alan birleştirme */
function mergeTripSessionForStalePoll(
  incoming: MuhabbetTripSession,
  prev: MuhabbetTripSession | null,
  locks: Record<string, number>,
  now: number,
  ctx: {
    callState: CallState;
    callPayload: MuhabbetTripCallSocketPayload | null;
    qrLoading: boolean;
  }
): MuhabbetTripSession {
  const fresh = (key: string) => optimisticLockFresh(locks, key, now);
  let merged: MuhabbetTripSession = { ...incoming };

  if (
    fresh('call_start') &&
    ctx.callState === 'outgoing' &&
    !incoming.call_active &&
    ctx.callPayload?.caller_id
  ) {
    merged = {
      ...merged,
      call_active: true,
      call_state: 'ringing',
      caller_id: ctx.callPayload.caller_id,
      call_started_at: (ctx.callPayload.started_at as string | undefined) ?? merged.call_started_at ?? null,
    };
    console.log('[leylek_optimistic]', JSON.stringify({ merge: 'call_start_stale_poll' }));
  }

  if (fresh('payment_method') && prev?.payment_method && !incoming.payment_method) {
    merged = {
      ...merged,
      payment_method: prev.payment_method,
      payment_method_selected_at: prev.payment_method_selected_at ?? merged.payment_method_selected_at,
    };
    console.log('[leylek_optimistic]', JSON.stringify({ merge: 'payment_method_stale_poll' }));
  }

  if (fresh('boarding_qr_create') && ctx.qrLoading && prev?.boarding_qr_token && !incoming.boarding_qr_token) {
    merged = {
      ...merged,
      boarding_qr_token: prev.boarding_qr_token,
      boarding_qr_expires_at: prev.boarding_qr_expires_at ?? merged.boarding_qr_expires_at,
      boarding_qr_created_at: prev.boarding_qr_created_at ?? merged.boarding_qr_created_at,
    };
    console.log('[leylek_optimistic]', JSON.stringify({ merge: 'boarding_qr_stale_poll' }));
  }

  const prevFinish = prev?.finish_qr_token || prev?.qr_finish_token;
  const incFinish = incoming.finish_qr_token || incoming.qr_finish_token;
  if (fresh('finish_qr_create') && ctx.qrLoading && prevFinish && !incFinish) {
    merged = {
      ...merged,
      finish_qr_token: prev.finish_qr_token ?? prev.qr_finish_token ?? merged.finish_qr_token,
      qr_finish_token: prev.qr_finish_token ?? merged.qr_finish_token,
      finish_qr_expires_at: prev.finish_qr_expires_at ?? merged.finish_qr_expires_at,
    };
    console.log('[leylek_optimistic]', JSON.stringify({ merge: 'finish_qr_stale_poll' }));
  }

  return merged;
}

function coord(lat?: number | null, lng?: number | null): Coord | null {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? { latitude: la, longitude: lo } : null;
}

function logLeylekAction(
  action: string,
  ctx: {
    sessionId: string;
    socketConnected: boolean;
    registered: boolean;
    role: string;
    status: string;
  }
) {
  console.log(
    '[leylek_action]',
    JSON.stringify({
      action,
      sessionId: ctx.sessionId,
      socketConnected: ctx.socketConnected,
      registered: ctx.registered,
      role: ctx.role,
      status: ctx.status,
    })
  );
}

function displayStatus(status?: string | null): { label: string; detail: string } {
  switch (status) {
    case 'active':
    case 'started':
      return { label: 'Yolculuk başladı', detail: 'Konum paylaşımı açık, rota takip ediliyor.' };
    case 'cancelled':
      return { label: 'İptal edildi', detail: 'Muhabbet yolculuk oturumu kapandı.' };
    case 'finished':
      return { label: 'Tamamlandı', detail: 'Muhabbet yolculuk oturumu tamamlandı.' };
    default:
      return { label: 'Başlamaya hazır', detail: 'Sürücü başlattığında canlı takip görünür.' };
  }
}

async function currentUserId(): Promise<string> {
  try {
    const raw = await getPersistedUserRaw();
    if (!raw) return '';
    const u = JSON.parse(raw) as { id?: string };
    return String(u?.id || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export default function LeylekTripScreen({ apiBaseUrl, sessionId }: LeylekTripScreenProps) {
  const router = useRouter();
  const [session, setSession] = useState<MuhabbetTripSession | null>(null);
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [callBusy, setCallBusy] = useState(false);
  const [callPayload, setCallPayload] = useState<MuhabbetTripCallSocketPayload | null>(null);
  const [forceFinishPrompt, setForceFinishPrompt] = useState<ForceFinishPrompt>(null);
  const [forceFinishWarningVisible, setForceFinishWarningVisible] = useState(false);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [qrScanVisible, setQrScanVisible] = useState(false);
  const [qrMode, setQrMode] = useState<QrMode>('finish');
  const [qrFinishToken, setQrFinishToken] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [paymentPromptVisible, setPaymentPromptVisible] = useState(false);
  const [paymentPromptShown, setPaymentPromptShown] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [boardingMessage, setBoardingMessage] = useState('');
  const [finishResult, setFinishResult] = useState<FinishResult>(null);
  const [deviceLocation, setDeviceLocation] = useState<Coord | null>(null);
  /** Zorla bitir isteği sunucuya yansımadan yerel “beklemede” */
  const [forceFinishRequestOptimistic, setForceFinishRequestOptimistic] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);

  const terminalCloseHandledSidRef = useRef<string | null>(null);
  const terminalNavigateDoneRef = useRef(false);
  const terminalAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTripStatusRef = useRef<string | null>(null);
  const optimisticRef = useRef<Record<string, number>>({});
  const sessionRef = useRef<MuhabbetTripSession | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const callPayloadRef = useRef<MuhabbetTripCallSocketPayload | null>(null);
  const qrLoadingRef = useRef(false);
  const lastSocketRefreshRef = useRef(0);
  const callOutgoingStartedAtRef = useRef(0);

  useEffect(() => {
    terminalCloseHandledSidRef.current = null;
    terminalNavigateDoneRef.current = false;
    prevTripStatusRef.current = null;
    if (terminalAutoTimerRef.current) {
      clearTimeout(terminalAutoTimerRef.current);
      terminalAutoTimerRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (terminalAutoTimerRef.current) {
        clearTimeout(terminalAutoTimerRef.current);
        terminalAutoTimerRef.current = null;
      }
    };
  }, []);

  const isDriver = !!session && myId === String(session.driver_id || '').trim().toLowerCase();
  const isTerminal = TERMINAL_TRIP_STATUSES.has(String(session?.status || '').trim().toLowerCase());

  sessionRef.current = session;
  callStateRef.current = callState;
  callPayloadRef.current = callPayload;
  qrLoadingRef.current = qrLoading;

  const touchOptimistic = useCallback((action: string) => {
    optimisticRef.current[action] = Date.now();
    console.log('[leylek_optimistic]', JSON.stringify({ touch: action }));
  }, []);

  const clearOptimistic = useCallback((action: string) => {
    delete optimisticRef.current[action];
    console.log('[leylek_optimistic]', JSON.stringify({ clear: action }));
  }, []);

  const clearAllOptimistic = useCallback(() => {
    optimisticRef.current = {};
    console.log('[leylek_optimistic]', JSON.stringify({ clear: 'all' }));
  }, []);

  const chromeDisplayStatus = useMemo(() => {
    if (!session) return displayStatus(null);
    const boarded = !!String(session.boarding_qr_confirmed_at || '').trim();
    const st = session.status;
    if (boarded && (st === 'active' || st === 'started')) {
      return {
        label: 'Yolculuk başladı',
        detail: 'Yolcu araca bindi. Rota hedefe yönleniyor.',
      };
    }
    return displayStatus(st);
  }, [session]);

  const suppressChromeRouteWait =
    !!String(session?.boarding_qr_confirmed_at || '').trim() &&
    (session?.status === 'active' || session?.status === 'started');

  const getActiveMuhabbetSessionId = useCallback(() => {
    return (
      normalizeMuhabbetSessionId(session?.id) ||
      normalizeMuhabbetSessionId(session?.session_id) ||
      normalizeMuhabbetSessionId(sessionId)
    );
  }, [session?.id, session?.session_id, sessionId]);

  const emitMuhabbetTripEvent = useCallback(
    (eventName: string, payload: Record<string, unknown> = {}, opts?: { showAlert?: boolean }) => {
      const activeSessionId = getActiveMuhabbetSessionId();
      if (!activeSessionId) {
        console.log(`[leylek-trip] emit blocked event=${eventName} session_id=`);
        if (opts?.showAlert !== false) {
          Alert.alert(
            'Yolculuk',
            'Yolculuk oturumu hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin.'
          );
        }
        return false;
      }
      const fullPayload = { ...payload, session_id: activeSessionId };
      console.log(`[leylek-trip] emit event=${eventName} session_id=${activeSessionId}`, fullPayload);
      getOrCreateSocket().emit(eventName, fullPayload);
      return true;
    },
    [getActiveMuhabbetSessionId]
  );

  const activeSessionId = getActiveMuhabbetSessionId();
  const tripInfoReady = !!activeSessionId;

  const navigateHomeFromTerminal = useCallback(() => {
    if (terminalNavigateDoneRef.current) return;
    terminalNavigateDoneRef.current = true;
    if (terminalAutoTimerRef.current) {
      clearTimeout(terminalAutoTimerRef.current);
      terminalAutoTimerRef.current = null;
    }
    router.replace(MUHABBET_SAFE_ROUTE);
  }, [router]);

  const closeTerminalTrip = useCallback(
    (eventName: string, nextSession?: MuhabbetTripSession | null) => {
      const sid = normalizeMuhabbetSessionId(nextSession?.id || nextSession?.session_id || sessionId);
      if (!sid) {
        console.log(
          '[leylek-trip] terminal session ignored',
          JSON.stringify({ event: eventName, detail: 'missing_session_id' })
        );
        return;
      }

      if (terminalCloseHandledSidRef.current === sid) {
        console.log(
          '[leylek-trip] terminal session ignored',
          JSON.stringify({ event: eventName, session_id: sid, detail: 'duplicate_closeTerminalTrip' })
        );
        return;
      }
      terminalCloseHandledSidRef.current = sid;

      const terminalStatus = String(nextSession?.status || '').trim().toLowerCase();
      console.log(
        '[leylek-trip] terminal session closed',
        JSON.stringify({
          event: eventName,
          session_id: sid,
          status: terminalStatus || undefined,
        })
      );

      setQrCodeVisible(false);
      setQrScanVisible(false);
      setQrFinishToken('');
      setQrExpiresAt(null);
      setForceFinishPrompt(null);
      setForceFinishWarningVisible(false);
      setForceFinishRequestOptimistic(false);
      clearAllOptimistic();
      callOutgoingStartedAtRef.current = 0;
      setQrLoading(false);
      setCallPayload(null);
      setCallState('idle');
      setCallBusy(false);
      setPaymentPromptVisible(false);
      setPaymentBusy(false);
      setActionBusy(false);
      setSession(null);

      if (terminalAutoTimerRef.current) {
        clearTimeout(terminalAutoTimerRef.current);
        terminalAutoTimerRef.current = null;
      }
      terminalNavigateDoneRef.current = false;

      terminalAutoTimerRef.current = setTimeout(() => {
        terminalAutoTimerRef.current = null;
        navigateHomeFromTerminal();
      }, 2800);

      Alert.alert('Muhabbet yolculuğu', 'Bu yolculuk tamamlandı veya kapandı.', [
        {
          text: 'Tamam',
          style: 'default',
          onPress: () => navigateHomeFromTerminal(),
        },
      ]);
    },
    [clearAllOptimistic, navigateHomeFromTerminal, sessionId]
  );

  const loadSession = useCallback(
    async (opts?: { silent?: boolean }): Promise<MuhabbetTripSession | null> => {
      const silent = !!opts?.silent;
      const token = await getPersistedAccessToken();
      if (!token) {
        if (!silent) {
          Alert.alert('Oturum gerekli', 'Muhabbet yolculuğunu açmak için tekrar giriş yapın.');
          setLoading(false);
        }
        return null;
      }
      if (!silent) setLoading(true);
      try {
        const base = apiBaseUrl.replace(/\/$/, '');
        const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; session?: MuhabbetTripSession; detail?: string };
        if (!res.ok || !data.success || !data.session) {
          if (!silent) Alert.alert('Muhabbet yolculuğu', data.detail || 'Oturum açılmadı.');
          return null;
        }
        const loadedSession = data.session;
        const loadedStatus = String(loadedSession.status || '').trim().toLowerCase();
        if (TERMINAL_TRIP_STATUSES.has(loadedStatus)) {
          const fm = String(loadedSession.finish_method || '').trim().toLowerCase();
          if (loadedStatus === 'finished' && fm === 'qr') {
            console.log('[leylek-trip] session loaded', silent ? '(silent)' : '', loadedSession);
            setSession((prev) => {
              if (!silent) return loadedSession;
              const now = Date.now();
              return mergeTripSessionForStalePoll(loadedSession, prev, optimisticRef.current, now, {
                callState: callStateRef.current,
                callPayload: callPayloadRef.current,
                qrLoading: qrLoadingRef.current,
              });
            });
            setFinishResult({ paymentMethod: loadedSession.payment_method || null });
            return loadedSession;
          }
          closeTerminalTrip('load', loadedSession);
          return null;
        }
        console.log('[leylek-trip] session loaded', silent ? '(silent)' : '', loadedSession);
        setSession((prev) => {
          if (!silent) return loadedSession;
          const now = Date.now();
          return mergeTripSessionForStalePoll(loadedSession, prev, optimisticRef.current, now, {
            callState: callStateRef.current,
            callPayload: callPayloadRef.current,
            qrLoading: qrLoadingRef.current,
          });
        });
        return loadedSession;
      } catch {
        if (!silent) Alert.alert('Muhabbet yolculuğu', 'Bağlantı hatası.');
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiBaseUrl, closeTerminalTrip, sessionId],
  );

  const refreshSessionFromServer = useCallback(
    async (action: string): Promise<MuhabbetTripSession | null> => {
      const sid = normalizeMuhabbetSessionId(sessionId);
      console.log('[leylek_session_refresh]', JSON.stringify({ action, sessionId: sid }));
      return await loadSession({ silent: true });
    },
    [loadSession, sessionId],
  );

  const socketRefreshSession = useCallback(
    (reason: string) => {
      const now = Date.now();
      if (now - lastSocketRefreshRef.current < 500) return;
      lastSocketRefreshRef.current = now;
      console.log('[leylek_socket_refresh]', JSON.stringify({ reason }));
      void refreshSessionFromServer(reason);
    },
    [refreshSessionFromServer],
  );

  const emitMuhabbetTripEventEnsured = useCallback(
    async (
      action: string,
      eventName: string,
      payload: Record<string, unknown> = {},
      opts?: { showSessionMissingAlert?: boolean; suppressConnectionRenewAlert?: boolean }
    ): Promise<boolean> => {
      await loadSession({ silent: true });
      const sidActive = getActiveMuhabbetSessionId();
      const socket = getOrCreateSocket();
      const role = isDriver ? 'driver' : 'passenger';
      const st = String(session?.status || '');
      logLeylekAction(action, {
        sessionId: sidActive || '',
        socketConnected: socket.connected,
        registered: !!myId && isMuhabbetSocketRegisteredForUser(socket, myId),
        role,
        status: st,
      });

      if (!sidActive) {
        if (opts?.showSessionMissingAlert !== false) {
          Alert.alert(
            'Yolculuk',
            'Yolculuk oturumu hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin.'
          );
        }
        return false;
      }

      notifyAuthTokenBecameAvailableForSocket();
      const socketReady = await ensureMuhabbetTripSocketReady(myId, 3000);
      logLeylekAction(`${action}_after_ensure`, {
        sessionId: sidActive,
        socketConnected: socket.connected,
        registered: !!myId && isMuhabbetSocketRegisteredForUser(socket, myId),
        role,
        status: st,
      });

      if (!socketReady) {
        if (!opts?.suppressConnectionRenewAlert) {
          Alert.alert(
            'Muhabbet yolculuk',
            'Bağlantı yenileniyor… Oturum güncellendi, lütfen tekrar deneyin.'
          );
        }
        await loadSession({ silent: true });
        return false;
      }

      const fullPayload = { ...payload, session_id: sidActive };
      console.log(`[leylek-trip] emit event=${eventName} session_id=${sidActive}`, fullPayload);
      socket.emit(eventName, fullPayload);
      return true;
    },
    [getActiveMuhabbetSessionId, isDriver, loadSession, myId, session?.status],
  );

  const muhabbetTripSessionRestPost = useCallback(
    async (opts: {
      action: string;
      pathSuffix: string;
      body?: Record<string, unknown>;
    }): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> => {
      const sid = getActiveMuhabbetSessionId();
      const token = (await getPersistedAccessToken())?.trim() || '';
      if (!sid || !token) {
        console.log(
          '[leylek_rest_action]',
          JSON.stringify({ action: opts.action, sessionId: sid || '', status: 0, body: { error: 'missing_session_or_token' } })
        );
        return { ok: false, status: 0, json: {} };
      }
      const base = apiBaseUrl.replace(/\/$/, '');
      const url = `${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}/${opts.pathSuffix}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(opts.body ?? {}),
        });
      } catch {
        console.log(
          '[leylek_rest_action]',
          JSON.stringify({ action: opts.action, sessionId: sid, status: -1, body: { error: 'network' } })
        );
        return { ok: false, status: -1, json: {} };
      }
      let json: Record<string, unknown> = {};
      try {
        json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      } catch {
        json = {};
      }
      console.log(
        '[leylek_rest_action]',
        JSON.stringify({ action: opts.action, sessionId: sid, status: res.status, body: json })
      );
      return { ok: res.ok, status: res.status, json };
    },
    [apiBaseUrl, getActiveMuhabbetSessionId],
  );

  useEffect(() => {
    void currentUserId().then(setMyId);
    const pref = takePrefetchedMuhabbetTripSession(sessionId);
    if (pref) {
      setSession(pref);
      setLoading(false);
      void loadSession({ silent: true });
    } else {
      void loadSession();
    }
  }, [loadSession, sessionId]);

  useEffect(() => {
    const sid = normalizeMuhabbetSessionId(sessionId);
    if (!sid) return;
    if (session && TERMINAL_TRIP_STATUSES.has(String(session.status || '').trim().toLowerCase())) {
      return;
    }
    const pollMs = session?.call_active ? 500 : qrCodeVisible ? 700 : 1000;
    const id = setInterval(() => {
      console.log(
        '[leylek_poll]',
        JSON.stringify({
          ms: pollMs,
          call_active: !!session?.call_active,
          qr_open: qrCodeVisible,
        })
      );
      void refreshSessionFromServer('session_poll');
    }, pollMs);
    return () => clearInterval(id);
  }, [qrCodeVisible, session?.call_active, session?.status, sessionId, refreshSessionFromServer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshSessionFromServer('app_state_active');
    });
    return () => sub.remove();
  }, [refreshSessionFromServer]);

  useEffect(() => {
    if (!session || !myId) return;
    const st = String(session.status || '').trim().toLowerCase();
    const prev = prevTripStatusRef.current;
    prevTripStatusRef.current = st;
    if (prev === 'ready' && st === 'active') {
      setBoardingMessage(
        myId && String(session.driver_id || '').trim().toLowerCase() === myId.trim().toLowerCase()
          ? 'Yolculuk başladı. Hedefte QR gösterin'
          : 'Araca bindiniz. Hedefte QR okutun'
      );
      const t = setTimeout(() => setBoardingMessage(''), 4200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [session, myId]);

  useEffect(() => {
    if (!session || !myId || isTerminal) return;
    const active = !!session.call_active;
    const cs = String(session.call_state || '').trim().toLowerCase();
    const callerLo = String(session.caller_id || '').trim().toLowerCase();
    const myLo = myId.trim().toLowerCase();
    const passengerLo = String(session.passenger_id || '').trim().toLowerCase();
    const driverLo = String(session.driver_id || '').trim().toLowerCase();
    const targetLo = callerLo === passengerLo ? driverLo : callerLo === driverLo ? passengerLo : '';

    if (active && callerLo && callerLo !== myLo && (cs === 'ringing' || cs === '')) {
      if (callStateRef.current !== 'idle') return;
      setCallPayload({
        session_id: session.id,
        conversation_id: session.conversation_id ?? undefined,
        channel_name: `muhabbet_trip_${session.id}`,
        caller_id: callerLo,
        target_user_id: targetLo,
      });
      setCallState('incoming');
      return;
    }

    if (!active) {
      if (!callBusy) {
        const outgoingGrace =
          callStateRef.current === 'outgoing' &&
          callOutgoingStartedAtRef.current > 0 &&
          Date.now() - callOutgoingStartedAtRef.current < 2000;
        if (!outgoingGrace) {
          setCallState('idle');
          setCallPayload(null);
          callOutgoingStartedAtRef.current = 0;
        }
      }
      return;
    }

    if (cs === 'ringing' || cs === '') {
      setCallPayload({
        session_id: session.id,
        conversation_id: session.conversation_id ?? undefined,
        channel_name: `muhabbet_trip_${session.id}`,
        caller_id: callerLo,
        target_user_id: targetLo,
      });
      if (callerLo === myLo) {
        setCallState('outgoing');
      } else {
        if (callStateRef.current !== 'idle') return;
        setCallState('incoming');
      }
      return;
    }
    if (cs === 'active') {
      setCallPayload((prev) => ({
        session_id: session.id,
        conversation_id: session.conversation_id ?? undefined,
        channel_name: `muhabbet_trip_${session.id}`,
        caller_id: callerLo || prev?.caller_id,
        target_user_id: targetLo || prev?.target_user_id,
        ...(prev || {}),
      }));
      setCallState('active');
    }
  }, [session, myId, isTerminal, callBusy]);

  useEffect(() => {
    if (!session || isTerminal) return;
    const st = String(session.status || '').trim().toLowerCase();
    const boardingTok = String(session.boarding_qr_token || '').trim();
    const finishTok = String(session.finish_qr_token || session.qr_finish_token || '').trim();

    if (st === 'ready' && boardingTok && isDriver) {
      setQrMode('boarding');
      setQrFinishToken(boardingTok.toUpperCase());
      setQrExpiresAt(session.boarding_qr_expires_at ?? null);
      setQrCodeVisible(true);
      return;
    }
    if ((st === 'active' || st === 'started') && finishTok && isDriver) {
      setQrMode('finish');
      setQrFinishToken(finishTok.toUpperCase());
      setQrExpiresAt(session.finish_qr_expires_at ?? null);
      setQrCodeVisible(true);
      return;
    }
    if (!boardingTok && !finishTok) {
      if (qrLoading) return;
      setQrCodeVisible(false);
      setQrFinishToken('');
      setQrExpiresAt(null);
    }
  }, [isDriver, isTerminal, qrLoading, session]);

  useEffect(() => {
    if (!session || !myId || isTerminal) {
      setForceFinishPrompt(null);
      return;
    }
    const ff = String(session.force_finish_state || '').trim().toLowerCase();
    const reqBy = String(session.forced_finish_requested_by_user_id || '').trim().toLowerCase();
    const myLo = myId.trim().toLowerCase();
    if (ff === 'pending' && reqBy && reqBy !== myLo) {
      setForceFinishPrompt({
        requesterUserId: reqBy,
        targetUserId: myLo,
      });
    } else {
      setForceFinishPrompt(null);
    }
  }, [session, myId, isTerminal]);

  useEffect(() => {
    if (!session || !myId) return;
    const myLo = myId.trim().toLowerCase();
    const reqBy = String(session.forced_finish_requested_by_user_id || '').trim().toLowerCase();
    const ff = String(session.force_finish_state || '').trim().toLowerCase();
    if (forceFinishRequestOptimistic && ff === 'pending' && reqBy === myLo) {
      setForceFinishRequestOptimistic(false);
    }
  }, [session, myId, forceFinishRequestOptimistic]);

  const emitCurrentLocation = useCallback(async (opts?: { requestPermission?: boolean; showAlert?: boolean; manual?: boolean }) => {
    if (opts?.manual) setSendingLocation(true);
    try {
      const perm = opts?.requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (opts?.showAlert) Alert.alert('Konum izni', 'Konum paylaşmak için izin gerekli.');
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setDeviceLocation(next);
      return emitMuhabbetTripEvent(
        'muhabbet_trip_location_update',
        { latitude: next.latitude, longitude: next.longitude },
        { showAlert: opts?.showAlert }
      );
    } catch {
      if (opts?.showAlert) Alert.alert('Konum', 'Konum alınamadı.');
      return false;
    } finally {
      if (opts?.manual) setSendingLocation(false);
    }
  }, [emitMuhabbetTripEvent]);

  useEffect(() => {
    if (!getActiveMuhabbetSessionId() || !myId || isTerminal) return;
    let cancelled = false;
    void emitCurrentLocation({ requestPermission: true, showAlert: false });
    const interval = setInterval(() => {
      if (!cancelled) void emitCurrentLocation({ requestPermission: false, showAlert: false });
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [emitCurrentLocation, getActiveMuhabbetSessionId, isTerminal, myId]);

  useEffect(() => {
    const activeSessionId = getActiveMuhabbetSessionId();
    if (!activeSessionId) return;
    const socket = getOrCreateSocket();
    const matches = (payload: MuhabbetTripSessionSocketPayload) =>
      normalizeMuhabbetSessionId(payload?.session_id || payload?.sessionId || payload?.session?.id) === activeSessionId;
    const bindNotify = (eventName: string) => (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] notify', eventName, payload);
      if (!matches(payload)) return;
      socketRefreshSession(`socket_${eventName}`);
    };
    const bindTerminal = (eventName: string) => (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', eventName, payload);
      if (!matches(payload)) return;
      closeTerminalTrip(eventName, payload.session || null);
    };
    const onLocation = bindNotify('muhabbet_trip_location_updated');
    const onPaymentMethodSet = (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] notify', 'muhabbet_trip_payment_method_set', payload);
      if (!matches(payload)) return;
      socketRefreshSession('socket_muhabbet_trip_payment_method_set');
    };
    const onStarted = bindNotify('muhabbet_trip_started');
    const onCancelled = bindTerminal('muhabbet_trip_cancelled');
    const onFinished = (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_finished', payload);
      if (!matches(payload)) return;
      const hinted = payload.session || null;
      const fm = String(hinted?.finish_method || '').trim().toLowerCase();
      if (fm === 'qr') {
        socketRefreshSession('socket_muhabbet_trip_finished');
        return;
      }
      closeTerminalTrip('muhabbet_trip_finished', hinted);
    };
    const onExpired = bindTerminal('muhabbet_trip_expired');
    const callMatches = (payload: MuhabbetTripCallSocketPayload) =>
      normalizeMuhabbetSessionId(payload?.session_id || payload?.sessionId) === activeSessionId;
    const onCallNotify =
      (label: string) =>
      (payload: MuhabbetTripCallSocketPayload) => {
        console.log('[leylek-trip] notify', label, payload);
        if (!callMatches(payload)) return;
        socketRefreshSession(`socket_${label}`);
      };
    const onTripError = (payload: { code?: string; message?: string; detail?: string }) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_error', payload);
      setActionBusy(false);
      setPaymentBusy(false);
      const message = payload?.message || payload?.detail || '';
      if (message) Alert.alert('Muhabbet yolculuk', message);
    };
    const onForceFinished = (payload: MuhabbetTripFinishSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_force_finished', payload);
      if (normalizeMuhabbetSessionId(payload?.session_id || payload?.sessionId) !== activeSessionId) return;
      closeTerminalTrip('muhabbet_trip_force_finished', payload.session || null);
    };
    const joinRole =
      !myId || !session
        ? ''
        : String(session.driver_id || '').trim().toLowerCase() === myId.trim().toLowerCase()
          ? 'driver'
          : 'passenger';
    void (async () => {
      const sock = getOrCreateSocket();
      logLeylekAction('muhabbet_trip_join', {
        sessionId: activeSessionId,
        socketConnected: sock.connected,
        registered: !!myId && isMuhabbetSocketRegisteredForUser(sock, myId),
        role: joinRole,
        status: String(session?.status || ''),
      });
      notifyAuthTokenBecameAvailableForSocket();
      await refreshSessionFromServer('trip_join_prefetch');
      const ok = await ensureMuhabbetTripSocketReady(myId, 3000);
      logLeylekAction('muhabbet_trip_join_after_ensure', {
        sessionId: activeSessionId,
        socketConnected: sock.connected,
        registered: !!myId && isMuhabbetSocketRegisteredForUser(sock, myId),
        role: joinRole,
        status: String(session?.status || ''),
      });
      if (!ok) {
        await refreshSessionFromServer('trip_join_socket_not_ready');
        return;
      }
      sock.emit('muhabbet_trip_join', { session_id: activeSessionId });
    })();
    const onCallStartNotify = onCallNotify('muhabbet_trip_call_start');
    const onCallAcceptNotify = onCallNotify('muhabbet_trip_call_accept');
    const onCallDeclineNotify = onCallNotify('muhabbet_trip_call_decline');
    const onCallEndNotify = onCallNotify('muhabbet_trip_call_end');
    socket.on('muhabbet_trip_location_updated', onLocation);
    socket.on('muhabbet_trip_payment_method_set', onPaymentMethodSet);
    socket.on('muhabbet_trip_started', onStarted);
    socket.on('muhabbet_trip_cancelled', onCancelled);
    socket.on('muhabbet_trip_finished', onFinished);
    socket.on('muhabbet_trip_expired', onExpired);
    socket.on('muhabbet_trip_call_start', onCallStartNotify);
    socket.on('muhabbet_trip_call_accept', onCallAcceptNotify);
    socket.on('muhabbet_trip_call_decline', onCallDeclineNotify);
    socket.on('muhabbet_trip_call_end', onCallEndNotify);
    socket.on('muhabbet_trip_error', onTripError);
    socket.on('muhabbet_trip_force_finished', onForceFinished);
    return () => {
      console.log(`[leylek-trip] emit event=muhabbet_trip_leave session_id=${activeSessionId}`, { session_id: activeSessionId });
      socket.emit('muhabbet_trip_leave', { session_id: activeSessionId });
      socket.off('muhabbet_trip_location_updated', onLocation);
      socket.off('muhabbet_trip_payment_method_set', onPaymentMethodSet);
      socket.off('muhabbet_trip_started', onStarted);
      socket.off('muhabbet_trip_cancelled', onCancelled);
      socket.off('muhabbet_trip_finished', onFinished);
      socket.off('muhabbet_trip_expired', onExpired);
      socket.off('muhabbet_trip_call_start', onCallStartNotify);
      socket.off('muhabbet_trip_call_accept', onCallAcceptNotify);
      socket.off('muhabbet_trip_call_decline', onCallDeclineNotify);
      socket.off('muhabbet_trip_call_end', onCallEndNotify);
      socket.off('muhabbet_trip_error', onTripError);
      socket.off('muhabbet_trip_force_finished', onForceFinished);
    };
  }, [closeTerminalTrip, getActiveMuhabbetSessionId, myId, refreshSessionFromServer, session, socketRefreshSession]);

  const locations = useMemo(() => {
    if (!session) return {};
    return {
      pickup: coord(session.pickup_lat, session.pickup_lng),
      dropoff: coord(session.dropoff_lat, session.dropoff_lng),
      passenger: coord(session.passenger_location_lat, session.passenger_location_lng),
      driver: coord(session.driver_location_lat, session.driver_location_lng),
    };
  }, [session]);

  const shareLocation = useCallback(async () => {
    await emitCurrentLocation({ requestPermission: true, showAlert: true, manual: true });
  }, [emitCurrentLocation]);

  useEffect(() => {
    if (!session || !myId || paymentPromptShown || isTerminal) return;
    const passengerId = String(session.passenger_id || '').trim().toLowerCase();
    const hasPaymentMethod = !!String(session.payment_method || '').trim();
    if (myId === passengerId && !hasPaymentMethod) {
      setPaymentPromptShown(true);
      setPaymentPromptVisible(true);
    }
  }, [isTerminal, myId, paymentPromptShown, session]);

  const emitTripCancel = useCallback(() => {
    void (async () => {
      setActionBusy(true);
      try {
        const rest = await muhabbetTripSessionRestPost({
          action: 'trip_cancel',
          pathSuffix: 'cancel',
          body: {},
        });
        if (isMuhabbetTripRestOk(rest)) {
          await refreshSessionFromServer('trip_cancel_rest');
          return;
        }
        const okSocket = await emitMuhabbetTripEventEnsured(
          'trip_muhabbet_trip_cancel',
          'muhabbet_trip_cancel',
          {},
          { suppressConnectionRenewAlert: true }
        );
        if (okSocket) await refreshSessionFromServer('trip_cancel_socket_fallback');
        else await refreshSessionFromServer('trip_cancel_fail');
      } finally {
        setActionBusy(false);
      }
    })();
  }, [emitMuhabbetTripEventEnsured, muhabbetTripSessionRestPost, refreshSessionFromServer]);

  const emitAction = useCallback(
    (eventName: TripActionEvent) => {
      if (eventName === 'muhabbet_trip_cancel') {
        emitTripCancel();
        return;
      }
      void (async () => {
        setActionBusy(true);
        try {
          await emitMuhabbetTripEventEnsured(`trip_${eventName}`, eventName, {}, { suppressConnectionRenewAlert: true });
        } finally {
          setActionBusy(false);
        }
      })();
    },
    [emitMuhabbetTripEventEnsured, emitTripCancel]
  );

  const startCall = useCallback(() => {
    if (isTerminal || !session) return;
    void (async () => {
      const sid = getActiveMuhabbetSessionId();
      if (!sid || !myId) {
        Alert.alert('Muhabbet yolculuğu', 'Yolculuk bilgisi hazırlanıyor.');
        return;
      }
      const myLo = myId.trim().toLowerCase();
      const passengerLo = String(session.passenger_id || '').trim().toLowerCase();
      const driverLo = String(session.driver_id || '').trim().toLowerCase();
      const targetLo = myLo === passengerLo ? driverLo : passengerLo;
      const nowIso = new Date().toISOString();
      console.log('[leylek_call]', {
        callerUserId: myId,
        sessionId: sid,
        role: isDriver ? 'driver' : 'passenger',
      });
      touchOptimistic('call_start');
      callOutgoingStartedAtRef.current = Date.now();
      setCallBusy(true);
      setCallState('outgoing');
      setCallPayload({
        session_id: sid,
        conversation_id: session.conversation_id ?? undefined,
        channel_name: `muhabbet_trip_${sid}`,
        caller_id: myLo,
        target_user_id: targetLo,
        started_at: nowIso,
      });
      try {
        const rest = await muhabbetTripSessionRestPost({ action: 'call_start', pathSuffix: 'call/start' });
        if (
          rest.ok &&
          rest.json.success === true &&
          rest.json.call &&
          typeof rest.json.call === 'object'
        ) {
          setCallPayload(rest.json.call as MuhabbetTripCallSocketPayload);
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setSession(sess as MuhabbetTripSession);
          }
          await refreshSessionFromServer('call_start_rest');
          clearOptimistic('call_start');
          callOutgoingStartedAtRef.current = 0;
          return;
        }
        setCallState('idle');
        setCallPayload(null);
        clearOptimistic('call_start');
        callOutgoingStartedAtRef.current = 0;
        const okSocket = await emitMuhabbetTripEventEnsured('start_call', 'muhabbet_trip_call_start', {}, {
          suppressConnectionRenewAlert: true,
        });
        if (!okSocket) {
          const det = typeof rest.json.detail === 'string' ? rest.json.detail : '';
          if (det) Alert.alert('Muhabbet yolculuk', det);
        } else {
          await refreshSessionFromServer('call_start_socket_fallback');
          clearOptimistic('call_start');
          callOutgoingStartedAtRef.current = 0;
        }
      } catch {
        clearOptimistic('call_start');
        callOutgoingStartedAtRef.current = 0;
        setCallState('idle');
        setCallPayload(null);
      } finally {
        setCallBusy(false);
      }
    })();
  }, [
    clearOptimistic,
    emitMuhabbetTripEventEnsured,
    getActiveMuhabbetSessionId,
    isDriver,
    isTerminal,
    muhabbetTripSessionRestPost,
    myId,
    refreshSessionFromServer,
    session,
    touchOptimistic,
  ]);

  const selectPaymentMethod = useCallback(
    (paymentMethod: 'cash' | 'card') => {
      if (!session || isTerminal || paymentBusy) return;
      const prevPm = session.payment_method ?? null;
      const prevSelAt = session.payment_method_selected_at ?? null;
      const optimisticAt = new Date().toISOString();
      touchOptimistic('payment_method');
      setSession((s) =>
        s
          ? {
              ...s,
              payment_method: paymentMethod,
              payment_method_selected_at: optimisticAt,
            }
          : s
      );
      void (async () => {
        setPaymentBusy(true);
        try {
          const rest = await muhabbetTripSessionRestPost({
            action: 'payment_method_set',
            pathSuffix: 'payment-method',
            body: { payment_method: paymentMethod },
          });
          if (isMuhabbetTripRestOk(rest)) {
            const sess = rest.json.session;
            if (sess && typeof sess === 'object') {
              setSession(sess as MuhabbetTripSession);
            }
            await refreshSessionFromServer('payment_method_rest');
            clearOptimistic('payment_method');
            setPaymentPromptVisible(false);
            return;
          }
          setSession((s) =>
            s
              ? {
                  ...s,
                  payment_method: prevPm,
                  payment_method_selected_at: prevSelAt,
                }
              : s
          );
          clearOptimistic('payment_method');
          await refreshSessionFromServer('payment_method_fail');
          const okSocket = await emitMuhabbetTripEventEnsured(
            'payment_method_set',
            'muhabbet_trip_payment_method_set',
            {
              payment_method: paymentMethod,
            },
            { suppressConnectionRenewAlert: true }
          );
          if (okSocket) {
            await refreshSessionFromServer('payment_method_socket_fallback');
            clearOptimistic('payment_method');
            setPaymentPromptVisible(false);
          } else {
            const det = typeof rest.json.detail === 'string' ? rest.json.detail : '';
            if (det) Alert.alert('Muhabbet yolculuk', det);
          }
        } catch {
          clearOptimistic('payment_method');
          setSession((s) =>
            s
              ? {
                  ...s,
                  payment_method: prevPm,
                  payment_method_selected_at: prevSelAt,
                }
              : s
          );
        } finally {
          setPaymentBusy(false);
        }
      })();
    },
    [
      clearOptimistic,
      emitMuhabbetTripEventEnsured,
      isTerminal,
      muhabbetTripSessionRestPost,
      paymentBusy,
      refreshSessionFromServer,
      session,
      touchOptimistic,
    ]
  );

  const acceptCall = useCallback(() => {
    if (!callPayload) return;
    void (async () => {
      const activeSessionIdNext = getActiveMuhabbetSessionId();
      const snapPayload = callPayload;
      const snapState = callState;
      touchOptimistic('call_accept');
      setCallBusy(true);
      setCallState('active');
      setCallPayload((prev) => ({ ...(prev || {}), session_id: activeSessionIdNext || prev?.session_id }));
      try {
        const rest = await muhabbetTripSessionRestPost({ action: 'call_accept', pathSuffix: 'call/accept' });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setSession(sess as MuhabbetTripSession);
          }
          await refreshSessionFromServer('call_accept_rest');
          clearOptimistic('call_accept');
          return;
        }
        setCallState(snapState);
        setCallPayload(snapPayload);
        clearOptimistic('call_accept');
        await refreshSessionFromServer('call_accept_fail');
        const okSocket = await emitMuhabbetTripEventEnsured(
          'call_accept',
          'muhabbet_trip_call_accept',
          {},
          { suppressConnectionRenewAlert: true }
        );
        if (okSocket) {
          await refreshSessionFromServer('call_accept_socket_fallback');
          clearOptimistic('call_accept');
        }
      } catch {
        clearOptimistic('call_accept');
        setCallState(snapState);
        setCallPayload(snapPayload);
      } finally {
        setCallBusy(false);
      }
    })();
  }, [
    callPayload,
    callState,
    clearOptimistic,
    emitMuhabbetTripEventEnsured,
    getActiveMuhabbetSessionId,
    muhabbetTripSessionRestPost,
    refreshSessionFromServer,
    touchOptimistic,
  ]);

  const declineCall = useCallback(() => {
    void (async () => {
      const snapPayload = callPayload;
      const snapState = callState;
      touchOptimistic('call_decline');
      setCallBusy(true);
      setCallPayload(null);
      setCallState('idle');
      try {
        const rest = await muhabbetTripSessionRestPost({ action: 'call_decline', pathSuffix: 'call/decline' });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setSession(sess as MuhabbetTripSession);
          }
          await refreshSessionFromServer('call_decline_rest');
          clearOptimistic('call_decline');
          return;
        }
        setCallPayload(snapPayload);
        setCallState(snapState);
        clearOptimistic('call_decline');
        await refreshSessionFromServer('call_decline_fail');
        await emitMuhabbetTripEventEnsured(
          'call_decline',
          'muhabbet_trip_call_decline',
          {},
          { showSessionMissingAlert: false, suppressConnectionRenewAlert: true }
        );
        await refreshSessionFromServer('call_decline_socket_fallback');
        clearOptimistic('call_decline');
      } catch {
        clearOptimistic('call_decline');
        setCallPayload(snapPayload);
        setCallState(snapState);
      } finally {
        setCallBusy(false);
      }
    })();
  }, [callPayload, callState, clearOptimistic, emitMuhabbetTripEventEnsured, muhabbetTripSessionRestPost, refreshSessionFromServer, touchOptimistic]);

  const endCall = useCallback(() => {
    void (async () => {
      const snapPayload = callPayload;
      const snapState = callState;
      touchOptimistic('call_end');
      setCallBusy(true);
      setCallPayload(null);
      setCallState('idle');
      try {
        const rest = await muhabbetTripSessionRestPost({ action: 'call_end', pathSuffix: 'call/end' });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setSession(sess as MuhabbetTripSession);
          }
          await refreshSessionFromServer('call_end_rest');
          clearOptimistic('call_end');
          return;
        }
        setCallPayload(snapPayload);
        setCallState(snapState);
        clearOptimistic('call_end');
        await refreshSessionFromServer('call_end_fail');
        await emitMuhabbetTripEventEnsured(
          'call_end',
          'muhabbet_trip_call_end',
          {},
          { showSessionMissingAlert: false, suppressConnectionRenewAlert: true }
        );
        await refreshSessionFromServer('call_end_socket_fallback');
        clearOptimistic('call_end');
      } catch {
        clearOptimistic('call_end');
        setCallPayload(snapPayload);
        setCallState(snapState);
      } finally {
        setCallBusy(false);
      }
    })();
  }, [callPayload, callState, clearOptimistic, emitMuhabbetTripEventEnsured, muhabbetTripSessionRestPost, refreshSessionFromServer, touchOptimistic]);

  const navigationTarget = useMemo(() => {
    if (!session) return null;
    if (session.status === 'started' || session.status === 'active') return locations.dropoff;
    if (isDriver) return locations.passenger || locations.pickup;
    return locations.driver || locations.pickup;
  }, [isDriver, locations.driver, locations.dropoff, locations.passenger, locations.pickup, session]);

  const navigationLabel = session?.status === 'started' || session?.status === 'active' ? 'Varışa Git' : isDriver ? 'Yolcuya Git' : 'Navigasyon';
  const openNavigation = useCallback(async () => {
    const sid = getActiveMuhabbetSessionId();
    const socket = getOrCreateSocket();
    logLeylekAction('navigation_open', {
      sessionId: sid || '',
      socketConnected: socket.connected,
      registered: !!myId && isMuhabbetSocketRegisteredForUser(socket, myId),
      role: isDriver ? 'driver' : 'passenger',
      status: String(session?.status || ''),
    });
    if (!navigationTarget) {
      Alert.alert('Navigasyon', 'Navigasyon için gerekli konum henüz hazır değil.');
      return;
    }
    const q = `${navigationTarget.latitude},${navigationTarget.longitude}`;
    const nativeUrl = Platform.OS === 'android' ? `google.navigation:q=${q}&mode=d` : `comgooglemaps://?daddr=${q}&directionsmode=driving`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;
    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
    } catch {
      await Linking.openURL(webUrl);
    }
  }, [getActiveMuhabbetSessionId, isDriver, myId, navigationTarget, session?.status]);

  const openQrFinish = useCallback(() => {
    if (!session || isTerminal) return;
    if (!getActiveMuhabbetSessionId()) {
      Alert.alert('Muhabbet yolculuğu', 'Yolculuk bilgisi hazırlanıyor.');
      return;
    }
    if (session.status === 'ready') {
      if (isDriver) {
        void (async () => {
          setActionBusy(true);
          touchOptimistic('boarding_qr_create');
          setQrMode('boarding');
          setQrFinishToken('');
          setQrExpiresAt(null);
          setQrLoading(true);
          setQrCodeVisible(true);
          try {
            const rest = await muhabbetTripSessionRestPost({
              action: 'boarding_qr_create',
              pathSuffix: 'boarding-qr/create',
            });
            if (
              rest.ok &&
              rest.json.success === true &&
              typeof rest.json.boarding_qr_token === 'string' &&
              rest.json.boarding_qr_token.trim()
            ) {
              setQrFinishToken(String(rest.json.boarding_qr_token).trim().toUpperCase());
              setQrExpiresAt(typeof rest.json.expires_at === 'string' ? rest.json.expires_at : null);
              await refreshSessionFromServer('boarding_qr_create_rest');
              clearOptimistic('boarding_qr_create');
              return;
            }
            setQrCodeVisible(false);
            setQrFinishToken('');
            clearOptimistic('boarding_qr_create');
            const okSocket = await emitMuhabbetTripEventEnsured(
              'boarding_qr_create',
              'muhabbet_trip_boarding_qr_create',
              {},
              { suppressConnectionRenewAlert: true }
            );
            if (!okSocket && typeof rest.json.detail === 'string' && rest.json.detail) {
              Alert.alert('Muhabbet yolculuk', rest.json.detail);
            }
            if (okSocket) {
              touchOptimistic('boarding_qr_create');
              await refreshSessionFromServer('boarding_qr_create_socket_fallback');
              clearOptimistic('boarding_qr_create');
            }
          } catch {
            clearOptimistic('boarding_qr_create');
            setQrCodeVisible(false);
            setQrFinishToken('');
          } finally {
            setQrLoading(false);
            setActionBusy(false);
          }
        })();
      } else {
        Alert.alert(
          'Araca bindiniz mi?',
          'Araca bindiğinizde sürücünün gösterdiği biniş QR kodunu okutun.',
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Tamam, QR okut',
              onPress: () => setQrScanVisible(true),
            },
          ],
        );
      }
      return;
    }
    if (isDriver) {
      setQrMode('finish');
      setQrFinishToken('');
      setQrExpiresAt(null);
      setQrLoading(true);
      touchOptimistic('finish_qr_create');
      setQrCodeVisible(true);
      void (async () => {
        setActionBusy(true);
        try {
          const rest = await muhabbetTripSessionRestPost({
            action: 'finish_qr_create',
            pathSuffix: 'finish-qr/create',
          });
          const rawTok =
            typeof rest.json.finish_qr_token === 'string'
              ? rest.json.finish_qr_token
              : typeof rest.json.qr_finish_token === 'string'
                ? rest.json.qr_finish_token
                : '';
          if (rest.ok && rest.json.success === true && rawTok.trim()) {
            setQrFinishToken(rawTok.trim().toUpperCase());
            setQrExpiresAt(typeof rest.json.expires_at === 'string' ? rest.json.expires_at : null);
            await refreshSessionFromServer('finish_qr_create_rest');
            clearOptimistic('finish_qr_create');
            return;
          }
          setQrCodeVisible(false);
          setQrFinishToken('');
          clearOptimistic('finish_qr_create');
          const okSocket = await emitMuhabbetTripEventEnsured(
            'finish_qr_create',
            'muhabbet_trip_finish_qr_create',
            {},
            { suppressConnectionRenewAlert: true }
          );
          if (!okSocket && typeof rest.json.detail === 'string' && rest.json.detail) {
            Alert.alert('Muhabbet yolculuk', rest.json.detail);
          }
          if (okSocket) {
            touchOptimistic('finish_qr_create');
            setTimeout(() => {
              void refreshSessionFromServer('finish_qr_create_socket_fallback').finally(() =>
                clearOptimistic('finish_qr_create')
              );
            }, 600);
          }
        } catch {
          clearOptimistic('finish_qr_create');
          setQrCodeVisible(false);
          setQrFinishToken('');
        } finally {
          setQrLoading(false);
          setActionBusy(false);
        }
      })();
    } else {
      setQrScanVisible(true);
    }
  }, [
    clearOptimistic,
    emitMuhabbetTripEventEnsured,
    getActiveMuhabbetSessionId,
    isDriver,
    isTerminal,
    muhabbetTripSessionRestPost,
    refreshSessionFromServer,
    session,
    touchOptimistic,
  ]);

  const confirmQrToken = useCallback(
    (rawToken: string) => {
      const token = rawToken.trim().toUpperCase();
      if (!token) {
        Alert.alert(qrMode === 'boarding' ? 'Biniş QR' : 'QR ile Bitir', qrMode === 'boarding' ? 'Sürücünün gösterdiği kodu girin.' : 'Yolcunun gösterdiği kodu girin.');
        return;
      }
      void (async () => {
        setActionBusy(true);
        if (qrMode === 'finish') {
          Vibration.vibrate([0, 70, 55, 90]);
        }
        try {
          if (qrMode === 'boarding') {
            const rest = await muhabbetTripSessionRestPost({
              action: 'boarding_qr_confirm',
              pathSuffix: 'boarding-qr/confirm',
              body: { boarding_qr_token: token },
            });
            if (rest.ok && rest.json.success === true) {
              const next = await refreshSessionFromServer('boarding_qr_confirm_rest');
              setQrScanVisible(false);
              setQrFinishToken('');
              setQrExpiresAt(null);
              setQrCodeVisible(false);
              const st = next?.status;
              if (st === 'active' || st === 'started') {
                setBoardingMessage(
                  myId &&
                    String(next?.driver_id || '')
                      .trim()
                      .toLowerCase() === myId.trim().toLowerCase()
                    ? 'Yolculuk başladı. Hedefte QR gösterin'
                    : 'Araca bindiniz. Hedefte QR okutun'
                );
                setTimeout(() => setBoardingMessage(''), 4200);
              }
              return;
            }
            const okSocket = await emitMuhabbetTripEventEnsured(
              'boarding_qr_confirm',
              'muhabbet_trip_boarding_qr_confirm',
              { boarding_qr_token: token },
              { suppressConnectionRenewAlert: true }
            );
            if (okSocket) {
              const next = await refreshSessionFromServer('boarding_qr_confirm_socket_fallback');
              setQrScanVisible(false);
              const st = next?.status;
              if (st === 'active' || st === 'started') {
                setQrFinishToken('');
                setQrExpiresAt(null);
                setQrCodeVisible(false);
                setBoardingMessage(
                  myId &&
                    String(next?.driver_id || '')
                      .trim()
                      .toLowerCase() === myId.trim().toLowerCase()
                    ? 'Yolculuk başladı. Hedefte QR gösterin'
                    : 'Araca bindiniz. Hedefte QR okutun'
                );
                setTimeout(() => setBoardingMessage(''), 4200);
              }
            } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
              Alert.alert('Muhabbet yolculuk', rest.json.detail);
            }
            return;
          }

          const actionLabel = 'finish_qr_confirm';
          const rest = await muhabbetTripSessionRestPost({
            action: 'finish_qr_confirm',
            pathSuffix: 'finish-qr/confirm',
            body: { finish_qr_token: token },
          });
          if (isMuhabbetTripRestOk(rest)) {
            setQrScanVisible(false);
            await refreshSessionFromServer('finish_qr_confirm_rest');
            return;
          }
          const okSocket = await emitMuhabbetTripEventEnsured(
            actionLabel,
            'muhabbet_trip_finish_qr_confirm',
            {
              finish_qr_token: token,
            },
            { suppressConnectionRenewAlert: true }
          );
          if (okSocket) {
            setQrScanVisible(false);
            await refreshSessionFromServer('finish_qr_confirm_socket_fallback');
          } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
            Alert.alert('Muhabbet yolculuk', rest.json.detail);
          }
        } finally {
          setActionBusy(false);
        }
      })();
    },
    [emitMuhabbetTripEventEnsured, muhabbetTripSessionRestPost, myId, qrMode, refreshSessionFromServer]
  );

  const requestForceFinish = useCallback(() => {
    if (!session || isTerminal) return;
    setForceFinishWarningVisible(true);
  }, [isTerminal, session]);

  const confirmForceFinishRequest = useCallback(() => {
    setForceFinishWarningVisible(false);
    void (async () => {
      touchOptimistic('force_finish_request');
      setForceFinishRequestOptimistic(true);
      setActionBusy(true);
      try {
        const rest = await muhabbetTripSessionRestPost({
          action: 'force_finish_request',
          pathSuffix: 'force-finish/request',
        });
        if (isMuhabbetTripRestOk(rest)) {
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setSession(sess as MuhabbetTripSession);
          }
          await refreshSessionFromServer('force_finish_request_rest');
          clearOptimistic('force_finish_request');
          return;
        }
        setForceFinishRequestOptimistic(false);
        clearOptimistic('force_finish_request');
        await refreshSessionFromServer('force_finish_request_fail');
        const okSocket = await emitMuhabbetTripEventEnsured(
          'force_finish_request',
          'muhabbet_trip_force_finish_request',
          {},
          { suppressConnectionRenewAlert: true }
        );
        if (okSocket) {
          await refreshSessionFromServer('force_finish_request_socket_fallback');
          clearOptimistic('force_finish_request');
        } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
          Alert.alert('Muhabbet yolculuk', rest.json.detail);
        }
      } catch {
        clearOptimistic('force_finish_request');
        setForceFinishRequestOptimistic(false);
      } finally {
        setActionBusy(false);
      }
    })();
  }, [
    clearOptimistic,
    emitMuhabbetTripEventEnsured,
    muhabbetTripSessionRestPost,
    refreshSessionFromServer,
    touchOptimistic,
  ]);

  const respondForceFinish = useCallback(
    (accepted: boolean) => {
      const snapshot = forceFinishPrompt;
      setForceFinishPrompt(null);
      void (async () => {
        touchOptimistic('force_finish_respond');
        setActionBusy(true);
        try {
          const rest = await muhabbetTripSessionRestPost({
            action: 'force_finish_respond',
            pathSuffix: 'force-finish/respond',
            body: { response: accepted ? 'accepted' : 'declined' },
          });
          if (isMuhabbetTripRestOk(rest)) {
            const sess = rest.json.session;
            if (sess && typeof sess === 'object') {
              setSession(sess as MuhabbetTripSession);
            }
            await refreshSessionFromServer('force_finish_respond_rest');
            clearOptimistic('force_finish_respond');
            return;
          }
          setForceFinishPrompt(snapshot);
          clearOptimistic('force_finish_respond');
          await refreshSessionFromServer('force_finish_respond_fail');
          const okSocket = await emitMuhabbetTripEventEnsured(
            'force_finish_respond',
            'muhabbet_trip_force_finish_respond',
            {
              response: accepted ? 'accepted' : 'declined',
            },
            { suppressConnectionRenewAlert: true }
          );
          if (okSocket) {
            await refreshSessionFromServer('force_finish_respond_socket_fallback');
            clearOptimistic('force_finish_respond');
          } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
            Alert.alert('Muhabbet yolculuk', rest.json.detail);
          }
        } catch {
          clearOptimistic('force_finish_respond');
          setForceFinishPrompt(snapshot);
        } finally {
          setActionBusy(false);
        }
      })();
    },
    [
      clearOptimistic,
      emitMuhabbetTripEventEnsured,
      forceFinishPrompt,
      muhabbetTripSessionRestPost,
      refreshSessionFromServer,
      touchOptimistic,
    ]
  );

  const closeQrCodeModal = useCallback(() => {
    setQrCodeVisible(false);
    setQrLoading(false);
    clearOptimistic('boarding_qr_create');
    clearOptimistic('finish_qr_create');
  }, [clearOptimistic]);

  useEffect(() => {
    if (!session) return;
    if (!session.route_polyline && locations.pickup && locations.dropoff) {
      console.log('[leylek-trip] route data missing; waiting for road route', {
        session_id: sessionId,
        pickup: locations.pickup,
        dropoff: locations.dropoff,
      });
    } else if (!locations.pickup || !locations.dropoff) {
      console.log('[leylek-trip] route coordinates missing', { session_id: sessionId });
    }
  }, [locations.dropoff, locations.pickup, session, sessionId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color="#2563EB" />
        <Text style={styles.loadingText}>Leylek yolculuk hazırlanıyor…</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <Ionicons name="alert-circle-outline" size={36} color="#F97316" />
        <Text style={styles.emptyTitle}>Oturum bulunamadı</Text>
        <Text style={styles.emptySub}>Sohbete dönüp tekrar deneyin.</Text>
        <Pressable onPress={() => router.back()} style={styles.emptyBackBtn}>
          <Text style={styles.emptyBackTxt}>Geri dön</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (finishResult) {
    const isCard = finishResult.paymentMethod === 'card';
    return (
      <SafeAreaView style={styles.resultRoot}>
        <View style={styles.resultCard}>
          <View style={[styles.resultIcon, { backgroundColor: isCard ? '#2563EB' : '#16A34A' }]}>
            <Ionicons name={isCard ? 'card-outline' : 'cash-outline'} size={42} color="#FFFFFF" />
          </View>
          <Text style={styles.resultTitle}>Yolculuk tamamlandı</Text>
          <Text style={styles.resultText}>
            {isCard ? 'Kart ödeme altyapısı yakında burada açılacak.' : 'Ödeme taraflar arasında tamamlanır'}
          </Text>
          <Pressable style={({ pressed }) => [styles.resultButton, pressed && { opacity: 0.86 }]} onPress={() => router.replace(MUHABBET_SAFE_ROUTE)}>
            <Text style={styles.resultButtonText}>Sohbete dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <LeylekTripLiveRideChrome
        modernLeylekOfferUi
        isDriver={isDriver}
        isTerminal={isTerminal}
        roleTitle=""
        statusLabel={chromeDisplayStatus.label}
        statusDetail={chromeDisplayStatus.detail}
        suppressWaitingPolylineBanner={suppressChromeRouteWait}
        pickupText={session.pickup_text || 'Sohbette belirlenen alış noktası'}
        dropoffText={session.dropoff_text || 'Sohbette belirlenen varış noktası'}
        agreedPrice={session.agreed_price}
        vehicleKind={session.vehicle_kind}
        paymentMethod={session.payment_method}
        routePolyline={session.route_polyline}
        routeDistanceKm={session.route_distance_km}
        routeDurationMin={session.route_duration_min}
        sessionStatus={session.status}
        pickup={locations.pickup}
        dropoff={locations.dropoff}
        passengerLocation={locations.passenger}
        driverLocation={locations.driver}
        deviceLocation={deviceLocation}
        routeDataMissing={!locations.pickup || !locations.dropoff}
        tripInfoReady={tripInfoReady}
        finishMethod={session.finish_method}
        finishScoreDelta={session.finish_score_delta}
        forcedFinishResponse={session.forced_finish_other_user_response}
        navigationLabel={navigationLabel}
        navigationDisabled={!navigationTarget}
        sendingLocation={sendingLocation}
        actionBusy={actionBusy}
        callState={callState}
        callBusy={callBusy}
        canStart={false}
        canFinish={tripInfoReady && isDriver && (session.status === 'active' || session.status === 'started')}
        onShareLocation={() => void shareLocation()}
        onStartCall={startCall}
        onJoinCall={acceptCall}
        onEndCall={endCall}
        onNavigate={() => void openNavigation()}
        onQrFinish={openQrFinish}
        onForceFinish={requestForceFinish}
        onStart={() => emitAction('muhabbet_trip_start')}
        onFinish={() => emitAction('muhabbet_trip_finish')}
        onCancel={() => emitAction('muhabbet_trip_cancel')}
      />
      {boardingMessage ? (
        <View style={styles.boardingToast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={19} color="#BBF7D0" />
          <Text style={styles.boardingToastText}>{boardingMessage}</Text>
        </View>
      ) : null}
      <Modal
        visible={paymentPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentPromptVisible(false)}
      >
        <View style={styles.trustModalRoot}>
          <View style={styles.trustModalCard}>
            <View style={[styles.trustModalIcon, { backgroundColor: '#F97316' }]}>
              <Ionicons name="wallet" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.trustModalTitle}>Masraf paylaşımı</Text>
            <Text style={styles.trustModalText}>Yol paylaşımı masrafını nasıl planlıyorsunuz?</Text>
            <View style={styles.paymentChoiceRow}>
              <Pressable
                style={({ pressed }) => [styles.paymentChoiceButton, pressed && styles.paymentChoicePressed]}
                disabled={paymentBusy}
                onPress={() => selectPaymentMethod('cash')}
              >
                {paymentBusy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="cash-outline" size={20} color="#FFFFFF" />}
                <Text style={styles.paymentChoiceText}>Nakit</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.paymentChoiceButton, styles.paymentChoiceCardButton, pressed && styles.paymentChoicePressed]}
                disabled={paymentBusy}
                onPress={() => selectPaymentMethod('card')}
              >
                {paymentBusy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="card-outline" size={20} color="#FFFFFF" />}
                <Text style={styles.paymentChoiceText}>Kart</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.trustDeclineButton, pressed && { opacity: 0.9 }]}
              disabled={paymentBusy}
              onPress={() => setPaymentPromptVisible(false)}
            >
              <Text style={styles.trustDeclineText}>Şimdilik sonra</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <MuhabbetTripCallScreen
        visible={callState === 'incoming' || callState === 'outgoing' || callState === 'active'}
        mode={callState === 'active' ? 'active' : callState === 'incoming' ? 'incoming' : 'outgoing'}
        apiBaseUrl={apiBaseUrl}
        sessionId={activeSessionId || sessionId}
        peerName={isDriver ? 'Yolcu' : 'Sürücü'}
        peerRoleLabel={isDriver ? 'Muhabbet yolcusu' : 'Muhabbet sürücüsü'}
        onAccept={acceptCall}
        onDecline={declineCall}
        onCancel={endCall}
      />
      <MuhabbetTripQrCodeModal
        visible={qrCodeVisible}
        mode={qrMode}
        loading={qrLoading}
        token={qrFinishToken}
        sessionId={activeSessionId || sessionId}
        expiresAt={qrExpiresAt}
        onClose={closeQrCodeModal}
      />
      <MuhabbetTripQrScanModal
        visible={qrScanVisible}
        mode={qrMode}
        onClose={() => setQrScanVisible(false)}
        onConfirmToken={confirmQrToken}
      />
      <Modal
        visible={forceFinishWarningVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForceFinishWarningVisible(false)}
      >
        <View style={styles.trustModalRoot}>
          <View style={styles.trustModalCard}>
            <View style={[styles.trustModalIcon, { backgroundColor: '#DC2626' }]}>
              <Ionicons name="warning" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.trustModalTitle}>Zorla Bitir</Text>
            <Text style={styles.trustModalText}>
              Zorla bitirme -5 puan etkileyebilir. Karşı tarafın yanıtı kayıt altına alınır.
            </Text>
            <Pressable style={({ pressed }) => [styles.forceButton, pressed && { opacity: 0.9 }]} onPress={confirmForceFinishRequest}>
              <Ionicons name="warning-outline" size={18} color="#FFFFFF" />
              <Text style={styles.trustAcceptText}>Zorla Bitirme İsteği Gönder</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.trustDeclineButton, pressed && { opacity: 0.9 }]} onPress={() => setForceFinishWarningVisible(false)}>
              <Text style={styles.trustDeclineText}>Vazgeç</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!forceFinishPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setForceFinishPrompt(null)}
      >
        <View style={styles.trustModalRoot}>
          <View style={styles.trustModalCard}>
            <View style={[styles.trustModalIcon, { backgroundColor: '#F97316' }]}>
              <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.trustModalTitle}>Karşı taraf zorla bitirdi</Text>
            <Text style={styles.trustModalText}>Karşı taraf yolculuğu zorla bitirdi. Yanıtınız kayıt altına alınacak ve yolculuk kapanacak.</Text>
            <Pressable style={({ pressed }) => [styles.trustAcceptButton, pressed && { opacity: 0.9 }]} onPress={() => respondForceFinish(true)}>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.trustAcceptText}>Onaylıyorum</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.trustDeclineButton, pressed && { opacity: 0.9 }]} onPress={() => respondForceFinish(false)}>
              <Text style={styles.trustDeclineText}>Onaylamıyorum</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#EEF1F5' },
  loadingText: { marginTop: 10, color: '#334155', fontWeight: '800' },
  emptyTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#0F172A' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#64748B' },
  emptyBackBtn: { marginTop: 16, borderRadius: 14, backgroundColor: '#2563EB', paddingVertical: 11, paddingHorizontal: 18 },
  emptyBackTxt: { color: '#FFF', fontWeight: '900' },
  resultRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#EEF1F5' },
  resultCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 16,
  },
  resultIcon: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { marginTop: 16, color: '#0F172A', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  resultText: { marginTop: 10, color: '#475569', fontSize: 16, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  resultButton: {
    marginTop: 20,
    width: '100%',
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  boardingToast: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    zIndex: 200,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 46, 22, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.42)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boardingToastText: { flex: 1, color: '#DCFCE7', fontSize: 14, fontWeight: '900' },
  trustModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  trustModalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 18,
  },
  trustModalIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  trustModalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  trustModalText: { marginTop: 8, color: '#475569', fontSize: 15, lineHeight: 21, textAlign: 'center', fontWeight: '700' },
  trustAcceptButton: {
    marginTop: 18,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  trustAcceptText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  trustDeclineButton: {
    marginTop: 10,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustDeclineText: { color: '#475569', fontSize: 14, fontWeight: '900' },
  paymentChoiceRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  paymentChoiceButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  paymentChoiceCardButton: {
    backgroundColor: '#2563EB',
  },
  paymentChoiceText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  paymentChoicePressed: { opacity: 0.84 },
  qrTokenBox: {
    marginTop: 16,
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  qrTokenText: { color: '#5B21B6', fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  forceButton: {
    marginTop: 18,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
