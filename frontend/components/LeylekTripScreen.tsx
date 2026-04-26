import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { ScreenHeaderGradient } from './ScreenHeaderGradient';
import { getOrCreateSocket } from '../contexts/SocketContext';
import { getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';
import type { MuhabbetTripSession, MuhabbetTripSessionSocketPayload } from '../lib/muhabbetTripTypes';
import LeylekTripMapPreview from './LeylekTripMapPreview';

type LeylekTripScreenProps = {
  apiBaseUrl: string;
  sessionId: string;
};

type Coord = { latitude: number; longitude: number };

function coord(lat?: number | null, lng?: number | null): Coord | null {
  const la = Number(lat);
  const lo = Number(lng);
  return Number.isFinite(la) && Number.isFinite(lo) ? { latitude: la, longitude: lo } : null;
}

function statusLabel(status?: string | null): string {
  switch (status) {
    case 'started':
      return 'Yolculuk başladı';
    case 'cancelled':
      return 'İptal edildi';
    case 'finished':
      return 'Tamamlandı';
    default:
      return 'Başlamaya hazır';
  }
}

function statusTone(status?: string | null): string {
  switch (status) {
    case 'started':
      return '#2563EB';
    case 'cancelled':
      return '#DC2626';
    case 'finished':
      return '#16A34A';
    default:
      return '#F97316';
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

  const isDriver = !!session && myId === String(session.driver_id || '').trim().toLowerCase();
  const isTerminal = session?.status === 'cancelled' || session?.status === 'finished';

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
      String(payload?.session_id || payload?.session?.id || '').trim().toLowerCase() === sessionId.toLowerCase();
    const onSession = (payload: MuhabbetTripSessionSocketPayload) => {
      if (!matches(payload) || !payload.session) return;
      setSession(payload.session);
    };
    socket.emit('join_muhabbet_trip_session', { session_id: sessionId });
    socket.on('joined_muhabbet_trip_session', onSession);
    socket.on('muhabbet_trip_session_updated', onSession);
    socket.on('muhabbet_trip_started', onSession);
    socket.on('muhabbet_trip_cancelled', onSession);
    socket.on('muhabbet_trip_finished', onSession);
    socket.on('muhabbet_trip_location_updated', onSession);
    return () => {
      socket.emit('leave_muhabbet_trip_session', { session_id: sessionId });
      socket.off('joined_muhabbet_trip_session', onSession);
      socket.off('muhabbet_trip_session_updated', onSession);
      socket.off('muhabbet_trip_started', onSession);
      socket.off('muhabbet_trip_cancelled', onSession);
      socket.off('muhabbet_trip_finished', onSession);
      socket.off('muhabbet_trip_location_updated', onSession);
    };
  }, [sessionId]);

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
      getOrCreateSocket().emit('muhabbet_trip_location_update', {
        session_id: sessionId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      Alert.alert('Konum', 'Konum alınamadı.');
    } finally {
      setSendingLocation(false);
    }
  }, [sessionId]);

  const emitAction = useCallback((eventName: 'muhabbet_trip_start' | 'muhabbet_trip_cancel' | 'muhabbet_trip_finish') => {
    setActionBusy(true);
    getOrCreateSocket().emit(eventName, { session_id: sessionId });
    setTimeout(() => setActionBusy(false), 1200);
  }, [sessionId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenHeaderGradient title="Leylek Yolculuk" onBack={() => router.back()} gradientColors={['#3B82F6', '#60A5FA']} />
        <View style={styles.center}>
          <ActivityIndicator color="#2563EB" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenHeaderGradient title="Leylek Yolculuk" onBack={() => router.back()} gradientColors={['#3B82F6', '#60A5FA']} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Oturum bulunamadı</Text>
          <Text style={styles.emptySub}>Sohbete dönüp tekrar deneyin.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <ScreenHeaderGradient title="Leylek Yolculuk" onBack={() => router.back()} gradientColors={['#3B82F6', '#60A5FA']} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, { backgroundColor: statusTone(session.status) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{statusLabel(session.status)}</Text>
            <Text style={styles.statusSub}>Bu ekran yalnızca Muhabbet oturumudur; normal ride sistemi kullanılmaz.</Text>
          </View>
        </View>

        <LeylekTripMapPreview
          pickup={locations.pickup}
          dropoff={locations.dropoff}
          passengerLocation={locations.passenger}
          driverLocation={locations.driver}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rota önizleme</Text>
          <View style={styles.routeRow}>
            <Ionicons name="location" size={19} color="#2563EB" />
            <Text style={styles.routeText}>{session.pickup_text || 'Alış noktası belirtilmedi'}</Text>
          </View>
          <View style={styles.routeRow}>
            <Ionicons name="flag" size={19} color="#16A34A" />
            <Text style={styles.routeText}>{session.dropoff_text || 'Varış noktası belirtilmedi'}</Text>
          </View>
          {session.agreed_price != null ? <Text style={styles.priceText}>Anlaşılan ücret: ₺{session.agreed_price}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => void shareLocation()}
            disabled={sendingLocation || isTerminal}
            style={({ pressed }) => [styles.secondaryBtn, (pressed || sendingLocation || isTerminal) && { opacity: 0.72 }]}
          >
            {sendingLocation ? <ActivityIndicator size="small" color="#2563EB" /> : <Ionicons name="navigate" size={18} color="#2563EB" />}
            <Text style={styles.secondaryBtnTxt}>Konumumu paylaş</Text>
          </Pressable>

          {isDriver && session.status === 'ready' ? (
            <Pressable
              onPress={() => emitAction('muhabbet_trip_start')}
              disabled={actionBusy}
              style={({ pressed }) => [styles.primaryBtnWrap, (pressed || actionBusy) && { opacity: 0.86 }]}
            >
              <LinearGradient colors={['#2563EB', '#60A5FA']} style={styles.primaryBtn}>
                <Ionicons name="play" size={18} color="#FFF" />
                <Text style={styles.primaryBtnTxt}>Başlat</Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          {isDriver && (session.status === 'ready' || session.status === 'started') ? (
            <Pressable
              onPress={() => emitAction('muhabbet_trip_finish')}
              disabled={actionBusy}
              style={({ pressed }) => [styles.primaryBtnWrap, (pressed || actionBusy) && { opacity: 0.86 }]}
            >
              <LinearGradient colors={['#16A34A', '#22C55E']} style={styles.primaryBtn}>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.primaryBtnTxt}>Bitir</Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          {!isTerminal ? (
            <Pressable
              onPress={() => emitAction('muhabbet_trip_cancel')}
              disabled={actionBusy}
              style={({ pressed }) => [styles.dangerBtn, (pressed || actionBusy) && { opacity: 0.78 }]}
            >
              <Ionicons name="close-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.dangerBtnTxt}>İptal et</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF1F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: 16, paddingBottom: 28, gap: 14 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  statusSub: { marginTop: 3, fontSize: 12, color: '#64748B', lineHeight: 17 },
  card: { padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  routeText: { flex: 1, fontSize: 14, color: '#1F2937', fontWeight: '600' },
  priceText: { marginTop: 6, fontSize: 14, color: '#16A34A', fontWeight: '800' },
  actions: { gap: 10 },
  primaryBtnWrap: { borderRadius: 16, overflow: 'hidden' },
  primaryBtn: { minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryBtnTxt: { color: '#2563EB', fontSize: 15, fontWeight: '900' },
  dangerBtn: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerBtnTxt: { color: '#B91C1C', fontSize: 15, fontWeight: '900' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#64748B' },
});
