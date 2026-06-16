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
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';
import { appAlert } from '../contexts/AppAlertContext';
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import {
  LDS_GRADIENT_COCKPIT_BASE,
  LDS_GRADIENT_COCKPIT_BASE_LOCATIONS,
  LDS_GRADIENT_COCKPIT_TOP_HAZE,
  LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS,
} from '../design-system/tokens/gradient';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_DEEP,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from './auth/premiumAuthStyles';
import {
  ROUTE_LOADING_MIN_VISIBLE_MS,
  ROUTE_LOADING_UI,
  ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
} from '../lib/routeLoadingUiConstants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MAP_POLL_INTERVAL_MS = 9000;

/** LHIS cockpit — DriverActivityMap ile uyumlu koyu Google Maps stili */
const DRIVER_OFFER_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

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
  /** LiveMap ile sabit paylaşılan zamanlama; renkler bu ekranda premium palete çekilir */
  const routeUiText = PREMIUM_TEXT_SOFT;
  const routeUiDot = PREMIUM_AUTH_CYAN;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      <PremiumText
        variant="caption"
        style={{
          color: routeUiText,
          fontSize: fs,
          fontWeight: U.fontWeight,
          letterSpacing: U.letterSpacing,
        }}
      >
        Rota hazırlanıyor
      </PremiumText>
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
              backgroundColor: routeUiDot,
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

// Renkler — kokpit yüzünde premium token kullanımı
const COLORS = {
  primary: PREMIUM_AUTH_CYAN,
  secondary: '#FF6B35',
  background: PREMIUM_NAVY_DEEP,
  card: 'rgba(16,26,43,0.92)',
  text: PREMIUM_TEXT_SOFT,
  textSecondary: PREMIUM_TEXT_MUTED,
  success: '#22C55E',
  border: PREMIUM_BORDER_SLATE,
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
  /** Yolcu ödeme: nakit | card (UI: kart yakında — iş mantığı değişmez) */
  passenger_payment_method?: 'cash' | 'card';
}

interface DriverOfferScreenProps {
  driverLocation: { latitude: number; longitude: number } | null;
  requests: PassengerRequest[];
  driverName: string;
  driverRating?: number;
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
  /** Kabul POST başlamadan / bittiğinde — parent prune sırasında tag'ı korar */
  onAcceptFlowStart?: (tagId: string) => void;
  onAcceptFlowEnd?: (tagId: string) => void;
  /** 409 veya teklif artık yok — parent listeden düşürsün */
  onOfferUnavailable?: (info: { tagId: string; requestId?: string }) => void;
}

function isDriverOfferNoLongerAvailable(res: Response, errMsg: string, rawText: string): boolean {
  if (res.status === 409) return true;
  const hay = `${errMsg}\n${rawText || ''}`.toLowerCase();
  return (
    hay.includes('artık müsait') ||
    hay.includes('başka sürücü') ||
    hay.includes('eşleştirilemez')
  );
}

// Yolcu Request Kartı Bileşeni - MARTI TAG MODELİ
function RequestCard({ 
  request, 
  driverLocation,
  driverId,
  playTapSound,
  onDismiss,
  onDriverAcceptMatch,
  onAcceptFlowStart,
  onAcceptFlowEnd,
  onOfferUnavailable,
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
  onAcceptFlowStart?: (tagId: string) => void;
  onAcceptFlowEnd?: (tagId: string) => void;
  onOfferUnavailable?: (info: { tagId: string; requestId?: string }) => void;
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
  const passengerRatingRaw = Number(
    (request as { passenger_rating?: unknown; rating?: unknown }).passenger_rating ??
      (request as { passenger_rating?: unknown; rating?: unknown }).rating,
  );
  const passengerRatingText =
    Number.isFinite(passengerRatingRaw) && passengerRatingRaw > 0
      ? passengerRatingRaw.toFixed(1)
      : '—';
  const rideDurationText = tripRoadShowFailedUi && tripDurationMinNumber == null
    ? '—'
    : tripDurationMinNumber != null
      ? `${tripDurationMinNumber} dk`
      : '—';
  const routeDistanceText = tripRoadShowLoading
    ? '—'
    : tripRoadShowFailedUi
      ? '—'
      : `${tripDistanceKmText} km`;

  return (
    <Animated.View
      style={[styles.reqCardWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.lg} style={styles.reqCard}>
        <View style={styles.reqHeaderRow}>
          <View style={styles.reqPriceBlock}>
            <PremiumText variant="caption" muted style={styles.reqRevenueLabel}>
              Teklif
            </PremiumText>
            <PremiumText variant="title" style={styles.reqPriceText}>
              {request.offered_price || 0} ₺
            </PremiumText>
          </View>
          <View style={styles.reqSecondLine}>
            <View style={styles.reqPassengerChip}>
              <Ionicons name="person-circle-outline" size={13} color="rgba(148,163,184,0.92)" />
              <PremiumText variant="caption" style={styles.reqPassengerName} numberOfLines={1}>
                {request.passenger_name?.split(' ')[0] || 'Yolcu'}
              </PremiumText>
            </View>
            {passengerRatingText !== '—' ? (
              <View style={styles.reqRatingChip}>
                <Ionicons name="star" size={11} color="#FACC15" />
                <PremiumText variant="caption" style={styles.reqRatingText}>
                  {passengerRatingText}
                </PremiumText>
              </View>
            ) : null}
            {request.passenger_payment_method === 'card' ? (
              <View style={[styles.reqPaymentPill, styles.reqPaymentPillCard]}>
                <PremiumText variant="caption" style={styles.reqPaymentPillText}>
                  Kart
                </PremiumText>
              </View>
            ) : request.passenger_payment_method === 'cash' ? (
              <View style={[styles.reqPaymentPill, styles.reqPaymentPillCash]}>
                <PremiumText variant="caption" style={styles.reqPaymentPillText}>
                  Nakit
                </PremiumText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.reqMetaRail}>
          <View style={styles.reqMetaCellCompact}>
            <PremiumText variant="caption" muted style={styles.reqMetaLabel}>
              Alış
            </PremiumText>
            <PremiumText variant="caption" style={styles.reqMetaValue}>
              {distanceToPassenger} km
            </PremiumText>
          </View>
          <View style={styles.reqMetaDivider} />
          <View style={styles.reqMetaCellCompact}>
            <PremiumText variant="caption" muted style={styles.reqMetaLabel}>
              Yolcuya
            </PremiumText>
            <PremiumText variant="caption" style={styles.reqMetaValue}>
              {typeof timeToPassengerDisplay === 'number'
                ? `${timeToPassengerDisplay} dk`
                : '—'}
            </PremiumText>
          </View>
          <View style={styles.reqMetaDivider} />
          <View style={styles.reqMetaCellCompact}>
            <PremiumText variant="caption" muted style={styles.reqMetaLabel}>
              Rota
            </PremiumText>
            {tripRoadShowLoading ? (
              <TripRouteCalculatingInline compact />
            ) : (
              <PremiumText variant="caption" style={styles.reqMetaValue}>
                {routeDistanceText}
              </PremiumText>
            )}
          </View>
          <View style={styles.reqMetaDivider} />
          <View style={styles.reqMetaCellCompact}>
            <PremiumText variant="caption" muted style={styles.reqMetaLabel}>
              Süre
            </PremiumText>
            <PremiumText variant="caption" style={styles.reqMetaValue}>
              {rideDurationText}
            </PremiumText>
          </View>
        </View>

        <View style={styles.reqRouteBlock}>
          <View style={styles.reqRouteLine}>
            <View style={[styles.reqDot, styles.reqDotPickup]} />
            <PremiumText variant="caption" style={styles.reqRouteText} numberOfLines={1}>
              {pickupLineFromRequest(request)}
            </PremiumText>
          </View>
          <View style={styles.reqRouteLine}>
            <View style={[styles.reqDot, styles.reqDotDropoff]} />
            <PremiumText variant="caption" style={styles.reqRouteText} numberOfLines={1}>
              {dropoffLineFromRequest(request)}
            </PremiumText>
          </View>
        </View>

        <View style={styles.reqActionsRow}>
          <TouchableOpacity
            style={styles.reqDismissBtn}
            onPress={onDismiss}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Geç"
          >
            <PremiumText variant="caption" muted style={styles.reqDismissText}>
              Geç
            </PremiumText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reqAcceptBtn, accepting && styles.acceptButtonDisabled]}
            onPress={async () => {
              if (accepting || globalAcceptFrozen) return;

              const tagIdForAccept = String(request.tag_id || request.id || '').trim();
              const requestIdForCb = String(request.request_id || request.id || '').trim();
              const userId = String(driverId || '').trim();

              if (!tagIdForAccept || !userId) {
                appAlert(
                  'Bilgi eksik',
                  'Teklif kabul edilemedi. Kısa bir süre sonra tekrar deneyin.',
                  [{ text: 'Tamam', style: 'default' }],
                  { variant: 'info' },
                );
                return;
              }

              setGlobalAcceptFrozen(true);
              setAccepting(true);
              onAcceptFlowStart?.(tagIdForAccept);
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
                      : 'Teklif kabul edilemedi. Kısa bir süre sonra tekrar deneyin.';
                }
                const taken = isDriverOfferNoLongerAvailable(res, errMsg, rawText);
                if (taken) {
                  onOfferUnavailable?.({
                    tagId: tagIdForAccept,
                    requestId: requestIdForCb || undefined,
                  });
                  appAlert(
                    'Eşleşme olmadı',
                    'Bu teklif başka bir sürücü tarafından alındı.',
                    [{ text: 'Tamam', style: 'default' }],
                    { variant: 'warning' },
                  );
                } else {
                  appAlert(
                    'Eşleşme olmadı',
                    errMsg,
                    [{ text: 'Tamam', style: 'default' }],
                    { variant: 'warning' },
                  );
                }
              } catch (e) {
                console.error('[driver/accept-offer] fetch', e);
                appAlert(
                  'Bağlantı kurulamadı',
                  'Kısa bir süre sonra tekrar deneyin.',
                  [{ text: 'Tamam', style: 'default' }],
                  { variant: 'info' },
                );
              } finally {
                setAccepting(false);
                setGlobalAcceptFrozen(false);
                onAcceptFlowEnd?.(tagIdForAccept);
              }
            }}
              disabled={accepting || globalAcceptFrozen}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Kabul et"
            >
              {accepting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <PremiumText variant="step" style={styles.reqAcceptBtnText}>
                  Kabul et
                </PremiumText>
              )}
            </TouchableOpacity>
        </View>
      </GlassSurface>
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
  onAcceptFlowStart,
  onAcceptFlowEnd,
  onOfferUnavailable,
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
  const [mapPinsLoadError, setMapPinsLoadError] = useState<string | null>(null);
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

  /** Collapsed: yalnızca mini HUD bar; MapView yalnızca expanded iken mount */
  const showMapHost = mapExpanded;

  /** Genişletilmiş harita yüksekliği */
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
      setMapPinsLoadError(null);
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
        if (cancelled) return;
        if (!j?.success) {
          console.warn('[driver_map] nearby-passengers-map not success', j);
          setMapPinsLoadError('Harita güncellenemedi. Kısa bir süre sonra tekrar deneyin.');
          return;
        }
        setMapPinsLoadError(null);
        setMapSeekingPins(Array.isArray(j.seeking) ? j.seeking : []);
        setMapLightPins(Array.isArray(j.nearby_app_users) ? j.nearby_app_users : []);
        setMapCityGrid(Array.isArray(j.city_grid) ? j.city_grid : []);
        setMapDriverCity(typeof j.driver_city === 'string' ? j.driver_city.trim() : '');
        setMapHud({
          seeking: Number(j.seeking_count) || 0,
          nearby: Number(j.nearby_light_count) || 0,
          radius: Math.round(Number(j.radius_km) || 20),
        });
      } catch (e) {
        if (cancelled) return;
        console.warn('[driver_map] nearby-passengers-map fetch failed', e);
        setMapPinsLoadError('Harita güncellenemedi. Kısa bir süre sonra tekrar deneyin.');
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
    if (!mapExpanded || !mapReady || !mapRef.current || !driverLocation) return;

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
  }, [mapExpanded, mapReady, driverLocation, mapSeekingPins, mapLightPins, mapHud.radius]);

  // Web fallback veya harita yoksa
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.mapFallback}>
          <Ionicons name="map" size={40} color={PREMIUM_AUTH_CYAN} />
          <PremiumText variant="caption" muted style={styles.mapFallbackText}>
            Talep {mapHud.seeking} · {mapHud.radius} km
          </PremiumText>
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
        customMapStyle={DRIVER_OFFER_DARK_MAP_STYLE}
        scrollEnabled={mapExpanded}
        zoomEnabled={mapExpanded}
        rotateEnabled={false}
        pitchEnabled={false}
        showsTraffic={mapExpanded}
      >
        {driverLocation && Circle ? (
          <>
            <Circle
              center={driverLocation}
              radius={(mapHud.radius || 20) * 1000}
              strokeColor="rgba(34,211,238,0.45)"
              fillColor="rgba(34,211,238,0.06)"
              strokeWidth={2}
            />
            <Circle
              center={driverLocation}
              radius={(mapHud.radius || 20) * 500}
              strokeColor="rgba(34,211,238,0.22)"
              fillColor="rgba(34,211,238,0.04)"
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
              description={listed ? 'Listede — kabul edebilirsin' : 'Yolcu talebi'}
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

  const driverMapRatingText =
    Number.isFinite(Number(driverRating)) && Number(driverRating) > 0
      ? Number(driverRating).toFixed(1)
      : null;

  const body = (
    <View style={styles.driverOfferBody}>
      {/* Dispatch deck — dispatch-first; harita altta */}
      <View style={styles.listContainer}>
        <LinearGradient
          colors={[...LDS_GRADIENT_COCKPIT_BASE]}
          locations={[...LDS_GRADIENT_COCKPIT_BASE_LOCATIONS]}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={[...LDS_GRADIENT_COCKPIT_TOP_HAZE]}
          locations={[...LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFillObject}
        />
        {isMotor ? (
          <LinearGradient
            colors={['rgba(22, 101, 52, 0.12)', 'rgba(8,17,31,0.38)']}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        ) : null}
        <GlassSurface
          variant="panel"
          style={[styles.dispatchDeck, mapExpanded && styles.dispatchDeckMapExpanded]}
          borderRadius={LDS_RADIUS.xl}
        >
          <View style={[styles.listHeader, mapExpanded && styles.listHeaderMapExpanded]}>
            <View style={styles.listHeaderCompactRow}>
              <View style={styles.listHeaderLiveDotWrap} pointerEvents="none">
                <View style={styles.listHeaderAccentDotOuter} />
                <View style={styles.listHeaderAccentDot} />
              </View>
              <PremiumText variant="step" style={styles.listTitleCompact} numberOfLines={1}>
                Yakın talepler · {mapHud.radius} km
              </PremiumText>
              {visibleRequests.length > 0 ? (
                <View style={styles.listHeaderCountPill}>
                  <PremiumText variant="caption" style={styles.listHeaderCountText}>
                    {visibleRequests.length}
                  </PremiumText>
                </View>
              ) : null}
            </View>
          </View>

        {visibleRequests.length === 0 ? (
          <View style={[styles.emptyState, mapExpanded && styles.emptyStateMapExpanded]}>
            <GlassSurface
              variant="plain"
              style={[styles.emptyStateCard, mapExpanded && styles.emptyStateCardMapExpanded]}
              borderRadius={LDS_RADIUS.lg}
            >
              <View style={styles.emptyBrandStrip}>
                <View style={styles.emptyBrandDotWrap} pointerEvents="none">
                  <View style={styles.emptyBrandDotOuter} />
                  <View style={styles.emptyBrandDot} />
                </View>
                <PremiumText variant="caption" style={styles.emptyBrandLabel}>
                  LeylekTAG · Saha operasyonu
                </PremiumText>
              </View>

              <View
                style={[
                  styles.emptyInstrumentOrb,
                  mapExpanded && styles.emptyInstrumentOrbMapExpanded,
                ]}
              >
                <View
                  style={[
                    styles.emptyOrbRing,
                    styles.emptyOrbRingOuter,
                    mapExpanded && styles.emptyOrbRingOuterMapExpanded,
                    isMotor && styles.emptyOrbRingOuterMotor,
                  ]}
                />
                <View
                  style={[
                    styles.emptyOrbRing,
                    styles.emptyOrbRingMid,
                    mapExpanded && styles.emptyOrbRingMidMapExpanded,
                    isMotor && styles.emptyOrbRingMidMotor,
                  ]}
                />
                <View style={[styles.emptyOrbCore, mapExpanded && styles.emptyOrbCoreMapExpanded]}>
                  <Ionicons
                    name="radio-outline"
                    size={mapExpanded ? 16 : 18}
                    color={isMotor ? 'rgba(134,239,172,0.92)' : 'rgba(34,211,238,0.9)'}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.emptyStatusPill,
                  mapExpanded && styles.emptyStatusPillMapExpanded,
                  isMotor && styles.emptyStatusPillMotor,
                ]}
              >
                <View style={styles.emptyStatusLiveDot} />
                <PremiumText variant="step" style={styles.emptyStatusText}>
                  Saha taraması aktif
                </PremiumText>
              </View>

              <PremiumText
                variant="title"
                style={[styles.emptyTitle, mapExpanded && styles.emptyTitleMapExpanded]}
              >
                Teklif bekleniyor
              </PremiumText>
              <PremiumText
                variant="caption"
                muted
                style={[styles.emptySubtitle, mapExpanded && styles.emptySubtitleMapExpanded]}
              >
                {mapHud.radius} km saha çevresinde tarama sürüyor.
              </PremiumText>

              <View style={styles.emptyChipRow}>
                <View style={styles.emptyChip}>
                  <Ionicons name="pulse-outline" size={11} color={PREMIUM_AUTH_CYAN} />
                  <PremiumText variant="caption" style={styles.emptyChipText}>
                    Canlı tarama
                  </PremiumText>
                </View>
                <View style={styles.emptyChip}>
                  <Ionicons name="shield-checkmark-outline" size={11} color={PREMIUM_AUTH_CYAN} />
                  <PremiumText variant="caption" style={styles.emptyChipText}>
                    LeylekTAG saha
                  </PremiumText>
                </View>
              </View>
            </GlassSurface>
          </View>
        ) : (
          <FlatList
            data={visibleRequests.slice(0, 20)}
            keyExtractor={(item, index) => item.id || item.request_id || index.toString()}
            renderItem={({ item, index }) => (
              <RequestCard
                request={item}
                driverLocation={driverLocation}
                driverId={driverId}
                playTapSound={playTapSound}
                onDismiss={() => onDismissRequest(item.id)}
                onDriverAcceptMatch={onDriverAcceptMatch}
                onAcceptFlowStart={onAcceptFlowStart}
                onAcceptFlowEnd={onAcceptFlowEnd}
                onOfferUnavailable={onOfferUnavailable}
                index={index}
                globalAcceptFrozen={globalAcceptFrozen}
                setGlobalAcceptFrozen={setGlobalAcceptFrozen}
              />
            )}
            contentContainerStyle={[styles.listContent, mapExpanded && styles.listContentMapExpanded]}
            showsVerticalScrollIndicator={false}
          />
        )}
        </GlassSurface>
      </View>

      <View
        style={[
          styles.mapCardShell,
          mapExpanded && styles.mapCardShellExpandedLayer,
        ]}
      >
        <GlassSurface
          variant={mapExpanded ? 'plain' : 'panel'}
          borderRadius={mapExpanded ? LDS_RADIUS.lg : LDS_RADIUS.xl}
          style={[
            styles.mapChromeShell,
            mapExpanded ? styles.mapChromeShellExpanded : styles.mapChromeShellCollapsed,
          ]}
        >
          <TouchableOpacity
            style={[styles.mapMiniHud, mapExpanded && styles.mapMiniHudExpanded]}
            onPress={() => setMapExpanded((v) => !v)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={mapExpanded ? 'Saha haritasını gizle' : 'Saha haritasını göster'}
          >
            <View style={styles.mapMiniHudLeft}>
              <View
                style={[
                  styles.mapMiniHudIconWrap,
                  mapExpanded && styles.mapMiniHudIconWrapExpanded,
                  !mapExpanded && styles.mapMiniHudIconWrapCompact,
                ]}
              >
                <Ionicons
                  name="satellite-outline"
                  size={mapExpanded ? 16 : 15}
                  color={PREMIUM_AUTH_CYAN}
                />
              </View>
              <View style={styles.mapMiniHudTitleCol}>
                <PremiumText
                  variant="caption"
                  style={[
                    styles.mapMiniHudPhase,
                    mapExpanded && styles.mapMiniHudPhaseExpanded,
                    !mapExpanded && styles.mapMiniHudPhaseCompact,
                  ]}
                  numberOfLines={1}
                >
                  {mapExpanded
                    ? 'Saha haritası'
                    : `Saha haritası · ${mapHud.seeking} talep · ${mapHud.radius} km`}
                </PremiumText>
              </View>
            </View>

            {mapExpanded ? (
              <View style={styles.mapMiniHudMetrics}>
                <View style={[styles.mapMiniHudPill, styles.mapMiniHudPillExpanded]}>
                  <PremiumText variant="step" style={styles.mapMiniHudPillValue}>
                    {mapHud.seeking}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.mapMiniHudPillLabel}>
                    Talep
                  </PremiumText>
                </View>
                <View style={[styles.mapMiniHudPill, styles.mapMiniHudPillExpanded]}>
                  <PremiumText variant="step" style={styles.mapMiniHudPillValue}>
                    {mapHud.radius}
                  </PremiumText>
                  <PremiumText variant="caption" muted style={styles.mapMiniHudPillLabel}>
                    km
                  </PremiumText>
                </View>
              </View>
            ) : null}

            <View style={styles.mapMiniHudChevronWrap}>
              <Ionicons
                name={mapExpanded ? 'chevron-down' : 'chevron-up'}
                size={mapExpanded ? 15 : 16}
                color="rgba(34,211,238,0.88)"
              />
            </View>
          </TouchableOpacity>
        </GlassSurface>

        {showMapHost ? (
          <View
            style={[styles.mapExpandedMapHost, { height: mapExpandedHeight }]}
            pointerEvents="box-none"
          >
            <View style={[styles.mapViewportFixed, styles.mapContainerSolidExpanded]}>
              {renderMap()}
              <View style={styles.mapDimOverlay} pointerEvents="none" />
              {!driverLocation || !mapReady ? (
                <View style={styles.mapLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="small" color={PREMIUM_AUTH_CYAN} />
                  <PremiumText variant="caption" muted style={styles.mapLoadingOverlayText}>
                    {!driverLocation ? 'Konum hazırlanıyor' : 'Harita hazırlanıyor'}
                  </PremiumText>
                </View>
              ) : null}
              {mapPinsLoadError ? (
                <View style={styles.mapPinsErrorBanner} pointerEvents="none">
                  <GlassSurface variant="plain" borderRadius={LDS_RADIUS.sm} style={styles.mapPinsErrorGlass}>
                    <PremiumText variant="caption" muted style={styles.mapPinsErrorText}>
                      {mapPinsLoadError}
                    </PremiumText>
                  </GlassSurface>
                </View>
              ) : null}
              <View style={styles.mapTopOverlay} pointerEvents="box-none">
                  <TouchableOpacity onPress={onBack} style={styles.mapBackFab} accessibilityRole="button">
                    <Ionicons name="chevron-back" size={24} color="#F1F5F9" />
                  </TouchableOpacity>
                  <View style={styles.mapNameCardWrap} pointerEvents="none">
                    <View style={styles.mapNameCard}>
                      <PremiumText variant="step" style={styles.mapNameText}>
                        {driverName?.split(' ')[0] || 'Sürücü'}
                      </PremiumText>
                      <View style={styles.mapRatingRow}>
                        {driverMapRatingText ? (
                          <>
                            <Ionicons name="star" size={14} color="#FBBF24" />
                            <PremiumText variant="caption" style={styles.mapRatingText}>
                              {driverMapRatingText}
                            </PremiumText>
                          </>
                        ) : (
                          <PremiumText variant="caption" muted style={styles.mapRatingEmpty}>
                            Henüz değerlendirme yok
                          </PremiumText>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.mapTopSpacer} />
                </View>
              <View style={styles.mapHud} pointerEvents="none">
                <Ionicons name="radio-outline" size={15} color="#94A3B8" style={styles.mapHudRadioIcon} />
                <PremiumText variant="caption" muted style={styles.mapHudText}>
                  Talep {mapHud.seeking} · {mapHud.radius} km
                </PremiumText>
              </View>
            </View>
          </View>
        ) : null}
      </View>
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
    backgroundColor: 'transparent',
  },
  /** Sütun: dispatch üstte (flex), harita altta (sabit) */
  driverOfferBody: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    flexDirection: 'column',
    backgroundColor: 'transparent',
  },
  mapCardShellExpandedLayer: {
    zIndex: 10,
    elevation: 11,
  },

  mapCardShell: {
    flexShrink: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: SCREEN_WIDTH,
    paddingHorizontal: LDS_SPACING.sm,
  },
  /** Sabit yükseklikli canlı harita — üst katman (zIndex); içerik `mapViewportFixed`. __DEV__: kırmızı = host alanı doğrulama */
  mapExpandedMapHost: {
    width: '100%',
    zIndex: 10,
    position: 'relative',
    backgroundColor: typeof __DEV__ !== 'undefined' && __DEV__ ? '#FF0000' : 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#01060e',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.38,
        shadowRadius: 22,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  mapExpandedMapHostCollapsed: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.sm,
    backgroundColor: 'rgba(8,17,31,0.72)',
  },
  mapLoadingOverlayText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  mapPinsErrorBanner: {
    position: 'absolute',
    left: LDS_SPACING.sm,
    right: LDS_SPACING.sm,
    bottom: LDS_SPACING.sm,
    zIndex: 5,
  },
  mapPinsErrorGlass: {
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    backgroundColor: 'rgba(8,17,31,0.88)',
    ...LDS_ELEVATION.chip,
  },
  mapPinsErrorText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  mapViewportFixed: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: LDS_RADIUS.lg,
    backgroundColor: PREMIUM_NAVY_DEEP,
    position: 'relative',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanelTop,
    ...LDS_ELEVATION.panel,
  },
  mapContainerSolidExpanded: {
    borderColor: 'rgba(34,211,238,0.26)',
    ...Platform.select({
      ios: {
        shadowOpacity: 0.48,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  mapChromeShell: {
    marginTop: 0,
    marginBottom: LDS_SPACING.xxs,
    overflow: 'hidden',
  },
  mapChromeShellCollapsed: {
    marginHorizontal: LDS_SPACING.xxs,
    ...LDS_ELEVATION.panel,
  },
  mapChromeShellExpanded: {
    marginBottom: LDS_SPACING.xs,
    marginHorizontal: 0,
  },
  mapMiniHud: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.sm,
    backgroundColor: 'transparent',
  },
  mapMiniHudExpanded: {
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    gap: LDS_SPACING.xs,
  },
  mapMiniHudLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
  },
  mapMiniHudIconWrap: {
    width: 38,
    height: 38,
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: 'rgba(34,211,238,0.18)',
    ...LDS_ELEVATION.chip,
  },
  mapMiniHudIconWrapExpanded: {
    width: 32,
    height: 32,
    borderRadius: LDS_RADIUS.sm,
  },
  mapMiniHudIconWrapCompact: {
    width: 30,
    height: 30,
    borderRadius: LDS_RADIUS.sm,
  },
  mapMiniHudTitleCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  mapMiniHudPhase: {
    letterSpacing: 0.06,
    color: PREMIUM_AUTH_CYAN,
    opacity: 0.86,
    fontWeight: '600',
  },
  mapMiniHudPhaseExpanded: {
    fontSize: 11,
    letterSpacing: 0.05,
  },
  mapMiniHudPhaseCompact: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.08,
    opacity: 0.92,
  },
  mapMiniHudMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    flexShrink: 0,
  },
  mapMiniHudPill: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(8,17,31,0.52)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    gap: 1,
  },
  mapMiniHudPillExpanded: {
    minWidth: 40,
    paddingVertical: 2,
    paddingHorizontal: LDS_SPACING.xs,
  },
  mapMiniHudPillValue: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
    color: PREMIUM_TEXT_SOFT,
  },
  mapMiniHudPillLabel: {
    fontSize: 9,
    letterSpacing: 0.04,
    fontWeight: '600',
  },
  mapMiniHudChevronWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mapDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,17,31,0.1)',
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
    backgroundColor: 'rgba(8,17,31,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34,211,238,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#01050c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {},
    }),
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
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30,58,95,0.65)',
    borderTopColor: 'rgba(34,211,238,0.12)',
    maxWidth: SCREEN_WIDTH * 0.58,
    ...Platform.select({
      ios: {
        shadowColor: '#01050c',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  mapNameText: {
    fontSize: 16,
    fontWeight: '900',
    color: PREMIUM_TEXT_SOFT,
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
    color: 'rgba(251,211,141,0.95)',
    fontVariant: ['tabular-nums'],
  },
  mapRatingEmpty: {
    fontWeight: '600',
    fontSize: 12,
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
    backgroundColor: 'rgba(8,17,31,0.88)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    maxWidth: '92%',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30,58,95,0.65)',
    borderTopColor: 'rgba(34,211,238,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#01050c',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {},
    }),
    zIndex: 6,
  },
  mapHudRadioIcon: {
    marginRight: 8,
  },
  mapHudText: {
    fontSize: 12,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    flexShrink: 1,
    letterSpacing: 0.08,
    fontVariant: ['tabular-nums'],
  },
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  mapFallbackText: {
    fontSize: 14,
    fontWeight: '700',
    color: PREMIUM_TEXT_MUTED,
    marginTop: 10,
    letterSpacing: 0.1,
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
    backgroundColor: 'rgba(16, 26, 43, 0.92)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30, 58, 95, 0.75)',
    borderTopColor: 'rgba(34, 211, 238, 0.2)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  requestCountTextBig: {
    fontSize: 22,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
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
    backgroundColor: 'rgba(16, 26, 43, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(30, 58, 95, 0.65)',
    shadowColor: '#010818',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 5,
  },
  requestCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
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
    borderColor: 'rgba(34,211,238,0.55)',
    backgroundColor: 'transparent',
  },
  driverPulseRingOuter: {
    borderColor: 'rgba(34,211,238,0.28)',
    borderWidth: 1.5,
  },
  driverMarker: {
    backgroundColor: '#0369a1',
    padding: 8,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'rgba(243,248,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    }),
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
    borderColor: 'rgba(243, 248, 255, 0.85)',
  },
  passengerMarkerSeeking: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EA580C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(16, 26, 43, 0.95)',
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  passengerMarkerSeekingListed: {
    backgroundColor: '#059669',
    borderColor: 'rgba(16, 26, 43, 0.92)',
    shadowColor: '#064e3b',
  },
  passengerMarkerLight: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 26, 43, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.25)',
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
    backgroundColor: PREMIUM_AUTH_CYAN,
  },

  // List / dispatch deck
  listContainer: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
    elevation: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  dispatchDeck: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: LDS_SPACING.sm,
    marginTop: 0,
    marginBottom: LDS_SPACING.xxs,
    overflow: 'hidden',
  },
  dispatchDeckMapExpanded: {
    marginTop: 0,
  },
  listHeader: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    borderBottomWidth: LDS_BORDER_WIDTH.hairline,
    borderBottomColor: LDS_BORDER_COLOR.cockpitPanel,
    backgroundColor: 'transparent',
  },
  listHeaderCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    minHeight: 32,
  },
  listHeaderCountPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: 'rgba(34,211,238,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listHeaderCountText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: PREMIUM_AUTH_CYAN,
    fontSize: 11,
  },
  listTitleCompact: {
    flex: 1,
    minWidth: 0,
    letterSpacing: -0.12,
    fontWeight: '700',
  },
  listHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  listHeaderLiveDotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listHeaderAccentDotOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(34,211,238,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34,211,238,0.22)',
  },
  listHeaderAccentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PREMIUM_AUTH_CYAN,
    opacity: 0.95,
  },
  listHeaderTitleCol: {
    flex: 1,
    minWidth: 0,
    gap: LDS_SPACING.xxs,
  },
  listPhaseLabel: {
    letterSpacing: 0.06,
    color: PREMIUM_AUTH_CYAN,
    opacity: 0.82,
    fontWeight: '600',
  },
  listTitle: {
    letterSpacing: -0.32,
  },
  listSectionSubtitle: {
    lineHeight: 15,
    opacity: 0.92,
  },
  listHeaderMapExpanded: {
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
  },
  listContent: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.xxs,
    paddingBottom: LDS_SPACING.sm,
  },
  listContentMapExpanded: {
    paddingTop: LDS_SPACING.xxs,
    paddingBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
  },
  emptyStateMapExpanded: {
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    justifyContent: 'flex-start',
    paddingTop: LDS_SPACING.xs,
  },
  emptyStateCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    paddingTop: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.md,
    backgroundColor: 'transparent',
  },
  emptyStateCardMapExpanded: {
    paddingTop: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.md,
    maxWidth: 380,
  },
  emptyBrandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xs,
    alignSelf: 'stretch',
    marginBottom: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.xxs,
    borderBottomWidth: LDS_BORDER_WIDTH.hairline,
    borderBottomColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  emptyBrandDotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBrandDotOuter: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34,211,238,0.2)',
  },
  emptyBrandDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: PREMIUM_AUTH_CYAN,
    opacity: 0.92,
  },
  emptyBrandLabel: {
    letterSpacing: 0.05,
    color: PREMIUM_AUTH_CYAN,
    opacity: 0.82,
    fontSize: 10,
    fontWeight: '600',
  },
  emptyInstrumentOrb: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: LDS_SPACING.xxs,
  },
  emptyInstrumentOrbMapExpanded: {
    width: 48,
    height: 48,
    marginBottom: LDS_SPACING.xxs,
  },
  emptyOrbRingOuterMotor: {
    borderColor: 'rgba(134,239,172,0.16)',
    backgroundColor: 'rgba(134,239,172,0.04)',
  },
  emptyOrbRingMidMotor: {
    borderColor: 'rgba(134,239,172,0.24)',
  },
  emptyOrbRingOuterMapExpanded: {
    width: 48,
    height: 48,
  },
  emptyOrbRingMidMapExpanded: {
    width: 36,
    height: 36,
  },
  emptyOrbCoreMapExpanded: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  emptyOrbRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: LDS_BORDER_WIDTH.hairline,
  },
  emptyOrbRingOuter: {
    width: 62,
    height: 62,
    borderColor: 'rgba(34,211,238,0.14)',
    backgroundColor: 'rgba(34,211,238,0.03)',
  },
  emptyOrbRingMid: {
    width: 46,
    height: 46,
    borderColor: 'rgba(34,211,238,0.22)',
    backgroundColor: 'rgba(8,17,31,0.35)',
  },
  emptyOrbCore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,17,31,0.62)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: 'rgba(34,211,238,0.18)',
    ...LDS_ELEVATION.chip,
  },
  emptyStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(34,211,238,0.28)',
    borderTopColor: 'rgba(34,211,238,0.42)',
    marginBottom: LDS_SPACING.xs,
  },
  emptyStatusPillMapExpanded: {
    paddingVertical: LDS_SPACING.xxs + 1,
    paddingHorizontal: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.xs,
  },
  emptyStatusPillMotor: {
    backgroundColor: 'rgba(134,239,172,0.08)',
    borderColor: 'rgba(134,239,172,0.24)',
    borderTopColor: 'rgba(134,239,172,0.34)',
  },
  emptyStatusLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PREMIUM_AUTH_CYAN,
    opacity: 0.95,
  },
  emptyStatusText: {
    letterSpacing: 0.18,
    color: 'rgba(186,235,245,0.95)',
    fontWeight: '800',
  },
  emptyTitle: {
    marginTop: LDS_SPACING.xxs,
    textAlign: 'center',
    letterSpacing: -0.2,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginTop: LDS_SPACING.xs,
    lineHeight: 17,
    paddingHorizontal: LDS_SPACING.xs,
    maxWidth: 320,
  },
  emptyChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
    marginTop: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    ...LDS_ELEVATION.chip,
  },
  emptyChipText: {
    fontWeight: '700',
    color: 'rgba(186,218,226,0.9)',
    letterSpacing: 0.12,
    fontSize: 10,
  },
  emptyTitleMapExpanded: {
    fontSize: 17,
    marginTop: LDS_SPACING.xs,
  },
  emptySubtitleMapExpanded: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: LDS_SPACING.xs,
  },

  // Dispatch talep kartı — LHIS cockpit card
  reqCardWrap: {
    marginTop: LDS_SPACING.xxs,
  },
  reqCard: {
    paddingHorizontal: LDS_SPACING.sm,
    paddingTop: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.sm,
    minHeight: 148,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: LDS_SPACING.sm,
    marginBottom: LDS_SPACING.xs,
  },
  reqPriceBlock: {
    gap: 1,
    flexShrink: 0,
  },
  reqRevenueLabel: {
    letterSpacing: 0.05,
  },
  reqPriceText: {
    fontSize: 23,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.35,
    fontVariant: ['tabular-nums'],
    color: 'rgba(94,229,209,0.95)',
  },
  reqMetaRail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(8,17,31,0.42)',
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    paddingVertical: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.xs,
  },
  reqMetaCellCompact: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 2,
  },
  reqMetaLabel: {
    letterSpacing: 0.08,
    fontSize: 10,
  },
  reqMetaValue: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
  reqMetaDivider: {
    width: LDS_BORDER_WIDTH.hairline,
    alignSelf: 'stretch',
    backgroundColor: LDS_BORDER_COLOR.cockpitPanel,
    marginHorizontal: LDS_SPACING.xxs,
  },
  reqSecondLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flex: 1,
    minWidth: 0,
  },
  reqPassengerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  reqPassengerName: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    flexShrink: 1,
  },
  reqRatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(251,211,141,0.08)',
    paddingHorizontal: LDS_SPACING.xs,
    paddingVertical: 2,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: 'rgba(251,211,141,0.18)',
  },
  reqRatingText: {
    fontWeight: '700',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  reqPaymentPill: {
    paddingHorizontal: LDS_SPACING.xs,
    paddingVertical: 2,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
  },
  reqPaymentPillCard: {
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  reqPaymentPillCash: {
    backgroundColor: 'rgba(22, 163, 74, 0.14)',
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  reqPaymentPillText: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.1,
    fontSize: 10,
  },
  reqRouteBlock: {
    marginTop: LDS_SPACING.xxs,
    gap: 3,
    paddingTop: LDS_SPACING.xxs,
    borderTopWidth: LDS_BORDER_WIDTH.hairline,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  reqRouteLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.xs,
  },
  reqDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  reqDotPickup: {
    backgroundColor: '#22C55E',
  },
  reqDotDropoff: {
    backgroundColor: '#EF4444',
  },
  reqRouteText: {
    flex: 1,
    minWidth: 0,
    color: PREMIUM_TEXT_SOFT,
    opacity: 0.92,
    lineHeight: 16,
  },
  reqActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LDS_SPACING.xs,
    marginTop: LDS_SPACING.sm,
  },
  reqDismissBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: 'rgba(8,17,31,0.35)',
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  reqDismissText: {
    fontWeight: '600',
    letterSpacing: 0.12,
  },
  reqAcceptBtn: {
    flex: 2,
    minHeight: 48,
    backgroundColor: 'rgba(8,145,178,0.88)',
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(34,211,238,0.38)',
    borderTopColor: 'rgba(34,211,238,0.55)',
    ...LDS_ELEVATION.chip,
  },
  acceptButtonDisabled: {
    backgroundColor: 'rgba(30, 50, 72, 0.85)',
    borderColor: 'rgba(30, 58, 95, 0.5)',
    borderTopColor: 'rgba(30, 58, 95, 0.5)',
  },
  reqAcceptBtnText: {
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  reqBottomMetaRow: {
    marginTop: LDS_SPACING.sm,
    borderTopWidth: LDS_BORDER_WIDTH.hairline,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanel,
    paddingTop: LDS_SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: LDS_SPACING.sm,
    backgroundColor: 'rgba(8,17,31,0.28)',
    borderRadius: LDS_RADIUS.sm,
    paddingHorizontal: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.xxs,
  },
  reqBottomMetaCell: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  reqBottomMetaDivider: {
    width: LDS_BORDER_WIDTH.hairline,
    height: 22,
    backgroundColor: LDS_BORDER_COLOR.cockpitPanel,
  },
  reqBottomMetaLabel: {
    fontSize: 10,
    letterSpacing: 0.04,
  },
  reqBottomMetaValue: {
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.05,
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
    backgroundColor: 'rgba(16, 26, 43, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 95, 0.65)',
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
    backgroundColor: 'rgba(30, 50, 72, 0.85)',
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
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  sentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 8,
  },
});
