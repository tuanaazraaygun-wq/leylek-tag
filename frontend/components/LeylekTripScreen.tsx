import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getOrCreateSocket } from '../contexts/SocketContext';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import { agoraUidFromUserId } from '../lib/agoraUid';
import type {
  MuhabbetTripCallSocketPayload,
  MuhabbetTripSession,
  MuhabbetTripSessionSocketPayload,
  MuhabbetTripTrustSocketPayload,
} from '../lib/muhabbetTripTypes';
import { muhabbetAgoraVoiceService } from '../services/muhabbetAgoraVoiceService';
import LeylekTripLiveRideChrome from './LeylekTripLiveRideChrome';

type LeylekTripScreenProps = {
  apiBaseUrl: string;
  sessionId: string;
};

type Coord = { latitude: number; longitude: number };
type TripActionEvent = 'muhabbet_trip_start' | 'muhabbet_trip_cancel' | 'muhabbet_trip_finish';
type CallState = 'idle' | 'incoming' | 'outgoing' | 'active';

function coord(lat?: number | null, lng?: number | null): Coord | null {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? { latitude: la, longitude: lo } : null;
}

function displayStatus(status?: string | null): { label: string; detail: string } {
  switch (status) {
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
  const [trustBusy, setTrustBusy] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<Coord | null>(null);
  const joinedCallKeyRef = useRef('');

  const isDriver = !!session && myId === String(session.driver_id || '').trim().toLowerCase();
  const isTerminal = session?.status === 'cancelled' || session?.status === 'finished';
  const status = displayStatus(session?.status);

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
      console.log('[leylek-trip] session loaded', data.session);
      setSession(data.session);
    } catch {
      Alert.alert('Muhabbet yolculuğu', 'Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, sessionId]);

  useEffect(() => {
    void currentUserId().then(setMyId);
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    let cancelled = false;
    const loadDeviceLocation = async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync();
        const pos = last || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && pos?.coords) {
          setDeviceLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        /* Device location is only a map fallback; absence should not block the trip screen. */
      }
    };
    void loadDeviceLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const socket = getOrCreateSocket();
    const matches = (payload: MuhabbetTripSessionSocketPayload) =>
      String(payload?.session_id || payload?.sessionId || payload?.session?.id || '').trim().toLowerCase() === sessionId.toLowerCase();
    const bind = (eventName: string) => (payload: MuhabbetTripSessionSocketPayload) => {
      console.log('[leylek-trip] event', eventName, payload);
      if (!matches(payload)) return;
      if (payload.session) setSession(payload.session);
      else void loadSession();
    };
    const onLocation = bind('muhabbet_trip_location_updated');
    const onStarted = bind('muhabbet_trip_started');
    const onCancelled = bind('muhabbet_trip_cancelled');
    const onFinished = bind('muhabbet_trip_finished');
    const callMatches = (payload: MuhabbetTripCallSocketPayload) =>
      String(payload?.session_id || payload?.sessionId || '').trim().toLowerCase() === sessionId.toLowerCase();
    const onCallStart = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_start', payload);
      if (!callMatches(payload)) return;
      setCallPayload(payload);
      setCallState(String(payload.caller_id || '').trim().toLowerCase() === myId ? 'outgoing' : 'incoming');
    };
    const onCallJoin = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_join', payload);
      if (!callMatches(payload)) return;
      setCallPayload((prev) => ({ ...(prev || {}), ...payload }));
      if (String(payload.joined_user_id || '').trim().toLowerCase() !== myId) {
        setCallState('active');
      }
    };
    const onCallEnd = (payload: MuhabbetTripCallSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_call_end', payload);
      if (!callMatches(payload)) return;
      void muhabbetAgoraVoiceService.leaveChannelAndDestroy();
      muhabbetAgoraVoiceService.resetCallbacks();
      joinedCallKeyRef.current = '';
      setCallPayload(null);
      setCallState('idle');
      setCallBusy(false);
    };
    const onTrustRequested = (payload: MuhabbetTripTrustSocketPayload) => {
      console.log('[leylek-trip] event', 'muhabbet_trip_trust_requested', payload);
      if (!callMatches(payload)) return;
      setTrustBusy(false);
      if (String(payload.requester_user_id || '').trim().toLowerCase() !== myId) {
        Alert.alert('Güven AL', 'Karşı taraf Muhabbet güven kontrolü istedi. Bu akış yakında aktif olacak.');
      }
    };
    const joinPayload = { session_id: sessionId };
    console.log('[leylek-trip] emit', 'muhabbet_trip_join', joinPayload);
    socket.emit('muhabbet_trip_join', joinPayload);
    socket.on('muhabbet_trip_location_updated', onLocation);
    socket.on('muhabbet_trip_started', onStarted);
    socket.on('muhabbet_trip_cancelled', onCancelled);
    socket.on('muhabbet_trip_finished', onFinished);
    socket.on('muhabbet_trip_call_start', onCallStart);
    socket.on('muhabbet_trip_call_join', onCallJoin);
    socket.on('muhabbet_trip_call_end', onCallEnd);
    socket.on('muhabbet_trip_trust_requested', onTrustRequested);
    return () => {
      const leavePayload = { session_id: sessionId };
      console.log('[leylek-trip] emit', 'muhabbet_trip_leave', leavePayload);
      socket.emit('muhabbet_trip_leave', leavePayload);
      socket.off('muhabbet_trip_location_updated', onLocation);
      socket.off('muhabbet_trip_started', onStarted);
      socket.off('muhabbet_trip_cancelled', onCancelled);
      socket.off('muhabbet_trip_finished', onFinished);
      socket.off('muhabbet_trip_call_start', onCallStart);
      socket.off('muhabbet_trip_call_join', onCallJoin);
      socket.off('muhabbet_trip_call_end', onCallEnd);
      socket.off('muhabbet_trip_trust_requested', onTrustRequested);
      void muhabbetAgoraVoiceService.leaveChannelAndDestroy();
      muhabbetAgoraVoiceService.resetCallbacks();
    };
  }, [loadSession, myId, sessionId]);

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
    setSendingLocation(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Konum izni', 'Konum paylaşmak için izin gerekli.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDeviceLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const payload = {
        session_id: sessionId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      console.log('[leylek-trip] emit', 'muhabbet_trip_location_update', payload);
      getOrCreateSocket().emit('muhabbet_trip_location_update', payload);
    } catch {
      Alert.alert('Konum', 'Konum alınamadı.');
    } finally {
      setSendingLocation(false);
    }
  }, [sessionId]);

  const emitAction = useCallback((eventName: TripActionEvent) => {
    const payload = { session_id: sessionId };
    console.log('[leylek-trip] emit', eventName, payload);
    setActionBusy(true);
    getOrCreateSocket().emit(eventName, payload);
    setTimeout(() => setActionBusy(false), 1200);
  }, [sessionId]);

  const ensureMicPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const joinMuhabbetAgoraChannel = useCallback(async (payload: MuhabbetTripCallSocketPayload) => {
    const channelName = String(payload.channel_name || `muhabbet_trip_${sessionId}`).trim();
    const token = String(payload.agora_token || '').trim();
    if (!token || !channelName || !myId) {
      Alert.alert('Arama', 'Arama bileti hazırlanamadı.');
      return false;
    }
    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert('Mikrofon izni', 'Sesli görüşme için mikrofon izni gerekli.');
      return false;
    }
    await muhabbetAgoraVoiceService.initialize();
    muhabbetAgoraVoiceService.setCallbacks({
      onJoinChannelSuccess: () => {
        setCallState('active');
        setCallBusy(false);
      },
      onUserOffline: () => {
        setCallState('idle');
        setCallPayload(null);
        setCallBusy(false);
      },
      onError: (_err, msg) => {
        setCallBusy(false);
        Alert.alert('Arama', msg || 'Agora bağlantı hatası.');
      },
    });
    muhabbetAgoraVoiceService.resetJoinGate();
    await muhabbetAgoraVoiceService.joinChannel(channelName, token, agoraUidFromUserId(myId));
    return true;
  }, [ensureMicPermission, myId, sessionId]);

  const startCall = useCallback(() => {
    if (isTerminal || !session) return;
    const payload = { session_id: sessionId };
    console.log('[leylek-trip] emit', 'muhabbet_trip_call_start', payload);
    setCallBusy(true);
    setCallState('outgoing');
    getOrCreateSocket().emit('muhabbet_trip_call_start', payload);
    setTimeout(() => setCallBusy(false), 1500);
  }, [isTerminal, session, sessionId]);

  const joinCall = useCallback(async () => {
    if (!callPayload) return;
    setCallBusy(true);
    const joined = await joinMuhabbetAgoraChannel(callPayload);
    if (joined) {
      const payload = { session_id: sessionId };
      console.log('[leylek-trip] emit', 'muhabbet_trip_call_join', payload);
      getOrCreateSocket().emit('muhabbet_trip_call_join', payload);
    } else {
      setCallBusy(false);
    }
  }, [callPayload, joinMuhabbetAgoraChannel, sessionId]);

  const endCall = useCallback(async () => {
    const payload = { session_id: sessionId };
    console.log('[leylek-trip] emit', 'muhabbet_trip_call_end', payload);
    getOrCreateSocket().emit('muhabbet_trip_call_end', payload);
    await muhabbetAgoraVoiceService.leaveChannelAndDestroy();
    muhabbetAgoraVoiceService.resetCallbacks();
    joinedCallKeyRef.current = '';
    setCallPayload(null);
    setCallState('idle');
    setCallBusy(false);
  }, [sessionId]);

  const requestTrust = useCallback(() => {
    if (isTerminal || !session) return;
    const payload = { session_id: sessionId };
    console.log('[leylek-trip] emit', 'muhabbet_trip_trust_request', payload);
    setTrustBusy(true);
    getOrCreateSocket().emit('muhabbet_trip_trust_request', payload);
    Alert.alert('Güven AL', 'Muhabbet güven isteği gönderildi. Bu izole akışın canlı görüşme adımı yakında aktif olacak.');
    setTimeout(() => setTrustBusy(false), 1500);
  }, [isTerminal, session, sessionId]);

  useEffect(() => {
    if (callState !== 'outgoing' || !callPayload || !myId) return;
    if (String(callPayload.caller_id || '').trim().toLowerCase() !== myId) return;
    const channelName = String(callPayload.channel_name || '').trim();
    const token = String(callPayload.agora_token || '').trim();
    const joinKey = `${channelName}|${token ? 'token' : 'no-token'}`;
    if (!channelName || !token || joinedCallKeyRef.current === joinKey) return;
    joinedCallKeyRef.current = joinKey;
    setCallBusy(true);
    void joinMuhabbetAgoraChannel(callPayload).then((joined) => {
      if (!joined) {
        joinedCallKeyRef.current = '';
        setCallBusy(false);
      }
    });
  }, [callPayload, callState, joinMuhabbetAgoraChannel, myId]);

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

  return (
    <View style={styles.root}>
      <LeylekTripLiveRideChrome
        isDriver={isDriver}
        isTerminal={isTerminal}
        roleTitle={isDriver ? 'Sürücü ekranı' : 'Yolcu ekranı'}
        statusLabel={status.label}
        statusDetail={status.detail}
        pickupText={session.pickup_text || 'Sohbette belirlenen alış noktası'}
        dropoffText={session.dropoff_text || 'Sohbette belirlenen varış noktası'}
        agreedPrice={session.agreed_price}
        vehicleKind={session.vehicle_kind}
        routePolyline={session.route_polyline}
        routeDistanceKm={session.route_distance_km}
        routeDurationMin={session.route_duration_min}
        pickup={locations.pickup}
        dropoff={locations.dropoff}
        passengerLocation={locations.passenger}
        driverLocation={locations.driver}
        deviceLocation={deviceLocation}
        routeDataMissing={!locations.pickup || !locations.dropoff}
        sendingLocation={sendingLocation}
        actionBusy={actionBusy}
        callState={callState}
        callBusy={callBusy}
        trustBusy={trustBusy}
        canStart={isDriver && session.status === 'ready'}
        canFinish={isDriver && (session.status === 'ready' || session.status === 'started')}
        onShareLocation={() => void shareLocation()}
        onStartCall={startCall}
        onJoinCall={() => void joinCall()}
        onEndCall={() => void endCall()}
        onTrustRequest={requestTrust}
        onStart={() => emitAction('muhabbet_trip_start')}
        onFinish={() => emitAction('muhabbet_trip_finish')}
        onCancel={() => emitAction('muhabbet_trip_cancel')}
      />
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
});
