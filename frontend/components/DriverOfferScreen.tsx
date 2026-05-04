/**
 * DriverOfferScreen - Sürücü Teklif Ekranı
 * 
 * Yolcunun gördüğü teklif ekranına benzer tasarım:
 * - Üstte harita (20km çevresindeki yolcuları gösterir)
 * - Altta kompakt kart listesi (scroll edilebilir)
 * - Her kartta: yolcu konumu, hedef, mesafe, süre bilgileri
 * - Hızlı teklif gönderme
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  ImageBackground,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';
import {
  ROUTE_LOADING_MIN_VISIBLE_MS,
  ROUTE_LOADING_UI,
  ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
} from '../lib/routeLoadingUiConstants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MAP_POLL_INTERVAL_MS = 9000;

/** İki nokta arası km (haritada yakın pin / zoom sınırı için). */
/** Kartta km: 0 veya geçersizse "?" (0.0 göstermeyi engeller). */
function formatTripKmBadge(km: number | undefined | null): string {
  const n = Number(km);
  if (!Number.isFinite(n) || n <= 0) return '?';
  return n.toFixed(1);
}

async function fetchTripRouteMetrics(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number,
): Promise<{ km: number; min: number } | null> {
  const q = new URLSearchParams({
    origin_lat: String(pickupLat),
    origin_lng: String(pickupLng),
    dest_lat: String(dropLat),
    dest_lng: String(dropLng),
  });
  try {
    const res = await fetch(`${API_BASE_URL}/route-metrics?${q}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.success !== true) return null;
    const dk = Number(data.distance_km);
    const dm = Number(data.duration_min);
    if (!Number.isFinite(dk) || dk <= 0 || !Number.isFinite(dm) || dm <= 0) return null;
    return { km: dk, min: Math.max(1, Math.round(dm)) };
  } catch {
    return null;
  }
}

/** LiveMapView `RouteCalculatingPremium` ile aynı zamanlama / renk sabitleri */
function TripRouteCalculatingInline({ compact }: { compact?: boolean }) {
  const U = ROUTE_LOADING_UI;
  const d0 = useRef(new Animated.Value(U.dotMinOpacity)).current;
  const d1 = useRef(new Animated.Value(U.dotMinOpacity)).current;
  const d2 = useRef(new Animated.Value(U.dotMinOpacity)).current;
  const d3 = useRef(new Animated.Value(U.dotMinOpacity)).current;
  const dots = [d0, d1, d2, d3];
  useEffect(() => {
    const loops = dots.map((v, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(i * U.dotStaggerMs),
          Animated.timing(v, {
            toValue: U.dotMaxOpacity,
            duration: U.dotTimingMs,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: U.dotMinOpacity,
            duration: U.dotTimingMs,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => {
      loops.forEach((l) => l.stop());
    };
  }, [d0, d1, d2, d3]);
  const fs = compact ? U.fontSizeOfferCompact : U.fontSizeOffer;
  const dotSz = compact ? U.dotSizeOfferCompact : U.dotSizeOffer;
  const dotGap = U.dotGapOffer;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      <Text
        style={{
          color: U.textColor,
          fontSize: fs,
          fontWeight: U.fontWeight,
          letterSpacing: U.letterSpacing,
        }}
      >
        Rota hesaplanıyor
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: U.textToDotsOffer,
          height: fs + 2,
        }}
      >
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={{
              width: dotSz,
              height: dotSz,
              marginLeft: i === 0 ? 0 : dotGap,
              borderRadius: 1,
              backgroundColor: U.dotColor,
              opacity: v,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function pickupLineFromRequest(r: PassengerRequest): string {
  const s = [r.pickup_location, (r as { pickup_address?: string }).pickup_address].find(
    (x) => typeof x === 'string' && x.trim(),
  );
  if (s) return s.trim();
  const la = Number(r.pickup_lat);
  const ln = Number(r.pickup_lng);
  if (Number.isFinite(la) && Number.isFinite(ln)) {
    return `Konum (${la.toFixed(4)}, ${ln.toFixed(4)})`;
  }
  return 'Alış noktası';
}

function dropoffLineFromRequest(r: PassengerRequest): string {
  const s = [
    r.dropoff_location,
    (r as { dropoff_address?: string }).dropoff_address,
    (r as { destination?: string }).destination,
  ].find((x) => typeof x === 'string' && x.trim());
  if (s) return s.trim();
  const la = Number(r.dropoff_lat);
  const ln = Number(r.dropoff_lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && (Math.abs(la) > 1e-6 || Math.abs(ln) > 1e-6)) {
    return `Hedef (${la.toFixed(4)}, ${ln.toFixed(4)})`;
  }
  return 'Hedef (haritada işaretli)';
}

export interface DriverMapSeekingPin {
  tag_id: string;
  pickup_lat: number;
  pickup_lng: number;
  status?: string;
  label?: string;
  /** Backend yol mesafesi (km) — harita zoom sınırı; kuş uçuşu hesaplanmaz */
  pickup_distance_km?: number;
  distance_km?: number;
}

export interface DriverMapLightPin {
  user_id: string;
  latitude: number;
  longitude: number;
  label?: string;
  distance_km?: number;
}

export interface DriverMapCityGridCell {
  center_lat: number;
  center_lng: number;
  count: number;
  intensity: number;
}

// react-native-maps'i sadece native platformlarda yükle
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

// Renkler
const COLORS = {
  primary: '#3FA9F5',
  secondary: '#FF6B35',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1B1B1E',
  textSecondary: '#64748B',
  success: '#22C55E',
  border: '#E2E8F0',
};

export interface PassengerRequest {
  id: string;
  request_id?: string;
  tag_id?: string;
  passenger_id: string;
  passenger_name: string;
  pickup_location: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_location: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  distance_to_passenger_km?: number;
  /** Backend tek kaynak (sürücü → pickup) */
  pickup_distance_km?: number;
  pickup_eta_min?: number;
  trip_distance_km?: number;
  time_to_passenger_min?: number;
  trip_duration_min?: number;
  // 🆕 MARTI TAG
  offered_price?: number;
  notes?: string;
  created_at?: string;
  /** Yolcu talebi: car | motorcycle (socket / dispatch) */
  passenger_vehicle_kind?: 'car' | 'motorcycle';
  /** Yolcu ödeme: nakit | sanal kart */
  passenger_payment_method?: 'cash' | 'card';
}

interface DriverOfferScreenProps {
  driverLocation: { latitude: number; longitude: number } | null;
  requests: PassengerRequest[];
  driverName: string;
  driverRating: number;
  onSendOffer: (requestId: string, price: number) => Promise<boolean>;
  /** Sürücü ID — Kabul butonunda driver_accept_offer emit için zorunlu */
  driverId: string;
  playTapSound?: () => void;
  onDismissRequest: (requestId: string) => void;
  onBack: () => void;
  onLogout: () => void;
  vehicleKind?: 'car' | 'motorcycle';
  /** true: üstte panel var; SafeArea üst padding yok, flex ile sığdır */
  embedded?: boolean;
  /** POST /driver/accept-offer başarılı olunca (optimistic harita / LiveMapView) */
  onDriverAcceptMatch?: (match: Record<string, unknown>) => void;
}

// Yolcu Request Kartı Bileşeni - MARTI TAG MODELİ
function RequestCard({ 
  request, 
  driverLocation,
  driverId,
  playTapSound,
  onDismiss,
  onDriverAcceptMatch,
  index,
  globalAcceptFrozen,
  setGlobalAcceptFrozen,
}: { 
  request: PassengerRequest; 
  driverLocation: { latitude: number; longitude: number } | null;
  driverId: string;
  playTapSound?: () => void;
  onDismiss: () => void;
  onDriverAcceptMatch?: (match: Record<string, unknown>) => void;
  index: number;
  globalAcceptFrozen: boolean;
  setGlobalAcceptFrozen: (v: boolean) => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const srvTripKm = Number(request.trip_distance_km);
  const srvTripMin = Number(request.trip_duration_min);
  const hasFullTripFromServer =
    Number.isFinite(srvTripKm) &&
    srvTripKm > 0 &&
    Number.isFinite(srvTripMin) &&
    srvTripMin > 0;

  const [tripRoadKm, setTripRoadKm] = useState<number | null>(null);
  const [tripRoadMin, setTripRoadMin] = useState<number | null>(null);
  const [tripRoadLoading, setTripRoadLoading] = useState(false);
  const [tripRoadFailed, setTripRoadFailed] = useState(false);
  const [tripUnavailableUiVisible, setTripUnavailableUiVisible] = useState(false);

  const tripRouteFetchIdRef = useRef(0);
  const tripLoadUiStartRef = useRef<number | null>(null);
  const tripLoadHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const forceTripRoadLoadingFalse = () => {
    tripLoadUiStartRef.current = null;
    if (tripLoadHideTimerRef.current) {
      clearTimeout(tripLoadHideTimerRef.current);
      tripLoadHideTimerRef.current = null;
    }
    setTripRoadLoading(false);
  };

  const beginTripRoadLoadingUi = () => {
    if (tripLoadHideTimerRef.current) {
      clearTimeout(tripLoadHideTimerRef.current);
      tripLoadHideTimerRef.current = null;
    }
    tripLoadUiStartRef.current = Date.now();
    setTripRoadLoading(true);
  };

  const endTripRoadLoadingUi = () => {
    const start = tripLoadUiStartRef.current;
    const finish = () => {
      tripLoadUiStartRef.current = null;
      if (tripLoadHideTimerRef.current) {
        clearTimeout(tripLoadHideTimerRef.current);
        tripLoadHideTimerRef.current = null;
      }
      setTripRoadLoading(false);
    };
    if (start == null) {
      finish();
      return;
    }
    const elapsed = Date.now() - start;
    if (elapsed >= ROUTE_LOADING_MIN_VISIBLE_MS) finish();
    else {
      tripLoadHideTimerRef.current = setTimeout(
        finish,
        ROUTE_LOADING_MIN_VISIBLE_MS - elapsed,
      );
    }
  };

  useEffect(() => {
    const fetchId = ++tripRouteFetchIdRef.current;
    let cancelled = false;
    setTripRoadKm(null);
    setTripRoadMin(null);
    setTripRoadFailed(false);

    const kmOk =
      Number.isFinite(srvTripKm) && srvTripKm > 0 && Number.isFinite(srvTripMin) && srvTripMin > 0;
    if (kmOk) return;

    const pla = Number(request.pickup_lat);
    const pln = Number(request.pickup_lng);
    const dla = Number(request.dropoff_lat);
    const dln = Number(request.dropoff_lng);
    if (![pla, pln, dla, dln].every((x) => Number.isFinite(x))) return;

    beginTripRoadLoadingUi();
    void (async () => {
      let got: { km: number; min: number } | null = null;
      try {
        got = await fetchTripRouteMetrics(pla, pln, dla, dln);
        if (!cancelled && got) {
          setTripRoadKm(got.km);
          setTripRoadMin(got.min);
        }
      } finally {
        if (!cancelled && tripRouteFetchIdRef.current === fetchId) {
          endTripRoadLoadingUi();
          setTripRoadFailed(
            !kmOk &&
              [pla, pln, dla, dln].every((x) => Number.isFinite(x)) &&
              got == null,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      tripRouteFetchIdRef.current += 1;
      forceTripRoadLoadingFalse();
    };
  }, [
    request.id,
    request.pickup_lat,
    request.pickup_lng,
    request.dropoff_lat,
    request.dropoff_lng,
    request.trip_distance_km,
    request.trip_duration_min,
    srvTripKm,
    srvTripMin,
  ]);

  const tripFailureEligible =
    !tripRoadLoading &&
    tripRoadFailed &&
    !hasFullTripFromServer &&
    tripRoadKm == null &&
    !(Number.isFinite(srvTripKm) && srvTripKm > 0);

  useEffect(() => {
    if (!tripFailureEligible) {
      setTripUnavailableUiVisible(false);
      return;
    }
    const t = setTimeout(
      () => setTripUnavailableUiVisible(true),
      ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [tripFailureEligible]);

  const tripRoadShowFailedUi = tripFailureEligible && tripUnavailableUiVisible;
  const tripRoadShowLoading =
    !hasFullTripFromServer &&
    !(Number.isFinite(srvTripKm) && srvTripKm > 0) &&
    (tripRoadLoading || (tripRoadFailed && !tripUnavailableUiVisible));

  // km yalnızca backend alanları (pickup_distance_km / trip_distance_km); yoksa "?"
  const distanceToPassenger = formatTripKmBadge(request.pickup_distance_km);
  const tripDistanceKmText = hasFullTripFromServer
    ? formatTripKmBadge(srvTripKm)
    : formatTripKmBadge(tripRoadKm ?? srvTripKm);

  const timeToPassenger =
    request.pickup_eta_min ??
    request.time_to_passenger_min ??
    null;
  const tripDuration = request.trip_duration_min ?? null;

  const timeToPassengerDisplay =
    timeToPassenger != null && Number.isFinite(Number(timeToPassenger))
      ? Math.max(1, Math.round(Number(timeToPassenger)))
      : '—';
  const tripDurationMinNumber = hasFullTripFromServer
    ? Math.max(1, Math.round(srvTripMin))
    : tripRoadMin != null
      ? Math.max(1, Math.round(tripRoadMin))
      : tripDuration != null && Number.isFinite(Number(tripDuration))
        ? Math.max(1, Math.round(Number(tripDuration)))
        : null;

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Üst Kısım - Yolcu Bilgisi */}
      <View style={styles.cardHeader}>
        <View style={styles.passengerInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>{request.passenger_name?.split(' ')[0] || 'Yolcu'}</Text>
            <Text style={styles.timeAgo}>Yeni teklif</Text>
            {request.passenger_vehicle_kind === 'motorcycle' ? (
              <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '700', marginTop: 2 }}>🏍️ Motor talebi</Text>
            ) : (
              <Text style={{ fontSize: 11, color: '#0369a1', fontWeight: '700', marginTop: 2 }}>🚗 Araç talebi</Text>
            )}
            {request.passenger_payment_method === 'card' ? (
              <View style={styles.paymentBadge}>
                <Ionicons name="card-outline" size={12} color="#1D4ED8" />
                <Text style={styles.paymentBadgeText}>Sanal kart</Text>
              </View>
            ) : request.passenger_payment_method === 'cash' ? (
              <View style={[styles.paymentBadge, styles.paymentBadgeCash]}>
                <Ionicons name="cash-outline" size={12} color="#047857" />
                <Text style={[styles.paymentBadgeText, styles.paymentBadgeTextCash]}>Nakit</Text>
              </View>
            ) : null}
          </View>
        </View>
        {/* 🆕 MARTI TAG - Yolcunun Teklif Ettiği Fiyat */}
        <View style={styles.priceTagContainer}>
          <Text style={styles.priceTagLabel}>Teklif</Text>
          <Text style={styles.priceTagValue}>{request.offered_price || 0} ₺</Text>
        </View>
      </View>

      {/* Konum Bilgileri */}
      <View style={styles.locationSection}>
        {/* Nereden */}
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Nereden</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {pickupLineFromRequest(request)}
            </Text>
          </View>
          <View style={styles.distanceBadge}>
            <Ionicons name="car" size={12} color={COLORS.primary} />
            <Text style={styles.distanceText}>{distanceToPassenger} km</Text>
          </View>
        </View>

        {/* Çizgi */}
        <View style={styles.locationLine} />

        {/* Nereye */}
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.secondary }]} />
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Nereye</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {dropoffLineFromRequest(request)}
            </Text>
          </View>
          <View
            style={[
              styles.distanceBadge,
              tripRoadShowLoading ? { minWidth: 118, alignItems: 'flex-end' } : null,
            ]}
          >
            <Ionicons name="navigate" size={12} color={COLORS.secondary} />
            {tripRoadShowLoading ? (
              <TripRouteCalculatingInline compact />
            ) : tripRoadShowFailedUi ? (
              <Text style={styles.distanceText}>—</Text>
            ) : (
              <Text style={styles.distanceText}>{tripDistanceKmText} km</Text>
            )}
          </View>
        </View>
      </View>

      {/* Mesafe ve Süre Bilgileri - BÜYÜK VE BELİRGİN */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={20} color="#3FA9F5" />
          <View>
            <Text style={styles.statValueBig}>
              {timeToPassengerDisplay}
              {typeof timeToPassengerDisplay === 'number' ? ' dk' : ''}
            </Text>
            <Text style={styles.statLabelBig}>yolcuya</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="speedometer-outline" size={20} color="#FF6B35" />
          <View style={{ flex: 1, minWidth: 0 }}>
            {tripRoadShowLoading ? (
              <TripRouteCalculatingInline compact />
            ) : (
              <Text style={styles.statValueBig}>
                {tripRoadShowFailedUi && tripDurationMinNumber == null
                  ? 'Rota bilgisi alınamadı'
                  : tripDurationMinNumber != null
                    ? `${tripDurationMinNumber} dk`
                    : '—'}
              </Text>
            )}
            <Text style={styles.statLabelBig}>yolculuk</Text>
          </View>
        </View>
      </View>

      {/* 🆕 MARTI TAG - Kabul Et / Geç Butonları */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
        >
          <Text style={styles.dismissButtonText}>Geç</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
          onPress={async () => {
            if (accepting || globalAcceptFrozen) return;

            const tagIdForAccept = String(request.tag_id || request.id || '').trim();
            const userId = String(driverId || '').trim();

            if (!tagIdForAccept || !userId) {
              Alert.alert('Hata', 'Eksik bilgi');
              return;
            }

            setGlobalAcceptFrozen(true);
            setAccepting(true);
            try {
              playTapSound?.();
              const url = `${API_BASE_URL}/driver/accept-offer?user_id=${encodeURIComponent(userId)}`;
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: tagIdForAccept, driver_id: userId }),
              });
              const rawText = await res.text();
              let body: Record<string, unknown> | null = null;
              try {
                body = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
              } catch {
                body = null;
              }
              console.log('[driver/accept-offer]', res.status, rawText?.slice?.(0, 500) || rawText);

              if (res.ok && body && body.success === true) {
                const m = (body.match as Record<string, unknown> | undefined) || body;
                onDriverAcceptMatch?.({
                  ...m,
                  pickup_distance_km:
                    m.pickup_distance_km ?? request.pickup_distance_km,
                  pickup_eta_min: m.pickup_eta_min ?? request.pickup_eta_min,
                  trip_distance_km:
                    m.trip_distance_km ?? request.trip_distance_km,
                  trip_duration_min:
                    m.trip_duration_min ?? request.trip_duration_min,
                });
                return;
              }

              setGlobalAcceptFrozen(false);

              let errMsg = '';
              if (body) {
                const d = (body as { detail?: unknown }).detail;
                const m = (body as { message?: unknown }).message;
                errMsg = [d, m]
                  .map((x) => (x != null && String(x).trim() ? String(x).trim() : ''))
                  .find(Boolean) || '';
              }
              if (!errMsg) {
                errMsg =
                  res.status === 409
                    ? 'Bu çağrı artık müsait değil veya başka sürücüye düştü.'
                    : `Sunucu yanıtı: ${res.status}`;
              }
              Alert.alert('Eşleşme olmadı', errMsg);
            } catch (e) {
              console.error('[driver/accept-offer] fetch', e);
              setGlobalAcceptFrozen(false);
              Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
            } finally {
              setAccepting(false);
            }
          }}
          disabled={accepting || globalAcceptFrozen}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Kabul Et</Text>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/** Şehir içi talep yoğunluğu — kırmızı dalga (tüm sürücüler aynı API verisini görür) */
function CityHeatCellMarker({
  cell,
  delayMs,
}: {
  cell: DriverMapCityGridCell;
  delayMs: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity2 = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    const boost = 0.35 + cell.intensity * 0.55;
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.5 + boost * 0.35,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs + 480),
        Animated.parallel([
          Animated.timing(scale2, {
            toValue: 1.35 + boost * 0.28,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity2, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale2, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity2, { toValue: 0.38, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [cell.intensity, delayMs, scale, opacity, scale2, opacity2]);

  return (
    <View style={styles.cityHeatWrap} collapsable={false}>
      <Animated.View
        style={[
          styles.cityHeatRing,
          { transform: [{ scale }], opacity },
        ]}
      />
      <Animated.View
        style={[
          styles.cityHeatRing,
          styles.cityHeatRingOuter,
          { transform: [{ scale: scale2 }], opacity: opacity2 },
        ]}
      />
      <View style={styles.cityHeatCore} />
    </View>
  );
}

export default function DriverOfferScreen({
  driverLocation,
  requests,
  driverName,
  driverRating,
  onSendOffer,
  driverId,
  playTapSound,
  onDismissRequest,
  onBack,
  onLogout: _onLogout,
  vehicleKind = 'car',
  embedded = false,
  onDriverAcceptMatch,
}: DriverOfferScreenProps) {
  const isMotor = vehicleKind === 'motorcycle';
  const [globalAcceptFrozen, setGlobalAcceptFrozen] = useState(false);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapSeekingPins, setMapSeekingPins] = useState<DriverMapSeekingPin[]>([]);
  const [mapLightPins, setMapLightPins] = useState<DriverMapLightPin[]>([]);
  const [mapCityGrid, setMapCityGrid] = useState<DriverMapCityGridCell[]>([]);
  const [mapDriverCity, setMapDriverCity] = useState('');
  const [mapHud, setMapHud] = useState({ seeking: 0, nearby: 0, radius: 20 });
  const [mapExpanded, setMapExpanded] = useState(false);
  const driverPulseScale = useRef(new Animated.Value(1)).current;
  const driverPulseOpacity = useRef(new Animated.Value(0.55)).current;
  const driverPulse2Scale = useRef(new Animated.Value(1)).current;
  const driverPulse2Opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const ring1 = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(driverPulseScale, {
            toValue: 2.2,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(driverPulseOpacity, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(driverPulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(driverPulseOpacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    const ring2 = Animated.loop(
      Animated.sequence([
        Animated.delay(650),
        Animated.parallel([
          Animated.timing(driverPulse2Scale, {
            toValue: 2.05,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(driverPulse2Opacity, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(driverPulse2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(driverPulse2Opacity, { toValue: 0.35, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    ring1.start();
    ring2.start();
    return () => {
      ring1.stop();
      ring2.stop();
    };
  }, [driverPulseScale, driverPulseOpacity, driverPulse2Scale, driverPulse2Opacity]);

  useEffect(() => {
    if (!mapExpanded) {
      setMapReady(false);
    }
  }, [mapExpanded]);

  /** Genişletilmiş harita yüksekliği — canlı harita yalnızca mapExpanded iken mount edilir */
  const mapExpandedHeight = Math.min(SCREEN_HEIGHT * 0.42, 360);

  /** Normal TAG: teklifleri gizleme; araç uyumsuzluğu yalnızca tanılama logu (sunucu hedefli socket teklifi kartta kalsın). */
  const visibleRequests = useMemo(() => {
    for (const req of requests) {
      const raw =
        (req as { passenger_vehicle_kind?: unknown }).passenger_vehicle_kind ??
        (req as { passenger_preferred_vehicle?: unknown }).passenger_preferred_vehicle;
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      const s = String(raw).trim().toLowerCase();
      const tripVk: 'car' | 'motorcycle' =
        s === 'motorcycle' || s === 'motor' ? 'motorcycle' : 'car';
      if (tripVk !== vehicleKind) {
        try {
          console.log(
            '[normal_ride_driver_offer_filtered]',
            JSON.stringify({
              reason: 'vehicle_mismatch_visibleRequests_show_anyway',
              tag_id: (req as { tag_id?: string }).tag_id ?? (req as { id?: string }).id ?? null,
              tripVk,
              vehicleKind,
            }),
          );
        } catch {
          /* noop */
        }
      }
    }
    return requests;
  }, [requests, vehicleKind]);

  const listedTagIds = useMemo(() => {
    const s = new Set<string>();
    visibleRequests.forEach((r) => {
      const id = r.id || r.tag_id || r.request_id;
      if (id) s.add(String(id));
    });
    return s;
  }, [visibleRequests]);

  // Sunucudan 20 km harita pinleri (hareket eden sürücüye göre)
  useEffect(() => {
    if (!driverId || !driverLocation) {
      setMapSeekingPins([]);
      setMapLightPins([]);
      setMapCityGrid([]);
      setMapDriverCity('');
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const q = new URLSearchParams({
          user_id: String(driverId),
          latitude: String(driverLocation.latitude),
          longitude: String(driverLocation.longitude),
        });
        const res = await fetch(`${API_BASE_URL}/driver/nearby-passengers-map?${q.toString()}`);
        const j = await res.json();
        if (cancelled || !j?.success) return;
        setMapSeekingPins(Array.isArray(j.seeking) ? j.seeking : []);
        setMapLightPins(Array.isArray(j.nearby_app_users) ? j.nearby_app_users : []);
        setMapCityGrid(Array.isArray(j.city_grid) ? j.city_grid : []);
        setMapDriverCity(typeof j.driver_city === 'string' ? j.driver_city.trim() : '');
        setMapHud({
          seeking: Number(j.seeking_count) || 0,
          nearby: Number(j.nearby_light_count) || 0,
          radius: Math.round(Number(j.radius_km) || 20),
        });
      } catch {
        /* sessiz */
      }
    };
    void load();
    const id = setInterval(load, MAP_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [driverId, driverLocation?.latitude, driverLocation?.longitude]);

  // Harita sınırları: sürücü + yalnızca tarama yarıçapı içindeki pinler (şehir grid zoom’u şişirmez)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driverLocation) return;

    const rk = mapHud.radius || 20;
    const fitKm = Math.min(45, rk * 1.2);

    const coordinates: { latitude: number; longitude: number }[] = [{ ...driverLocation }];

    mapSeekingPins.forEach((p) => {
      const pk = Number(p.pickup_distance_km ?? p.distance_km);
      if (Number.isFinite(pk) && pk <= fitKm) {
        coordinates.push({ latitude: p.pickup_lat, longitude: p.pickup_lng });
      }
    });
    mapLightPins.forEach((p) => {
      const dk = Number(p.distance_km);
      if (Number.isFinite(dk) && dk <= fitKm) {
        coordinates.push({ latitude: p.latitude, longitude: p.longitude });
      }
    });

    if (coordinates.length === 1) {
      const latDelta = Math.max(0.14, (rk / 111) * 1.1);
      const lngDelta = Math.max(0.14, (rk / (111 * Math.cos((driverLocation.latitude * Math.PI) / 180))) * 1.1);
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        },
        400
      );
      return;
    }

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 44, right: 36, bottom: 36, left: 36 },
        animated: true,
      });
    }, 350);
  }, [mapReady, driverLocation, mapSeekingPins, mapLightPins, mapHud.radius]);

  // Web fallback veya harita yoksa
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.mapFallback}>
          <Ionicons name="map" size={40} color="#38BDF8" />
          <Text style={styles.mapFallbackText}>
            Talep {mapHud.seeking} · {mapHud.radius} km
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={
          driverLocation
            ? {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.12,
                longitudeDelta: 0.12,
              }
            : {
                latitude: 39.92,
                longitude: 32.85,
                latitudeDelta: 0.15,
                longitudeDelta: 0.15,
              }
        }
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {driverLocation && Circle ? (
          <>
            <Circle
              center={driverLocation}
              radius={(mapHud.radius || 20) * 1000}
              strokeColor="rgba(63, 169, 245, 0.5)"
              fillColor="rgba(63, 169, 245, 0.07)"
              strokeWidth={2}
            />
            <Circle
              center={driverLocation}
              radius={(mapHud.radius || 20) * 500}
              strokeColor="rgba(63, 169, 245, 0.35)"
              fillColor="rgba(63, 169, 245, 0.05)"
              strokeWidth={1}
            />
          </>
        ) : null}

        {mapCityGrid.map((cell, idx) => (
          <Marker
            key={`heat-${idx}-${cell.center_lat}-${cell.center_lng}`}
            coordinate={{ latitude: cell.center_lat, longitude: cell.center_lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <CityHeatCellMarker cell={cell} delayMs={(idx % 6) * 180} />
          </Marker>
        ))}

        {driverLocation && (
          <Marker coordinate={driverLocation} title="Siz" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarkerPulseWrap} collapsable={false}>
              <Animated.View
                style={[
                  styles.driverPulseRing,
                  {
                    transform: [{ scale: driverPulseScale }],
                    opacity: driverPulseOpacity,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.driverPulseRing,
                  styles.driverPulseRingOuter,
                  {
                    transform: [{ scale: driverPulse2Scale }],
                    opacity: driverPulse2Opacity,
                  },
                ]}
              />
              <View style={styles.driverMarker}>
                {isMotor ? (
                  <MaterialCommunityIcons name="motorbike" size={24} color="#FFF" />
                ) : (
                  <Ionicons name="car" size={24} color="#FFF" />
                )}
              </View>
            </View>
          </Marker>
        )}

        {mapSeekingPins.map((pin) => {
          const listed = listedTagIds.has(String(pin.tag_id));
          return (
            <Marker
              key={`seek-${pin.tag_id}`}
              coordinate={{ latitude: pin.pickup_lat, longitude: pin.pickup_lng }}
              title={pin.label || 'Talep'}
              description={listed ? 'Listede — teklif verebilirsiniz' : 'Yolcu talebi'}
            >
              <View style={[styles.passengerMarkerSeeking, listed && styles.passengerMarkerSeekingListed]}>
                <Ionicons name="navigate" size={15} color="#FFF" />
              </View>
            </Marker>
          );
        })}

        {mapLightPins.map((pin) => (
          <Marker
            key={`light-${pin.user_id}`}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            title={pin.label || 'Yakında'}
            description="Konum paylaşan kullanıcı"
          >
            <View style={styles.passengerMarkerLight}>
              <View style={styles.passengerMarkerLightDot} />
            </View>
          </Marker>
        ))}
      </MapView>
    );
  };

  const displayRating = driverRating != null ? driverRating.toFixed(1) : '4.0';

  const body = (
    <View style={styles.driverOfferBody}>
      <View
        style={[
          styles.mapCardShell,
          mapExpanded && styles.mapCardShellExpandedLayer,
        ]}
      >
        <TouchableOpacity
          style={[styles.mapExpandToggle, mapExpanded && styles.mapExpandToggleWithMapBelow]}
          onPress={() => setMapExpanded((v) => !v)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={mapExpanded ? 'Haritayı gizle' : 'Haritayı göster'}
        >
          <Ionicons
            name={mapExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#BAE6FD"
          />
          <Text style={styles.mapExpandToggleText}>
            {mapExpanded ? 'Haritayı gizle' : 'Haritayı göster'}
          </Text>
        </TouchableOpacity>

        {mapExpanded ? (
          <View
            style={[styles.mapExpandedMapHost, { height: mapExpandedHeight }]}
          >
            <View style={[styles.mapViewportFixed, styles.mapContainerSolidExpanded]}>
              {renderMap()}
              <View style={styles.mapDimOverlay} pointerEvents="none" />
              <View style={styles.mapTopOverlay} pointerEvents="box-none">
                <TouchableOpacity onPress={onBack} style={styles.mapBackFab} accessibilityRole="button">
                  <Ionicons name="chevron-back" size={24} color="#F1F5F9" />
                </TouchableOpacity>
                <View style={styles.mapNameCardWrap} pointerEvents="none">
                  <View style={styles.mapNameCard}>
                    <Text style={styles.mapNameText}>{driverName?.split(' ')[0] || 'Sürücü'}</Text>
                    <View style={styles.mapRatingRow}>
                      <Ionicons name="star" size={14} color="#FBBF24" />
                      <Text style={styles.mapRatingText}>{displayRating}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.mapTopSpacer} />
              </View>
              <View style={styles.mapHud} pointerEvents="none">
                <Ionicons name="radio-outline" size={15} color="#94A3B8" style={styles.mapHudRadioIcon} />
                <Text style={styles.mapHudText}>
                  Talep {mapHud.seeking} · {mapHud.radius} km
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Yolcu İstekleri — ImageBackground yalnızca liste / boş durum; haritayı sarmaz */}
      <ImageBackground
        source={require('../assets/images/offer-background.png')}
        style={styles.listContainer}
        imageStyle={styles.listBackgroundImage}
      >
        {isMotor ? (
          <LinearGradient
            colors={['rgba(22, 101, 52, 0.35)', 'rgba(15, 23, 42, 0.55)']}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        ) : null}
        <View style={[styles.listHeader, mapExpanded && styles.listHeaderMapExpanded]}>
          <View style={styles.listHeaderTopRow}>
            <View style={styles.listHeaderAccentDot} />
            <Text style={[styles.listTitle, mapExpanded && styles.listTitleMapExpanded]}>
              Yakındaki İstekler
            </Text>
          </View>
        </View>

        {visibleRequests.length === 0 ? (
          <View style={[styles.emptyState, mapExpanded && styles.emptyStateMapExpanded]}>
            <View style={[styles.emptyStateCard, mapExpanded && styles.emptyStateCardMapExpanded]}>
              <View
                style={[
                  styles.emptyIconRing,
                  mapExpanded && styles.emptyIconRingMapExpanded,
                  isMotor && styles.emptyIconRingMotor,
                ]}
              >
                {isMotor ? (
                  <MaterialCommunityIcons
                    name="motorbike"
                    size={mapExpanded ? 48 : 56}
                    color="#86EFAC"
                  />
                ) : (
                  <Ionicons name="car-outline" size={mapExpanded ? 44 : 52} color="#38BDF8" />
                )}
              </View>
              <Text style={[styles.emptyTitle, mapExpanded && styles.emptyTitleMapExpanded]}>
                Teklif bekleniyor
              </Text>
              <Text style={[styles.emptySubtitle, mapExpanded && styles.emptySubtitleMapExpanded]}>
                Çevrimiçi kaldığınızda talepler burada belirir. Haritada {mapHud.radius} km içindeki yolcu talepleri ve yakındaki kullanıcılar gösterilir.
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={visibleRequests}
            keyExtractor={(item, index) => item.id || item.request_id || index.toString()}
            renderItem={({ item, index }) => (
              <RequestCard
                request={item}
                driverLocation={driverLocation}
                driverId={driverId}
                playTapSound={playTapSound}
                onDismiss={() => onDismissRequest(item.id)}
                onDriverAcceptMatch={onDriverAcceptMatch}
                index={index}
                globalAcceptFrozen={globalAcceptFrozen}
                setGlobalAcceptFrozen={setGlobalAcceptFrozen}
              />
            )}
            contentContainerStyle={[styles.listContent, mapExpanded && styles.listContentMapExpanded]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ImageBackground>
    </View>
  );

  if (embedded) {
    return <View style={[styles.container, styles.containerEmbedded]}>{body}</View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerEmbedded: {
    minHeight: 0,
  },
  /** Sütun: üstte harita alanı, altta yalnızca liste (ImageBackground haritayı örtmez) */
  driverOfferBody: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    flexDirection: 'column',
  },
  mapCardShellExpandedLayer: {
    zIndex: 10,
    elevation: 11,
  },

  mapCardShell: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: SCREEN_WIDTH,
    paddingHorizontal: 12,
  },
  /** Sabit yükseklikli canlı harita — üst katman (zIndex); içerik `mapViewportFixed`. __DEV__: kırmızı = host alanı doğrulama */
  mapExpandedMapHost: {
    width: '100%',
    zIndex: 10,
    position: 'relative',
    backgroundColor: typeof __DEV__ !== 'undefined' && __DEV__ ? '#FF0000' : 'transparent',
    elevation: 12,
  },
  mapViewportFixed: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#0b1220',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.65)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 12,
  },
  mapContainerSolidExpanded: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    shadowOpacity: 0.48,
    shadowRadius: 22,
    elevation: 16,
  },
  mapExpandToggle: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  mapExpandToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E0F2FE',
    letterSpacing: 0.2,
  },
  mapExpandToggleWithMapBelow: {
    marginBottom: 8,
  },
  mapDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    zIndex: 2,
  },

  mapTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 6,
  },
  mapBackFab: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.14)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  mapTopSpacer: {
    width: 44,
    height: 44,
  },
  mapNameCardWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  mapNameCard: {
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    maxWidth: SCREEN_WIDTH * 0.58,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  mapNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.2,
  },
  mapRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  mapRatingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E2E8F0',
    fontVariant: ['tabular-nums'],
  },

  // Map (yükseklik mapCardShell üzerinden mapSectionHeight ile verilir)
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
  },
  mapContainerSolid: {
    width: '100%',
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#0b1220',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(51, 65, 85, 0.65)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 12,
  },
  mapBackgroundImage: {
    resizeMode: 'cover',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapHud: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    maxWidth: '92%',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 6,
  },
  mapHudRadioIcon: {
    marginRight: 8,
  },
  mapHudText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E2E8F0',
    flexShrink: 1,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  mapFallbackText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 10,
    letterSpacing: 0.2,
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  mapOverlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  requestCountBadgeBig: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    gap: 12,
  },
  requestCountTextBig: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1B1B1E',
  },
  radiusInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 27, 42, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
  },
  radiusInfoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 6,
  },
  driverMarkerPulseWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.85)',
    backgroundColor: 'transparent',
  },
  driverPulseRingOuter: {
    borderColor: 'rgba(14, 165, 233, 0.5)',
    borderWidth: 1.5,
  },
  driverMarker: {
    backgroundColor: '#0284C7',
    padding: 8,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#F8FAFC',
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  cityHeatWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityHeatRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.95)',
    backgroundColor: 'transparent',
  },
  cityHeatRingOuter: {
    borderColor: 'rgba(220, 38, 38, 0.5)',
    borderWidth: 1.5,
  },
  cityHeatCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: 'rgba(248, 250, 252, 0.95)',
    shadowColor: '#7f1d1d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  passengerMarker: {
    backgroundColor: COLORS.secondary,
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  passengerMarkerSeeking: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EA580C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#F8FAFC',
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  passengerMarkerSeekingListed: {
    backgroundColor: '#059669',
    borderColor: '#ECFDF5',
    shadowColor: '#064e3b',
  },
  passengerMarkerLight: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(100, 116, 139, 0.55)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 5,
  },
  passengerMarkerLightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
  },

  // List
  listContainer: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
    elevation: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  listBackgroundImage: {
    resizeMode: 'cover',
  },
  listHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.18)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  listHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listHeaderAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  listTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.35,
  },
  listHeaderMapExpanded: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
  },
  listTitleMapExpanded: {
    fontSize: 17,
    letterSpacing: -0.25,
  },
  listSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  listContentMapExpanded: {
    paddingTop: 2,
    paddingBottom: 18,
    paddingHorizontal: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyStateMapExpanded: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  emptyStateCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  emptyStateCardMapExpanded: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 18,
    maxWidth: 380,
  },
  emptyIconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyIconRingMotor: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(134, 239, 172, 0.4)',
  },
  emptyIconRingMapExpanded: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.1,
  },
  emptyTitleMapExpanded: {
    fontSize: 19,
    marginTop: 12,
  },
  emptySubtitleMapExpanded: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerDetails: {
    marginLeft: 10,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  paymentBadgeCash: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  paymentBadgeTextCash: {
    color: '#047857',
  },
  dismissBtn: {
    padding: 8,
  },

  // Location
  locationSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginLeft: 4,
    marginVertical: 4,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  locationLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 4,
  },

  // Stats - BÜYÜK VE BELİRGİN
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#0D1B2A',
    borderRadius: 12,
    padding: 14,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  statValueBig: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabelBig: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
  },

  // 🆕 MARTI TAG - Fiyat Etiketi ve Butonlar
  priceTagContainer: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priceTagLabel: {
    fontSize: 10,
    color: '#FFF',
    opacity: 0.9,
    textAlign: 'center',
  },
  priceTagValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 17,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 17,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },

  // Offer Section (Eski - artık kullanılmıyor)
  offerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  priceBtn: {
    padding: 10,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  priceInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    minWidth: 60,
    paddingVertical: 8,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  sentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    borderRadius: 12,
  },
  sentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
});
