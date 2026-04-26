import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { getOrCreateSocket } from '../contexts/SocketContext';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import type { MuhabbetTripSession, MuhabbetTripSessionSocketPayload } from '../lib/muhabbetTripTypes';
import LeylekTripMapPreview from './LeylekTripMapPreview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_GRAD = ['#0F172A', '#1E3A8A'] as const;
const DRIVER_GRAD = ['#2563EB', '#60A5FA'] as const;
const FINISH_GRAD = ['#16A34A', '#22C55E'] as const;
const SHARE_GRAD = ['#F97316', '#FDBA74'] as const;

type LeylekTripScreenProps = {
  apiBaseUrl: string;
  sessionId: string;
};

type Coord = { latitude: number; longitude: number };
type TripActionEvent = 'muhabbet_trip_start' | 'muhabbet_trip_cancel' | 'muhabbet_trip_finish';

function coord(lat?: number | null, lng?: number | null): Coord | null {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? { latitude: la, longitude: lo } : null;
}

function displayStatus(status?: string | null): { label: string; detail: string; color: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (status) {
    case 'started':
      return { label: 'Yolculuk başladı', detail: 'Konum paylaşımı açık, rota takip ediliyor.', color: '#2563EB', icon: 'navigate-circle' };
    case 'cancelled':
      return { label: 'İptal edildi', detail: 'Muhabbet yolculuk oturumu kapandı.', color: '#DC2626', icon: 'close-circle' };
    case 'finished':
      return { label: 'Tamamlandı', detail: 'Muhabbet yolculuk oturumu tamamlandı.', color: '#16A34A', icon: 'checkmark-circle' };
    default:
      return { label: 'Başlamaya hazır', detail: 'Sürücü başlattığında canlı takip görünür.', color: '#F97316', icon: 'time' };
  }
}

function shortId(v?: string | null): string {
  const s = String(v || '').trim();
  return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '—';
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
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<MuhabbetTripSession | null>(null);
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

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
    const joinPayload = { session_id: sessionId };
    console.log('[leylek-trip] emit', 'muhabbet_trip_join', joinPayload);
    socket.emit('muhabbet_trip_join', joinPayload);
    socket.on('muhabbet_trip_location_updated', onLocation);
    socket.on('muhabbet_trip_started', onStarted);
    socket.on('muhabbet_trip_cancelled', onCancelled);
    socket.on('muhabbet_trip_finished', onFinished);
    return () => {
      socket.off('muhabbet_trip_location_updated', onLocation);
      socket.off('muhabbet_trip_started', onStarted);
      socket.off('muhabbet_trip_cancelled', onCancelled);
      socket.off('muhabbet_trip_finished', onFinished);
    };
  }, [loadSession, sessionId]);

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
      <LeylekTripMapPreview
        pickup={locations.pickup}
        dropoff={locations.dropoff}
        passengerLocation={locations.passenger}
        driverLocation={locations.driver}
        style={styles.map}
      />

      <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={[styles.topChrome, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backFab} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color="#0F172A" />
            </Pressable>
            <LinearGradient colors={HEADER_GRAD} style={styles.headerPill}>
              <Ionicons name="leaf" size={16} color="#A7F3D0" />
              <Text style={styles.headerPillText}>Leylek Teklif Sende</Text>
            </LinearGradient>
          </View>

          <View style={styles.routeGlassCard}>
            <View style={styles.routeGlassHeader}>
              <View style={[styles.statusIcon, { backgroundColor: `${status.color}22` }]}>
                <Ionicons name={status.icon} size={22} color={status.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>{status.label}</Text>
                <Text style={styles.statusSub}>{status.detail}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePointRow}>
              <View style={[styles.routeDot, { backgroundColor: '#2563EB' }]} />
              <View style={styles.routeTextStack}>
                <Text style={styles.routeLabel}>Alış noktası</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{session.pickup_text || 'Sohbette belirlenen alış noktası'}</Text>
              </View>
            </View>
            <View style={styles.routePointRow}>
              <View style={[styles.routeDot, { backgroundColor: '#16A34A' }]} />
              <View style={styles.routeTextStack}>
                <Text style={styles.routeLabel}>Varış noktası</Text>
                <Text style={styles.routeValue} numberOfLines={1}>{session.dropoff_text || 'Sohbette belirlenen varış noktası'}</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.grabber} />
        <View style={styles.identityRow}>
          <View style={styles.identityAvatar}>
            <Ionicons name={isDriver ? 'car-sport' : 'person'} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.identityTitle}>{isDriver ? 'Sürücü ekranı' : 'Yolcu ekranı'}</Text>
            <Text style={styles.identitySub}>
              Oturum {shortId(session.id)} · {session.vehicle_kind === 'motorcycle' ? 'Motor' : 'Araç'}
            </Text>
          </View>
          {session.agreed_price != null ? (
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>₺{session.agreed_price}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Ionicons name="navigate" size={18} color="#2563EB" />
            <Text style={styles.metricValue}>{locations.driver ? 'Açık' : 'Bekliyor'}</Text>
            <Text style={styles.metricLabel}>Sürücü konumu</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="person" size={18} color="#F97316" />
            <Text style={styles.metricValue}>{locations.passenger ? 'Açık' : 'Bekliyor'}</Text>
            <Text style={styles.metricLabel}>Yolcu konumu</Text>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            onPress={() => void shareLocation()}
            disabled={sendingLocation || isTerminal}
            style={({ pressed }) => [styles.actionBtnWrap, (pressed || sendingLocation || isTerminal) && { opacity: 0.72 }]}
          >
            <LinearGradient colors={SHARE_GRAD} style={styles.actionBtn}>
              {sendingLocation ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="locate" size={19} color="#FFF" />}
              <Text style={styles.actionBtnText}>Konum paylaş</Text>
            </LinearGradient>
          </Pressable>

          {isDriver && session.status === 'ready' ? (
            <Pressable
              onPress={() => emitAction('muhabbet_trip_start')}
              disabled={actionBusy}
              style={({ pressed }) => [styles.actionBtnWrap, (pressed || actionBusy) && { opacity: 0.86 }]}
            >
              <LinearGradient colors={DRIVER_GRAD} style={styles.actionBtn}>
                <Ionicons name="play" size={19} color="#FFF" />
                <Text style={styles.actionBtnText}>Başlat</Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          {isDriver && (session.status === 'ready' || session.status === 'started') ? (
            <Pressable
              onPress={() => emitAction('muhabbet_trip_finish')}
              disabled={actionBusy}
              style={({ pressed }) => [styles.actionBtnWrap, (pressed || actionBusy) && { opacity: 0.86 }]}
            >
              <LinearGradient colors={FINISH_GRAD} style={styles.actionBtn}>
                <Ionicons name="checkmark-circle" size={19} color="#FFF" />
                <Text style={styles.actionBtnText}>Bitir</Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          {!isTerminal ? (
            <Pressable
              onPress={() => emitAction('muhabbet_trip_cancel')}
              disabled={actionBusy}
              style={({ pressed }) => [styles.cancelBtn, (pressed || actionBusy) && { opacity: 0.78 }]}
            >
              <Ionicons name="close-circle-outline" size={19} color="#FCA5A5" />
              <Text style={styles.cancelBtnText}>İptal et</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#EEF1F5' },
  loadingText: { marginTop: 10, color: '#334155', fontWeight: '800' },
  map: { flex: 1, height: undefined, borderRadius: 0 },
  topChrome: { paddingHorizontal: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
  },
  headerPill: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  headerPillText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  routeGlassCard: {
    width: Math.min(SCREEN_WIDTH - 28, 420),
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.95)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  routeGlassHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  statusIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  statusSub: { marginTop: 2, color: '#64748B', fontSize: 12, fontWeight: '600' },
  routeLine: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 11 },
  routePointRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  routeDot: { width: 9, height: 9, borderRadius: 5, marginRight: 10 },
  routeTextStack: { flex: 1, minWidth: 0 },
  routeLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  routeValue: { color: '#111827', fontSize: 14, fontWeight: '800', marginTop: 2 },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  grabber: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginBottom: 14 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  identityAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  identityTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  identitySub: { marginTop: 3, color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  pricePill: { borderRadius: 999, backgroundColor: 'rgba(22,163,74,0.18)', paddingVertical: 8, paddingHorizontal: 12 },
  priceText: { color: '#86EFAC', fontSize: 15, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', marginTop: 6 },
  metricLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 2 },
  actionGrid: { gap: 10 },
  actionBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  actionBtn: { minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  cancelBtn: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(185, 28, 28, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelBtnText: { color: '#FECACA', fontSize: 15, fontWeight: '900' },
  emptyTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#0F172A' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#64748B' },
  emptyBackBtn: { marginTop: 16, borderRadius: 14, backgroundColor: '#2563EB', paddingVertical: 11, paddingHorizontal: 18 },
  emptyBackTxt: { color: '#FFF', fontWeight: '900' },
});
