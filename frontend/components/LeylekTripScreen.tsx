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
import type { Socket } from 'socket.io-client';
import { getOrCreateSocket } from '../contexts/SocketContext';
import {
  ensureMuhabbetTripSocketReady,
  isMuhabbetSocketRegisteredForUser,
} from '../lib/muhabbetTripSocketEnsure';
import { notifyAuthTokenBecameAvailableForSocket } from '../lib/socketRegisterScheduler';
import { publishSocketSessionRefresh, subscribeSocketSessionRefresh } from '../lib/socketSessionRefresh';
import { takePrefetchedMuhabbetTripSession } from '../lib/muhabbetTripPushSessionPrefetch';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { subscribeTripSessionUpdated } from '../lib/muhabbetRealtimeEvents';
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
type ForceFinishPrompt = {
  requesterUserId: string;
  targetUserId: string;
  requestId?: string;
  timeoutAt?: string;
} | null;
type FinishResult = { paymentMethod: 'cash' | 'card' | null } | null;
const TERMINAL_TRIP_STATUSES = new Set(['finished', 'cancelled', 'expired']);
const MUHABBET_SAFE_ROUTE = '/' as Href;

function normalizeMuhabbetSessionId(value?: string | null): string {
  const sid = String(value || '').trim().toLowerCase();
  if (!sid || sid === 'undefined' || sid === 'null') return '';
  return sid;
}

/** Trip session odası + ack (muhabbet_trip_joined); başarısızsa birkaç deneme */
async function emitMuhabbetTripJoinWithRetries(socket: Socket, sessionIdRaw: string): Promise<boolean> {
  const sidNorm = normalizeMuhabbetSessionId(sessionIdRaw);
  if (!sidNorm) return false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ok = await new Promise<boolean>((resolve) => {
      let settled = false;
      const cleanup = () => {
        socket.off('muhabbet_trip_joined', onJ);
        socket.off('muhabbet_trip_error', onE);
      };
      const finish = (v: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(tid);
        cleanup();
        resolve(v);
      };
      const tid = setTimeout(() => finish(false), 1200);
      const onJ = (p: Record<string, unknown>) => {
        const sess = p?.session as MuhabbetTripSession | undefined;
        const ps = normalizeMuhabbetSessionId(
          String(p?.session_id || p?.sessionId || sess?.id || sess?.session_id || '')
        );
        if (ps && ps === sidNorm) finish(true);
      };
      const onE = (p: { code?: string }) => {
        const c = String(p?.code || '');
        if (c === 'not_registered' || c === 'forbidden' || c === 'bad_request' || c === 'server_error') finish(false);
      };
      socket.on('muhabbet_trip_joined', onJ);
      socket.on('muhabbet_trip_error', onE);
      console.log('[socket_emit]', JSON.stringify({ event: 'muhabbet_trip_join', hasAck: true, connected: socket.connected }));
      socket.emit('muhabbet_trip_join', { session_id: sidNorm });
    });
    console.log('[socket_join]', JSON.stringify({ kind: 'muhabbet_trip', session_id: sidNorm, ok, attempt }));
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 280));
  }
  return false;
}

function isMuhabbetTripRestOk(rest: { ok: boolean; json: Record<string, unknown> }): boolean {
  return rest.ok && rest.json.success === true;
}

const OPTIMISTIC_LOCK_MS = 1500;

type MuhabbetStateLockKey = 'call' | 'qr' | 'forceFinish' | 'payment';

type MuhabbetStateLocks = Record<MuhabbetStateLockKey, number>;

function optimisticLockFresh(locks: Record<string, number>, key: string, now: number): boolean {
  const t = locks[key];
  return t != null && now - t < OPTIMISTIC_LOCK_MS;
}

function createOptimisticActionId(flow: string): string {
  return `${flow}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

type MergePollCtx = {
  callState: CallState;
  callPayload: MuhabbetTripCallSocketPayload | null;
  qrLoading: boolean;
  latestPaymentActionId: string | null;
};

/** Poll / socket refresh: kilitliyken sunucu alanı geriye düşüremez */
function mergeMuhabbetTripSessionFromPoll(
  incoming: MuhabbetTripSession,
  prev: MuhabbetTripSession | null,
  optimisticLocks: Record<string, number>,
  stateLocks: MuhabbetStateLocks,
  now: number,
  ctx: MergePollCtx
): MuhabbetTripSession {
  let merged: MuhabbetTripSession = { ...incoming };

  if (prev && now < stateLocks.call) {
    const incTripStatus = String(incoming.status || '').trim().toLowerCase();
    if (!TERMINAL_TRIP_STATUSES.has(incTripStatus)) {
      console.log('[leylek_merge_blocked]', JSON.stringify({ key: 'call' }));
      const incomingCs = String(incoming.call_state || '').trim().toLowerCase();
      const overlayOutgoing =
        ctx.callState !== 'idle' &&
        ctx.callPayload &&
        (ctx.callState === 'outgoing' ||
          ctx.callState === 'active' ||
          incomingCs === 'active');
      if (overlayOutgoing && ctx.callPayload) {
        const cp = ctx.callPayload;
        const callerLo = String(cp.caller_id || '').trim().toLowerCase();
        const synState =
          ctx.callState === 'active' || incomingCs === 'active' ? 'active' : 'ringing';
        merged = {
          ...merged,
          call_active: true,
          call_state: synState,
          caller_id: callerLo || merged.caller_id,
          call_started_at:
            (typeof cp.started_at === 'string' ? cp.started_at : null) ??
            merged.call_started_at ??
            prev.call_started_at ??
            null,
          call_channel_name:
            cp.channel_name ??
            merged.call_channel_name ??
            prev.call_channel_name ??
            (merged.id ? `muhabbet_trip_${merged.id}` : null),
        };
        console.log('[leylek_fast_path]', JSON.stringify({ key: 'call_lock_overlay', synState }));
      } else {
        merged = {
          ...merged,
          call_active: prev.call_active,
          call_state: prev.call_state,
          caller_id: prev.caller_id,
          call_started_at: prev.call_started_at,
          call_channel_name: prev.call_channel_name,
        };
      }
    }
  }
  if (prev && now < stateLocks.qr) {
    console.log('[leylek_merge_blocked]', JSON.stringify({ key: 'qr' }));
    merged = {
      ...merged,
      boarding_qr_token: prev.boarding_qr_token,
      boarding_qr_created_at: prev.boarding_qr_created_at,
      boarding_qr_expires_at: prev.boarding_qr_expires_at,
      finish_qr_token: prev.finish_qr_token,
      qr_finish_token: prev.qr_finish_token,
      finish_qr_created_at: prev.finish_qr_created_at,
      finish_qr_expires_at: prev.finish_qr_expires_at,
      qr_finish_token_created_at: prev.qr_finish_token_created_at,
    };
  }
  if (prev && now < stateLocks.payment) {
    console.log('[leylek_merge_blocked]', JSON.stringify({ key: 'payment' }));
    merged = {
      ...merged,
      payment_method: prev.payment_method,
      payment_method_selected_at: prev.payment_method_selected_at,
    };
  }
  if (prev && now < stateLocks.forceFinish) {
    const incTripStatusFf = String(incoming.status || '').trim().toLowerCase();
    if (!TERMINAL_TRIP_STATUSES.has(incTripStatusFf)) {
      console.log('[leylek_merge_blocked]', JSON.stringify({ key: 'forceFinish' }));
      merged = {
        ...merged,
        force_finish_state: prev.force_finish_state,
        forced_finish_requested_by_user_id: prev.forced_finish_requested_by_user_id,
        forced_finish_requested_at: prev.forced_finish_requested_at,
        forced_finish_started_at: prev.forced_finish_started_at,
        forced_finish_timeout_at: prev.forced_finish_timeout_at,
        forced_finish_request_id: prev.forced_finish_request_id,
        forced_finish_confirmed_by_user_id: prev.forced_finish_confirmed_by_user_id,
        forced_finish_confirmed_at: prev.forced_finish_confirmed_at,
        forced_finish_other_user_response: prev.forced_finish_other_user_response,
      };
    }
  }

  if (
    prev?.payment_method &&
    incoming.payment_method != null &&
    String(prev.payment_method) !== String(incoming.payment_method) &&
    ctx.latestPaymentActionId != null
  ) {
    merged = {
      ...merged,
      payment_method: prev.payment_method,
      payment_method_selected_at: prev.payment_method_selected_at ?? merged.payment_method_selected_at,
    };
    console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_payment_response' }));
  }

  return mergeTripSessionForStalePoll(merged, prev, optimisticLocks, now, ctx);
}

/** Poll sırasında gelen eski session, optimistic UI ile çakışmasın diye alan birleştirme */
function mergeTripSessionForStalePoll(
  incoming: MuhabbetTripSession,
  prev: MuhabbetTripSession | null,
  locks: Record<string, number>,
  now: number,
  ctx: MergePollCtx
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

function muhabbetTripRestDetail(detail: unknown, fallback: string): string {
  if (detail === null || detail === undefined) return fallback;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
    const o = detail as Record<string, unknown>;
    const msg = o.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    const code = o.code;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object' && 'msg' in first && typeof (first as { msg?: string }).msg === 'string') {
      return String((first as { msg: string }).msg).trim();
    }
  }
  return fallback;
}

function displayStatus(status?: string | null): { label: string; detail: string } {
  switch (status) {
    case 'ready':
      return { label: 'Binişe hazır', detail: 'Biniş QR ile yolculuk başlatılır.' };
    case 'expired':
      return { label: 'Süresi doldu', detail: 'Bu Muhabbet yolculuk oturumu kapanmış.' };
    case 'active':
    case 'started':
      return { label: 'Yolculuk aktif', detail: 'Konum paylaşımı açık, rota takip ediliyor.' };
    case 'cancelled':
      return { label: 'İptal edildi', detail: 'Muhabbet yolculuk oturumu kapandı.' };
    case 'finished':
      return { label: 'Tamamlandı', detail: 'Muhabbet yolculuk oturumu tamamlandı.' };
    default:
      return { label: 'Binişe hazır', detail: 'Sürücü başlattığında canlı takip görünür.' };
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
  const effectiveSessionId = normalizeMuhabbetSessionId(sessionId);
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
  const [forceFinishTimeoutNotice, setForceFinishTimeoutNotice] = useState(false);
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

  const lastLocationRestOkRef = useRef(0);

  const terminalCloseHandledSidRef = useRef<string | null>(null);
  const terminalNavigateDoneRef = useRef(false);
  const terminalAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTripStatusRef = useRef<string | null>(null);
  const optimisticRef = useRef<Record<string, number>>({});
  const sessionRef = useRef<MuhabbetTripSession | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const callPayloadRef = useRef<MuhabbetTripCallSocketPayload | null>(null);
  const qrLoadingRef = useRef(false);
  const callOutgoingStartedAtRef = useRef(0);
  /** sessionId:callerId — decline/end sonrası kısa süre incoming tekrarını kes */
  const dismissedCallRef = useRef<{ key: string; until: number } | null>(null);
  const qrCreateInFlightRef = useRef(false);
  const refreshDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef<Promise<MuhabbetTripSession | null> | null>(null);
  const refreshDebouncedResolversRef = useRef<((v: MuhabbetTripSession | null) => void)[]>([]);
  const callSigLoggedRef = useRef('');
  const forceFinishSeenRef = useRef('');
  const forceFinishDismissedRef = useRef('');
  const forceFinishInFlightRef = useRef(false);
  const forceFinishRequestOptimisticRef = useRef(false);
  const callBusyRef = useRef(false);
  const callStartInFlightRef = useRef(false);
  const paymentInFlightRef = useRef(false);
  /** Legacy socket refresh UI busy iken atlandıysa, idle olunca tek bypass refresh */
  const pendingRefreshAfterIdleRef = useRef(false);
  const latestQrActionIdRef = useRef<string | null>(null);
  const latestCallActionIdRef = useRef<string | null>(null);
  const latestPaymentActionIdRef = useRef<string | null>(null);
  const latestForceFinishActionIdRef = useRef<string | null>(null);
  const qrModalOpenedAtRef = useRef(0);
  const [callStartCooldownUntil, setCallStartCooldownUntil] = useState(0);
  const [forceFinishUiTick, setForceFinishUiTick] = useState(0);

  const stateLockRef = useRef<MuhabbetStateLocks>({
    call: 0,
    qr: 0,
    forceFinish: 0,
    payment: 0,
  });

  const lockState = useCallback((key: MuhabbetStateLockKey, ms = 1500) => {
    stateLockRef.current[key] = Date.now() + ms;
    console.log('[leylek_lock]', JSON.stringify({ key, active: true, until: stateLockRef.current[key] }));
  }, []);

  const isLocked = useCallback((key: MuhabbetStateLockKey) => Date.now() < stateLockRef.current[key], []);

  const unlockState = useCallback((key: MuhabbetStateLockKey) => {
    stateLockRef.current[key] = 0;
    console.log('[leylek_lock]', JSON.stringify({ key, active: false }));
  }, []);

  useEffect(() => {
    terminalCloseHandledSidRef.current = null;
    terminalNavigateDoneRef.current = false;
    prevTripStatusRef.current = null;
    dismissedCallRef.current = null;
    forceFinishSeenRef.current = '';
    forceFinishDismissedRef.current = '';
    pendingRefreshAfterIdleRef.current = false;
    latestQrActionIdRef.current = null;
    latestCallActionIdRef.current = null;
    latestPaymentActionIdRef.current = null;
    latestForceFinishActionIdRef.current = null;
    stateLockRef.current = { call: 0, qr: 0, forceFinish: 0, payment: 0 };
    setForceFinishTimeoutNotice(false);
    setCallStartCooldownUntil(0);
    if (terminalAutoTimerRef.current) {
      clearTimeout(terminalAutoTimerRef.current);
      terminalAutoTimerRef.current = null;
    }
  }, [effectiveSessionId]);

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

  useEffect(() => {
    if (isTerminal) setForceFinishTimeoutNotice(false);
  }, [isTerminal]);

  useEffect(() => {
    if (!session || !myId) return;
    const ff = String(session.force_finish_state || '').trim().toLowerCase();
    const reqBy = String(session.forced_finish_requested_by_user_id || '').trim().toLowerCase();
    if (!(ff === 'pending' && reqBy === myId.trim().toLowerCase())) {
      setForceFinishTimeoutNotice(false);
    }
  }, [session, myId]);

  const qrInteractionAllowed = useMemo(() => {
    if (!session) return false;
    const st = String(session.status || '').trim().toLowerCase();
    if (st === 'expired' || st === 'cancelled' || st === 'finished') return false;
    return st === 'ready' || st === 'active' || st === 'started';
  }, [session]);

  sessionRef.current = session;
  callStateRef.current = callState;
  callPayloadRef.current = callPayload;
  qrLoadingRef.current = qrLoading;
  callBusyRef.current = callBusy;
  forceFinishRequestOptimisticRef.current = forceFinishRequestOptimistic;

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
        label: 'Yolculuk aktif',
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
      effectiveSessionId
    );
  }, [session?.id, session?.session_id, effectiveSessionId]);

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
      const sock = getOrCreateSocket();
      console.log('[socket_emit]', JSON.stringify({ event: eventName, hasAck: false, connected: sock.connected }));
      if (!sock.connected) {
        notifyAuthTokenBecameAvailableForSocket();
        publishSocketSessionRefresh('trip_emit_socket_disconnected');
        try {
          sock.connect();
        } catch {
          /* noop */
        }
      }
      console.log(`[leylek-trip] emit event=${eventName} session_id=${activeSessionId}`, fullPayload);
      sock.emit(eventName, fullPayload);
      return true;
    },
    [getActiveMuhabbetSessionId]
  );

  const activeSessionId = getActiveMuhabbetSessionId();
  /** Çağrı başlatma dahil; sadece terminal kapalı oturumda aksiyonlar açık (QR beklemeden arama). */
  const tripInfoReady = Boolean(session && !isTerminal);

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
      const sid = normalizeMuhabbetSessionId(nextSession?.id || nextSession?.session_id || effectiveSessionId);
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
      stateLockRef.current = { call: 0, qr: 0, forceFinish: 0, payment: 0 };
      callOutgoingStartedAtRef.current = 0;
      setQrLoading(false);
      qrCreateInFlightRef.current = false;
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
      }, 1700);

      const terminalBody =
        terminalStatus === 'finished'
          ? 'Bu yolculuk tamamlanmış.'
          : terminalStatus === 'cancelled'
            ? 'Bu yolculuk iptal edilmiş.'
            : terminalStatus === 'expired'
              ? 'Bu yolculuk süresi dolmuş.'
              : 'Bu yolculuk tamamlandı veya kapandı.';
      Alert.alert('Muhabbet yolculuğu', terminalBody, [
        {
          text: 'Tamam',
          style: 'default',
          onPress: () => navigateHomeFromTerminal(),
        },
      ]);
    },
    [clearAllOptimistic, navigateHomeFromTerminal, effectiveSessionId]
  );

  const loadSession = useCallback(
    async (opts?: { silent?: boolean }): Promise<MuhabbetTripSession | null> => {
      const silent = !!opts?.silent;
      if (!effectiveSessionId) {
        if (!silent) setLoading(false);
        return null;
      }
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
        const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(effectiveSessionId)}`, {
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
          if (
            loadedStatus === 'finished' &&
            (fm === 'qr' || fm === 'forced' || fm === 'forced_timeout')
          ) {
            console.log('[leylek-trip] session loaded', silent ? '(silent)' : '', loadedSession);
            setSession((prev) => {
              if (!silent) return loadedSession;
              const now = Date.now();
              return mergeMuhabbetTripSessionFromPoll(
                loadedSession,
                prev,
                optimisticRef.current,
                { ...stateLockRef.current },
                now,
                {
                  callState: callStateRef.current,
                  callPayload: callPayloadRef.current,
                  qrLoading: qrLoadingRef.current,
                  latestPaymentActionId: latestPaymentActionIdRef.current,
                }
              );
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
          return mergeMuhabbetTripSessionFromPoll(
            loadedSession,
            prev,
            optimisticRef.current,
            { ...stateLockRef.current },
            now,
            {
              callState: callStateRef.current,
              callPayload: callPayloadRef.current,
              qrLoading: qrLoadingRef.current,
              latestPaymentActionId: latestPaymentActionIdRef.current,
            }
          );
        });
        return loadedSession;
      } catch {
        if (!silent) Alert.alert('Muhabbet yolculuğu', 'Bağlantı hatası.');
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiBaseUrl, closeTerminalTrip, effectiveSessionId],
  );

  const refreshSessionFromServer = useCallback(
    async (action: string, opts?: { bypassDebounce?: boolean }): Promise<MuhabbetTripSession | null> => {
      const sid = effectiveSessionId;
      console.log('[leylek_session_refresh]', JSON.stringify({ action, sessionId: sid, bypass: !!opts?.bypassDebounce }));

      const runLoad = (): Promise<MuhabbetTripSession | null> => {
        if (refreshInFlightRef.current) {
          console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'join_inflight', action }));
          return refreshInFlightRef.current;
        }
        console.log('[leylek_fast_path]', JSON.stringify({ action, phase: 'load_start' }));
        const p = loadSession({ silent: true }).finally(() => {
          refreshInFlightRef.current = null;
        });
        refreshInFlightRef.current = p;
        return p;
      };

      if (opts?.bypassDebounce) {
        if (refreshDebounceTimerRef.current) {
          clearTimeout(refreshDebounceTimerRef.current);
          refreshDebounceTimerRef.current = null;
        }
        const pending = refreshDebouncedResolversRef.current.splice(0);
        const p = runLoad();
        pending.forEach((fn) => void p.then(fn));
        return p;
      }

      return new Promise<MuhabbetTripSession | null>((resolve) => {
        refreshDebouncedResolversRef.current.push(resolve);
        if (refreshDebounceTimerRef.current) {
          clearTimeout(refreshDebounceTimerRef.current);
        }
        refreshDebounceTimerRef.current = setTimeout(() => {
          refreshDebounceTimerRef.current = null;
          const batch = refreshDebouncedResolversRef.current.splice(0);
          void runLoad().then((r) => {
            batch.forEach((fn) => {
              try {
                fn(r);
              } catch {
                /* noop */
              }
            });
          });
        }, 300);
      });
    },
    [loadSession, effectiveSessionId],
  );

  useEffect(() => {
    const sidNorm = effectiveSessionId;
    if (!sidNorm) return;
    const unsub = subscribeTripSessionUpdated((p) => {
      const sid = normalizeMuhabbetSessionId(p.session_id);
      if (sid && sid === sidNorm) {
        const reason = String(p.reason || '').trim() || 'unknown';
        void refreshSessionFromServer(`socket_trip_session_updated_${reason}`, { bypassDebounce: true });
      }
    });
    return unsub;
  }, [effectiveSessionId, refreshSessionFromServer]);

  /** Legacy socket refresh busy sırasında kaçırıldıysa, idle olunca tek bypass refresh */
  useEffect(() => {
    const sid = effectiveSessionId;
    if (!sid || !pendingRefreshAfterIdleRef.current) return;

    const idle =
      callStateRef.current === 'idle' &&
      !callBusyRef.current &&
      !qrLoadingRef.current &&
      !qrCreateInFlightRef.current &&
      !paymentInFlightRef.current &&
      !callStartInFlightRef.current &&
      !forceFinishInFlightRef.current &&
      !forceFinishRequestOptimisticRef.current;

    if (!idle) return;

    pendingRefreshAfterIdleRef.current = false;
    console.log('[leylek_fast_path]', 'legacy_socket_after_idle_dirty_refresh');
    void refreshSessionFromServer('legacy_socket_after_idle_dirty', { bypassDebounce: true });
  }, [
    callState,
    callBusy,
    qrLoading,
    paymentBusy,
    forceFinishRequestOptimistic,
    effectiveSessionId,
    refreshSessionFromServer,
  ]);

  useEffect(() => {
    return () => {
      if (refreshDebounceTimerRef.current) {
        clearTimeout(refreshDebounceTimerRef.current);
        refreshDebounceTimerRef.current = null;
      }
      refreshDebouncedResolversRef.current = [];
      refreshInFlightRef.current = null;
    };
  }, []);

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
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(
          `[leylek-trip] emit event=${eventName} session_id=${sidActive}`,
          JSON.stringify({ payloadKeys: Object.keys(payload), session_id: sidActive })
        );
      }
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
        JSON.stringify({
          action: opts.action,
          sessionId: sid,
          status: res.status,
          ok: res.ok,
          success: json.success,
          keys: Object.keys(json),
        })
      );
      return { ok: res.ok, status: res.status, json };
    },
    [apiBaseUrl, getActiveMuhabbetSessionId],
  );

  useEffect(() => {
    void currentUserId().then(setMyId);
    if (!effectiveSessionId) {
      Alert.alert(
        'Yolculuk',
        'Yolculuk oturumu hazırlanıyor, lütfen birkaç saniye sonra tekrar deneyin.'
      );
      router.back();
      setLoading(false);
      return;
    }
    const pref = takePrefetchedMuhabbetTripSession(effectiveSessionId);
    if (pref) {
      setSession(pref);
      setLoading(false);
      void loadSession({ silent: true });
    } else {
      void loadSession();
    }
  }, [effectiveSessionId, loadSession, router]);

  /* Poll aralığı üstteki primitif alanlara bağlı; `session` nesnesini deps'e eklemek merge başına interval sıfırlar */
  useEffect(() => {
    const sid = effectiveSessionId;
    if (!sid) return;
    if (session && TERMINAL_TRIP_STATUSES.has(String(session.status || '').trim().toLowerCase())) {
      return;
    }
    const csPoll = String(session?.call_state || '').trim().toLowerCase();
    const ringingLike =
      csPoll === 'ringing' || csPoll === '';
    const ffPending =
      !!session?.forced_finish_requested_at &&
      !session?.forced_finish_confirmed_at &&
      String(session.force_finish_state || '').trim().toLowerCase() === 'pending';
    const fastPoll =
      qrLoading ||
      (session?.call_active && ringingLike) ||
      ffPending;
    const pollMs = fastPoll ? 500 : 1200;
    const id = setInterval(() => {
      console.log(
        '[leylek_poll]',
        JSON.stringify({
          ms: pollMs,
          call_active: !!session?.call_active,
          qr_loading: qrLoading,
          qr_open: qrCodeVisible,
        })
      );
      void refreshSessionFromServer('session_poll');
    }, pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session nesnesi yerine üstteki primitive alanlar
  }, [
    qrCodeVisible,
    qrLoading,
    session?.call_active,
    session?.call_state,
    session?.status,
    session?.forced_finish_requested_at,
    session?.forced_finish_confirmed_at,
    session?.force_finish_state,
    effectiveSessionId,
    refreshSessionFromServer,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshSessionFromServer('app_state_active', { bypassDebounce: true });
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
          ? 'Yolculuk aktif. Hedefte QR gösterin'
          : 'Araca bindiniz. Hedefte QR okutun'
      );
      const t = setTimeout(() => setBoardingMessage(''), 4200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [session, myId]);

  useEffect(() => {
    if (!session || !myId || isTerminal) return;
    if (isLocked('call')) {
      console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'call_session_effect_locked' }));
      return;
    }
    const active = !!session.call_active;
    const cs = String(session.call_state || '').trim().toLowerCase();
    const callerLo = String(session.caller_id || '').trim().toLowerCase();
    const myLo = myId.trim().toLowerCase();
    const passengerLo = String(session.passenger_id || '').trim().toLowerCase();
    const driverLo = String(session.driver_id || '').trim().toLowerCase();
    const targetLo = callerLo === passengerLo ? driverLo : callerLo === driverLo ? passengerLo : '';
    const expectedCalleeLo =
      callerLo && passengerLo && driverLo
        ? callerLo === passengerLo
          ? driverLo
          : callerLo === driverLo
            ? passengerLo
            : ''
        : '';
    const imCallee = expectedCalleeLo !== '' && myLo === expectedCalleeLo;
    const sidNorm = normalizeMuhabbetSessionId(session.id);

    const sigLog = `${callStateRef.current}:${active}:${cs}:${callerLo}:${callBusy}`;
    if (callSigLoggedRef.current !== sigLog) {
      callSigLoggedRef.current = sigLog;
      console.log(
        '[leylek_call_state]',
        JSON.stringify({
          local: callStateRef.current,
          vs_server: { active, state: cs || null, caller_id: callerLo || null },
        })
      );
    }

    if (cs === 'ended') {
      if (!callBusy) {
        setCallState('idle');
        setCallPayload(null);
        callOutgoingStartedAtRef.current = 0;
      }
      return;
    }

    const dismissKey = callerLo && sidNorm ? `${sidNorm}:${callerLo}` : '';
    const suppressed =
      dismissKey &&
      dismissedCallRef.current &&
      Date.now() < dismissedCallRef.current.until &&
      dismissedCallRef.current.key === dismissKey;

    const calleeIncomingReady =
      active &&
      !!callerLo &&
      imCallee &&
      (cs === 'ringing' || cs === '') &&
      !suppressed;

    if (calleeIncomingReady) {
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

    if (!callerLo && (cs === 'ringing' || cs === '')) {
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
        if (!imCallee || suppressed || callStateRef.current !== 'idle') return;
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
  }, [session, myId, isTerminal, callBusy, isLocked]);

  useEffect(() => {
    if (!session || isTerminal) return;
    if (isLocked('qr')) return;
    const st = String(session.status || '').trim().toLowerCase();
    const boardingTok = String(session.boarding_qr_token || '').trim();
    const finishTok = String(session.finish_qr_token || session.qr_finish_token || '').trim();

    if (st === 'ready' && boardingTok && isDriver) {
      if (qrLoading) return;
      setQrMode('boarding');
      setQrFinishToken(boardingTok.toUpperCase());
      setQrExpiresAt(session.boarding_qr_expires_at ?? null);
      setQrCodeVisible(true);
      return;
    }
    if ((st === 'active' || st === 'started') && finishTok && isDriver) {
      if (qrLoading) return;
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
  }, [isDriver, isTerminal, isLocked, qrLoading, session]);

  /** Oturum kapandıysa QR modallarını kapat */
  useEffect(() => {
    const st = String(session?.status || '').trim().toLowerCase();
    if (TERMINAL_TRIP_STATUSES.has(st)) {
      setQrScanVisible(false);
      setQrCodeVisible(false);
      setQrLoading(false);
      qrCreateInFlightRef.current = false;
      unlockState('qr');
    }
  }, [session?.status, unlockState]);

  useEffect(() => {
    const st = String(session?.status || '').trim().toLowerCase();
    if (st === 'active' || st === 'started') {
      setQrScanVisible(false);
    }
  }, [session?.status]);

  useEffect(() => {
    if (!session || !myId || isTerminal) {
      setForceFinishPrompt(null);
      return;
    }
    const ff = String(session.force_finish_state || '').trim().toLowerCase();
    const reqBy = String(session.forced_finish_requested_by_user_id || '').trim().toLowerCase();
    const myLo = myId.trim().toLowerCase();
    const sidN = normalizeMuhabbetSessionId(session.id);
    const rid = String(session.forced_finish_request_id || '').trim();
    if (ff === 'pending' && reqBy && reqBy !== myLo) {
      const dedupeKey = `${sidN}:${rid || reqBy}`;
      if (forceFinishDismissedRef.current === dedupeKey) {
        return;
      }
      if (forceFinishSeenRef.current !== dedupeKey) {
        forceFinishSeenRef.current = dedupeKey;
        console.log(
          '[leylek_force_finish_modal]',
          JSON.stringify({ action: 'open', sessionId: sidN, requestId: rid || reqBy })
        );
        setForceFinishPrompt({
          requesterUserId: reqBy,
          targetUserId: myLo,
          requestId: rid || undefined,
          timeoutAt: session.forced_finish_timeout_at ?? undefined,
        });
      } else {
        setForceFinishPrompt((prev) =>
          prev && prev.requesterUserId === reqBy
            ? { ...prev, timeoutAt: session.forced_finish_timeout_at ?? prev.timeoutAt }
            : prev
        );
      }
      return;
    }
    forceFinishSeenRef.current = '';
    forceFinishDismissedRef.current = '';
    setForceFinishPrompt(null);
  }, [session, myId, isTerminal]);

  useEffect(() => {
    if (!forceFinishPrompt) return;
    const id = setInterval(() => setForceFinishUiTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [forceFinishPrompt]);

  const forceFinishCountdownText = useMemo(() => {
    void forceFinishUiTick;
    const iso = session?.forced_finish_timeout_at;
    if (!iso || !forceFinishPrompt) return '';
    const sec = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
    return sec > 0 ? `Yanıt için kalan: ${sec} sn` : 'Süre doldu — güncelleniyor';
  }, [forceFinishPrompt, forceFinishUiTick, session?.forced_finish_timeout_at]);

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
      const sid = getActiveMuhabbetSessionId();
      if (!sid) return false;

      const token = (await getPersistedAccessToken())?.trim() || '';
      const base = apiBaseUrl.replace(/\/$/, '');
      const url = `${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}/location`;
      const now = Date.now();
      const restDue = now - lastLocationRestOkRef.current >= 3000;

      if (restDue && token) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: next.latitude, lng: next.longitude }),
          });
          const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          console.log(
            '[leylek_location_rest]',
            JSON.stringify({ session_id: sid, ok: res.ok, status: res.status, body_keys: Object.keys(j) })
          );
          if (res.ok) {
            lastLocationRestOkRef.current = Date.now();
            console.log('[leylek_presence]', JSON.stringify({ kind: 'location_sent', session_id: sid, ok: true, via: 'rest' }));
            return true;
          }
          console.warn('[leylek_location_rest] http_fail', res.status, j?.detail || j);
        } catch (e) {
          console.warn('[leylek_location_rest] network_error', e);
        }
      } else if (!restDue) {
        return true;
      } else {
        console.warn('[leylek_location_rest] skipped_no_token');
      }

      const sent = emitMuhabbetTripEvent(
        'muhabbet_trip_location_update',
        { latitude: next.latitude, longitude: next.longitude },
        { showAlert: opts?.showAlert }
      );
      console.log('[leylek_presence]', JSON.stringify({ kind: 'location_sent', session_id: sid || '', ok: sent, via: 'socket_fallback' }));
      if (!sent) {
        notifyAuthTokenBecameAvailableForSocket();
        publishSocketSessionRefresh('location_emit_failed');
      }
      return sent;
    } catch {
      if (opts?.showAlert) Alert.alert('Konum', 'Konum alınamadı.');
      return false;
    } finally {
      if (opts?.manual) setSendingLocation(false);
    }
  }, [apiBaseUrl, emitMuhabbetTripEvent, getActiveMuhabbetSessionId]);

  useEffect(() => {
    if (!getActiveMuhabbetSessionId() || !myId || isTerminal) return;
    let cancelled = false;
    void emitCurrentLocation({ requestPermission: true, showAlert: false });
    const interval = setInterval(() => {
      if (!cancelled) void emitCurrentLocation({ requestPermission: false, showAlert: false });
    }, 3000);
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
    const HIGH_PRIORITY_LEGACY_TRIP_EVENTS = new Set([
      'muhabbet_trip_started',
      'muhabbet_trip_boarding_qr_created',
      'muhabbet_trip_call_accept',
      'muhabbet_trip_call_decline',
      'muhabbet_trip_call_end',
      'muhabbet_trip_force_finished',
      'muhabbet_trip_session_updated',
    ]);

    const legacyTripUiIdle = (): boolean => {
      if (callStateRef.current !== 'idle') return false;
      if (callBusyRef.current) return false;
      if (qrLoadingRef.current) return false;
      if (qrCreateInFlightRef.current) return false;
      if (paymentInFlightRef.current) return false;
      if (callStartInFlightRef.current) return false;
      if (forceFinishInFlightRef.current) return false;
      if (forceFinishRequestOptimisticRef.current) return false;
      return true;
    };

    const legacyTripSocketRefresh = (eventLabel: string, payload?: unknown) => {
      if (__DEV__) {
        const callLike = /_call_|incoming_call|agora|token/i.test(eventLabel);
        if (callLike && payload && typeof payload === 'object') {
          const p = payload as Record<string, unknown>;
          console.log(
            '[leylek-trip] legacy_socket_debug',
            JSON.stringify({
              event: eventLabel,
              session_id: p.session_id ?? p.sessionId ?? null,
              keys: Object.keys(p),
            })
          );
        } else {
          console.log('[leylek-trip] legacy_socket_debug', JSON.stringify({ event: eventLabel, payload }));
        }
      }
      const urgent = HIGH_PRIORITY_LEGACY_TRIP_EVENTS.has(eventLabel);
      if (!urgent && !legacyTripUiIdle()) {
        pendingRefreshAfterIdleRef.current = true;
        console.log(
          '[leylek_skip_refresh]',
          JSON.stringify({ reason: 'legacy_socket_ui_busy', event: eventLabel, pendingRefreshAfterIdle: true })
        );
        return;
      }
      pendingRefreshAfterIdleRef.current = false;
      void refreshSessionFromServer(`legacy_socket_${eventLabel}`, { bypassDebounce: true });
    };
    const onLegacySessionEvent =
      (eventLabel: string) =>
      (payload: MuhabbetTripSessionSocketPayload) => {
        if (!matches(payload)) return;
        legacyTripSocketRefresh(eventLabel, payload);
      };
    const callMatches = (payload: MuhabbetTripCallSocketPayload) =>
      normalizeMuhabbetSessionId(payload?.session_id || payload?.sessionId) === activeSessionId;
    const onLegacyCallEvent =
      (eventLabel: string) =>
      (payload: MuhabbetTripCallSocketPayload) => {
        if (!callMatches(payload)) return;
        legacyTripSocketRefresh(eventLabel, payload);
      };
    const onCallIncoming = (payload: MuhabbetTripCallSocketPayload) => {
      if (!callMatches(payload)) return;
      const myLo = String(myId || '').trim().toLowerCase();
      const targetLo = String(payload.target_user_id || '').trim().toLowerCase();
      const callerLo = String(payload.caller_id || '').trim().toLowerCase();
      // Arayan taraf: gelen arama / zil yok (REST + yerel outgoing yeterli)
      if (!myLo || callerLo === myLo) return;
      if (targetLo !== myLo) return;
      const sidNormLocal = activeSessionId;
      const dismissKey = callerLo && sidNormLocal ? `${sidNormLocal}:${callerLo}` : '';
      const suppressed =
        dismissKey &&
        dismissedCallRef.current &&
        Date.now() < dismissedCallRef.current.until &&
        dismissedCallRef.current.key === dismissKey;
      if (suppressed) return;
      setCallPayload(payload);
      setCallState('incoming');
      void refreshSessionFromServer('muhabbet_trip_call_incoming_socket', { bypassDebounce: true });
    };
    const onLocation = (payload: MuhabbetTripSessionSocketPayload) => {
      if (!matches(payload)) return;
      const p = payload as MuhabbetTripSessionSocketPayload & { updated_at?: string };
      const rawIso = String(
        p.updated_at ||
          (p.session
            ? String(p.session.passenger_location_updated_at || p.session.driver_location_updated_at || '')
            : '')
      ).trim();
      let ageMs: number | null = null;
      if (rawIso) {
        const t = new Date(rawIso).getTime();
        if (Number.isFinite(t)) ageMs = Date.now() - t;
      }
      if (__DEV__) {
        console.log('[leylek_presence]', JSON.stringify({ kind: 'location_received', ageMs }));
      }
      legacyTripSocketRefresh('muhabbet_trip_location_updated', payload);
    };
    const onTripError = (payload: { code?: string; message?: string; detail?: string }) => {
      if (__DEV__) {
        console.log('[leylek-trip] legacy_socket_debug', JSON.stringify({ event: 'muhabbet_trip_error', payload }));
      }
      void refreshSessionFromServer('legacy_socket_muhabbet_trip_error', { bypassDebounce: true });
    };
    const onForceFinished = (payload: MuhabbetTripFinishSocketPayload) => {
      if (normalizeMuhabbetSessionId(payload?.session_id || payload?.sessionId) !== activeSessionId) return;
      legacyTripSocketRefresh('muhabbet_trip_force_finished', payload);
    };
    const joinRole =
      !myId || !session
        ? ''
        : String(session.driver_id || '').trim().toLowerCase() === myId.trim().toLowerCase()
          ? 'driver'
          : 'passenger';

    const runTripJoin = async (reason: string) => {
      console.log('[socket_join]', JSON.stringify({ kind: 'trip_run', reason, session_id: activeSessionId }));
      const sock = getOrCreateSocket();
      logLeylekAction('muhabbet_trip_join', {
        sessionId: activeSessionId,
        socketConnected: sock.connected,
        registered: !!myId && isMuhabbetSocketRegisteredForUser(sock, myId),
        role: joinRole,
        status: String(session?.status || ''),
      });
      notifyAuthTokenBecameAvailableForSocket();
      await refreshSessionFromServer('trip_join_prefetch', { bypassDebounce: true });
      const ok = await ensureMuhabbetTripSocketReady(myId, 8000);
      logLeylekAction('muhabbet_trip_join_after_ensure', {
        sessionId: activeSessionId,
        socketConnected: sock.connected,
        registered: !!myId && isMuhabbetSocketRegisteredForUser(sock, myId),
        role: joinRole,
        status: String(session?.status || ''),
      });
      if (!ok) {
        await refreshSessionFromServer('trip_join_socket_not_ready', { bypassDebounce: true });
        return;
      }
      await emitMuhabbetTripJoinWithRetries(sock, activeSessionId);
    };

    void runTripJoin('effect_mount');
    const unsubRefresh = subscribeSocketSessionRefresh((reason) => {
      if (reason.startsWith('socket_') || reason === 'app_active' || reason === 'trip_emit_socket_disconnected' || reason === 'location_emit_failed') {
        void runTripJoin(reason);
      }
    });
    const onCallStartNotify = onLegacyCallEvent('muhabbet_trip_call_start');
    const onCallAcceptNotify = onLegacyCallEvent('muhabbet_trip_call_accept');
    const onCallDeclineNotify = onLegacyCallEvent('muhabbet_trip_call_decline');
    const onCallEndNotify = onLegacyCallEvent('muhabbet_trip_call_end');
    const onPaymentMethodSet = onLegacySessionEvent('muhabbet_trip_payment_method_set');
    const onStarted = onLegacySessionEvent('muhabbet_trip_started');
    const onBoardingQrCreated = onLegacySessionEvent('muhabbet_trip_boarding_qr_created');
    const onCancelled = onLegacySessionEvent('muhabbet_trip_cancelled');
    const onFinished = onLegacySessionEvent('muhabbet_trip_finished');
    const onExpired = onLegacySessionEvent('muhabbet_trip_expired');
    const onSessionUpdated = onLegacySessionEvent('muhabbet_trip_session_updated');
    socket.on('muhabbet_trip_location_updated', onLocation);
    socket.on('muhabbet_trip_payment_method_set', onPaymentMethodSet);
    socket.on('muhabbet_trip_started', onStarted);
    socket.on('muhabbet_trip_boarding_qr_created', onBoardingQrCreated);
    socket.on('muhabbet_trip_cancelled', onCancelled);
    socket.on('muhabbet_trip_finished', onFinished);
    socket.on('muhabbet_trip_expired', onExpired);
    socket.on('muhabbet_trip_session_updated', onSessionUpdated);
    socket.on('muhabbet_trip_call_start', onCallStartNotify);
    socket.on('muhabbet_trip_call_incoming', onCallIncoming);
    socket.on('muhabbet_trip_call_accept', onCallAcceptNotify);
    socket.on('muhabbet_trip_call_decline', onCallDeclineNotify);
    socket.on('muhabbet_trip_call_end', onCallEndNotify);
    socket.on('muhabbet_trip_error', onTripError);
    socket.on('muhabbet_trip_force_finished', onForceFinished);
    return () => {
      unsubRefresh();
      console.log(`[leylek-trip] emit event=muhabbet_trip_leave session_id=${activeSessionId}`, { session_id: activeSessionId });
      socket.emit('muhabbet_trip_leave', { session_id: activeSessionId });
      socket.off('muhabbet_trip_location_updated', onLocation);
      socket.off('muhabbet_trip_payment_method_set', onPaymentMethodSet);
      socket.off('muhabbet_trip_started', onStarted);
      socket.off('muhabbet_trip_boarding_qr_created', onBoardingQrCreated);
      socket.off('muhabbet_trip_cancelled', onCancelled);
      socket.off('muhabbet_trip_finished', onFinished);
      socket.off('muhabbet_trip_expired', onExpired);
      socket.off('muhabbet_trip_session_updated', onSessionUpdated);
      socket.off('muhabbet_trip_call_start', onCallStartNotify);
      socket.off('muhabbet_trip_call_incoming', onCallIncoming);
      socket.off('muhabbet_trip_call_accept', onCallAcceptNotify);
      socket.off('muhabbet_trip_call_decline', onCallDeclineNotify);
      socket.off('muhabbet_trip_call_end', onCallEndNotify);
      socket.off('muhabbet_trip_error', onTripError);
      socket.off('muhabbet_trip_force_finished', onForceFinished);
    };
  }, [getActiveMuhabbetSessionId, myId, refreshSessionFromServer, session]);

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
          await refreshSessionFromServer('trip_cancel_rest', { bypassDebounce: true });
          return;
        }
        const okSocket = await emitMuhabbetTripEventEnsured(
          'trip_muhabbet_trip_cancel',
          'muhabbet_trip_cancel',
          {},
          { suppressConnectionRenewAlert: true }
        );
        if (okSocket) await refreshSessionFromServer('trip_cancel_socket_fallback', { bypassDebounce: true });
        else await refreshSessionFromServer('trip_cancel_fail', { bypassDebounce: true });
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

  const bumpCallCooldown = useCallback(() => {
    const until = Date.now() + 5000;
    setCallStartCooldownUntil(until);
    setTimeout(() => {
      setCallStartCooldownUntil((cur) => (cur === until ? 0 : cur));
    }, 5000);
  }, []);

  const recordDismissForCall = useCallback((callerId: string | undefined) => {
    const initiator = String(callerId || '').trim().toLowerCase();
    const sidK = effectiveSessionId;
    if (initiator && sidK) {
      dismissedCallRef.current = { key: `${sidK}:${initiator}`, until: Date.now() + 5000 };
    }
  }, [effectiveSessionId]);

  const startCall = useCallback(() => {
    const sidPress = getActiveMuhabbetSessionId();
    console.log('[leylek_call_start_press]', {
      sessionId: sidPress,
      role: isDriver ? 'driver' : 'passenger',
      status: session?.status,
      callBusy,
      callState: callStateRef.current,
    });
    if (isTerminal || !session) return;
    if (callStartInFlightRef.current) {
      console.log('[leylek_ui_guard]', JSON.stringify({ reason: 'call duplicate blocked', detail: 'inFlight' }));
      return;
    }
    const now = Date.now();
    if (callStartCooldownUntil > 0 && now < callStartCooldownUntil) {
      console.log('[leylek_ui_guard]', JSON.stringify({ reason: 'call duplicate blocked', detail: 'cooldown' }));
      return;
    }
    const csServ = String(session.call_state || '').trim().toLowerCase();
    if (
      callStateRef.current === 'outgoing' ||
      callStateRef.current === 'active' ||
      (session.call_active && (csServ === 'ringing' || csServ === 'active' || csServ === ''))
    ) {
      console.log('[leylek_ui_guard]', JSON.stringify({ reason: 'call duplicate blocked', detail: 'already_ringing_or_active' }));
      return;
    }
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
      const callActionId = createOptimisticActionId('call_start');
      latestCallActionIdRef.current = callActionId;
      console.log('[leylek_call]', {
        callerUserId: myId,
        sessionId: sid,
        role: isDriver ? 'driver' : 'passenger',
      });
      bumpCallCooldown();
      touchOptimistic('call_start');
      callOutgoingStartedAtRef.current = Date.now();
      callStartInFlightRef.current = true;
      setCallState('outgoing');
      setCallPayload({
        session_id: sid,
        conversation_id: session.conversation_id ?? undefined,
        channel_name: `muhabbet_trip_${sid}`,
        caller_id: myLo,
        target_user_id: targetLo,
        started_at: nowIso,
      });
      console.log('[leylek_ui_instant]', JSON.stringify({ flow: 'call_outgoing', actionId: callActionId }));

      const token = (await getPersistedAccessToken())?.trim() || '';
      const base = apiBaseUrl.replace(/\/$/, '');
      const url = `${base}/muhabbet/trip-sessions/${encodeURIComponent(sid)}/call/start`;

      try {
        console.log('[leylek_call_start_post]', url);
        if (!token) {
          const parsedBody = { error: 'missing_token' };
          console.log('[leylek_call_start_response]', { status: 0, ok: false, body: parsedBody });
          if (callActionId !== latestCallActionIdRef.current) return;
          setCallState('idle');
          setCallPayload(null);
          clearOptimistic('call_start');
          callOutgoingStartedAtRef.current = 0;
          Alert.alert('Muhabbet yolculuk', 'Arama başlatılamadı: Oturum anahtarı bulunamadı. Tekrar giriş yapın.');
          void refreshSessionFromServer('call_start_rest_fail', { bypassDebounce: true });
          return;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        let parsedBody: Record<string, unknown> = {};
        try {
          parsedBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        } catch {
          parsedBody = {};
        }
        console.log('[leylek_call_start_response]', { status: res.status, ok: res.ok, body: parsedBody });

        if (callActionId !== latestCallActionIdRef.current) {
          console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_call_response' }));
          return;
        }

        if (res.ok && parsedBody.success === true) {
          latestCallActionIdRef.current = null;
          const callObj = parsedBody.call as MuhabbetTripCallSocketPayload | undefined;
          const sessRaw = parsedBody.session;
          const sess = sessRaw && typeof sessRaw === 'object' ? (sessRaw as MuhabbetTripSession) : null;
          if (callObj && typeof callObj === 'object') {
            setCallPayload(callObj);
          } else if (sess) {
            const sidN = normalizeMuhabbetSessionId(sess.id);
            const passengerLoR = String(sess.passenger_id || '').trim().toLowerCase();
            const driverLoR = String(sess.driver_id || '').trim().toLowerCase();
            const callerLo = String(sess.caller_id || myLo).trim().toLowerCase();
            const targetLoR = callerLo === passengerLoR ? driverLoR : passengerLoR;
            setCallPayload({
              session_id: sidN,
              conversation_id: sess.conversation_id ?? undefined,
              channel_name: String(sess.call_channel_name || `muhabbet_trip_${sidN}`),
              caller_id: callerLo,
              target_user_id: targetLoR,
              started_at: sess.call_started_at ?? undefined,
            });
          }
          if (sess) {
            setSession(sess);
          }
          setCallState('outgoing');
          callOutgoingStartedAtRef.current = Date.now();
          void refreshSessionFromServer('call_start_rest', { bypassDebounce: true });
          clearOptimistic('call_start');
          return;
        }

        setCallState('idle');
        setCallPayload(null);
        clearOptimistic('call_start');
        callOutgoingStartedAtRef.current = 0;
        const detailMsg = muhabbetTripRestDetail(parsedBody.detail, '');
        Alert.alert(
          'Muhabbet yolculuk',
          detailMsg ? `Arama başlatılamadı: ${detailMsg}` : 'Arama başlatılamadı.'
        );
        void refreshSessionFromServer('call_start_rest_fail', { bypassDebounce: true });
      } catch (error) {
        console.warn('[leylek_call_start_error]', error);
        if (callActionId !== latestCallActionIdRef.current) {
          console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_call_response' }));
        } else {
          clearOptimistic('call_start');
          callOutgoingStartedAtRef.current = 0;
          setCallState('idle');
          setCallPayload(null);
          Alert.alert(
            'Muhabbet yolculuk',
            `Arama başlatılamadı: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } finally {
        if (callActionId === latestCallActionIdRef.current) {
          callStartInFlightRef.current = false;
        }
      }
    })();
  }, [
    apiBaseUrl,
    bumpCallCooldown,
    callBusy,
    callStartCooldownUntil,
    clearOptimistic,
    getActiveMuhabbetSessionId,
    isDriver,
    isTerminal,
    myId,
    refreshSessionFromServer,
    session,
    touchOptimistic,
  ]);

  const selectPaymentMethod = useCallback(
    (paymentMethod: 'cash' | 'card') => {
      if (!session || isTerminal || paymentBusy || paymentInFlightRef.current) return;
      if (isLocked('payment')) {
        console.log('[leylek_ui_guard]', JSON.stringify({ reason: 'payment blocked', detail: 'stateLock' }));
        return;
      }
      paymentInFlightRef.current = true;
      lockState('payment', 1500);
      setPaymentBusy(true);
      const prevPm = session.payment_method ?? null;
      const prevSelAt = session.payment_method_selected_at ?? null;
      const optimisticAt = new Date().toISOString();
      const paymentActionId = createOptimisticActionId('payment_method');
      latestPaymentActionIdRef.current = paymentActionId;
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
      console.log('[leylek_ui_instant]', JSON.stringify({ flow: 'payment_method', paymentMethod, actionId: paymentActionId }));
      void (async () => {
        const t0 = Date.now();
        try {
          const rest = await muhabbetTripSessionRestPost({
            action: 'payment_method_set',
            pathSuffix: 'payment-method',
            body: { payment_method: paymentMethod },
          });
          if (isMuhabbetTripRestOk(rest)) {
            if (paymentActionId !== latestPaymentActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_payment_response' }));
              return;
            }
            latestPaymentActionIdRef.current = null;
            const sess = rest.json.session;
            if (sess && typeof sess === 'object') {
              setSession(sess as MuhabbetTripSession);
            }
            void refreshSessionFromServer('payment_method_rest', { bypassDebounce: true });
            clearOptimistic('payment_method');
            setPaymentPromptVisible(false);
            console.log('[leylek_payment_timing]', JSON.stringify({ ms: Date.now() - t0, action: 'payment_method_set', ok: true }));
            unlockState('payment');
            return;
          }
          if (paymentActionId !== latestPaymentActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_payment_response' }));
            return;
          }
          clearOptimistic('payment_method');
          unlockState('payment');
          setSession((s) =>
            s
              ? {
                  ...s,
                  payment_method: prevPm,
                  payment_method_selected_at: prevSelAt,
                }
              : s
          );
          latestPaymentActionIdRef.current = null;
          const okSocket = await emitMuhabbetTripEventEnsured(
            'payment_method_set',
            'muhabbet_trip_payment_method_set',
            {
              payment_method: paymentMethod,
            },
            { suppressConnectionRenewAlert: true }
          );
          if (okSocket) {
            if (paymentActionId !== latestPaymentActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_payment_response' }));
            } else {
              void refreshSessionFromServer('payment_method_socket_fallback', { bypassDebounce: true });
              clearOptimistic('payment_method');
              setPaymentPromptVisible(false);
              console.log('[leylek_payment_timing]', JSON.stringify({ ms: Date.now() - t0, action: 'payment_method_set_socket', ok: true }));
              unlockState('payment');
              latestPaymentActionIdRef.current = null;
            }
          } else {
            void refreshSessionFromServer('payment_method_fail', { bypassDebounce: true });
            const det = typeof rest.json.detail === 'string' ? rest.json.detail : '';
            if (det) Alert.alert('Muhabbet yolculuk', det);
            console.log('[leylek_payment_timing]', JSON.stringify({ ms: Date.now() - t0, action: 'payment_method_set', ok: false }));
            latestPaymentActionIdRef.current = null;
          }
        } catch {
          if (paymentActionId !== latestPaymentActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_payment_response' }));
          } else {
            clearOptimistic('payment_method');
            unlockState('payment');
            latestPaymentActionIdRef.current = null;
            setSession((s) =>
              s
                ? {
                    ...s,
                    payment_method: prevPm,
                    payment_method_selected_at: prevSelAt,
                  }
                : s
            );
            console.log('[leylek_payment_timing]', JSON.stringify({ ms: Date.now() - t0, action: 'payment_method_set', ok: false, error: true }));
          }
        } finally {
          paymentInFlightRef.current = false;
          setPaymentBusy(false);
        }
      })();
    },
    [
      clearOptimistic,
      emitMuhabbetTripEventEnsured,
      isLocked,
      isTerminal,
      lockState,
      muhabbetTripSessionRestPost,
      paymentBusy,
      refreshSessionFromServer,
      session,
      touchOptimistic,
      unlockState,
    ]
  );

  const acceptCall = useCallback(() => {
    if (!callPayload) return;
    void (async () => {
      const activeSessionIdNext = getActiveMuhabbetSessionId();
      const snapPayload = callPayload;
      const snapState = callState;
      touchOptimistic('call_accept');
      lockState('call', 2000);
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
          await refreshSessionFromServer('call_accept_rest', { bypassDebounce: true });
          clearOptimistic('call_accept');
          unlockState('call');
          return;
        }
        setCallState(snapState);
        setCallPayload(snapPayload);
        clearOptimistic('call_accept');
        unlockState('call');
        const msg = muhabbetTripRestDetail(rest.json.detail, 'Çağrı kabul edilemedi.');
        if (msg) Alert.alert('Muhabbet yolculuk', msg);
        await refreshSessionFromServer('call_accept_rest_fail', { bypassDebounce: true });
      } catch {
        clearOptimistic('call_accept');
        unlockState('call');
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
    getActiveMuhabbetSessionId,
    muhabbetTripSessionRestPost,
    refreshSessionFromServer,
    touchOptimistic,
    unlockState,
    lockState,
  ]);

  const declineCall = useCallback(() => {
    void (async () => {
      const snapPayload = callPayload;
      const snapState = callState;
      touchOptimistic('call_decline');
      lockState('call', 2000);
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
          recordDismissForCall(String(snapPayload?.caller_id || ''));
          void refreshSessionFromServer('call_decline_rest', { bypassDebounce: true });
          clearOptimistic('call_decline');
          unlockState('call');
          return;
        }
        setCallPayload(snapPayload);
        setCallState(snapState);
        clearOptimistic('call_decline');
        unlockState('call');
        const msg = muhabbetTripRestDetail(rest.json.detail, 'Çağrı reddedilemedi.');
        if (msg) Alert.alert('Muhabbet yolculuk', msg);
        void refreshSessionFromServer('call_decline_rest_fail', { bypassDebounce: true });
      } catch {
        clearOptimistic('call_decline');
        unlockState('call');
        setCallPayload(snapPayload);
        setCallState(snapState);
      } finally {
        setCallBusy(false);
      }
    })();
  }, [
    callPayload,
    callState,
    clearOptimistic,
    muhabbetTripSessionRestPost,
    recordDismissForCall,
    refreshSessionFromServer,
    touchOptimistic,
    unlockState,
    lockState,
  ]);

  const endCall = useCallback(() => {
    void (async () => {
      const snapPayload = callPayload;
      const snapState = callState;
      touchOptimistic('call_end');
      lockState('call', 2000);
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
          recordDismissForCall(String(snapPayload?.caller_id || sessionRef.current?.caller_id || ''));
          void refreshSessionFromServer('call_end_rest', { bypassDebounce: true });
          clearOptimistic('call_end');
          unlockState('call');
          return;
        }
        setCallPayload(snapPayload);
        setCallState(snapState);
        clearOptimistic('call_end');
        unlockState('call');
        const msg = muhabbetTripRestDetail(rest.json.detail, 'Çağrı sonlandırılamadı.');
        if (msg) Alert.alert('Muhabbet yolculuk', msg);
        void refreshSessionFromServer('call_end_rest_fail', { bypassDebounce: true });
      } catch {
        clearOptimistic('call_end');
        unlockState('call');
        setCallPayload(snapPayload);
        setCallState(snapState);
      } finally {
        setCallBusy(false);
      }
    })();
  }, [
    callPayload,
    callState,
    clearOptimistic,
    muhabbetTripSessionRestPost,
    recordDismissForCall,
    refreshSessionFromServer,
    touchOptimistic,
    unlockState,
    lockState,
  ]);

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
    const stNow = String(session.status || '').trim().toLowerCase();
    if (!['ready', 'active', 'started'].includes(stNow)) {
      const phaseMsg =
        stNow === 'expired'
          ? 'Bu yolculuk süresi dolmuş.'
          : stNow === 'cancelled'
            ? 'Bu yolculuk iptal edilmiş.'
            : stNow === 'finished'
              ? 'Bu yolculuk tamamlanmış.'
              : 'Bu yolculuk QR işlemi için uygun değil.';
      Alert.alert('QR ile işlem', phaseMsg);
      return;
    }
    if (!getActiveMuhabbetSessionId()) {
      Alert.alert('Muhabbet yolculuğu', 'Yolculuk bilgisi hazırlanıyor.');
      return;
    }
    if (session.status === 'active' || session.status === 'started') {
      setQrMode('finish');
    }
    if (session.status === 'ready') {
      if (isDriver) {
        if (qrCreateInFlightRef.current) return;
        if (isLocked('qr')) {
          console.log('[leylek_ui_guard]', JSON.stringify({ reason: 'qr blocked', detail: 'stateLock' }));
          return;
        }
        qrCreateInFlightRef.current = true;
        lockState('qr', 2000);
        touchOptimistic('boarding_qr_create');
        const qrActionId = createOptimisticActionId('qr_boarding');
        latestQrActionIdRef.current = qrActionId;
        console.log('[leylek_ui_instant]', JSON.stringify({ flow: 'qr_boarding_open', actionId: qrActionId }));
        setQrMode('boarding');
        setQrCodeVisible(true);
        setQrLoading(true);
        setQrFinishToken('');
        setQrExpiresAt(null);
        qrModalOpenedAtRef.current = Date.now();
        void (async () => {
          const t0 = Date.now();
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
              if (qrActionId !== latestQrActionIdRef.current) {
                console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
                return;
              }
              latestQrActionIdRef.current = null;
              setQrFinishToken(String(rest.json.boarding_qr_token).trim().toUpperCase());
              setQrExpiresAt(typeof rest.json.expires_at === 'string' ? rest.json.expires_at : null);
              setQrLoading(false);
              clearOptimistic('boarding_qr_create');
              void refreshSessionFromServer('boarding_qr_create_rest', { bypassDebounce: true });
              console.log(
                '[leylek_qr_timing]',
                JSON.stringify({
                  create_ms: Date.now() - t0,
                  open_to_token_ms: Date.now() - qrModalOpenedAtRef.current,
                  mode: 'boarding',
                  ok: true,
                })
              );
              unlockState('qr');
              return;
            }
            if (rest.ok && rest.json.success === true) {
              console.log('[leylek_qr_timing]', JSON.stringify({ mode: 'boarding', missing_token: true, ms: Date.now() - t0 }));
            }
            if (qrActionId !== latestQrActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
              return;
            }
            unlockState('qr');
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
              if (qrActionId !== latestQrActionIdRef.current) {
                console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
                return;
              }
              touchOptimistic('boarding_qr_create');
              void refreshSessionFromServer('boarding_qr_create_socket_fallback', { bypassDebounce: true });
              clearOptimistic('boarding_qr_create');
              unlockState('qr');
            }
            console.log('[leylek_qr_timing]', JSON.stringify({ create_ms: Date.now() - t0, mode: 'boarding', ok: false }));
          } catch {
            if (qrActionId !== latestQrActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
              return;
            }
            unlockState('qr');
            clearOptimistic('boarding_qr_create');
            setQrCodeVisible(false);
            setQrFinishToken('');
          } finally {
            if (qrActionId === latestQrActionIdRef.current) {
              qrCreateInFlightRef.current = false;
              setQrLoading(false);
            }
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
              onPress: () => {
                setQrMode('boarding');
                setQrScanVisible(true);
              },
            },
          ],
        );
      }
      return;
    }
    if (isDriver) {
      if (qrCreateInFlightRef.current) return;
      if (isLocked('qr')) {
        console.log('[leylek_ui_guard]', JSON.stringify({ reason: 'qr blocked', detail: 'stateLock' }));
        return;
      }
      qrCreateInFlightRef.current = true;
      lockState('qr', 2000);
      touchOptimistic('finish_qr_create');
      const qrFinishActionId = createOptimisticActionId('qr_finish');
      latestQrActionIdRef.current = qrFinishActionId;
      console.log('[leylek_ui_instant]', JSON.stringify({ flow: 'qr_finish_open', actionId: qrFinishActionId }));
      setQrMode('finish');
      setQrCodeVisible(true);
      setQrLoading(true);
      setQrFinishToken('');
      setQrExpiresAt(null);
      qrModalOpenedAtRef.current = Date.now();
      void (async () => {
        const t0 = Date.now();
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
            if (qrFinishActionId !== latestQrActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
              return;
            }
            latestQrActionIdRef.current = null;
            setQrFinishToken(rawTok.trim().toUpperCase());
            setQrExpiresAt(typeof rest.json.expires_at === 'string' ? rest.json.expires_at : null);
            setQrLoading(false);
            clearOptimistic('finish_qr_create');
            void refreshSessionFromServer('finish_qr_create_rest', { bypassDebounce: true });
            console.log(
              '[leylek_qr_timing]',
              JSON.stringify({
                create_ms: Date.now() - t0,
                open_to_token_ms: Date.now() - qrModalOpenedAtRef.current,
                mode: 'finish',
                ok: true,
              })
            );
            unlockState('qr');
            return;
          }
          if (rest.ok && rest.json.success === true) {
            console.log('[leylek_qr_timing]', JSON.stringify({ mode: 'finish', missing_token: true, ms: Date.now() - t0 }));
          }
          if (qrFinishActionId !== latestQrActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
            return;
          }
          unlockState('qr');
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
            if (qrFinishActionId !== latestQrActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
              return;
            }
            touchOptimistic('finish_qr_create');
            void refreshSessionFromServer('finish_qr_create_socket_fallback', { bypassDebounce: true }).finally(() => {
              if (qrFinishActionId !== latestQrActionIdRef.current) {
                console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
                return;
              }
              clearOptimistic('finish_qr_create');
              unlockState('qr');
            });
          }
          console.log('[leylek_qr_timing]', JSON.stringify({ create_ms: Date.now() - t0, mode: 'finish', ok: false }));
        } catch {
          if (qrFinishActionId !== latestQrActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_qr_response' }));
            return;
          }
          unlockState('qr');
          clearOptimistic('finish_qr_create');
          setQrCodeVisible(false);
          setQrFinishToken('');
        } finally {
          if (qrFinishActionId === latestQrActionIdRef.current) {
            qrCreateInFlightRef.current = false;
            setQrLoading(false);
          }
        }
      })();
    } else {
      setQrMode('finish');
      setQrScanVisible(true);
    }
  }, [
    clearOptimistic,
    emitMuhabbetTripEventEnsured,
    getActiveMuhabbetSessionId,
    isDriver,
    isTerminal,
    isLocked,
    lockState,
    muhabbetTripSessionRestPost,
    refreshSessionFromServer,
    session,
    touchOptimistic,
    unlockState,
  ]);

  const confirmQrToken = useCallback(
    (rawToken: string) => {
      const token = rawToken.trim();
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
          const stGuard = String(sessionRef.current?.status || '').trim().toLowerCase();
          if (qrMode === 'finish' && stGuard === 'ready') {
            Alert.alert(
              'Hedef QR',
              'Önce biniş QR ile yolculuğu başlatın. Bitiş kodunu okutmak için yolculuk aktif olmalıdır.'
            );
            return;
          }
          if (qrMode === 'boarding') {
            const rest = await muhabbetTripSessionRestPost({
              action: 'boarding_qr_confirm',
              pathSuffix: 'boarding-qr/confirm',
              body: { boarding_qr_token: token },
            });
            const applyBoardingConfirmSuccess = async (refreshReason: string) => {
              const next = await refreshSessionFromServer(refreshReason, { bypassDebounce: true });
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
                    ? 'Yolculuk aktif. Hedefte QR gösterin'
                    : 'Araca bindiniz. Hedefte QR okutun'
                );
                setTimeout(() => setBoardingMessage(''), 4200);
              }
            };
            if (isMuhabbetTripRestOk(rest)) {
              await applyBoardingConfirmSuccess('boarding_qr_confirm_rest');
              return;
            }
            const okSocket = await emitMuhabbetTripEventEnsured(
              'boarding_qr_confirm',
              'muhabbet_trip_boarding_qr_confirm',
              { boarding_qr_token: token },
              { suppressConnectionRenewAlert: true }
            );
            if (okSocket) {
              await applyBoardingConfirmSuccess('boarding_qr_confirm_socket_fallback');
            } else {
              Alert.alert(
                'Biniş QR',
                muhabbetTripRestDetail(rest.json.detail, 'Biniş QR doğrulanamadı.')
              );
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
            await refreshSessionFromServer('finish_qr_confirm_rest', { bypassDebounce: true });
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
            await refreshSessionFromServer('finish_qr_confirm_socket_fallback', { bypassDebounce: true });
          } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
            Alert.alert('Hedef QR', muhabbetTripRestDetail(rest.json.detail, 'Bitiş QR doğrulanamadı.'));
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
    if (forceFinishInFlightRef.current) return;
    forceFinishInFlightRef.current = true;
    lockState('forceFinish', 2000);
    setActionBusy(true);
    setForceFinishWarningVisible(false);
    const myLoReq = myId.trim().toLowerCase();
    const reqIso = new Date().toISOString();
    const ffReqActionId = createOptimisticActionId('force_finish_request');
    latestForceFinishActionIdRef.current = ffReqActionId;
    console.log('[leylek_ui_instant]', JSON.stringify({ flow: 'force_finish_request', actionId: ffReqActionId }));
    setSession((prev) =>
      prev && myLoReq
        ? {
            ...prev,
            force_finish_state: 'pending',
            forced_finish_requested_by_user_id: myLoReq,
            forced_finish_requested_at: reqIso,
          }
        : prev
    );
    void (async () => {
      touchOptimistic('force_finish_request');
      setForceFinishRequestOptimistic(true);
      try {
        const rest = await muhabbetTripSessionRestPost({
          action: 'force_finish_request',
          pathSuffix: 'force-finish/request',
        });
        if (isMuhabbetTripRestOk(rest)) {
          if (ffReqActionId !== latestForceFinishActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
            return;
          }
          const sess = rest.json.session;
          if (sess && typeof sess === 'object') {
            setSession(sess as MuhabbetTripSession);
          }
          setForceFinishTimeoutNotice(true);
          await refreshSessionFromServer('force_finish_request_rest', { bypassDebounce: true });
          clearOptimistic('force_finish_request');
          unlockState('forceFinish');
          return;
        }
        if (ffReqActionId !== latestForceFinishActionIdRef.current) {
          console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
          return;
        }
        setForceFinishRequestOptimistic(false);
        clearOptimistic('force_finish_request');
        unlockState('forceFinish');
        await refreshSessionFromServer('force_finish_request_fail', { bypassDebounce: true });
        const okSocket = await emitMuhabbetTripEventEnsured(
          'force_finish_request',
          'muhabbet_trip_force_finish_request',
          {},
          { suppressConnectionRenewAlert: true }
        );
        if (okSocket) {
          if (ffReqActionId !== latestForceFinishActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
          } else {
            await refreshSessionFromServer('force_finish_request_socket_fallback', { bypassDebounce: true });
            setForceFinishRequestOptimistic(true);
            setForceFinishTimeoutNotice(true);
            clearOptimistic('force_finish_request');
            unlockState('forceFinish');
          }
        } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
          Alert.alert('Muhabbet yolculuk', rest.json.detail);
        }
      } catch {
        if (ffReqActionId !== latestForceFinishActionIdRef.current) {
          console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
        } else {
          clearOptimistic('force_finish_request');
          setForceFinishRequestOptimistic(false);
          unlockState('forceFinish');
        }
      } finally {
        forceFinishInFlightRef.current = false;
        setActionBusy(false);
      }
    })();
  }, [
    clearOptimistic,
    emitMuhabbetTripEventEnsured,
    lockState,
    muhabbetTripSessionRestPost,
    refreshSessionFromServer,
    touchOptimistic,
    unlockState,
    myId,
  ]);

  const respondForceFinish = useCallback(
    (accepted: boolean) => {
      const snapshot = forceFinishPrompt;
      setForceFinishPrompt(null);
      void (async () => {
        lockState('forceFinish', 2000);
        touchOptimistic('force_finish_respond');
        setActionBusy(true);
        const ffRespActionId = createOptimisticActionId('force_finish_respond');
        latestForceFinishActionIdRef.current = ffRespActionId;
        const myLoResp = myId.trim().toLowerCase();
        console.log('[leylek_ui_instant]', JSON.stringify({ flow: 'force_finish_respond', accepted, actionId: ffRespActionId }));
        if (accepted) {
          const respIso = new Date().toISOString();
          setSession((prev) =>
            prev && myLoResp
              ? {
                  ...prev,
                  force_finish_state: 'accepted',
                  forced_finish_other_user_response: 'accepted',
                  forced_finish_confirmed_by_user_id: myLoResp,
                  forced_finish_confirmed_at: respIso,
                }
              : prev
          );
        }
        try {
          const rest = await muhabbetTripSessionRestPost({
            action: 'force_finish_respond',
            pathSuffix: 'force-finish/respond',
            body: { response: accepted ? 'accepted' : 'declined' },
          });
          if (isMuhabbetTripRestOk(rest)) {
            if (ffRespActionId !== latestForceFinishActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
              return;
            }
            const sess = rest.json.session;
            if (sess && typeof sess === 'object') {
              setSession(sess as MuhabbetTripSession);
            }
            await refreshSessionFromServer('force_finish_respond_rest', { bypassDebounce: true });
            clearOptimistic('force_finish_respond');
            unlockState('forceFinish');
            return;
          }
          if (ffRespActionId !== latestForceFinishActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
            return;
          }
          setForceFinishPrompt(snapshot);
          clearOptimistic('force_finish_respond');
          unlockState('forceFinish');
          await refreshSessionFromServer('force_finish_respond_fail', { bypassDebounce: true });
          const okSocket = await emitMuhabbetTripEventEnsured(
            'force_finish_respond',
            'muhabbet_trip_force_finish_respond',
            {
              response: accepted ? 'accepted' : 'declined',
            },
            { suppressConnectionRenewAlert: true }
          );
          if (okSocket) {
            if (ffRespActionId !== latestForceFinishActionIdRef.current) {
              console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
            } else {
              await refreshSessionFromServer('force_finish_respond_socket_fallback', { bypassDebounce: true });
              clearOptimistic('force_finish_respond');
              unlockState('forceFinish');
            }
          } else if (typeof rest.json.detail === 'string' && rest.json.detail) {
            Alert.alert('Muhabbet yolculuk', rest.json.detail);
          }
        } catch {
          if (ffRespActionId !== latestForceFinishActionIdRef.current) {
            console.log('[leylek_skip_refresh]', JSON.stringify({ reason: 'stale_force_finish_response' }));
          } else {
            clearOptimistic('force_finish_respond');
            unlockState('forceFinish');
            setForceFinishPrompt(snapshot);
          }
        } finally {
          setActionBusy(false);
        }
      })();
    },
    [
      clearOptimistic,
      emitMuhabbetTripEventEnsured,
      forceFinishPrompt,
      lockState,
      muhabbetTripSessionRestPost,
      myId,
      refreshSessionFromServer,
      touchOptimistic,
      unlockState,
    ]
  );

  const closeQrCodeModal = useCallback(() => {
    setQrCodeVisible(false);
    setQrLoading(false);
    qrCreateInFlightRef.current = false;
    latestQrActionIdRef.current = null;
    unlockState('qr');
    clearOptimistic('boarding_qr_create');
    clearOptimistic('finish_qr_create');
  }, [clearOptimistic, unlockState]);

  useEffect(() => {
    if (!session) return;
    if (!session.route_polyline && locations.pickup && locations.dropoff) {
      console.log('[leylek-trip] route data missing; waiting for road route', {
        session_id: effectiveSessionId,
        pickup: locations.pickup,
        dropoff: locations.dropoff,
      });
    } else if (!locations.pickup || !locations.dropoff) {
      console.log('[leylek-trip] route coordinates missing', { session_id: effectiveSessionId });
    }
  }, [locations.dropoff, locations.pickup, session, effectiveSessionId]);

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
        peerLocationUpdatedAt={
          isDriver ? session.passenger_location_updated_at ?? null : session.driver_location_updated_at ?? null
        }
        forceFinishIgnoresQrBusy
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
        qrBusy={qrLoading}
        qrInteractionAllowed={qrInteractionAllowed}
        callState={callState}
        callBusy={callBusy}
        callDialDisabled={
          callState === 'idle' && callStartCooldownUntil > 0 && Date.now() < callStartCooldownUntil
        }
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
      {forceFinishTimeoutNotice ? (
        <View style={styles.forceFinishTimeoutNotice} pointerEvents="none">
          <Ionicons name="hourglass-outline" size={18} color="#FEF3C7" />
          <Text style={styles.forceFinishTimeoutNoticeText}>
            Karşı taraf yanıt vermezse 30 saniye sonra kapanacak.
          </Text>
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
        sessionId={activeSessionId || effectiveSessionId}
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
        sessionId={activeSessionId || effectiveSessionId}
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
            <Pressable
              style={({ pressed }) => [
                styles.forceButton,
                pressed && { opacity: 0.9 },
                actionBusy && { opacity: 0.55 },
              ]}
              disabled={actionBusy}
              onPress={confirmForceFinishRequest}
            >
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
        onRequestClose={() => {
          const sidN = effectiveSessionId;
          const rid = String(forceFinishPrompt?.requestId || '').trim();
          const rq = String(forceFinishPrompt?.requesterUserId || '').trim();
          if (sidN && (rid || rq)) {
            forceFinishDismissedRef.current = `${sidN}:${rid || rq}`;
          }
          setForceFinishPrompt(null);
        }}
      >
        <View style={styles.trustModalRoot}>
          <View style={styles.trustModalCard}>
            <View style={[styles.trustModalIcon, { backgroundColor: '#F97316' }]}>
              <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.trustModalTitle}>Karşı taraf zorla bitirdi</Text>
            <Text style={styles.trustModalText}>Karşı taraf yolculuğu zorla bitirdi. Yanıtınız kayıt altına alınacak ve yolculuk kapanacak.</Text>
            {forceFinishCountdownText ? (
              <Text style={[styles.trustModalText, { marginTop: 8, fontWeight: '900', color: '#0F172A' }]}>
                {forceFinishCountdownText}
              </Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.trustAcceptButton, pressed && { opacity: 0.9 }, actionBusy && { opacity: 0.55 }]}
              disabled={actionBusy}
              onPress={() => respondForceFinish(true)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.trustAcceptText}>Onaylıyorum</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.trustDeclineButton, pressed && { opacity: 0.9 }, actionBusy && { opacity: 0.55 }]}
              disabled={actionBusy}
              onPress={() => respondForceFinish(false)}
            >
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
  forceFinishTimeoutNotice: {
    position: 'absolute',
    top: 112,
    left: 18,
    right: 18,
    zIndex: 199,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 58, 138, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forceFinishTimeoutNoticeText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
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
