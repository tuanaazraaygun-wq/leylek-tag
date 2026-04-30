import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

function coord(lat?: number | null, lng?: number | null): Coord | null {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? { latitude: la, longitude: lo } : null;
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

  const isDriver = !!session && myId === String(session.driver_id || '').trim().toLowerCase();
  const isTerminal = TERMINAL_TRIP_STATUSES.has(String(session?.status || '').trim().toLowerCase());
  const status = displayStatus(session?.status);

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

  const closeTerminalTrip = useCallback((eventName: string, nextSession?: MuhabbetTripSession | null) => {
    const terminalSessionId = normalizeMuhabbetSessionId(nextSession?.id || nextSession?.session_id || sessionId);
    const terminalStatus = String(nextSession?.status || '').trim().toLowerCase();
    console.log(`[leylek-trip] terminal event received event=${eventName} session_id=${terminalSessionId}`);
    if (terminalStatus) {
      console.log(`[leylek-trip] terminal status on load status=${terminalStatus}`);
    }
    setQrCodeVisible(false);
    setQrScanVisible(false);
    setQrFinishToken('');
    setQrExpiresAt(null);
    setForceFinishPrompt(null);
    setForceFinishWarningVisible(false);
    setCallPayload(null);
    setCallState('idle');
    setCallBusy(false);
    setPaymentPromptVisible(false);
    setPaymentBusy(false);
    setActionBusy(false);
    setSession(null);
    setTimeout(() => router.replace(MUHABBET_SAFE_ROUTE), 120);
  }, [router, sessionId]);

  const loadSession = useCallback(async () => {
    const token = await getPersistedAccessToken();
    if (!token) {
      Alert.alert('Oturum gerekli', 'Muhabbet yolculuğunu açmak için tekrar giriş yapın.');
      setLoading(false);
      return;
    }
    try {
      const base = apiBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${base}/muhabbet/trip-sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; session?: MuhabbetTripSession; detail?: string };
      if (!res.ok || !data.success || !data.session) {
        Alert.alert('Muhabbet yolculuğu', data.detail || 'Oturum açılmadı.');
        return;
      }
      const loadedStatus = String(data.session.status || '').trim().toLowerCase();
      if (TERMINAL_TRIP_STATUSES.has(loadedStatus)) {
        console.log(`[leylek-trip] terminal status on load status=${loadedStatus}`);
        closeTerminalTrip('load', data.session);
        return;
      }
      console.log('[leylek-trip] session loaded', data.session);
      setSession(data.session);
    } catch {
      Alert.alert('Muhabbet yolculuğu', 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, closeTerminalTrip, sessionId]);

  useEffect(() => {
    void currentUserId().then(setMyId);
    void loadSession();
  }, [loadSession]);

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
    const bind = (eventName: string) => (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', eventName, payload);
      if (!matches(payload)) return;
      if (payload.session) setSession(payload.session);
      else void loadSession();
    };
    const bindTerminal = (eventName: string) => (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', eventName, payload);
      if (!matches(payload)) return;
      closeTerminalTrip(eventName, payload.session || null);
    };
    const onLocation = bind('muhabbet_trip_location_updated');
    const onPaymentMethodSet = (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_payment_method_set', payload);
      if (!matches(payload)) return;
      if (payload.session) setSession(payload.session);
      else void loadSession();
      setPaymentBusy(false);
      setPaymentPromptVisible(false);
    };
    const onStarted = (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_started', payload);
      if (!matches(payload)) return;
      const nextSession = payload.session || null;
      if (nextSession) setSession(nextSession);
      else void loadSession();
      setQrCodeVisible(false);
      setQrScanVisible(false);
      setQrFinishToken('');
      setQrExpiresAt(null);
      setActionBusy(false);
      setBoardingMessage(myId && String(nextSession?.driver_id || '').trim().toLowerCase() === myId
        ? 'Yolculuk başladı. Hedefte QR gösterin'
        : 'Araca bindiniz. Hedefte QR okutun');
      setTimeout(() => setBoardingMessage(''), 4200);
    };
    const onCancelled = bindTerminal('muhabbet_trip_cancelled');
    const onFinished = (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_finished', payload);
      if (!matches(payload)) return;
      const nextSession = payload.session || session || null;
      if (nextSession?.finish_method === 'qr') {
        setQrCodeVisible(false);
        setQrScanVisible(false);
        setQrFinishToken('');
        setQrExpiresAt(null);
        setForceFinishPrompt(null);
        setForceFinishWarningVisible(false);
        setCallPayload(null);
        setCallState('idle');
        setCallBusy(false);
        setActionBusy(false);
        setSession(nextSession);
        setFinishResult({ paymentMethod: nextSession.payment_method || null });
        return;
      }
      closeTerminalTrip('muhabbet_trip_finished', nextSession);
    };
    const onExpired = bindTerminal('muhabbet_trip_expired');
    const callMatches = (payload: MuhabbetTripCallSocketPayload) =>
      normalizeMuhabbetSessionId(payload?.session_id || payload?.sessionId) === activeSessionId;
    const onCallStart = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_start', payload);
      if (!callMatches(payload)) return;
      setCallPayload(payload);
      if (String(payload.caller_id || '').trim().toLowerCase() === myId) {
        setCallState('outgoing');
      }
    };
    const onCallIncoming = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_incoming', payload);
      if (!callMatches(payload)) return;
      setCallPayload((prev) => ({ ...(prev || {}), ...payload }));
      if (String(payload.caller_id || '').trim().toLowerCase() !== myId) {
        setCallState('incoming');
      }
    };
    const onCallAccept = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_accept', payload);
      if (!callMatches(payload)) return;
      setCallPayload((prev) => ({ ...(prev || {}), ...payload }));
      setCallState('active');
      setCallBusy(false);
    };
    const onCallDecline = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_decline', payload);
      if (!callMatches(payload)) return;
      setCallPayload(null);
      setCallState('idle');
      setCallBusy(false);
    };
    const onCallEnd = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_end', payload);
      if (!callMatches(payload)) return;
      setCallPayload(null);
      setCallState('idle');
      setCallBusy(false);
    };
    const onBoardingQrCreated = (payload: MuhabbetTripFinishSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_boarding_qr_created', payload);
      if (!callMatches(payload)) return;
      setActionBusy(false);
      setQrMode('boarding');
      if (payload.session) setSession(payload.session);
      setQrFinishToken(String(payload.boarding_qr_token || '').trim().toUpperCase());
      setQrExpiresAt(payload.expires_at || null);
      setQrCodeVisible(true);
    };
    const onQrCreated = (payload: MuhabbetTripFinishSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_finish_qr_created', payload);
      if (!callMatches(payload)) return;
      setActionBusy(false);
      setQrMode('finish');
      if (payload.session) setSession(payload.session);
      setQrFinishToken(String(payload.finish_qr_token || payload.qr_finish_token || '').trim().toUpperCase());
      setQrExpiresAt(payload.expires_at || null);
      setQrCodeVisible(true);
    };
    const onFinishQrCreated = (payload: MuhabbetTripFinishSocketPayload) => {
      onQrCreated(payload);
    };
    const onTripError = (payload: { code?: string; message?: string; detail?: string }) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_error', payload);
      setActionBusy(false);
      setPaymentBusy(false);
      const message = payload?.message || payload?.detail || '';
      if (message) Alert.alert('Muhabbet yolculuk', message);
    };
    const onForceRequested = (payload: MuhabbetTripFinishSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_force_finish_requested', payload);
      if (!callMatches(payload)) return;
      setActionBusy(false);
      if (payload.session) setSession(payload.session);
      if (String(payload.requester_user_id || '').trim().toLowerCase() !== myId) {
        setForceFinishPrompt({
          requesterUserId: String(payload.requester_user_id || '').trim().toLowerCase(),
          targetUserId: String(payload.target_user_id || '').trim().toLowerCase(),
        });
      }
    };
    const onForceFinished = (payload: MuhabbetTripFinishSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_force_finished', payload);
      if (!callMatches(payload)) return;
      closeTerminalTrip('muhabbet_trip_force_finished', payload.session || null);
    };
    emitMuhabbetTripEvent('muhabbet_trip_join', {}, { showAlert: false });
    socket.on('muhabbet_trip_location_updated', onLocation);
    socket.on('muhabbet_trip_payment_method_set', onPaymentMethodSet);
    socket.on('muhabbet_trip_started', onStarted);
    socket.on('muhabbet_trip_cancelled', onCancelled);
    socket.on('muhabbet_trip_finished', onFinished);
    socket.on('muhabbet_trip_expired', onExpired);
    socket.on('muhabbet_trip_call_start', onCallStart);
    socket.on('muhabbet_trip_call_incoming', onCallIncoming);
    socket.on('muhabbet_trip_call_accept', onCallAccept);
    socket.on('muhabbet_trip_call_decline', onCallDecline);
    socket.on('muhabbet_trip_call_end', onCallEnd);
    socket.on('muhabbet_trip_boarding_qr_created', onBoardingQrCreated);
    socket.on('muhabbet_trip_finish_qr_created', onFinishQrCreated);
    socket.on('muhabbet_trip_error', onTripError);
    socket.on('muhabbet_trip_force_finish_requested', onForceRequested);
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
      socket.off('muhabbet_trip_call_start', onCallStart);
      socket.off('muhabbet_trip_call_incoming', onCallIncoming);
      socket.off('muhabbet_trip_call_accept', onCallAccept);
      socket.off('muhabbet_trip_call_decline', onCallDecline);
      socket.off('muhabbet_trip_call_end', onCallEnd);
      socket.off('muhabbet_trip_boarding_qr_created', onBoardingQrCreated);
      socket.off('muhabbet_trip_finish_qr_created', onFinishQrCreated);
      socket.off('muhabbet_trip_error', onTripError);
      socket.off('muhabbet_trip_force_finish_requested', onForceRequested);
      socket.off('muhabbet_trip_force_finished', onForceFinished);
    };
  }, [closeTerminalTrip, emitMuhabbetTripEvent, getActiveMuhabbetSessionId, loadSession, myId, session]);

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

  const emitAction = useCallback((eventName: TripActionEvent) => {
    setActionBusy(true);
    if (!emitMuhabbetTripEvent(eventName)) {
      setActionBusy(false);
      return;
    }
    setTimeout(() => setActionBusy(false), 1200);
  }, [emitMuhabbetTripEvent]);

  const startCall = useCallback(() => {
    if (isTerminal || !session) return;
    if (!getActiveMuhabbetSessionId()) {
      Alert.alert('Muhabbet yolculuğu', 'Yolculuk bilgisi hazırlanıyor.');
      return;
    }
    setCallBusy(true);
    setCallState('outgoing');
    if (!emitMuhabbetTripEvent('muhabbet_trip_call_start')) {
      setCallState('idle');
      setCallBusy(false);
      return;
    }
    setTimeout(() => setCallBusy(false), 1500);
  }, [emitMuhabbetTripEvent, getActiveMuhabbetSessionId, isTerminal, session]);

  const selectPaymentMethod = useCallback((paymentMethod: 'cash' | 'card') => {
    if (!session || isTerminal || paymentBusy) return;
    setPaymentBusy(true);
    if (!emitMuhabbetTripEvent('muhabbet_trip_payment_method_set', { payment_method: paymentMethod })) {
      setPaymentBusy(false);
      return;
    }
    setTimeout(() => {
      setPaymentBusy(false);
      setPaymentPromptVisible(false);
    }, 1000);
  }, [emitMuhabbetTripEvent, isTerminal, paymentBusy, session]);

  const acceptCall = useCallback(() => {
    if (!callPayload) return;
    setCallBusy(true);
    const activeSessionId = getActiveMuhabbetSessionId();
    if (!emitMuhabbetTripEvent('muhabbet_trip_call_accept')) {
      setCallBusy(false);
      return;
    }
    setCallPayload((prev) => ({ ...(prev || {}), session_id: activeSessionId }));
    setCallState('active');
    setTimeout(() => setCallBusy(false), 900);
  }, [callPayload, emitMuhabbetTripEvent, getActiveMuhabbetSessionId]);

  const declineCall = useCallback(() => {
    emitMuhabbetTripEvent('muhabbet_trip_call_decline', {}, { showAlert: false });
    setCallPayload(null);
    setCallState('idle');
    setCallBusy(false);
  }, [emitMuhabbetTripEvent]);

  const endCall = useCallback(() => {
    emitMuhabbetTripEvent('muhabbet_trip_call_end', {}, { showAlert: false });
    setCallPayload(null);
    setCallState('idle');
    setCallBusy(false);
  }, [emitMuhabbetTripEvent]);

  const navigationTarget = useMemo(() => {
    if (!session) return null;
    if (session.status === 'started' || session.status === 'active') return locations.dropoff;
    if (isDriver) return locations.passenger || locations.pickup;
    return locations.driver || locations.pickup;
  }, [isDriver, locations.driver, locations.dropoff, locations.passenger, locations.pickup, session]);

  const navigationLabel = session?.status === 'started' || session?.status === 'active' ? 'Varışa Git' : isDriver ? 'Yolcuya Git' : 'Navigasyon';
  const openNavigation = useCallback(async () => {
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
  }, [navigationTarget]);

  const openQrFinish = useCallback(() => {
    if (!session || isTerminal) return;
    if (!getActiveMuhabbetSessionId()) {
      Alert.alert('Muhabbet yolculuğu', 'Yolculuk bilgisi hazırlanıyor.');
      return;
    }
    if (session.status === 'ready') {
      setQrMode('boarding');
      setQrFinishToken('');
      setQrExpiresAt(null);
      if (isDriver) {
        setActionBusy(true);
        if (!emitMuhabbetTripEvent('muhabbet_trip_boarding_qr_create')) {
          setActionBusy(false);
          return;
        }
        setTimeout(() => setActionBusy(false), 1500);
      } else {
        setQrScanVisible(true);
      }
      return;
    }
    setQrMode('finish');
    setQrFinishToken('');
    setQrExpiresAt(null);
    if (isDriver) {
      setActionBusy(true);
      if (!emitMuhabbetTripEvent('muhabbet_trip_finish_qr_create')) {
        setActionBusy(false);
        return;
      }
      setTimeout(() => setActionBusy(false), 1500);
    } else {
      setQrScanVisible(true);
    }
  }, [emitMuhabbetTripEvent, getActiveMuhabbetSessionId, isDriver, isTerminal, session]);

  const confirmQrToken = useCallback((rawToken: string) => {
    const token = rawToken.trim().toUpperCase();
    if (!token) {
      Alert.alert(qrMode === 'boarding' ? 'Biniş QR' : 'QR ile Bitir', qrMode === 'boarding' ? 'Sürücünün gösterdiği kodu girin.' : 'Yolcunun gösterdiği kodu girin.');
      return;
    }
    const eventName = qrMode === 'boarding' ? 'muhabbet_trip_boarding_qr_confirm' : 'muhabbet_trip_finish_qr_confirm';
    const payload = qrMode === 'boarding'
      ? { boarding_qr_token: token }
      : { finish_qr_token: token };
    setActionBusy(true);
    if (qrMode === 'finish') {
      Vibration.vibrate([0, 70, 55, 90]);
    }
    if (!emitMuhabbetTripEvent(eventName, payload)) {
      setActionBusy(false);
      return;
    }
    setQrScanVisible(false);
    setTimeout(() => setActionBusy(false), 1500);
  }, [emitMuhabbetTripEvent, qrMode]);

  const requestForceFinish = useCallback(() => {
    if (!session || isTerminal) return;
    setForceFinishWarningVisible(true);
  }, [isTerminal, session]);

  const confirmForceFinishRequest = useCallback(() => {
    setForceFinishWarningVisible(false);
    setActionBusy(true);
    if (!emitMuhabbetTripEvent('muhabbet_trip_force_finish_request')) {
      setActionBusy(false);
      return;
    }
    setTimeout(() => setActionBusy(false), 1500);
  }, [emitMuhabbetTripEvent]);

  const respondForceFinish = useCallback((accepted: boolean) => {
    setForceFinishPrompt(null);
    setActionBusy(true);
    if (!emitMuhabbetTripEvent('muhabbet_trip_force_finish_respond', { response: accepted ? 'accepted' : 'declined' })) {
      setActionBusy(false);
      return;
    }
    setTimeout(() => setActionBusy(false), 1500);
  }, [emitMuhabbetTripEvent]);

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
        suppressFloatingTopActions
        isDriver={isDriver}
        isTerminal={isTerminal}
        roleTitle={isDriver ? 'Sürücü ekranı' : 'Yolcu ekranı'}
        statusLabel={status.label}
        statusDetail={status.detail}
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
        token={qrFinishToken}
        sessionId={activeSessionId || sessionId}
        expiresAt={qrExpiresAt}
        onClose={() => setQrCodeVisible(false)}
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
