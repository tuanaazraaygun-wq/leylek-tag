import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Pressable,
  Linking,
  Alert,
  Dimensions,
  Animated,
  Easing,
  Modal,
  Image,
  ImageBackground,
  InteractionManager,
  type TextStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { tapButtonHaptic } from '../utils/touchHaptics';
import { callCheck } from '../lib/callCheck';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { displayFirstName } from '../lib/displayName';
import { API_BASE_URL } from '../lib/backendConfig';
import {
  ROUTE_LOADING_MIN_VISIBLE_MS,
  ROUTE_LOADING_UI,
  ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
} from '../lib/routeLoadingUiConstants';
import type { PassengerGender } from '../lib/passengerFieldHelpers';
import {
  getDriverMarkerImage,
  getPassengerMarkerImage,
  getDriverNavMarkerAnchor,
  getDriverNavRotationOffsetDeg,
  MARKER_PIXEL,
} from '../lib/mapNavMarkers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import InRideSaferForceEndModal from './InRideSaferForceEndModal';
import { BOARDING_COMMS_CLOSED_USER_MSG } from '../lib/boardingCommsClosed';
import { appAlert } from '../contexts/AppAlertContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Immersive nav alt boşluğu (dp): Marker araç haritada; padding “araç alt bandı + güvenli alan” için kalibrasyon.
 */
const DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP = 112;

/**
 * Immersive nav: Google mapPadding.bottom — araç PNG yüksekliği + alt inset ile kamera merkezi/yol hizası.
 */
function driverNavImmersiveMapPaddingBottomPx(insetsBottom: number): number {
  const iconHalf = Math.max(MARKER_PIXEL.driverCar, MARKER_PIXEL.driverMotor) * 0.5;
  const raw =
    DRIVER_NAV_OVERLAY_ABOVE_BOTTOM_DP +
    iconHalf +
    Math.max(insetsBottom, 0) +
    10;
  return Math.round(Math.min(210, Math.max(96, raw)));
}

/** Android: `tracksViewChanges` kısa süre true — sürekli true iken özel PNG bazen çizilmez (bekleme ekranıyla aynı mantık). */
function TripMapMarkerImage({
  source,
  scale = 1,
  size = 40,
}: {
  source: number;
  scale?: number;
  /** NAV_MARKER_IMG / MARKER_PIXEL ile APK ile aynı ölçü */
  size?: number;
}) {
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        transform: scale !== 1 ? [{ scale }] : undefined,
      }}
    >
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

// Google Maps için değişkenler
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi');
  }
}

interface LiveMapViewProps {
  userLocation: { latitude: number; longitude: number } | null;
  otherLocation: { latitude: number; longitude: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  isDriver: boolean;
  userName?: string;
  otherUserName?: string;
  otherUserId?: string;
  userId?: string;  // 🆕 Kullanıcı ID
  tagId?: string;   // 🆕 Tag ID
  /** Sunucu tag.status — hedef yakınlığında otomatik tamamlama için (yalnız sürücü) */
  tagStatus?: string | null;
  /** Sunucu tag.started_at — yolculuk gerçekten başlamadan otomatik tamamlama yok */
  tagStartedAt?: string | null;
  price?: number;
  offeredPrice?: number;  // Teklif edilen fiyat
  routeInfo?: {
    /** Gösterim: yalnızca backend alanları (pickup_*, trip_*); OSRM km kullanılmaz */
    pickup_distance_km?: number | null;
    pickup_eta_min?: number | null;
    trip_distance_km?: number | null;
    trip_duration_min?: number | null;
    /** Eski socket alanları — tercihen kullanılmaz */
    distance_km?: number;
    duration_min?: number;
    meeting_distance_km?: number | null;
    meeting_duration_min?: number | null;
  } | null;
  // Yeni: Sürücü/Yolcu detay bilgileri
  otherUserDetails?: {
    rating?: number;
    totalTrips?: number;
    profilePhoto?: string;
    // Sürücü için ek bilgiler
    vehiclePhoto?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleYear?: string;
    vehicleColor?: string;
    plateNumber?: string;
  };
  onBlock?: () => void;
  onReport?: () => void;
  onCall?: (type: 'audio' | 'video') => void;
  onChat?: () => void;
  onComplete?: () => void;
  onRequestTripEnd?: () => void;
  onForceEnd?: () => void;
  /** Biniş / in_progress: önce şikayet; yalnızca kayıt başarılıysa zorla bitir (index sunar) */
  onInRideComplaintForceEnd?: (args: {
    reasonKey: string;
    details: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  onAutoComplete?: () => void;
  onShowEndTripModal?: () => void;
  onShowQRModal?: () => void;  // 🆕 QR Modal aç
  /** Sürücü haritasında: yolcu araç/motor tercihi (marker ve uyarı metinleri) */
  otherTripVehicleKind?: 'car' | 'motorcycle';
  /** Sürücü: yolcunun teklifte seçtiği ödeme */
  passengerPaymentMethod?: 'cash' | 'card';
  /** Sürücü uygulama-içi navigasyon açıkken üst bileşen GPS aralığını kısaltır */
  onNavigationModeChange?: (active: boolean) => void;
  /** Yolculuk: karşı taraftan güven isteği */
  onTrustRequest?: () => void;
  /** true iken Güven AL basılmaz (çift istek / oturum çakışması önlemi) */
  trustRequestDisabled?: boolean;
  trustRequestLabel?: string;
  /** Harita ekranından Leylek Zeka sohbeti (global widget ayrı kalır) */
  onOpenLeylekZekaSupport?: () => void;
  /** Karşı taraf marker ölçümü (index ile uyumlu; varsayılan 1) */
  peerMapPinScale?: number;
  selfGender?: PassengerGender | null;
  /** Sürücü haritasında yolcu cinsiyeti — marker ikonu */
  otherPassengerGender?: PassengerGender | null;
  /** Sürücü: `otherLocation` yolcu canlı GPS değil, tag alım (pickup) yedeğinden geliyorsa */
  otherLocationFromPickupFallback?: boolean;
  /** Biniş QR doğrulandı — yolcu pini gizlenir, üst metin güncellenir; matched iken GPS ile hedef fazına geçiş engellenir */
  boardingConfirmed?: boolean;
  /** Sürücü: navigasyon pickup → destination geçişi (biniş sonrası hedef fazı) — yolcuya bildirim tetiklemek için */
  onDriverEnteredDestinationNavigation?: () => void;
  /** Sürücü "Yolcuya Git" — doğrulamadan hemen önce (index’te DRIVER_NAV_COORDS vb.) */
  onDriverYolcuyaGitAttempt?: () => void;
  /**
   * Sürücü: origin/dest yedekleri (pickup, GPS alias) + YOLCUYA_GIT_VALIDATION alanı (activeTag).
   * Yalnız normal yolculuk; index’te userLocation / activeTag geçer.
   */
  driverYolcuyaGitCoordContext?: {
    driverLocation?: { latitude: number; longitude: number } | null;
    currentLocation?: { latitude: number; longitude: number } | null;
    activeTag?: Record<string, unknown> | null;
  } | null;
  /**
   * Leylek Teklif / Muhabbet yolculuk ekranı — LiveMapView modern kart+sheet (varsayılan kapalı).
   * Normal ride bu prop’u kullanmaz.
   */
  modernLeylekOfferUi?: boolean;
}

/**
 * Sunucu (tag / teklif) pickup→destination km/dk — fiyatlandırma ile aynı kaynak.
 * Eşleşme haritasında OSRM yalnız çizgi; bu alanlar doluysa üst panel km/dk buradan kalır.
 */
function readAuthoritativeTripKmMinFromRouteInfo(
  routeInfo: LiveMapViewProps['routeInfo'],
): { km: number; min: number } | null {
  if (!routeInfo) return null;
  const km = Number(routeInfo.trip_distance_km);
  const min = Number(routeInfo.trip_duration_min);
  if (!Number.isFinite(km) || km <= 0) return null;
  if (!Number.isFinite(min) || min <= 0) return null;
  return { km, min: Math.max(1, Math.round(min)) };
}

/** Buluşma leg’i — sunucu routeInfo pickup alanları (kuş uçuşu UI’da kullanılmaz). */
function readPickupKmMinFromRouteInfo(
  routeInfo: LiveMapViewProps['routeInfo'],
): { km: number; min: number } | null {
  if (!routeInfo) return null;
  const info = routeInfo as Record<string, unknown>;
  const km = Number(info.pickup_distance_km);
  const min = Number(info.pickup_eta_min);
  if (!Number.isFinite(km) || km <= 0) return null;
  if (!Number.isFinite(min) || min <= 0) return null;
  return { km, min: Math.max(1, Math.round(min)) };
}

/**
 * Sürücü buluşma çizgisi: backend `get_route_info` / `_emit_driver_on_the_way_route` aynı alanları
 * `routeInfo` (index’te `...(activeTag.route_info||{})` ile) üzerinden verir. OSRM public ile ayrı.
 */
function decodeMeetingPolylineFromServerRouteInfo(
  routeInfo: LiveMapViewProps['routeInfo'] | null | undefined,
): MapLatLng[] | null {
  if (!routeInfo) return null;
  const ri = routeInfo as Record<string, unknown>;
  const enc = ri.overview_polyline ?? ri.polyline;
  if (typeof enc === 'string' && enc.length > 2) {
    const c = decodeOsrmPolyline(enc, 5);
    return c.length >= 2 ? c : null;
  }
  const coords = ri.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const out: MapLatLng[] = [];
    for (const p of coords) {
      if (Array.isArray(p) && p.length >= 2) {
        const lng = Number(p[0]);
        const lat = Number(p[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          out.push({ latitude: lat, longitude: lng });
        }
      } else if (p && typeof p === 'object') {
        const o = p as Record<string, unknown>;
        const lat = Number(o.latitude ?? o.lat);
        const lng = Number(o.longitude ?? o.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          out.push({ latitude: lat, longitude: lng });
        }
      }
    }
    return out.length >= 2 ? out : null;
  }
  return null;
}

/** Google→OSRM (server) — tek bacak; API key istemci dışında. */
async function fetchBackendRouteMetrics(
  oLa: number,
  oLo: number,
  dLa: number,
  dLo: number,
): Promise<{
  success: boolean;
  distance_km?: number;
  duration_min?: number;
  overview_polyline?: string;
  source?: string;
}> {
  const q = new URLSearchParams({
    origin_lat: String(oLa),
    origin_lng: String(oLo),
    dest_lat: String(dLa),
    dest_lng: String(dLo),
  });
  try {
    const res = await fetch(`${API_BASE_URL}/route-metrics?${q}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.success !== true) return { success: false };
    const dk = Number(data.distance_km);
    const dm = Number(data.duration_min);
    const op =
      typeof data.overview_polyline === 'string' ? data.overview_polyline : undefined;
    const src = typeof data.source === 'string' ? data.source : undefined;
    return {
      success: true,
      distance_km: Number.isFinite(dk) ? dk : undefined,
      duration_min: Number.isFinite(dm) ? dm : undefined,
      overview_polyline: op,
      source: src,
    };
  } catch {
    return { success: false };
  }
}

/** Geçici teşhis: buluşma / hedef km-dk kaynağı */
type MeetingMetricSource =
  | 'routeInfo'
  | 'osrm'
  | 'backend_route_metrics'
  | 'straight_fallback'; // yalnız iç log; UI kuş uçuşu göstermez
type DestinationMetricSource =
  | 'routeInfo'
  | 'osrm'
  | 'backend_route_metrics'
  | 'straight_fallback'
  | 'approx_pickup_anchor'; // iç log / eski kod yolu

function logNavDiag(tag: string, payload: Record<string, unknown>) {
  try {
    console.log(tag, JSON.stringify({ ...payload, t: Date.now() }));
  } catch {
    console.log(tag, '[payload_serialize_failed]');
  }
}

/** Yolcu ekranı — buluşma kartının altındaki kırmızı ipucu (rota süresi + mesafe + periyodik hatırlatma) */
function buildPassengerDriverHint(
  meters: number,
  meetingDurationMin: number | null,
  otherUserName: string,
): string {
  const name = displayFirstName(otherUserName, 'Sürücünüz');
  if (meters <= 80) {
    return 'Sürücü yanınızda';
  }
  if (meters <= 220) {
    return 'Sürücü geldi — buluşabilirsiniz';
  }
  const dur =
    meetingDurationMin != null && Number.isFinite(meetingDurationMin)
      ? Math.max(1, Math.round(meetingDurationMin))
      : null;
  if (dur != null && dur <= 1) {
    return `${name} yolda · 1 dk`;
  }
  if (dur === 2) {
    return `${name} yolda · 2 dk`;
  }
  if (dur != null && dur > 2) {
    return `${name} yolda · ${dur} dk`;
  }
  return `${name} yolda`;
}

function formatRouteKmMin(distanceKm: number | null, durationMin: number | null): string {
  let distPart = '—';
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm >= 0) {
    const m = Math.round(distanceKm * 1000);
    if (m < 1000) {
      distPart = `${m} m`;
    } else if (distanceKm < 10) {
      distPart = `${distanceKm.toFixed(2)} km`;
    } else {
      distPart = `${distanceKm.toFixed(1)} km`;
    }
  }
  const min =
    durationMin != null && Number.isFinite(durationMin)
      ? String(Math.max(1, Math.round(durationMin)))
      : '—';
  return `${distPart} • ${min} dk`;
}

/** Yeşil tema + hafif kare animasyonu — rota metriği beklenirken (gürültüsüz) */
function RouteCalculatingPremium({
  compact,
  valueTextStyle,
}: {
  compact?: boolean;
  valueTextStyle?: TextStyle | TextStyle[] | null;
}) {
  const d0 = useRef(new Animated.Value(ROUTE_LOADING_UI.dotMinOpacity)).current;
  const d1 = useRef(new Animated.Value(ROUTE_LOADING_UI.dotMinOpacity)).current;
  const d2 = useRef(new Animated.Value(ROUTE_LOADING_UI.dotMinOpacity)).current;
  const d3 = useRef(new Animated.Value(ROUTE_LOADING_UI.dotMinOpacity)).current;
  const dots = [d0, d1, d2, d3];
  const U = ROUTE_LOADING_UI;
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
  const fs = compact ? U.fontSizeMapCompact : U.fontSizeMap;
  const dotSz = compact ? U.dotSizeMapCompact : U.dotSizeMap;
  const dotGap = compact ? U.dotGapMapCompact : U.dotGapMap;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      <Text
        style={[
          {
            color: U.textColor,
            fontSize: fs,
            fontWeight: U.fontWeight,
            letterSpacing: U.letterSpacing,
          },
          valueTextStyle,
        ]}
        numberOfLines={1}
      >
        Rota hesaplanıyor
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: U.textToDotsMap,
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

function RouteUnavailableMuted({
  compact,
  valueTextStyle,
}: {
  compact?: boolean;
  valueTextStyle?: TextStyle | TextStyle[] | null;
}) {
  const fs = compact ? 12.5 : 14;
  return (
    <Text
      style={[
        {
          color: '#64748B',
          fontSize: fs,
          fontWeight: '500',
          letterSpacing: 0.1,
        },
        valueTextStyle,
      ]}
      numberOfLines={1}
    >
      Rota bilgisi alınamadı
    </Text>
  );
}

type MapLatLng = { latitude: number; longitude: number };

/** OSRM URL / rota: yalnızca gerçek sayılar (string koordinat güvenli reddedilir) */
function isOsrmCoordComponent(n: unknown): n is number {
  return typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n);
}

function isValidRouteEndpoint(loc: { latitude?: unknown; longitude?: unknown } | null | undefined): loc is MapLatLng {
  if (!loc) return false;
  return isOsrmCoordComponent(loc.latitude) && isOsrmCoordComponent(loc.longitude);
}

/**
 * Rota uçu: string / JSON’den gelen enlem-boylamı sayıya çevir; OSRM/uyarılarda sadece sayı vardı.
 */
function parseRouteEndpoint(
  loc: { latitude?: unknown; longitude?: unknown } | null | undefined,
): MapLatLng | null {
  if (loc == null) return null;
  const la = Number(loc.latitude);
  const lo = Number(loc.longitude);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  const out: MapLatLng = { latitude: la, longitude: lo };
  return isValidMapCoord(out) ? out : null;
}

function pickCoordNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Sürücü → yolcu: activeTag yedek (index driverPassengerCoordsForMap ile aynı alanlar) */
function pickDriverPickupDestFromActiveTag(
  tag: Record<string, unknown> | null | undefined,
): MapLatLng | null {
  if (!tag) return null;
  const plRaw = tag.passenger_location;
  if (plRaw != null) {
    if (typeof plRaw === 'object') {
      const o = plRaw as Record<string, unknown>;
      const la = o.latitude ?? o.lat;
      const lo = o.longitude ?? o.lng;
      const p = parseRouteEndpoint({ latitude: la, longitude: lo });
      if (p) return p;
    } else if (typeof plRaw === 'string' && plRaw.trim().startsWith('{')) {
      try {
        const o = JSON.parse(plRaw) as Record<string, unknown>;
        const p = parseRouteEndpoint({
          latitude: o.latitude ?? o.lat,
          longitude: o.longitude ?? o.lng,
        });
        if (p) return p;
      } catch {
        /* noop */
      }
    }
  }
  const pLat = pickCoordNumber(tag.pickup_lat);
  const pLng = pickCoordNumber(tag.pickup_lng);
  if (pLat != null && pLng != null) {
    return parseRouteEndpoint({ latitude: pLat, longitude: pLng });
  }
  const paxLa = pickCoordNumber(tag.passenger_latitude ?? tag.passenger_lat);
  const paxLo = pickCoordNumber(tag.passenger_longitude ?? tag.passenger_lng);
  if (paxLa != null && paxLo != null) {
    return parseRouteEndpoint({ latitude: paxLa, longitude: paxLo });
  }
  return null;
}

function resolveYolcuyaGitDriverOrigin(
  ctx: { driverLocation?: { latitude?: unknown; longitude?: unknown } | null; currentLocation?: { latitude?: unknown; longitude?: unknown } | null } | null | undefined,
  userLocation: { latitude?: unknown; longitude?: unknown } | null | undefined,
  navMapCoord: MapLatLng | null,
  navStable: MapLatLng | null,
  extraCandidates?: readonly ({ latitude?: unknown; longitude?: unknown } | MapLatLng | null | undefined)[],
): MapLatLng | null {
  const cands: (
    | { latitude?: unknown; longitude?: unknown }
    | MapLatLng
    | null
    | undefined
  )[] = [
    ctx?.driverLocation,
    userLocation,
    ctx?.currentLocation,
    navMapCoord,
    navStable,
    ...(extraCandidates ?? []),
  ];
  for (const c of cands) {
    const p = parseRouteEndpoint(c);
    if (p) return p;
  }
  return null;
}

function resolveYolcuyaGitDriverDest(
  otherLocation: { latitude?: unknown; longitude?: unknown } | null | undefined,
  activeTag: Record<string, unknown> | null | undefined,
): MapLatLng | null {
  const o0 = parseRouteEndpoint(otherLocation);
  if (o0) return o0;
  return pickDriverPickupDestFromActiveTag(activeTag);
}

function computeMeetingRouteEndpoints(
  isDriver: boolean,
  userLocation: { latitude: number; longitude: number } | null,
  otherLocation: { latitude: number; longitude: number } | null,
  driverYolcuyaContext: {
    driverLocation?: { latitude: number; longitude: number } | null;
    currentLocation?: { latitude: number; longitude: number } | null;
    activeTag?: Record<string, unknown> | null;
  } | null | undefined,
  navDriverMapCoord: MapLatLng | null,
  navDriverStable: MapLatLng | null,
): { ul: MapLatLng | null; ol: MapLatLng | null } {
  if (!isDriver) {
    return {
      ul: parseRouteEndpoint(userLocation),
      ol: parseRouteEndpoint(otherLocation),
    };
  }
  return {
    ul: resolveYolcuyaGitDriverOrigin(
      driverYolcuyaContext,
      userLocation,
      navDriverMapCoord,
      navDriverStable,
    ),
    ol: resolveYolcuyaGitDriverDest(otherLocation, driverYolcuyaContext?.activeTag ?? null),
  };
}

/** OSRM encoded polyline (precision 5) → harita koordinatları */
function decodeOsrmPolyline(encoded: string, precision = 5): MapLatLng[] {
  const coordinates: MapLatLng[] = [];
  if (!encoded || typeof encoded !== 'string') return coordinates;
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);
  const len = encoded.length;
  while (index < len) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      if (index >= len) return coordinates;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      if (index >= len) return coordinates;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    coordinates.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return coordinates;
}

/** OSRM GeoJSON LineString — [lng, lat] → { latitude, longitude } */
function osrmGeometryToCoords(geometry: unknown): MapLatLng[] | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type !== 'LineString' || !Array.isArray(g.coordinates)) return null;
  const out: MapLatLng[] = [];
  for (const pair of g.coordinates as [number, number][]) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ latitude: lat, longitude: lng });
  }
  return out.length >= 2 ? out : null;
}

/** OSRM yanıtı: polyline (string) veya GeoJSON LineString */
function osrmRouteGeometryToCoords(geometry: unknown): MapLatLng[] | null {
  if (geometry == null) return null;
  if (typeof geometry === 'string') {
    const decoded = decodeOsrmPolyline(geometry);
    return decoded.length >= 2 ? decoded : null;
  }
  return osrmGeometryToCoords(geometry);
}

/** OSRM (Project OSRM) — polyline decode; km/dk backend’ten gelir */
async function fetchOsrmDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ distanceM: number; durationS: number; coordinates: MapLatLng[] } | null> {
  if (
    !isOsrmCoordComponent(fromLat) ||
    !isOsrmCoordComponent(fromLng) ||
    !isOsrmCoordComponent(toLat) ||
    !isOsrmCoordComponent(toLng)
  ) {
    return null;
  }
  const origin = { latitude: fromLat, longitude: fromLng };
  const dest = { latitude: toLat, longitude: toLng };
  console.log('ROUTE ORIGIN:', origin);
  console.log('ROUTE DEST:', dest);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
    const data = await res.json();
    if (!data?.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      console.warn('[OSRM] No route found', { code: data?.code });
      return null;
    }
    if (data.code !== 'Ok') {
      console.warn('[OSRM] Route response not Ok', data?.code);
      return null;
    }
    const r = data.routes[0];
    const coords = osrmRouteGeometryToCoords(r.geometry);
    if (!coords) return null;
    return {
      distanceM: Number(r.distance) || 0,
      durationS: Number(r.duration) || 0,
      coordinates: coords,
    };
  } catch (e) {
    console.warn('[OSRM] fetchOsrmDrivingRoute failed', e);
    return null;
  }
}

type OsrmNavStepParsed = {
  distanceM: number;
  maneuver: { type?: string; modifier?: string };
  name: string;
};

function buildOsrmStepsFromLeg(leg: unknown): OsrmNavStepParsed[] {
  if (!leg || typeof leg !== 'object') return [];
  const steps = (leg as { steps?: unknown[] }).steps;
  if (!Array.isArray(steps)) return [];
  const out: OsrmNavStepParsed[] = [];
  for (const s of steps) {
    if (!s || typeof s !== 'object') continue;
    const sd = s as Record<string, unknown>;
    const m = sd.maneuver as { type?: string; modifier?: string } | undefined;
    out.push({
      distanceM: Number(sd.distance) || 0,
      maneuver: { type: m?.type, modifier: m?.modifier },
      name: String(sd.name || ''),
    });
  }
  return out;
}

async function fetchOsrmDrivingRouteWithSteps(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{
  distanceM: number;
  durationS: number;
  coordinates: MapLatLng[];
  steps: OsrmNavStepParsed[];
} | null> {
  if (
    !isOsrmCoordComponent(fromLat) ||
    !isOsrmCoordComponent(fromLng) ||
    !isOsrmCoordComponent(toLat) ||
    !isOsrmCoordComponent(toLng)
  ) {
    return null;
  }
  const origin = { latitude: fromLat, longitude: fromLng };
  const dest = { latitude: toLat, longitude: toLng };
  console.log('ROUTE ORIGIN (steps):', origin);
  console.log('ROUTE DEST (steps):', dest);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=polyline&steps=true`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
    const data = await res.json();
    if (!data?.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      console.warn('[OSRM] No route found (steps)', { code: data?.code });
      return null;
    }
    if (data.code !== 'Ok') {
      console.warn('[OSRM] Route response not Ok (steps)', data?.code);
      return null;
    }
    const r = data.routes[0];
    const coords = osrmRouteGeometryToCoords(r.geometry);
    if (!coords) return null;
    const leg = r.legs?.[0];
    const steps = buildOsrmStepsFromLeg(leg);
    return {
      distanceM: Number(r.distance) || 0,
      durationS: Number(r.duration) || 0,
      coordinates: coords,
      steps,
    };
  } catch (e) {
    console.warn('[OSRM] fetchOsrmDrivingRouteWithSteps failed', e);
    return null;
  }
}

/** cumStart[i] = rota başından adım i'nin başına kadar mesafe (m) */
function buildCumStartMeters(steps: OsrmNavStepParsed[]): number[] {
  const cum: number[] = [0];
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    acc += steps[i].distanceM;
    cum.push(acc);
  }
  return cum;
}

function formatTurkishManeuver(step: OsrmNavStepParsed): string {
  const typ = String(step.maneuver?.type || '').toLowerCase();
  const mod = String(step.maneuver?.modifier || '').toLowerCase();
  const street = step.name?.trim() ? ` — ${step.name}` : '';

  if (typ === 'arrive') return 'Hedefe varın';
  if (typ === 'depart') return `Yola çıkın${street}`;

  const dir =
    mod === 'sharp right'
      ? 'keskin sağa'
      : mod === 'right'
        ? 'sağa'
        : mod === 'slight right'
          ? 'hafif sağa'
          : mod === 'straight'
            ? 'düz'
            : mod === 'slight left'
              ? 'hafif sola'
              : mod === 'left'
                ? 'sola'
                : mod === 'sharp left'
                  ? 'keskin sola'
                  : mod === 'uturn'
                    ? 'U dönüşü yapın'
                    : '';

  if (typ === 'roundabout' || typ === 'rotary')
    return `Kavşağa girin${mod ? ` (${mod})` : ''}${street}`;
  if (typ === 'exit roundabout' || typ === 'exit rotary') return 'Kavşaktan çıkın';
  if (typ === 'merge') return 'Şeride girin';
  if (typ === 'fork') return `Yol ayrımında ${dir || 'gösterilen'} yönü izleyin`;
  if (typ === 'end of road') return `${dir || 'uygun'} yöne dönün${street}`;
  if (typ === 'continue' || typ === 'new name')
    return (step.name ? `${step.name} üzerinde devam edin` : 'Devam edin') + (street && !step.name ? street : '');

  if (typ === 'turn' && dir) return `${dir} dönün${street}`;
  if (dir) return `${dir} dönün${street}`;
  return `İlerleyin${street}`;
}

/** TTS: cadde/sokak adı yok — kısa Türkçe manevra */
function formatTurkishManeuverNoStreet(step: OsrmNavStepParsed): string {
  const typ = String(step.maneuver?.type || '').toLowerCase();
  const mod = String(step.maneuver?.modifier || '').toLowerCase();
  if (typ === 'arrive') return 'varışa yaklaş';
  if (typ === 'depart') return 'yola çık';

  const dir =
    mod === 'sharp right'
      ? 'keskin sağa'
      : mod === 'right'
        ? 'sağa'
        : mod === 'slight right'
          ? 'hafif sağa'
          : mod === 'straight'
            ? 'düz'
            : mod === 'slight left'
              ? 'hafif sola'
              : mod === 'left'
                ? 'sola'
                : mod === 'sharp left'
                  ? 'keskin sola'
                  : mod === 'uturn'
                    ? 'U dönüşü yap'
                    : '';

  if (typ === 'roundabout' || typ === 'rotary') return 'kavşağa gir';
  if (typ === 'exit roundabout' || typ === 'exit rotary') return 'kavşaktan çık';
  if (typ === 'merge') return 'şeride gir';
  if (typ === 'fork') return `${dir || 'gösterilen'} yöne sap`;
  if (typ === 'end of road') return `${dir || 'uygun'} yöne dön`;
  if (typ === 'continue' || typ === 'new name') return 'düz devam et';
  if (typ === 'turn' && dir) return `${dir} dön`;
  if (dir) return `${dir} dön`;
  return 'ilerle';
}

/** Ses anonsu için yuvarlanmış mesafe metni (cadde okunmaz) */
function metersTurkishTts(meters: number): string {
  const m = Math.max(10, Math.round(meters / 10) * 10);
  if (m >= 1000) {
    const km = meters / 1000;
    const k = Math.round(km * 10) / 10;
    return `${k} kilometre`;
  }
  return `${m} metre`;
}

/** Ses: hafif dönüş / düz devam / kalkış — anons yok (UI okları kalır). Fork’ta slight yine konuşulur. */
function navStepTtsMuted(step: OsrmNavStepParsed): boolean {
  const typ = String(step.maneuver?.type || '').toLowerCase();
  const mod = String(step.maneuver?.modifier || '').toLowerCase();
  if (typ === 'fork') return false;
  if (typ === 'continue' || typ === 'new name') return true;
  if (typ === 'depart') return true;
  if (mod === 'slight right' || mod === 'slight left') return true;
  return false;
}

/** Marka tonu: ~%20 anonslarda, spam yok */
function maybeLeylekPrefix(salt: string): string {
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 31 + salt.charCodeAt(i)) | 0;
  const pick = Math.abs(h) % 5;
  if (pick === 0) return 'Leylek, ';
  return '';
}

function ttsArrivalEndPhrases(stage: 'pickup' | 'destination', salt: string): { ttsLine: string; ttsAction: string } {
  if (stage === 'destination') {
    const lines = [
      'Leylek, hedefe yaklaştın',
      'Hedefe yaklaştın, sağa sola bak',
      'Leylek, buralarda bir yerde',
    ];
    let h = 0;
    for (let i = 0; i < salt.length; i++) h = (h * 37 + salt.charCodeAt(i)) | 0;
    const ttsLine = lines[Math.abs(h) % lines.length];
    return { ttsLine, ttsAction: 'hedefe yaklaş' };
  }
  const lines = ['Leylek, yolcuya yaklaştın', 'Yolcu buralarda, sağa sola bak', 'Yolcuya yaklaş'];
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h * 41 + salt.charCodeAt(i)) | 0;
  const ttsLine = lines[Math.abs(h) % lines.length];
  return { ttsLine, ttsAction: 'yolcuya yaklaş' };
}

/**
 * Tek stil TTS: kısa emir; slight/continue sessiz.
 */
function buildNavTtsPhrases(
  step: OsrmNavStepParsed,
  d: number,
  stage: 'pickup' | 'destination',
): { ttsLine: string; ttsAction: string; ttsMuted: boolean } {
  const muted = navStepTtsMuted(step);
  if (muted) {
    return { ttsLine: '', ttsAction: '', ttsMuted: true };
  }
  const typ = String(step.maneuver?.type || '').toLowerCase();
  const mod = String(step.maneuver?.modifier || '').toLowerCase();

  if (typ === 'arrive') {
    const act = stage === 'destination' ? 'hedefe yaklaş' : 'yolcuya yaklaş';
    return {
      ttsLine: `${metersTurkishTts(d)} sonra ${act}`,
      ttsAction: act,
      ttsMuted: false,
    };
  }

  let action = '';
  if (typ === 'roundabout' || typ === 'rotary') action = 'kavşağa gir';
  else if (typ === 'exit roundabout' || typ === 'exit rotary') action = 'kavşaktan çık';
  else if (typ === 'merge') action = 'şeride gir';
  else if (typ === 'fork') {
    if (mod.includes('right')) action = 'yol ayrımından sağdan devam et';
    else if (mod.includes('left')) action = 'yol ayrımından soldan devam et';
    else action = 'yol ayrımından devam et';
  } else if (typ === 'end of road') {
    if (mod.includes('right')) action = 'sağa dön';
    else if (mod.includes('left')) action = 'sola dön';
    else if (mod === 'uturn') action = 'u dönüşü yap';
    else action = 'uygun yöne dön';
  } else if (typ === 'turn' || typ === 'on ramp' || typ === 'off ramp') {
    if (mod === 'uturn') action = 'u dönüşü yap';
    else if (mod === 'sharp right') action = 'keskin sağa dön';
    else if (mod === 'sharp left') action = 'keskin sola dön';
    else if (mod === 'right') action = 'sağa dön';
    else if (mod === 'left') action = 'sola dön';
    else if (mod === 'straight') action = '';
    else action = formatTurkishManeuverNoStreet(step);
  } else {
    action = formatTurkishManeuverNoStreet(step);
  }

  if (!action || action === 'ilerle' || action === 'düz devam et') {
    return { ttsLine: '', ttsAction: '', ttsMuted: true };
  }

  const prefix = maybeLeylekPrefix(`${stage}|${d}|${typ}|${mod}`);
  const line = `${prefix}${metersTurkishTts(d)} sonra ${action}`;
  return { ttsLine: line, ttsAction: action, ttsMuted: false };
}

function pointSegmentClosestT(
  p: MapLatLng,
  a: MapLatLng,
  b: MapLatLng,
): { t: number; distM: number } {
  const latScale = Math.cos(((a.latitude + b.latitude) * 0.5 * Math.PI) / 180);
  const ax = a.longitude * latScale;
  const bx = b.longitude * latScale;
  const px = p.longitude * latScale;
  const ay = a.latitude;
  const by = b.latitude;
  const py = p.latitude;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  let t = ab2 > 1e-18 ? (apx * abx + apy * aby) / ab2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qLat = ay + t * (by - ay);
  const qLng = a.longitude + t * (b.longitude - a.longitude);
  const distM = haversineMeters(p, { latitude: qLat, longitude: qLng });
  return { t, distM };
}

function distanceAlongPolylineM(user: MapLatLng, polyline: MapLatLng[]): number {
  if (polyline.length < 2) return 0;
  let acc = 0;
  let bestAlong = 0;
  let bestDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = haversineMeters(a, b);
    const { t, distM } = pointSegmentClosestT(user, a, b);
    if (distM < bestDist) {
      bestDist = distM;
      bestAlong = acc + t * segLen;
    }
    acc += segLen;
  }
  return Math.min(bestAlong, acc);
}

/** Polyline üzerinde GPS’e en yakın nokta (marker snap). */
function closestPointOnPolyline(user: MapLatLng, polyline: MapLatLng[]): { point: MapLatLng; distM: number } {
  if (polyline.length < 2) return { point: user, distM: Infinity };
  let bestD = Infinity;
  let bestP = user;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const { t, distM } = pointSegmentClosestT(user, a, b);
    if (distM < bestD) {
      bestD = distM;
      const qLat = a.latitude + t * (b.latitude - a.latitude);
      const qLng = a.longitude + t * (b.longitude - a.longitude);
      bestP = { latitude: qLat, longitude: qLng };
    }
  }
  return { point: bestP, distM: bestD };
}

function isValidMapCoord(c: { latitude: number; longitude: number } | null | undefined): boolean {
  if (!c) return false;
  const la = Number(c.latitude);
  const ln = Number(c.longitude);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return false;
  if (Math.abs(la) < 1e-6 && Math.abs(ln) < 1e-6) return false;
  return true;
}

/** Fit / kamera / marker: önce ref’teki stabil nokta, sonra state, sonra ham GPS */
function resolveNavigationAnchor(
  stableRef: React.MutableRefObject<MapLatLng | null>,
  mapCoord: MapLatLng | null,
  userLoc: { latitude: number; longitude: number } | null,
): MapLatLng | null {
  const s = stableRef.current;
  if (s && isValidMapCoord(s)) return s;
  if (mapCoord && isValidMapCoord(mapCoord)) return mapCoord;
  if (userLoc && isValidMapCoord(userLoc)) return userLoc;
  return null;
}

/** Rota üzerine snap + mikro drift filtre — yol dışına taşmış GPS’i zorla çekmez (sıkı) */
const NAV_MARKER_SNAP_MAX_M = 25;
/** 3 m altı: marker güncelleme yok (mikro jitter) */
const NAV_MARKER_MICRO_IGNORE_M = 3;
const NAV_MARKER_SOFT_BLEND_MAX_M = 22;
/** Yumuşak yaklaşmada her karede hedefe yaklaşma oranı */
const NAV_MARKER_LERP = 0.15;

/** Marker yönü: rota üzerinde ileri bakış (m) — pusula kullanılmaz */
const NAV_ROUTE_BEARING_LOOKAHEAD_MIN_M = 14;
const NAV_ROUTE_BEARING_LOOKAHEAD_MAX_M = 48;
const NAV_ROUTE_BEARING_MIN_SEP_M = 5.5;
/** Bearing yumuşatma (0–1), küçük bearing zıplamasını keser */
const NAV_MARKER_BEARING_LERP = 0.22;
/** Harita heading (animateCamera): ekstra yumuşatma — titreşimi keser */
const NAV_CAMERA_HEADING_LERP = 0.22;
/** Bu kadar dereceden az ham değişimde smoothing girdiği değiştirme */
const NAV_MARKER_BEARING_RAW_DEADBAND_DEG = 2.4;

function findNextStepIndex(progressM: number, steps: OsrmNavStepParsed[], cumStart: number[]): number {
  if (!steps.length || cumStart.length < 2) return -1;
  const eps = 12;
  let k = 1;
  while (k < steps.length && cumStart[k] <= progressM + eps) {
    k++;
  }
  return k;
}

type ManeuverArrowKind =
  | 'straight'
  | 'right'
  | 'left'
  | 'sharp_right'
  | 'sharp_left'
  | 'slight_right'
  | 'slight_left'
  | 'uturn'
  | 'roundabout'
  | 'merge'
  | 'fork'
  | 'unknown';

function stepToArrowKind(step: OsrmNavStepParsed): ManeuverArrowKind {
  const typ = (step.maneuver?.type || '').toLowerCase();
  const mod = (step.maneuver?.modifier || '').toLowerCase();
  if (typ === 'arrive') return 'straight';
  if (typ === 'roundabout' || typ === 'rotary') return 'roundabout';
  if (typ === 'merge') return 'merge';
  if (typ === 'fork') return 'fork';
  if (mod === 'uturn') return 'uturn';
  if (mod === 'sharp right') return 'sharp_right';
  if (mod === 'right') return 'right';
  if (mod === 'slight right') return 'slight_right';
  if (mod === 'straight') return 'straight';
  if (mod === 'slight left') return 'slight_left';
  if (mod === 'left') return 'left';
  if (mod === 'sharp left') return 'sharp_left';
  if (typ === 'turn' || typ === 'end of road') {
    if (mod.includes('right')) return mod.includes('sharp') ? 'sharp_right' : 'right';
    if (mod.includes('left')) return mod.includes('sharp') ? 'sharp_left' : 'left';
  }
  return 'unknown';
}

type NavManeuverUi = {
  instructionLine: string;
  streetName: string | null;
  arrowKind: ManeuverArrowKind;
  /** Ses: yalnızca bu anahtar değişince okunur */
  speechKey: string;
  /** Sonraki manevraya kalan mesafe (m); yoksa mesafe anonsu yapılmaz */
  metersToManeuver: number | null;
  /** TTS tam cümle — kısa, cadde yok, doğal Türkçe (sesli asistan) */
  ttsLine: string;
  /** TTS mesafe bantları: “X metre sonra …” için yalın manevra */
  ttsAction: string;
  /** true: manevra sesi yok (hafif dönüş vb.); UI ok metni kalır */
  ttsMuted?: boolean;
};

function buildNavManeuverUiFromSteps(
  progressM: number,
  steps: OsrmNavStepParsed[],
  cumStart: number[],
  stage: 'pickup' | 'destination',
): NavManeuverUi {
  const k = findNextStepIndex(progressM, steps, cumStart);
  if (k < 0) {
    return {
      instructionLine: 'Rotayı takip edin',
      streetName: null,
      arrowKind: 'unknown',
      speechKey: `${stage}-noroute`,
      metersToManeuver: null,
      ttsLine: 'Rotayı takip et',
      ttsAction: 'rotayı takip et',
      ttsMuted: false,
    };
  }
  if (k >= steps.length) {
    const last = steps[steps.length - 1];
    const end = ttsArrivalEndPhrases(stage, `${stage}-${last.name || 'x'}`);
    return {
      instructionLine: stage === 'destination' ? 'Hedefe yaklaşın' : 'Yolcuya yaklaşın',
      streetName: last.name?.trim() || null,
      arrowKind: 'straight',
      speechKey: `${stage}-arrive-end`,
      metersToManeuver: null,
      ttsLine: end.ttsLine,
      ttsAction: end.ttsAction,
      ttsMuted: false,
    };
  }
  const step = steps[k];
  const d = Math.max(0, cumStart[k] - progressM);
  const distLabel = d >= 950 ? `${(d / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(d / 10) * 10)} m`;
  const action = formatTurkishManeuver(step);
  const instructionLine = `${distLabel} sonra ${action}`;
  const streetName = step.name?.trim() || null;
  const arrowKind = stepToArrowKind(step);
  const speechKey = `${stage}-step${k}-${step.maneuver?.type || ''}-${step.maneuver?.modifier || ''}`;
  const { ttsLine, ttsAction, ttsMuted } = buildNavTtsPhrases(step, d, stage);
  return {
    instructionLine,
    streetName,
    arrowKind,
    speechKey,
    metersToManeuver: d,
    ttsLine,
    ttsAction,
    ttsMuted,
  };
}

const ROUTE_HIGHLIGHT_AHEAD_M = 200;

/** Sürücü nav: geçilen kısım soluk, kalan parlak, yakın segment vurgulu */
function splitRouteForNavDisplay(
  polyline: MapLatLng[],
  progressM: number,
): { dim: MapLatLng[]; bright: MapLatLng[]; hot: MapLatLng[] } {
  if (polyline.length < 2) {
    return { dim: [], bright: polyline, hot: [] };
  }
  let acc = 0;
  let splitIdx = 0;
  let splitPoint: MapLatLng = polyline[0];
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = haversineMeters(a, b);
    if (acc + segLen >= progressM) {
      const t = Math.max(0, Math.min(1, (progressM - acc) / segLen));
      splitPoint = {
        latitude: a.latitude + t * (b.latitude - a.latitude),
        longitude: a.longitude + t * (b.longitude - a.longitude),
      };
      splitIdx = i;
      break;
    }
    acc += segLen;
    splitIdx = i;
    splitPoint = b;
  }
  const traveled = [...polyline.slice(0, splitIdx + 1), splitPoint];
  const remaining = [splitPoint, ...polyline.slice(splitIdx + 1)];
  if (remaining.length < 2) {
    return { dim: traveled.length >= 2 ? traveled : [], bright: polyline, hot: [] };
  }
  let h = 0;
  const hot: MapLatLng[] = [remaining[0]];
  for (let i = 0; i < remaining.length - 1 && h < ROUTE_HIGHLIGHT_AHEAD_M; i++) {
    const a = remaining[i];
    const b = remaining[i + 1];
    const len = haversineMeters(a, b);
    if (h + len <= ROUTE_HIGHLIGHT_AHEAD_M) {
      hot.push(b);
      h += len;
    } else {
      const need = ROUTE_HIGHLIGHT_AHEAD_M - h;
      const t = need / len;
      hot.push({
        latitude: a.latitude + t * (b.latitude - a.latitude),
        longitude: a.longitude + t * (b.longitude - a.longitude),
      });
      break;
    }
  }
  return {
    dim: traveled.length >= 2 ? traveled : [],
    bright: remaining,
    hot: hot.length >= 2 ? hot : [],
  };
}

type NavTrafficLevel = 'free' | 'slow' | 'heavy';

function trafficLevelFromDelayRatio(ratio: number | null | undefined): NavTrafficLevel {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 1.12) return 'free';
  if (ratio <= 1.38) return 'slow';
  return 'heavy';
}

/** Buluşma aşaması: yeşil ton + trafik yoğunluğuna göre parlak hat */
function pickupNavRouteStrokeColors(level: NavTrafficLevel): { dim: string; bright: string; hot: string } {
  switch (level) {
    case 'free':
      return {
        dim: 'rgba(4, 120, 87, 0.42)',
        bright: '#22C55E',
        hot: 'rgba(220, 252, 231, 0.95)',
      };
    case 'slow':
      return {
        dim: 'rgba(4, 120, 87, 0.42)',
        bright: '#22C55E',
        hot: 'rgba(220, 252, 231, 0.95)',
      };
    case 'heavy':
      return {
        dim: 'rgba(4, 120, 87, 0.42)',
        bright: '#22C55E',
        hot: 'rgba(220, 252, 231, 0.95)',
      };
  }
}

/** Hedef aşaması: turuncu ton + trafik */
function destinationNavRouteStrokeColors(level: NavTrafficLevel): { dim: string; bright: string; hot: string } {
  switch (level) {
    case 'free':
      return {
        dim: 'rgba(194, 65, 12, 0.42)',
        bright: '#F97316',
        hot: '#FFEDD5',
      };
    case 'slow':
      return {
        dim: 'rgba(194, 65, 12, 0.42)',
        bright: '#F97316',
        hot: '#FFEDD5',
      };
    case 'heavy':
      return {
        dim: 'rgba(194, 65, 12, 0.42)',
        bright: '#F97316',
        hot: '#FFEDD5',
      };
  }
}

/** GPS hızına göre hedef zoom (m/s → km/h); bilinmiyorsa yavaş / yakın zoom */
function zoomTargetForSpeedMps(speedMps: number | null | undefined): number {
  const kmh =
    typeof speedMps === 'number' && speedMps >= 0 && Number.isFinite(speedMps)
      ? speedMps * 3.6
      : 0;
  if (kmh < 5) return 18.5;
  if (kmh < 20) return 17.5;
  if (kmh < 40) return 16.5;
  if (kmh < 70) return 15.5;
  return 14.8;
}

/** Üç boyutlu nav — Google Maps tarzı sabit eğim */
const NAV_CAMERA_PITCH_DEG = 55;

function navPitchForSpeedMps(_speedMps: number | null | undefined): number {
  return NAV_CAMERA_PITCH_DEG;
}

/** Kamera merkezi polyline üzerinde İleri bakış (m): ~50 düşük hız — ~100 otoyol */
const NAV_CAMERA_LOOKAHEAD_MIN_M = 50;
const NAV_CAMERA_LOOKAHEAD_MAX_M = 100;

function navCameraLookAheadMeters(speedMps: number | null | undefined): number {
  const s = typeof speedMps === 'number' && speedMps >= 0 && Number.isFinite(speedMps) ? speedMps : 0;
  const kmh = s * 3.6;
  if (kmh < 15) return NAV_CAMERA_LOOKAHEAD_MIN_M;
  if (kmh >= 70) return NAV_CAMERA_LOOKAHEAD_MAX_M;
  const t = (kmh - 15) / (70 - 15);
  return NAV_CAMERA_LOOKAHEAD_MIN_M + t * (NAV_CAMERA_LOOKAHEAD_MAX_M - NAV_CAMERA_LOOKAHEAD_MIN_M);
}

/**
 * Heading-up Kamera merkezi: rota üzerinde araçtan lookAhead kadar ileri.
 * Polyline yoksa eski bearing + offset fallback (ızgara sapmayı keser).
 */
function computeNavCameraCenterFromLookAhead(
  anchor: MapLatLng,
  polyline: MapLatLng[],
  headingDeg: number,
  remainKm: number,
  zoom: number,
  speedMps: number | null | undefined,
): MapLatLng {
  const lookM = navCameraLookAheadMeters(speedMps);
  if (polyline.length >= 2) {
    const progressM = distanceAlongPolylineM(anchor, polyline);
    const totalM = polylineLengthMeters(polyline);
    const along = Math.min(Math.max(0, progressM + lookM), Math.max(totalM, 0));
    const pt = pointAtDistanceAlongPolyline(polyline, along);
    if (pt && isValidMapCoord(pt)) {
      return pt;
    }
  }
  return offsetCameraCenterForward(anchor, headingDeg, remainKm, zoom);
}

/**
 * Kamera hedefi = araçtan ileri (yol ekseni bearing); GPS noktası sabit overlay’de kalır, harita altında akar.
 * zoom yüksek (yakın) iken ileri mesafe kısaltılır; taşma / titreme azalır.
 */
function offsetCameraCenterForward(
  from: MapLatLng,
  bearingDeg: number,
  remainKm: number,
  zoom: number,
): MapLatLng {
  let forwardM = 232;
  if (remainKm > 5) forwardM = 292;
  else if (remainKm >= 1) forwardM = 256;
  else forwardM = 214;
  const z = Number.isFinite(zoom) ? Math.max(14.8, Math.min(18.5, zoom)) : 16.5;
  forwardM *= Math.min(1.05, Math.max(0.9, 17 / z));
  /** Overlay nav: ileri offset biraz fazlaydı → yol çizgisi ikonun altında kalıyordu; 1.04 ile hizaya yaklaştır */
  forwardM *= 1.04;
  const R = 6378137;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lng1 = (from.longitude * Math.PI) / 180;
  const ang = forwardM / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
}

function meetingEndpointsKey(dLat: number, dLng: number, pLat: number, pLng: number): string {
  return `${dLat.toFixed(5)},${dLng.toFixed(5)}|${pLat.toFixed(5)},${pLng.toFixed(5)}`;
}

/** Karşı taraf çok yakınsa arama gereksiz — çağrıyı engelle (metre) */
const PROXIMITY_CALL_BLOCK_M = 100;

function haversineMeters(a: MapLatLng, b: MapLatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(la1) * Math.cos(la2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sürücü → yolcu düz mesafe (km) — uzun buluşmada tam polyline fit zoom’u öldürür */
function straightLineKm(a: MapLatLng, b: MapLatLng): number {
  return haversineMeters(a, b) / 1000;
}

/** OSRM yoksa: süre ≈ mesafe / 40 km/h (dk) */
function fallbackDurationMinFromKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 1;
  return Math.max(1, Math.round((distanceKm / 40) * 60));
}

function clampNavZoom(z: number): number {
  if (!Number.isFinite(z)) return 16.5;
  return Math.min(18.5, Math.max(14.8, z));
}

/** Turn-by-turn aktif: zoom şehir ölçeğine (≤14.8) düşmesin — sokak bandı */
const ACTIVE_NAV_MIN_STREET_ZOOM = 16.15;
const ACTIVE_NAV_MAX_STREET_ZOOM = 17.85;

function clampActiveNavFollowZoom(z: number): number {
  if (!Number.isFinite(z)) return 17.1;
  return Math.min(ACTIVE_NAV_MAX_STREET_ZOOM, Math.max(ACTIVE_NAV_MIN_STREET_ZOOM, z));
}

/** Google Maps: bazı cihazlarda yalnız `animateCamera` heading’i uygulamaz; `setCamera` ile anında kilitle. */
function snapThenAnimateNavCamera(
  map: { setCamera?: (c: object) => void; animateCamera?: (c: object, o: { duration: number }) => void },
  camera: { center: MapLatLng; heading: number; pitch: number; zoom: number },
  duration: number,
  snapHeading: boolean,
): void {
  if (typeof map.animateCamera !== 'function') return;
  if (snapHeading && typeof map.setCamera === 'function') {
    try {
      map.setCamera(camera);
    } catch {
      /* noop */
    }
  }
  map.animateCamera(camera, { duration });
}

function bearingDegrees(from: MapLatLng, to: MapLatLng): number {
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function polylineLengthMeters(polyline: MapLatLng[]): number {
  if (polyline.length < 2) return 0;
  let acc = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    acc += haversineMeters(polyline[i], polyline[i + 1]);
  }
  return acc;
}

/** Turuncu hedef: bariz kuş uçuşu / seyrek fallback geometrisini gösterme */
const DEST_ROUTE_GEOM_MIN_POINTS = 5;
const DEST_ROUTE_GEOM_MIN_PATH_CROW_RATIO = 1.01;

function isAcceptableDestinationRouteGeometry(coords: MapLatLng[]): boolean {
  if (!Array.isArray(coords) || coords.length < DEST_ROUTE_GEOM_MIN_POINTS) return false;
  const pathM = polylineLengthMeters(coords);
  const crowM = haversineMeters(coords[0], coords[coords.length - 1]);
  if (!Number.isFinite(pathM) || pathM <= 0 || !Number.isFinite(crowM) || crowM < 1) return false;
  return pathM / crowM >= DEST_ROUTE_GEOM_MIN_PATH_CROW_RATIO;
}

function destinationRouteCoordsOrEmpty(coords: MapLatLng[] | null | undefined): MapLatLng[] {
  if (!coords || coords.length < 2) return [];
  if (!isAcceptableDestinationRouteGeometry(coords)) {
    const pathM = polylineLengthMeters(coords);
    const crowM = haversineMeters(coords[0], coords[coords.length - 1]);
    logNavDiag('DEST_ROUTE_GEOMETRY_REJECTED', {
      leg: 'destination_polyline',
      points: coords.length,
      path_m: Math.round(pathM),
      crow_m: Math.round(crowM),
      ratio: Number((crowM > 0 ? pathM / crowM : 0).toFixed(4)),
    });
    return [];
  }
  return coords;
}

/** Rota başından `distanceM` mesafedeki nokta (polyline üzerinde). */
function pointAtDistanceAlongPolyline(polyline: MapLatLng[], distanceM: number): MapLatLng | null {
  if (polyline.length < 2) return null;
  const d = Math.max(0, distanceM);
  let acc = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const len = haversineMeters(a, b);
    if (acc + len >= d) {
      const t = len > 1e-9 ? (d - acc) / len : 0;
      const u = Math.max(0, Math.min(1, t));
      return {
        latitude: a.latitude + u * (b.latitude - a.latitude),
        longitude: a.longitude + u * (b.longitude - a.longitude),
      };
    }
    acc += len;
  }
  const last = polyline[polyline.length - 1];
  return { latitude: last.latitude, longitude: last.longitude };
}

/**
 * Snap noktasından rota boyunca ileri bakış — pusula değil, polyline ekseni.
 * Nav Marker.flat + rotation = bearing + offset (mapNavMarkers); MapView heading ile “ileri yukarı”.
 */
function bearingAlongRouteAheadDeg(
  anchor: MapLatLng,
  polyline: MapLatLng[],
  lookaheadM: number,
  fallbackTo: MapLatLng | null,
): number | null {
  if (polyline.length < 2) {
    return fallbackTo ? bearingDegrees(anchor, fallbackTo) : null;
  }
  const progressM = distanceAlongPolylineM(anchor, polyline);
  const totalM = polylineLengthMeters(polyline);
  const want = progressM + Math.max(NAV_ROUTE_BEARING_LOOKAHEAD_MIN_M, lookaheadM);
  let ahead = pointAtDistanceAlongPolyline(polyline, want);
  if (!ahead) return fallbackTo ? bearingDegrees(anchor, fallbackTo) : null;
  let sep = haversineMeters(anchor, ahead);
  if (sep < NAV_ROUTE_BEARING_MIN_SEP_M && want < totalM - 2) {
    ahead = pointAtDistanceAlongPolyline(polyline, Math.min(totalM - 0.5, progressM + NAV_ROUTE_BEARING_LOOKAHEAD_MAX_M));
    if (ahead) sep = haversineMeters(anchor, ahead);
  }
  if (sep < NAV_ROUTE_BEARING_MIN_SEP_M && polyline.length >= 2) {
    const tail = polyline[polyline.length - 1];
    const pre = polyline[polyline.length - 2];
    return bearingDegrees(pre, tail);
  }
  if (!ahead) {
    const tail = polyline[polyline.length - 1];
    return bearingDegrees(anchor, tail);
  }
  return bearingDegrees(anchor, ahead);
}

/** En kısa yönde açı farkı (-180, 180] */
function angleDiffDeg(fromDeg: number, toDeg: number): number {
  let d = toDeg - fromDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function absAngleDiffDeg(a: number, b: number): number {
  return Math.abs(angleDiffDeg(a, b));
}

/**
 * Heading yumuşatma — 0↔90 zıplamasını önler. t: 0–1 (her karede hedefe yaklaşma oranı).
 */
function interpolateHeading(prevHeading: number, newHeading: number, t: number): number {
  const d = angleDiffDeg(prevHeading, newHeading);
  let h = prevHeading + d * Math.max(0, Math.min(1, t));
  h = ((h % 360) + 360) % 360;
  return h;
}

function lerpLatLng(a: MapLatLng, b: MapLatLng, t: number): MapLatLng {
  const k = Math.max(0, Math.min(1, t));
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * k,
    longitude: a.longitude + (b.longitude - a.longitude) * k,
  };
}

/** Git 3fff2416 / d58ad083 çizgisi — daha sakin kamera (71067417 sonrası ince ayar) */
const NAV_CAMERA_THROTTLE_MS = 102;
const NAV_CAMERA_MIN_MOVE_M = 8;
const NAV_CAMERA_MIN_HEADING_DEG = 5;
/** GPS gürültüsünde <5 m adımda kamera animasyonu yok (yalnız marker) */
const NAV_MARKER_ONLY_MOVE_M = 5;
const NAV_CAMERA_ANIM_MS = 560;
/** Gesture sonrası ilk yaklaşım: daha uzun, yumuşak re-center */
const NAV_CAMERA_RESUME_ANIM_MS = 720;
/** Araç dururken sadece pusula: ~4,5 km/h altı = yavaş say */
const NAV_CAMERA_STATIONARY_SPEED_MPS = 1.25;
const NAV_CAMERA_STATIONARY_HEADING_DEG = 8;
const NAV_CAMERA_HEADING_ONLY_MS = 300;
const NAV_CENTER_LERP_HEADING_ONLY = 0.58;
const NAV_CENTER_LERP_FULL = 0.76;
/** Harita takibi yeniden açıldıktan sonra ~1 sn: daha yumuşak lerp (iki aşamalı his) */
const NAV_RESUME_SOFT_MS = 960;
const NAV_CENTER_LERP_RESUME_MOVE = 0.44;
const NAV_CENTER_LERP_RESUME_STILL = 0.36;
/** Mikro GPS / heading gürültüsü — eşikler biraz sıkı: daha az mikro hareket */
const NAV_JITTER_MAX_STEP_M = 0.62;
const NAV_JITTER_MAX_HEADING_DEG = 1.45;
const NAV_JITTER_MIN_CENTER_MOVE_M = 0.55;
const NAV_JITTER_MIN_HEADING_FOR_ANIM_DEG = 1.12;
const NAV_HEADING_PULSE_MIN_MS = 120;
const NAV_ZOOM_SMOOTH = 0.15;
/** Manevra mesafe anonsları arası minimum süre (ms) — daha sakin ses */
const NAV_SPEECH_MIN_GAP_MS = 4100;
/** Sürücü–yolcu bu kadar yakın + varış var → trip (turuncu) navigasyon aşaması */
const NAV_HANDOFF_TO_DESTINATION_M = 45;
/** Harita sürükleme / dokunma sonrası otomatik takip bu kadar ms durur; sonra yumuşakça devam */
const NAV_MAP_GESTURE_MS = 9_000;

function smoothZoomToward(prev: number | null, target: number): number {
  if (prev == null || !Number.isFinite(prev)) return target;
  const d = target - prev;
  if (Math.abs(d) < 0.04) return target;
  return prev + d * NAV_ZOOM_SMOOTH;
}

/**
 * Nav modu: tüm 10–20 km rotayı fit etmek yerine, sürücüye yakın ~3 km’lik segmenti göster.
 * Böylece “yol tarifi” hissi (yakın zoom) korunur.
 */
function sliceMeetingRouteForNavFit(user: MapLatLng, route: MapLatLng[], aheadM: number): MapLatLng[] {
  if (route.length < 2) return [user, ...route];
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversineMeters(user, route[i]);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const out: MapLatLng[] = [user];
  let prev = user;
  let acc = 0;
  for (let i = bestI; i < route.length; i++) {
    const step = haversineMeters(prev, route[i]);
    acc += step;
    if (acc > aheadM && out.length >= 2) break;
    out.push(route[i]);
    prev = route[i];
  }
  if (out.length < 2) {
    out.push(route[Math.min(route.length - 1, bestI + 1)]);
  }
  return out;
}

function NavManeuverArrowIcon({ kind, size = 56 }: { kind: ManeuverArrowKind; size?: number }) {
  const green = '#4ADE80';
  const white = '#FFFFFF';
  switch (kind) {
    case 'straight':
      return <MaterialCommunityIcons name="arrow-up-bold" size={size} color={green} />;
    case 'right':
      return <MaterialCommunityIcons name="arrow-right-bold" size={size} color={green} />;
    case 'left':
      return <MaterialCommunityIcons name="arrow-left-bold" size={size} color={green} />;
    case 'sharp_right':
      return <MaterialCommunityIcons name="arrow-right-bold" size={size + 6} color={white} />;
    case 'sharp_left':
      return <MaterialCommunityIcons name="arrow-left-bold" size={size + 6} color={white} />;
    case 'slight_right':
      return <MaterialCommunityIcons name="arrow-top-right" size={size} color={green} />;
    case 'slight_left':
      return <MaterialCommunityIcons name="arrow-top-left" size={size} color={green} />;
    case 'uturn':
      return <MaterialCommunityIcons name={'u-turn-left' as any} size={size} color={green} />;
    case 'roundabout':
      return <MaterialCommunityIcons name={'rotate-right' as any} size={size} color={green} />;
    case 'merge':
      return <MaterialCommunityIcons name="call-merge" size={size} color={green} />;
    case 'fork':
      return <MaterialCommunityIcons name="call-split" size={size} color={green} />;
    default:
      return <MaterialCommunityIcons name="navigation-variant" size={size} color={green} />;
  }
}

// 🆕 Hareketli Çerçeve Componenti
const AnimatedBorder = ({ color, children }: { color: string; children: React.ReactNode }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Dönen animasyon
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    
    // Nabız animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <Animated.View style={[{ transform: [{ scale: pulse }] }]}>
      <View style={[styles.animatedBorderOuter, { borderColor: color }]}>
        {children}
      </View>
      <Animated.View 
        style={[
          styles.animatedGlow, 
          { 
            borderColor: color,
            shadowColor: color,
            transform: [{ rotate: spin }] 
          }
        ]} 
      />
    </Animated.View>
  );
};

// 🆕 Işıklı Navigasyon İkonu
const NavigationIcon = ({ onPress }: { onPress: () => void }) => {
  const glow = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.navIconContainer, { opacity: glow }]}>
        <View style={styles.navIconOuter}>
          <LinearGradient colors={['#F97316', '#EA580C']} style={styles.navIconInner}>
            <Ionicons name="navigate" size={28} color="#FFF" />
          </LinearGradient>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function LiveMapView({
  userLocation,
  otherLocation,
  destinationLocation,
  isDriver,
  userName = 'Sen',
  otherUserName = 'Karşı Taraf',
  otherUserId,
  userId,      // 🆕
  tagId,       // 🆕
  tagStatus,
  tagStartedAt,
  price,
  offeredPrice,
  routeInfo,
  otherUserDetails,
  onBlock,
  onReport,
  onCall,
  onChat,
  onComplete,
  onRequestTripEnd,
  onForceEnd,
  onInRideComplaintForceEnd,
  onAutoComplete,
  onShowEndTripModal,
  onShowQRModal,  // 🆕
  otherTripVehicleKind = 'car',
  passengerPaymentMethod,
  onNavigationModeChange,
  onTrustRequest,
  trustRequestDisabled = false,
  trustRequestLabel,
  onOpenLeylekZekaSupport,
  peerMapPinScale = 1,
  selfGender = null,
  otherPassengerGender = null,
  otherLocationFromPickupFallback = false,
  boardingConfirmed = false,
  onDriverEnteredDestinationNavigation,
  onDriverYolcuyaGitAttempt,
  driverYolcuyaGitCoordContext = null,
  modernLeylekOfferUi = false,
}: LiveMapViewProps) {
  /** Sürücü + yolcu pini pickup yedeği: meeting/dest guard ve loglar tek bayrak (yolcu ekranında hep false) */
  const pickupFallbackForDriver = isDriver && !!otherLocationFromPickupFallback;

  const tripStarted =
    tagStartedAt != null && String(tagStartedAt).trim().length > 0;
  const tripOnboardSaferForceEnd =
    String(tagStatus || '').toLowerCase() === 'in_progress' ||
    !!boardingConfirmed ||
    tripStarted;

  const logPax = useCallback((label: string, fn: unknown) => {
    if (!isDriver) callCheck(label, fn);
  }, [isDriver]);

  const mapRef = useRef<any>(null);
  const pickupFallbackLoggedForTagRef = useRef<string | null>(null);
  const meetingRouteCoordinatesRef = useRef<MapLatLng[]>([]);
  const fitNavigationViewportRef = useRef<
    ((routeCoords?: MapLatLng[] | null) => void) | null
  >(null);
  const applyDriverActiveFollowViewportRef = useRef<(() => void) | null>(null);
  const insets = useSafeAreaInsets();
  const routeInfoRef = useRef(routeInfo);
  routeInfoRef.current = routeInfo;

  const meetingMetricSourceRef = useRef<MeetingMetricSource>('routeInfo');
  const destinationMetricSourceRef = useRef<DestinationMetricSource>('routeInfo');

  /** Tek OSRM buluşma fetch’i — dışarıdan (ör. Yolcuya Git) tetiklemek için */
  const runMeetingRouteOsrmFetchRef = useRef<() => void>(() => {});

  // BİLGİ KARTI STATE'İ
  const [showInfoCard, setShowInfoCard] = useState(false);
  const [inRideSaferFeVisible, setInRideSaferFeVisible] = useState(false);
  const [inRideSaferFeStep, setInRideSaferFeStep] = useState<'choice' | 'complaint'>('choice');
  const [inRideComplaintSubmitting, setInRideComplaintSubmitting] = useState(false);
  const inRideComplaintInFlightRef = useRef(false);

  // ARAMA STATE'LERİ
  const [isCallLoading, setIsCallLoading] = useState(false);

  /** Özel PNG marker: Android’de tracksViewChanges sürekli true kalınca pin kaybolabiliyor — bekleme ekranı gibi kısa süre sonra kapat */
  const [pinTracks, setPinTracks] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setPinTracks(false), 2400);
    return () => clearTimeout(id);
  }, []);

  /** Güven AL — kalkan, yumuşak nabız (sürücü + yolcu) */
  const guvenShieldPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!onTrustRequest) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(guvenShieldPulse, {
          toValue: 1.08,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(guvenShieldPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      guvenShieldPulse.setValue(1);
    };
  }, [onTrustRequest, guvenShieldPulse]);
  
  // YEŞİL ROTA: Şoför → Yolcu (buluşma) — koordinatlar yalnız OSRM polyline / düz çizgi
  const [meetingRouteCoordinates, setMeetingRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  useEffect(() => {
    meetingRouteCoordinatesRef.current = meetingRouteCoordinates;
  }, [meetingRouteCoordinates]);

  const [meetingDistance, setMeetingDistance] = useState<number | null>(null);
  const [meetingDuration, setMeetingDuration] = useState<number | null>(null);
  /** Buluşma gerçek rota km/dk yüklenirken (kuş uçuşu gösterilmez) */
  const [meetingRoadLoading, setMeetingRoadLoading] = useState(false);
  /** OSRM + backend sonrası hâlâ yol metriği yok (kuş uçuşu yok; nötr mesaj) */
  const [meetingRouteMetricsUnavailable, setMeetingRouteMetricsUnavailable] = useState(false);

  // TURUNCU ROTA: Yolcu → Hedef (varış)
  const [destinationRoute, setDestinationRoute] = useState<{latitude: number, longitude: number}[]>([]);
  const [destinationDistance, setDestinationDistance] = useState<number | null>(() => {
    const a = readAuthoritativeTripKmMinFromRouteInfo(routeInfo);
    return a ? a.km : null;
  });
  const [destinationDuration, setDestinationDuration] = useState<number | null>(() => {
    const a = readAuthoritativeTripKmMinFromRouteInfo(routeInfo);
    return a ? a.min : null;
  });
  const [destinationRoadLoading, setDestinationRoadLoading] = useState(false);
  const [destinationRouteMetricsUnavailable, setDestinationRouteMetricsUnavailable] =
    useState(false);
  const destinationRouteRef = useRef<{ latitude: number; longitude: number }[]>([]);
  useEffect(() => {
    destinationRouteRef.current = destinationRoute;
  }, [destinationRoute]);

  /** Hata bayrağı geldikten sonra “alınamadı” metnini gecikmeli göster (yarış / flicker önlemi) */
  const [meetingUnavailableUiVisible, setMeetingUnavailableUiVisible] = useState(false);
  const [destinationUnavailableUiVisible, setDestinationUnavailableUiVisible] =
    useState(false);

  const meetingRouteFetchIdRef = useRef(0);
  const meetingLoadUiStartRef = useRef<number | null>(null);
  const meetingLoadHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const destRouteFetchIdRef = useRef(0);
  const destLoadUiStartRef = useRef<number | null>(null);
  const destLoadHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const forceMeetingRoadLoadingFalse = useCallback(() => {
    meetingLoadUiStartRef.current = null;
    if (meetingLoadHideTimerRef.current) {
      clearTimeout(meetingLoadHideTimerRef.current);
      meetingLoadHideTimerRef.current = null;
    }
    setMeetingRoadLoading(false);
  }, []);

  const beginMeetingRoadLoadingUi = useCallback(() => {
    if (meetingLoadHideTimerRef.current) {
      clearTimeout(meetingLoadHideTimerRef.current);
      meetingLoadHideTimerRef.current = null;
    }
    meetingLoadUiStartRef.current = Date.now();
    setMeetingRoadLoading(true);
  }, []);

  const endMeetingRoadLoadingUi = useCallback(() => {
    const start = meetingLoadUiStartRef.current;
    const finish = () => {
      meetingLoadUiStartRef.current = null;
      if (meetingLoadHideTimerRef.current) {
        clearTimeout(meetingLoadHideTimerRef.current);
        meetingLoadHideTimerRef.current = null;
      }
      setMeetingRoadLoading(false);
    };
    if (start == null) {
      finish();
      return;
    }
    const elapsed = Date.now() - start;
    if (elapsed >= ROUTE_LOADING_MIN_VISIBLE_MS) finish();
    else {
      meetingLoadHideTimerRef.current = setTimeout(
        finish,
        ROUTE_LOADING_MIN_VISIBLE_MS - elapsed,
      );
    }
  }, []);

  const forceDestinationRoadLoadingFalse = useCallback(() => {
    destLoadUiStartRef.current = null;
    if (destLoadHideTimerRef.current) {
      clearTimeout(destLoadHideTimerRef.current);
      destLoadHideTimerRef.current = null;
    }
    setDestinationRoadLoading(false);
  }, []);

  const beginDestinationRoadLoadingUi = useCallback(() => {
    if (destLoadHideTimerRef.current) {
      clearTimeout(destLoadHideTimerRef.current);
      destLoadHideTimerRef.current = null;
    }
    destLoadUiStartRef.current = Date.now();
    setDestinationRoadLoading(true);
  }, []);

  const endDestinationRoadLoadingUi = useCallback(() => {
    const start = destLoadUiStartRef.current;
    const finish = () => {
      destLoadUiStartRef.current = null;
      if (destLoadHideTimerRef.current) {
        clearTimeout(destLoadHideTimerRef.current);
        destLoadHideTimerRef.current = null;
      }
      setDestinationRoadLoading(false);
    };
    if (start == null) {
      finish();
      return;
    }
    const elapsed = Date.now() - start;
    if (elapsed >= ROUTE_LOADING_MIN_VISIBLE_MS) finish();
    else {
      destLoadHideTimerRef.current = setTimeout(
        finish,
        ROUTE_LOADING_MIN_VISIBLE_MS - elapsed,
      );
    }
  }, []);

  useEffect(() => {
    if (!meetingRouteMetricsUnavailable) {
      setMeetingUnavailableUiVisible(false);
      return;
    }
    const t = setTimeout(
      () => setMeetingUnavailableUiVisible(true),
      ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [meetingRouteMetricsUnavailable]);

  useEffect(() => {
    if (!destinationRouteMetricsUnavailable) {
      setDestinationUnavailableUiVisible(false);
      return;
    }
    const t = setTimeout(
      () => setDestinationUnavailableUiVisible(true),
      ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [destinationRouteMetricsUnavailable]);

  /** Tag’deki sunucu trip km/dk — ilk kare + socket/refresh sonrası anında */
  useEffect(() => {
    const a = readAuthoritativeTripKmMinFromRouteInfo(routeInfo);
    if (!a) return;
    destinationMetricSourceRef.current = 'routeInfo';
    setDestinationDistance(a.km);
    setDestinationDuration(a.min);
    setDestinationRouteMetricsUnavailable(false);
  }, [routeInfo?.trip_distance_km, routeInfo?.trip_duration_min, tagId]);
  
  // Hedefe yaklaşma kontrolü
  const [nearDestination, setNearDestination] = useState(false);
  const autoCompleteTriggered = useRef(false);
  
  // 🆕 Matrix Tarzı Durum Mesajları
  const [matrixStatus, setMatrixStatus] = useState('');
  
  /** Sürücü "Yolcuya Git" — tamamen uygulama içi harita; dış Maps açılmaz */
  const [navigationMode, setNavigationMode] = useState(false);
  const navigationModeRef = useRef(false);
  useEffect(() => {
    navigationModeRef.current = navigationMode;
  }, [navigationMode]);

  /** Nav açılınca PNG marker bir kez daha çizilsin (tracksViewChanges kısa true) */
  useEffect(() => {
    if (!isDriver || !navigationMode) return;
    setPinTracks(true);
    const id = setTimeout(() => setPinTracks(false), 3800);
    return () => clearTimeout(id);
  }, [isDriver, navigationMode]);

  /** pickup: sürücü→yolcu | destination: yolcu konumu→varış (rota çizimi) */
  const [navigationStage, setNavigationStage] = useState<'pickup' | 'destination'>('pickup');
  const navigationStageRef = useRef<'pickup' | 'destination'>('pickup');
  useEffect(() => {
    navigationStageRef.current = navigationStage;
  }, [navigationStage]);

  const driverMapDebugPayload = useMemo(
    () => ({
      tagId: tagId != null && String(tagId).trim() !== '' ? String(tagId) : null,
      navigationMode,
      navigationStage,
      hasUserLocation: isValidRouteEndpoint(userLocation),
      hasOtherLocation: isValidRouteEndpoint(otherLocation),
      meetingRouteCoordinatesLength: meetingRouteCoordinates.length,
      otherLocationFromPickupFallback: pickupFallbackForDriver,
      isDriver,
    }),
    [
      tagId,
      navigationMode,
      navigationStage,
      userLocation?.latitude,
      userLocation?.longitude,
      otherLocation?.latitude,
      otherLocation?.longitude,
      meetingRouteCoordinates.length,
      pickupFallbackForDriver,
      isDriver,
    ],
  );

  useEffect(() => {
    if (!isDriver) return;
    console.log('DRIVER_ROUTE_RENDER_STATE', driverMapDebugPayload);
  }, [isDriver, driverMapDebugPayload]);

  useEffect(() => {
    console.log('NAVIGATION_MODE_CHANGED', {
      navigationMode,
      navigationStage,
      isDriver,
    });
  }, [navigationMode, navigationStage, isDriver]);

  const pickupNavStepsRef = useRef<{
    steps: OsrmNavStepParsed[];
    cumStart: number[];
  } | null>(null);
  const destNavStepsRef = useRef<{
    steps: OsrmNavStepParsed[];
    cumStart: number[];
  } | null>(null);

  const meetingHasOsrmPolylineRef = useRef(false);
  const lastNavRefreshDedupeKeyRef = useRef('');
  const lastNavRefreshThrottleAtRef = useRef(0);

  const clearMeetingRoute = useCallback((reason: string) => {
    console.log('CLEAR ROUTE CALLED', {
      reason,
      navigationMode,
      navigationStage,
      isDriver,
    });
    setMeetingRouteCoordinates([]);
    meetingHasOsrmPolylineRef.current = false;
    pickupNavStepsRef.current = null;
  }, [navigationMode, navigationStage, isDriver]);

  useEffect(() => {
    if (!boardingConfirmed) return;
    clearMeetingRoute('boarding_confirmed');
  }, [boardingConfirmed, clearMeetingRoute]);

  /** tagId reset effect’inde kullan; navigationMode değişince callback ref’i değişmesin diye ref */
  const clearMeetingRouteRef = useRef(clearMeetingRoute);
  clearMeetingRouteRef.current = clearMeetingRoute;

  const setMeetingRouteCoordsLogged = useCallback((coords: MapLatLng[]) => {
    console.log('SET ROUTE COORDS', coords.length);
    setMeetingRouteCoordinates(coords);
  }, []);

  const [navManeuverUi, setNavManeuverUi] = useState<NavManeuverUi | null>(null);
  /** Google Directions (backend) trafik gecikme oranına göre rota rengi */
  const [navRouteTrafficLevel, setNavRouteTrafficLevel] = useState<NavTrafficLevel>('free');

  const lastNavCameraAtRef = useRef(0);

  const navCamLastUserRef = useRef<MapLatLng | null>(null);
  const navCamLastRawHeadingRef = useRef<number | null>(null);
  const navCamLastTimeRef = useRef(0);
  const navSmoothHeadingRef = useRef(0);
  const navSmoothCenterRef = useRef<MapLatLng | null>(null);
  /** Önceki kare remainKm — mikro jitter’da yolcu/ hedef kaydıyla skip’i engellemek için */
  const navRemainKmRef = useRef<number | null>(null);
  const navCamLastManeuverKeyRef = useRef('');
  const navCamInitializedRef = useRef(false);
  /** Kullanıcı haritayı kaydırdı / yakınlaştırdı — otomatik kamera kısa süre durur */
  const navUserMapGestureUntilRef = useRef(0);
  const navGestureResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Yeniden ortala: bir kare jitter/throttle atla, merkezi GPS’e göre tazele */
  const navForceRecenterOnceRef = useRef(false);
  /** Nav modunda araç marker’ı: rota snap + drift filtresi (ham GPS yerine) */
  const [navDriverMapCoord, setNavDriverMapCoord] = useState<MapLatLng | null>(null);
  const navDriverStableRef = useRef<MapLatLng | null>(null);
  /** Eşleşme haritası sürücü pini (parse edilmiş) — Yolcuya Git origin yedeği */
  const driverMapPinCoordRef = useRef<MapLatLng | null>(null);
  useEffect(() => {
    if (!isDriver) {
      driverMapPinCoordRef.current = null;
      return;
    }
    const p = parseRouteEndpoint(userLocation);
    if (p) driverMapPinCoordRef.current = p;
  }, [isDriver, userLocation]);
  /** Nav başına bir kez Güven ipucu animasyonu */
  const guvenNavHintShownRef = useRef(false);
  /** Takip yeniden başladıktan sonra kısa süre: daha yumuşak merkez lerp + uzun anim */
  const navFollowResumeSoftUntilRef = useRef(0);
  /** Son gönderilen kamera heading — çok yavaşta titremeyi keser */
  const navCamHeadingSentRef = useRef<number | null>(null);
  /** Son animateCamera heading — mikro titremede atlamayı heading farkıyla gevşet */
  const navCamLastSentHeadingRef = useRef<number | null>(null);
  /** Marker bearing’den sonra ikinci kat kamera heading yumuşatması */
  const navCamDisplayedHeadingRef = useRef<number | null>(null);
  /** Gesture süresi bitince kamera efektini yeniden tetikler (GPS hareketsizken bile) */
  const [navFollowResumeTick, setNavFollowResumeTick] = useState(0);
  const scheduleNavMapGesturePause = useCallback(() => {
    if (Platform.OS !== 'web' && isDriver) {
      console.log('DRIVER_MAP_GESTURE_START', driverMapDebugPayload);
      console.log('DRIVER_AUTO_FOLLOW_PAUSED', {
        ...driverMapDebugPayload,
        untilMs: Date.now() + NAV_MAP_GESTURE_MS,
      });
    }
    navUserMapGestureUntilRef.current = Date.now() + NAV_MAP_GESTURE_MS;
    navFollowResumeSoftUntilRef.current = 0;
    if (navGestureResumeTimerRef.current) {
      clearTimeout(navGestureResumeTimerRef.current);
    }
    navGestureResumeTimerRef.current = setTimeout(() => {
      navGestureResumeTimerRef.current = null;
      navFollowResumeSoftUntilRef.current = Date.now() + NAV_RESUME_SOFT_MS;
      if (Platform.OS !== 'web' && isDriver) {
        console.log('DRIVER_MAP_GESTURE_END', driverMapDebugPayload);
        console.log('DRIVER_AUTO_FOLLOW_RESUMED', driverMapDebugPayload);
      }
      setNavFollowResumeTick((x) => x + 1);
    }, NAV_MAP_GESTURE_MS);
  }, [isDriver, driverMapDebugPayload]);
  const navProgrammaticCameraRef = useRef(false);
  const navCameraAnimClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Son GPS örneği — <5 m adım için kamera atlama */
  const navLastTickUserRef = useRef<MapLatLng | null>(null);
  /** GPS hızı (m/s); yoksa veya <0 ise null */
  const navGpsSpeedMpsRef = useRef<number | null>(null);
  const navSmoothZoomRef = useRef<number | null>(null);
  /** Rota eksenine göre marker dönüşü (pusula değil) */
  const navDriverMarkerSmoothedBearingRef = useRef<number | null>(null);
  /** Rota bearing (kuzeyden °) — kamera `heading` ile senkron */
  const [driverNavRouteHeadingDeg, setDriverNavRouteHeadingDeg] = useState(0);
  const navSpeechStateRef = useRef<{ key: string; bands: Set<string> }>({ key: '', bands: new Set() });
  const navSpeechLastAtRef = useRef(0);
  const navSpeechPrevMetersRef = useRef<number | null>(null);
  /** Sürücü nav: ilk manevra sessiz/ boşsa tek seferlik genel TTS */
  const navStartupSpeechDoneRef = useRef(false);
  const navStagePrevRef = useRef<'pickup' | 'destination'>('pickup');
  /** pickup→destination geçişinde parent callback (yolcuya socket tetik); tag değişince sıfırlanır */
  const pickupToDestNavHintPrevRef = useRef<'pickup' | 'destination'>(navigationStage);

  useEffect(() => {
    pickupToDestNavHintPrevRef.current = navigationStage;
  }, [tagId]);

  useEffect(() => {
    if (!isDriver || !navigationMode) {
      pickupToDestNavHintPrevRef.current = navigationStage;
      return;
    }
    const prev = pickupToDestNavHintPrevRef.current;
    pickupToDestNavHintPrevRef.current = navigationStage;
    if (
      prev === 'pickup' &&
      navigationStage === 'destination' &&
      boardingConfirmed
    ) {
      try {
        console.log(
          'DRIVER_DESTINATION_NAV_PHASE',
          JSON.stringify({ tagId: tagId != null ? String(tagId) : null }),
        );
      } catch {
        /* noop */
      }
      onDriverEnteredDestinationNavigation?.();
    }
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    boardingConfirmed,
    tagId,
    onDriverEnteredDestinationNavigation,
  ]);

  /** Pickup → hedef geçişinde kamera eşiklerini sıfırla (turuncu rota + araç hizası tazelensin) */
  useEffect(() => {
    if (!isDriver || !navigationMode) {
      navStagePrevRef.current = navigationStage;
      return;
    }
    if (navStagePrevRef.current === 'pickup' && navigationStage === 'destination') {
      navCamInitializedRef.current = false;
      navCamLastUserRef.current = null;
      navCamLastRawHeadingRef.current = null;
      navCamLastTimeRef.current = 0;
      navLastTickUserRef.current = null;
      navRemainKmRef.current = null;
      navCamDisplayedHeadingRef.current = null;
    }
    navStagePrevRef.current = navigationStage;
  }, [isDriver, navigationMode, navigationStage]);

  /** Sürücü navigasyonu kapatınca buluşma polyline’ını kaldır (yolcu ekranı etkilenmez) */
  useEffect(() => {
    if (!navigationMode && isDriver) {
      if (navCameraAnimClearTimerRef.current) {
        clearTimeout(navCameraAnimClearTimerRef.current);
        navCameraAnimClearTimerRef.current = null;
      }
      if (navGestureResumeTimerRef.current) {
        clearTimeout(navGestureResumeTimerRef.current);
        navGestureResumeTimerRef.current = null;
      }
      navProgrammaticCameraRef.current = false;
      navUserMapGestureUntilRef.current = 0;
      navFollowResumeSoftUntilRef.current = 0;
      navCamHeadingSentRef.current = null;
      navCamLastSentHeadingRef.current = null;
      navCamDisplayedHeadingRef.current = null;
      lastNavRefreshDedupeKeyRef.current = '';
      lastNavRefreshThrottleAtRef.current = 0;
      setNavigationStage('pickup');
      destNavStepsRef.current = null;
      setNavManeuverUi(null);
      setNavRouteTrafficLevel('free');
      navCamLastUserRef.current = null;
      navCamLastRawHeadingRef.current = null;
      navCamLastTimeRef.current = 0;
      navSmoothCenterRef.current = null;
      navRemainKmRef.current = null;
      navCamLastManeuverKeyRef.current = '';
      navCamInitializedRef.current = false;
      navLastTickUserRef.current = null;
      navForceRecenterOnceRef.current = false;
      guvenNavHintShownRef.current = false;
      navSmoothHeadingRef.current = 0;
      navGpsSpeedMpsRef.current = null;
      navSmoothZoomRef.current = null;
      navSpeechStateRef.current = { key: '', bands: new Set() };
      navSpeechLastAtRef.current = 0;
      navSpeechPrevMetersRef.current = null;
      navDriverStableRef.current = null;
      setNavDriverMapCoord(null);
      navDriverMarkerSmoothedBearingRef.current = null;
      setDriverNavRouteHeadingDeg(0);
    }
  }, [navigationMode, isDriver]);

  /**
   * Buluşma sonrası: sürücü yolcuya yakın + varış noktası var → hedef (turuncu) aşaması.
   * Navigasyon açıkken oturum aynı kalır; kamera / maneuver / OSRM hedef rotası devam eder.
   */
  useEffect(() => {
    if (!isDriver || !navigationMode || !userLocation || !otherLocation) return;
    if (navigationStage !== 'pickup') return;
    if (!destinationLocation) return;
    // matched: hedef navigasyon fazına yalnızca biniş onayından sonra — GPS yakınlığı tek başına yetmez
    const st = String(tagStatus || '').toLowerCase();
    if (st === 'matched' && !boardingConfirmed) return;
    if (haversineMeters(userLocation, otherLocation) < NAV_HANDOFF_TO_DESTINATION_M) {
      setNavigationStage('destination');
    }
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    tagStatus,
    boardingConfirmed,
  ]);

  /** Biniş onayı sonrası hedef fazı (45 m beklenmeden) */
  useEffect(() => {
    if (!isDriver || !navigationMode || !boardingConfirmed) return;
    if (navigationStage !== 'pickup') return;
    if (!destinationLocation) return;
    setNavigationStage('destination');
  }, [
    isDriver,
    navigationMode,
    boardingConfirmed,
    navigationStage,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
  ]);

  /** Sürücü nav: backend /directions ile trafik gecikme oranı → rota rengi (yeşil / turuncu / kırmızı) */
  useEffect(() => {
    if (Platform.OS === 'web') {
      setNavRouteTrafficLevel('free');
      return;
    }
    if (!isDriver || !navigationMode || !userLocation) {
      if (!isDriver || !navigationMode) setNavRouteTrafficLevel('free');
      return;
    }
    const dest =
      navigationStage === 'pickup'
        ? otherLocation
        : navigationStage === 'destination'
          ? destinationLocation
          : null;
    if (!dest) return;

    let cancelled = false;
    const fetchTrafficHint = async () => {
      try {
        const q = new URLSearchParams({
          origin_lat: String(userLocation.latitude),
          origin_lng: String(userLocation.longitude),
          dest_lat: String(dest.latitude),
          dest_lng: String(dest.longitude),
        });
        const res = await fetch(`${API_BASE_URL}/directions?${q}`);
        const data = await res.json();
        if (cancelled || !data?.success) return;
        setNavRouteTrafficLevel(trafficLevelFromDelayRatio(Number(data.traffic_delay_ratio)));
      } catch {
        if (!cancelled) setNavRouteTrafficLevel('free');
      }
    };
    void fetchTrafficHint();
    const id = setInterval(fetchTrafficHint, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
  ]);

  /** OSRM: buluşma ve hedef rotaları ayrı throttle — aynı anda birbirini iptal etmesin */
  const routeThrottleRef = useRef<{ meeting: number; destination: number }>({
    meeting: 0,
    destination: 0,
  });
  /** Haritayı sürekli fit etmek pinch-zoom'u bozar; sadece ilk yüklemede ve hedef ilk geldiğinde */
  const mapFitRef = useRef<{ initialDone: boolean; hadDestination: boolean }>({
    initialDone: false,
    hadDestination: false,
  });
  const lastOsrmAtRef = useRef(0);
  const lastOsrmKeyRef = useRef('');

  useEffect(() => {
    if (!isDriver || !otherLocationFromPickupFallback) {
      pickupFallbackLoggedForTagRef.current = null;
      return;
    }
    const tid = tagId != null && String(tagId).trim() !== '' ? String(tagId) : '_';
    if (pickupFallbackLoggedForTagRef.current === tid) return;
    pickupFallbackLoggedForTagRef.current = tid;
    console.log('Using pickup fallback for passenger');
  }, [isDriver, otherLocationFromPickupFallback, tagId]);

  useEffect(() => {
    console.log('NAVIGATION_MODE_FORCED_FALSE', { reason: 'tag_id_reset', tagId: tagId ?? null });
    clearMeetingRouteRef.current('tag_id_reset');
    lastOsrmKeyRef.current = '';
    lastOsrmAtRef.current = 0;
    mapFitRef.current = { initialDone: false, hadDestination: false };
    setNavigationMode(false);
    setNavigationStage('pickup');
    navStagePrevRef.current = 'pickup';
    destNavStepsRef.current = null;
    setNavManeuverUi(null);
    setNavRouteTrafficLevel('free');
    navCamLastUserRef.current = null;
    navCamLastRawHeadingRef.current = null;
    navCamLastTimeRef.current = 0;
    navSmoothCenterRef.current = null;
    navRemainKmRef.current = null;
    navCamLastManeuverKeyRef.current = '';
    navCamInitializedRef.current = false;
    navLastTickUserRef.current = null;
    navSmoothHeadingRef.current = 0;
    navGpsSpeedMpsRef.current = null;
    navSmoothZoomRef.current = null;
    navSpeechStateRef.current = { key: '', bands: new Set() };
    navSpeechLastAtRef.current = 0;
    navSpeechPrevMetersRef.current = null;
    navStartupSpeechDoneRef.current = false;
    meetingMetricSourceRef.current = 'routeInfo';
    destinationMetricSourceRef.current = 'routeInfo';
    navFollowResumeSoftUntilRef.current = 0;
    navCamHeadingSentRef.current = null;
    navCamLastSentHeadingRef.current = null;
    navCamDisplayedHeadingRef.current = null;
    if (navGestureResumeTimerRef.current) {
      clearTimeout(navGestureResumeTimerRef.current);
      navGestureResumeTimerRef.current = null;
    }
    navDriverStableRef.current = null;
    setNavDriverMapCoord(null);
    navDriverMarkerSmoothedBearingRef.current = null;
    setDriverNavRouteHeadingDeg(0);
  }, [tagId]);

  useEffect(() => {
    if (!isDriver) return;
    console.log('NAVIGATION_MODE_PROP_NOTIFY', {
      navigationMode,
      hasCallback: typeof onNavigationModeChange === 'function',
    });
    onNavigationModeChange?.(navigationMode);
  }, [isDriver, navigationMode, onNavigationModeChange]);

  /** Nav modunda yalnızca hız (zoom / pitch) için konum aboneliği */
  useEffect(() => {
    if (Platform.OS === 'web' || !isDriver || !navigationMode) return;
    let positionSub: Location.LocationSubscription | undefined;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }
        positionSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 900,
            distanceInterval: 0,
          },
          (loc) => {
            const s = loc.coords.speed;
            navGpsSpeedMpsRef.current =
              typeof s === 'number' && s >= 0 && Number.isFinite(s) ? s : null;
          },
        );
      } catch {
        /* speed opsiyonel */
      }
    })();
    return () => {
      positionSub?.remove();
    };
  }, [isDriver, navigationMode]);

  /** Rota snap + drift — navDriverMapCoord */
  useEffect(() => {
    if (!isDriver || !navigationMode) {
      navDriverStableRef.current = null;
      setNavDriverMapCoord(null);
      return;
    }
    if (!isValidMapCoord(userLocation)) {
      return;
    }
    const uLoc = userLocation as MapLatLng;
    const poly =
      navigationStage === 'pickup' && meetingRouteCoordinates.length >= 2
        ? meetingRouteCoordinates
        : navigationStage === 'destination' && destinationRoute.length > 2
          ? destinationRoute
          : [];
    let candidate: MapLatLng = {
      latitude: uLoc.latitude,
      longitude: uLoc.longitude,
    };
    if (poly.length >= 2) {
      const { point, distM } = closestPointOnPolyline(candidate, poly);
      if (distM <= NAV_MARKER_SNAP_MAX_M) {
        candidate = point;
      }
    }
    const prev = navDriverStableRef.current;
    if (!prev) {
      navDriverStableRef.current = candidate;
      setNavDriverMapCoord(candidate);
      return;
    }
    const d = haversineMeters(prev, candidate);
    if (d < NAV_MARKER_MICRO_IGNORE_M) {
      return;
    }
    let next = candidate;
    if (d < NAV_MARKER_SOFT_BLEND_MAX_M) {
      next = lerpLatLng(prev, candidate, NAV_MARKER_LERP);
    }
    navDriverStableRef.current = next;
    setNavDriverMapCoord(next);
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    userLocation?.latitude,
    userLocation?.longitude,
    meetingRouteCoordinates,
    destinationRoute,
  ]);

  /** Nav: rota bearing’i yumuşat — kamera `heading` (harita döner), overlay ikon sabit açıda. */
  useEffect(() => {
    if (!isDriver || !navigationMode) {
      navDriverMarkerSmoothedBearingRef.current = null;
      setDriverNavRouteHeadingDeg(0);
      return;
    }
    const anchor = resolveNavigationAnchor(navDriverStableRef, navDriverMapCoord, userLocation);
    if (!anchor || !isValidMapCoord(anchor)) return;

    const poly =
      navigationStage === 'pickup' && meetingRouteCoordinates.length >= 2
        ? meetingRouteCoordinates
        : navigationStage === 'destination' && destinationRoute.length > 2
          ? destinationRoute
          : [];
    const dest =
      navigationStage === 'pickup'
        ? otherLocation
        : destinationLocation && isValidMapCoord(destinationLocation)
          ? destinationLocation
          : null;

    let rawBearing =
      poly.length >= 2
        ? bearingAlongRouteAheadDeg(anchor, poly, 28, dest)
        : dest
          ? bearingDegrees(anchor, dest)
          : null;
    if (rawBearing == null || !Number.isFinite(rawBearing)) {
      if (dest && isValidMapCoord(dest)) {
        rawBearing = bearingDegrees(anchor, dest);
      }
    }
    if (rawBearing == null || !Number.isFinite(rawBearing)) return;

    const prevSm = navDriverMarkerSmoothedBearingRef.current;
    let smoothed = rawBearing;
    if (prevSm != null) {
      if (absAngleDiffDeg(prevSm, rawBearing) < NAV_MARKER_BEARING_RAW_DEADBAND_DEG) {
        smoothed = prevSm;
      } else {
        smoothed = interpolateHeading(prevSm, rawBearing, NAV_MARKER_BEARING_LERP);
      }
    }
    navDriverMarkerSmoothedBearingRef.current = smoothed;
    setDriverNavRouteHeadingDeg(smoothed);
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    userLocation?.latitude,
    userLocation?.longitude,
    navDriverMapCoord?.latitude,
    navDriverMapCoord?.longitude,
    meetingRouteCoordinates,
    destinationRoute,
    otherLocation?.latitude,
    otherLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
  ]);

  /**
   * Sürücü nav: harita araç altında akar — kamera `heading` + `pitch`, merkez GPS (snap) + ileri offset;
   * araç ikonu MapView dışında overlay (sabit ekran konumu).
   */
  useEffect(() => {
    const centerBase = resolveNavigationAnchor(navDriverStableRef, navDriverMapCoord, userLocation);
    if (Platform.OS === 'web' || !isDriver || !navigationMode || !centerBase || !mapRef.current) {
      return;
    }
    const bypassCameraGuards = navForceRecenterOnceRef.current;
    if (bypassCameraGuards) {
      navForceRecenterOnceRef.current = false;
      navSmoothCenterRef.current = null;
    }
    if (Date.now() < navUserMapGestureUntilRef.current && !bypassCameraGuards) {
      return;
    }
    const prevTick = navLastTickUserRef.current;
    const stepMovedM =
      prevTick != null ? haversineMeters(prevTick, centerBase) : Infinity;
    navLastTickUserRef.current = { ...centerBase };

    const speedMps = navGpsSpeedMpsRef.current;
    const isMoving =
      stepMovedM >= 1.2 ||
      (typeof speedMps === 'number' && speedMps >= 0 && speedMps >= NAV_CAMERA_STATIONARY_SPEED_MPS);

    const zoomTargetSpeed = clampNavZoom(zoomTargetForSpeedMps(speedMps));
    navSmoothZoomRef.current = smoothZoomToward(navSmoothZoomRef.current, zoomTargetSpeed);
    const zoomRaw =
      navSmoothZoomRef.current != null && Number.isFinite(navSmoothZoomRef.current)
        ? navSmoothZoomRef.current
        : zoomTargetSpeed;
    const zoom = clampActiveNavFollowZoom(clampNavZoom(zoomRaw));

    const polyNav =
      navigationStage === 'pickup' && meetingRouteCoordinates.length >= 2
        ? meetingRouteCoordinates
        : navigationStage === 'destination' && destinationRoute.length > 2
          ? destinationRoute
          : [];

    const destForCam =
      navigationStage === 'destination' && destinationLocation && isValidMapCoord(destinationLocation)
        ? destinationLocation
        : otherLocation;

    const headingDegBase =
      navDriverMarkerSmoothedBearingRef.current != null &&
      Number.isFinite(navDriverMarkerSmoothedBearingRef.current)
        ? navDriverMarkerSmoothedBearingRef.current
        : destForCam && isValidMapCoord(destForCam)
          ? bearingDegrees(centerBase, destForCam)
          : 0;

    let headingDeg = headingDegBase;
    const prevCamHeading = navCamDisplayedHeadingRef.current;
    if (prevCamHeading != null && Number.isFinite(headingDegBase)) {
      headingDeg = interpolateHeading(prevCamHeading, headingDegBase, NAV_CAMERA_HEADING_LERP);
    }
    navCamDisplayedHeadingRef.current = headingDeg;

    const remainKm =
      destForCam && isValidMapCoord(destForCam) ? straightLineKm(centerBase, destForCam) : 0;

    const targetCenterRaw = computeNavCameraCenterFromLookAhead(
      centerBase,
      polyNav,
      headingDeg,
      remainKm,
      zoom,
      speedMps,
    );
    const targetCenter = { ...targetCenterRaw };

    const prevSmoothCenter = navSmoothCenterRef.current;
    const inSoftResume = Date.now() < navFollowResumeSoftUntilRef.current;
    const centerLerp = inSoftResume
      ? isMoving
        ? NAV_CENTER_LERP_RESUME_MOVE
        : NAV_CENTER_LERP_RESUME_STILL
      : isMoving
        ? NAV_CENTER_LERP_FULL
        : NAV_CENTER_LERP_HEADING_ONLY;
    navSmoothCenterRef.current =
      prevSmoothCenter == null
        ? { ...targetCenter }
        : lerpLatLng(prevSmoothCenter, targetCenter, centerLerp);

    const centerAfterLerp = navSmoothCenterRef.current;
    if (!centerAfterLerp) {
      return;
    }
    const centerMovedM =
      prevSmoothCenter == null ? Infinity : haversineMeters(prevSmoothCenter, centerAfterLerp);

    const pitch = navPitchForSpeedMps(speedMps);
    const cameraCenter = { ...centerAfterLerp };

    const headingDeltaSinceLast =
      navCamLastSentHeadingRef.current == null
        ? Infinity
        : absAngleDiffDeg(navCamLastSentHeadingRef.current, headingDeg);

    const skipForJitter =
      !bypassCameraGuards &&
      navCamInitializedRef.current &&
      stepMovedM < NAV_JITTER_MAX_STEP_M &&
      centerMovedM < NAV_JITTER_MIN_CENTER_MOVE_M &&
      headingDeltaSinceLast < NAV_JITTER_MIN_HEADING_FOR_ANIM_DEG;

    if (skipForJitter) {
      return;
    }

    const now = Date.now();
    if (!bypassCameraGuards && now - navCamLastTimeRef.current < NAV_CAMERA_THROTTLE_MS) {
      return;
    }

    const duration = inSoftResume
      ? NAV_CAMERA_RESUME_ANIM_MS
      : isMoving
        ? NAV_CAMERA_ANIM_MS
        : NAV_CAMERA_HEADING_ONLY_MS;

    navProgrammaticCameraRef.current = true;
    if (navCameraAnimClearTimerRef.current) {
      clearTimeout(navCameraAnimClearTimerRef.current);
    }
    navCameraAnimClearTimerRef.current = setTimeout(() => {
      navProgrammaticCameraRef.current = false;
      navCameraAnimClearTimerRef.current = null;
    }, duration + 220);

    snapThenAnimateNavCamera(
      mapRef.current,
      {
        center: { ...cameraCenter },
        heading: headingDeg,
        pitch,
        zoom,
      },
      duration,
      bypassCameraGuards,
    );

    navCamLastSentHeadingRef.current = headingDeg;
    navCamLastTimeRef.current = now;
    navCamInitializedRef.current = true;
    lastNavCameraAtRef.current = now;
  }, [
    isDriver,
    navigationMode,
    navFollowResumeTick,
    driverNavRouteHeadingDeg,
    navigationStage,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    navDriverMapCoord?.latitude,
    navDriverMapCoord?.longitude,
    userLocation?.latitude,
    userLocation?.longitude,
    meetingRouteCoordinates,
    destinationRoute,
  ]);

  /** Turn-by-turn kartı (ok + mesafe + sokak) */
  useEffect(() => {
    const navPos = resolveNavigationAnchor(navDriverStableRef, navDriverMapCoord, userLocation);
    if (!isDriver || !navigationMode || !navPos) {
      setNavManeuverUi(null);
      return;
    }
    if (navigationStage === 'pickup') {
      const poly = meetingRouteCoordinates;
      const meta = pickupNavStepsRef.current;
      if (poly.length >= 2 && meta?.steps?.length && meta.cumStart.length) {
        const p = distanceAlongPolylineM(navPos, poly);
        setNavManeuverUi(buildNavManeuverUiFromSteps(p, meta.steps, meta.cumStart, 'pickup'));
      } else if (otherLocation) {
        const d = haversineMeters(navPos, otherLocation);
        const label = d >= 950 ? `${(d / 1000).toFixed(1)} km` : `${Math.max(20, Math.round(d / 10) * 10)} m`;
        setNavManeuverUi({
          instructionLine: `${label} sonra yolcuya yaklaşın`,
          streetName: null,
          arrowKind: 'straight',
          speechKey: 'pickup-fallback-approach',
          metersToManeuver: d,
          ttsLine: `${metersTurkishTts(d)} sonra yolcuya yaklaş`,
          ttsAction: 'yolcuya yaklaş',
          ttsMuted: false,
        });
      } else {
        setNavManeuverUi({
          instructionLine: 'Rotayı takip edin',
          streetName: null,
          arrowKind: 'unknown',
          speechKey: 'pickup-nolocation',
          metersToManeuver: null,
          ttsLine: 'Rotayı takip et',
          ttsAction: 'rotayı takip et',
          ttsMuted: false,
        });
      }
      return;
    }
    if (navigationStage === 'destination') {
      const poly = destinationRoute;
      const meta = destNavStepsRef.current;
      if (poly.length >= 2 && meta?.steps?.length && meta.cumStart.length) {
        const p = distanceAlongPolylineM(navPos, poly);
        setNavManeuverUi(buildNavManeuverUiFromSteps(p, meta.steps, meta.cumStart, 'destination'));
      } else if (destinationLocation) {
        const d = haversineMeters(navPos, destinationLocation);
        const label = d >= 950 ? `${(d / 1000).toFixed(1)} km` : `${Math.max(20, Math.round(d / 10) * 10)} m`;
        setNavManeuverUi({
          instructionLine: `${label} sonra hedefe yaklaşın`,
          streetName: null,
          arrowKind: 'straight',
          speechKey: 'dest-fallback-approach',
          metersToManeuver: d,
          ttsLine: `${metersTurkishTts(d)} sonra hedefe yaklaş`,
          ttsAction: 'hedefe yaklaş',
          ttsMuted: false,
        });
      } else {
        setNavManeuverUi({
          instructionLine: 'Hedefe gidin',
          streetName: null,
          arrowKind: 'unknown',
          speechKey: 'dest-nodropoff',
          metersToManeuver: null,
          ttsLine: 'Hedefe yaklaş',
          ttsAction: 'hedefe ilerle',
          ttsMuted: false,
        });
      }
    }
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    userLocation?.latitude,
    userLocation?.longitude,
    navDriverMapCoord?.latitude,
    navDriverMapCoord?.longitude,
    meetingRouteCoordinates,
    destinationRoute,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
  ]);

  useEffect(() => {
    if (!navigationMode) {
      if (Platform.OS !== 'web') {
        callCheck('Speech.stop', Speech.stop);
        if (typeof Speech.stop === 'function') {
          Speech.stop();
        }
      }
      navSpeechStateRef.current = { key: '', bands: new Set() };
      navSpeechLastAtRef.current = 0;
      navSpeechPrevMetersRef.current = null;
      navStartupSpeechDoneRef.current = false;
    }
  }, [navigationMode]);

  /** İlk manevra TTS yoksa tek sefer “navigasyon başladı” (web hariç) */
  useEffect(() => {
    if (Platform.OS === 'web' || !isDriver || !navigationMode || navStartupSpeechDoneRef.current) {
      return;
    }
    if (!navManeuverUi || !navManeuverUi.speechKey) {
      return;
    }
    const muted = !!navManeuverUi.ttsMuted;
    const line = navManeuverUi.ttsLine.trim();
    if (!muted && line.length > 0) {
      navStartupSpeechDoneRef.current = true;
      return;
    }
    navStartupSpeechDoneRef.current = true;
    callCheck('Speech.stop', Speech.stop);
    if (typeof Speech.stop === 'function') Speech.stop();
    callCheck('Speech.speak', Speech.speak);
    if (typeof Speech.speak === 'function') {
      Speech.speak('Yolcuya doğru navigasyon başlatıldı.', {
        language: 'tr-TR',
        rate: 0.92,
        pitch: 1.0,
        volume: 1,
      });
    }
    logNavDiag('NAV_VOICE_TRIGGER', {
      kind: 'startup_generic',
      reason: muted ? 'first_maneuver_muted' : 'first_maneuver_empty_tts',
      speechKey: navManeuverUi.speechKey,
    });
  }, [isDriver, navigationMode, navManeuverUi]);

  /**
   * Manevra değişince tam anons; aynı manevrada ~280 m / ~100 m hatırlatma + “şimdi …” (sessiz manevrada yok).
   */
  useEffect(() => {
    if (Platform.OS === 'web' || !isDriver || !navigationMode || !navManeuverUi) {
      return;
    }
    const key = navManeuverUi.speechKey;
    if (!key) return;

    const speak = (utterance: string) => {
      if (!utterance.trim()) return;
      callCheck('Speech.stop', Speech.stop);
      if (typeof Speech.stop === 'function') Speech.stop();
      callCheck('Speech.speak', Speech.speak);
      if (typeof Speech.speak === 'function') {
        Speech.speak(utterance, {
          language: 'tr-TR',
          rate: 0.92,
          pitch: 1.0,
          volume: 1,
        });
      }
    };

    const ttsMain = navManeuverUi.ttsLine.trim();
    const act = navManeuverUi.ttsAction.trim();
    const muted = !!navManeuverUi.ttsMuted;

    if (key !== navSpeechStateRef.current.key) {
      navSpeechStateRef.current = { key, bands: new Set() };
      navSpeechLastAtRef.current = Date.now();
      navSpeechPrevMetersRef.current = navManeuverUi.metersToManeuver ?? null;
      if (!muted && ttsMain.length > 0) {
        speak(ttsMain);
        logNavDiag('NAV_VOICE_TRIGGER', {
          kind: 'maneuver',
          speechKey: key,
          tts_len: ttsMain.length,
        });
      } else {
        logNavDiag('NAV_VOICE_SKIP', {
          reason: muted ? 'first_maneuver_muted' : 'empty_tts_line',
          speechKey: key,
        });
      }
      return;
    }

    if (muted || !act) {
      return;
    }

    const m = navManeuverUi.metersToManeuver;
    if (m == null || !Number.isFinite(m)) {
      navSpeechPrevMetersRef.current = m ?? null;
      return;
    }

    const prevM = navSpeechPrevMetersRef.current ?? Infinity;
    navSpeechPrevMetersRef.current = m;

    const now = Date.now();
    if (now - navSpeechLastAtRef.current < NAV_SPEECH_MIN_GAP_MS) return;

    const bands = navSpeechStateRef.current.bands;
    const hysteresisM = 12;
    const farBands: { id: string; th: number }[] = [
      { id: '280', th: 280 },
      { id: '100', th: 100 },
    ];
    for (const { id, th } of farBands) {
      const crossed = prevM > th + hysteresisM && m <= th;
      if (crossed && !bands.has(id)) {
        bands.add(id);
        navSpeechLastAtRef.current = now;
        const approxM = Math.max(th - 8, Math.min(th + 8, Math.round(m / 5) * 5));
        speak(`${metersTurkishTts(approxM)} sonra ${act}`);
        return;
      }
    }
    const nowTh = 34;
    if (prevM > nowTh + hysteresisM + 6 && m <= nowTh && !bands.has('now')) {
      bands.add('now');
      navSpeechLastAtRef.current = now;
      speak(`Şimdi ${act}`);
    }
  }, [navManeuverUi, isDriver, navigationMode]);
  
  // 🔥 YANIP SÖNEN BUTON ANİMASYONU
  const pulseAnim = useRef(new Animated.Value(1)).current;
  /** Sürücü "Yolcuya Git" — daha belirgin nefes alan ölçek */
  const navBreathAnim = useRef(new Animated.Value(1)).current;
  /** Küçük yeşil ara butonu — hızlı nefes animasyonu */
  const quickCallBreath = useRef(new Animated.Value(1)).current;
  const driverCueOpacity = useRef(new Animated.Value(1)).current;
  const canliBlink = useRef(new Animated.Value(1)).current;
  const callLabelBlink = useRef(new Animated.Value(1)).current;

  const [passengerEtaTick, setPassengerEtaTick] = useState(0);

  const passMotor = otherTripVehicleKind === 'motorcycle';
  const riderNoun = passMotor ? 'Motor yolcusu' : 'Yolcu';

  const tripCompassSpin = useRef(new Animated.Value(0)).current;
  const tripCompassRotate = tripCompassSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  useEffect(() => {
    if (!isDriver || navigationMode) return;
    const loop = Animated.loop(
      Animated.timing(tripCompassSpin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      tripCompassSpin.setValue(0);
    };
  }, [isDriver, navigationMode, tripCompassSpin]);

  /** Tam ekran navigasyonda büyük “Yolcuya Git” pusula dönüşü + nabız */
  const navGitCompassSpin = useRef(new Animated.Value(0)).current;
  const navGitCompassRotate = navGitCompassSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const navGitPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isDriver || !navigationMode) return;
    const loop = Animated.loop(
      Animated.timing(navGitCompassSpin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      navGitCompassSpin.setValue(0);
    };
  }, [isDriver, navigationMode, navGitCompassSpin]);
  useEffect(() => {
    if (!isDriver || !navigationMode) return;
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(navGitPulse, {
          toValue: 1.055,
          duration: 880,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(navGitPulse, {
          toValue: 1,
          duration: 880,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    beat.start();
    return () => {
      beat.stop();
      navGitPulse.setValue(1);
    };
  }, [isDriver, navigationMode, navGitPulse]);

  const matchYgitGlowAnim = useRef(new Animated.Value(0.35)).current;
  const matchYgitBreathAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isDriver || navigationMode) {
      matchYgitGlowAnim.setValue(0.35);
      matchYgitBreathAnim.setValue(1);
      return;
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(matchYgitGlowAnim, {
          toValue: 0.95,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(matchYgitGlowAnim, {
          toValue: 0.28,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(matchYgitBreathAnim, {
          toValue: 1.05,
          duration: 950,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(matchYgitBreathAnim, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();
    breathLoop.start();
    return () => {
      glowLoop.stop();
      breathLoop.stop();
      matchYgitGlowAnim.setValue(0.35);
      matchYgitBreathAnim.setValue(1);
    };
  }, [isDriver, navigationMode, matchYgitGlowAnim, matchYgitBreathAnim]);

  const guvenHintOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isDriver || !navigationMode || !onTrustRequest || guvenNavHintShownRef.current) {
      return;
    }
    guvenNavHintShownRef.current = true;
    guvenHintOpacity.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(guvenHintOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(guvenHintOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]);
    seq.start();
    return () => {
      seq.stop();
    };
  }, [isDriver, navigationMode, onTrustRequest, guvenHintOpacity]);

  /**
   * Normal ride icin kritik driver -> pickup navigation flow.
   * Backend/socket kaynakli pickup_lat/pickup_lng string gelebilir; koordinatlar
   * number'a parse edilmeden validation'a sokulmayacak.
   * Origin ve destination fallback zincirleri bozulmayacak.
   * Sorun olursa once YOLCUYA_GIT_BLOCKED_EXACT loguna bak.
   */
  const handleYolcuyaGitPress = useCallback(() => {
    void tapButtonHaptic();
    try {
      onDriverYolcuyaGitAttempt?.();
    } catch {
      /* noop */
    }

    console.log('YOLCUYA_GIT_PRESS_START', {
      isDriver,
      navigationMode,
      navigationStage,
      hasUserLocation: !!userLocation,
      hasOtherLocation: !!otherLocation,
      userLocation,
      otherLocation,
      otherLocationFromPickupFallback,
    });

    if (!isDriver) {
      console.log('YOLCUYA_GIT_BLOCKED', { reason: 'not_driver', userLocation, otherLocation });
      return;
    }

    const ctx = driverYolcuyaGitCoordContext;
    const activeTag = (ctx?.activeTag ?? null) as Record<string, unknown> | null;
    const anchorFallback = resolveNavigationAnchor(
      navDriverStableRef,
      navDriverMapCoord,
      userLocation as { latitude: number; longitude: number } | null,
    );
    const origin = resolveYolcuyaGitDriverOrigin(
      ctx,
      userLocation,
      navDriverMapCoord,
      navDriverStableRef.current,
      [driverMapPinCoordRef.current, anchorFallback],
    );
    const destination = resolveYolcuyaGitDriverDest(otherLocation, activeTag);

    const originOk = isValidMapCoord(origin);
    const destOk = isValidMapCoord(destination);

    if (!originOk || !destOk) {
      console.log('YOLCUYA_GIT_BLOCKED_EXACT', {
        origin,
        destination,
        driverLocation: ctx?.driverLocation ?? null,
        userLocation,
        currentLocation: ctx?.currentLocation ?? null,
        otherLocation,
        navDriverMapCoord,
        navDriverStableRef: navDriverStableRef.current,
        activeTag,
        pickup_lat: activeTag?.pickup_lat,
        pickup_lng: activeTag?.pickup_lng,
        passenger_location: activeTag?.passenger_location,
        originOk,
        destOk,
        driverMapPinCoordRef: driverMapPinCoordRef.current,
      });
      let alertBody: string;
      if (!originOk && !destOk) {
        alertBody = 'Eksik: origin=MISSING destination=MISSING';
      } else if (!originOk) {
        alertBody = 'Eksik: origin=MISSING (sürücü GPS / konum)';
      } else {
        alertBody = 'Eksik: destination=MISSING (yolcu / alış noktası)';
      }
      Alert.alert('Konum', alertBody);
      return;
    }

    logNavDiag('NAV_ROUTE_START', {
      tagId: tagId != null ? String(tagId) : null,
      pickup_fallback: pickupFallbackForDriver,
      meeting_metric_source: meetingMetricSourceRef.current,
      destination_metric_source: destinationMetricSourceRef.current,
    });

    if (!navigationMode) {
      navigationStageRef.current = 'pickup';
      navigationModeRef.current = true;
      setNavigationStage('pickup');
      navDriverStableRef.current = null;
      setNavDriverMapCoord(null);
      navDriverMarkerSmoothedBearingRef.current = null;
      setNavigationMode(true);
      console.log('YOLCUYA_GIT_SET_NAV', {
        nextNavigationMode: true,
        nextNavigationStage: 'pickup',
      });
      navCamHeadingSentRef.current = null;
      navCamLastSentHeadingRef.current = null;
      navCamDisplayedHeadingRef.current = null;
      navFollowResumeSoftUntilRef.current = Date.now() + NAV_RESUME_SOFT_MS;
      if (userId && tagId) {
        const q = new URLSearchParams({ user_id: userId, tag_id: tagId });
        void fetch(`${API_BASE_URL}/driver/on-the-way?${q}`, { method: 'POST' });
      }
      /* meeting-route effect navigationMode ile zaten tetiklenir; microtask ile ikinci fetch iptal/flicker üretiyordu */
    } else {
      lastNavCameraAtRef.current = 0;
      navUserMapGestureUntilRef.current = 0;
      navForceRecenterOnceRef.current = true;
      navFollowResumeSoftUntilRef.current = Date.now() + NAV_RESUME_SOFT_MS;
      if (navGestureResumeTimerRef.current) {
        clearTimeout(navGestureResumeTimerRef.current);
        navGestureResumeTimerRef.current = null;
      }
      setNavFollowResumeTick((x) => x + 1);
      runMeetingRouteOsrmFetchRef.current();
      InteractionManager.runAfterInteractions(() => {
        applyDriverActiveFollowViewportRef.current?.();
      });
    }
  }, [
    userLocation,
    otherLocation,
    navigationMode,
    navigationStage,
    pickupFallbackForDriver,
    isDriver,
    userId,
    tagId,
    setNavigationMode,
    setNavigationStage,
    setNavFollowResumeTick,
    onDriverYolcuyaGitAttempt,
    driverYolcuyaGitCoordContext,
    navDriverMapCoord,
  ]);

  const handleBoardingQrPress = useCallback(() => {
    if (!onShowQRModal) return;
    if (!boardingConfirmed && isDriver && userLocation && otherLocation) {
      const distanceKm =
        meetingDistance != null && Number.isFinite(meetingDistance) && meetingDistance >= 0
          ? meetingDistance
          : null;
      if (distanceKm == null) {
        Alert.alert(
          '📍 Mesafe',
          'Yolcuya mesafe sunucudan henüz gelmedi. Bir süre sonra tekrar deneyin.',
          [{ text: 'Tamam', style: 'default' }],
        );
        return;
      }
      const distanceMeters = distanceKm * 1000;
      if (distanceMeters > 1000) {
        Alert.alert(
          '📍 Yakın değil',
          `${riderNoun} sizden ${distanceMeters < 1000 ? Math.round(distanceMeters) + ' metre' : distanceKm.toFixed(1) + ' km'} uzakta.\n\nQR kodu göstermek için ${passMotor ? 'motor yolcusunun' : 'yolcunun'} yakınınızda olmanız gerekir.`,
          [{ text: 'Tamam', style: 'default' }],
        );
        return;
      }
    }
    onShowQRModal();
  }, [
    onShowQRModal,
    boardingConfirmed,
    isDriver,
    userLocation,
    otherLocation,
    meetingDistance,
    riderNoun,
    passMotor,
  ]);
  
  useEffect(() => {
    // Sürekli yanıp sönen animasyon
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    
    return () => pulseAnimation.stop();
  }, []);

  useEffect(() => {
    if (!isDriver) return;
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(navBreathAnim, {
          toValue: 1.06,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(navBreathAnim, {
          toValue: 0.98,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    breath.start();
    return () => breath.stop();
  }, [isDriver, navBreathAnim]);

  useEffect(() => {
    if (!isDriver) return;
    const cue = Animated.loop(
      Animated.sequence([
        Animated.timing(driverCueOpacity, {
          toValue: 0.72,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(driverCueOpacity, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    cue.start();
    return () => cue.stop();
  }, [isDriver, driverCueOpacity]);

  useEffect(() => {
    if (isDriver) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(canliBlink, {
          toValue: 0.38,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(canliBlink, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isDriver, canliBlink]);

  useEffect(() => {
    if (!onCall) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(callLabelBlink, {
          toValue: 0.38,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(callLabelBlink, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [onCall, callLabelBlink]);

  /** Tek satır: "SÜRÜCÜ AHMET ARA" / "YOLCU MEHMET ARA" — kalın parlak yeşil */
  const callPromptLine = useMemo(() => {
    if (isDriver) return 'Yolcuyu Ara';
    const role = 'SÜRÜCÜ';
    const name = displayFirstName(otherUserName, 'Sürücü').toLocaleUpperCase('tr-TR');
    return `${role} ${name} ARA`;
  }, [isDriver, otherUserName]);

  useEffect(() => {
    if (isDriver) return;
    const id = setInterval(() => setPassengerEtaTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isDriver]);

  const passengerDriverHint = useMemo(() => {
    if (isDriver || !userLocation || !otherLocation) {
      return '';
    }
    if (meetingDistance == null || !Number.isFinite(meetingDistance)) {
      const name = displayFirstName(otherUserName, 'Sürücünüz');
      return `${name} yolda`;
    }
    const meters = meetingDistance * 1000;
    return buildPassengerDriverHint(meters, meetingDuration, otherUserName);
  }, [
    isDriver,
    userLocation,
    otherLocation,
    meetingDuration,
    meetingDistance,
    otherUserName,
    passengerEtaTick,
  ]);
  
  // Matrix durumları — yalnızca backend meetingDistance (km); yoksa nötr metin
  useEffect(() => {
    if (boardingConfirmed) {
      setMatrixStatus(isDriver ? '> YOLCU ARACTA' : '> ARACTASIN');
      return;
    }
    if (!userLocation || !otherLocation) return;

    const distanceKm =
      meetingDistance != null && Number.isFinite(meetingDistance) && meetingDistance >= 0
        ? meetingDistance
        : null;
    if (distanceKm == null) {
      setMatrixStatus(isDriver ? '> YOLCUYU ALINIZ' : '> SURUCU YOLA CIKTI');
      return;
    }
    const meters = distanceKm * 1000;
    
    if (isDriver) {
      // SÜRÜCÜ İÇİN MESAJLAR
      if (meters > 500) {
        setMatrixStatus('> YOLCUYU ALINIZ');
      } else if (meters > 100) {
        setMatrixStatus('> YOLCUYA YAKLASTINIZ');
      } else if (meters <= 100 && !destinationLocation) {
        setMatrixStatus('> YOLCUYU ALDINIZ');
      } else if (destinationLocation) {
        setMatrixStatus('> YOLCUNUN HEDEFINE GIDIN');
      }
    } else {
      // YOLCU İÇİN MESAJLAR
      if (meters > 500) {
        setMatrixStatus('> SURUCU YOLA CIKTI');
      } else if (meters > 100) {
        setMatrixStatus('> SURUCU SIZIN ICIN GELIYOR');
      } else if (meters <= 100) {
        setMatrixStatus('> SURUCU GELDI');
      }
      if (destinationLocation && meters <= 100) {
        setMatrixStatus('> IYI YOLCULUKLAR');
      }
    }
  }, [
    userLocation,
    otherLocation,
    isDriver,
    destinationLocation,
    passMotor,
    meetingDistance,
    boardingConfirmed,
  ]);
  
  // Renk teması - Yolcu: Mor, Sürücü: Mavi
  const themeColor = isDriver ? '#3B82F6' : '#8B5CF6';
  const themeLightColor = isDriver ? '#DBEAFE' : '#EDE9FE';
  const themeGradient = isDriver ? ['#3B82F6', '#2563EB'] : ['#8B5CF6', '#7C3AED'];
  
  // Arama fonksiyonu - hızlı ve direkt
  const handleCall = async (type: 'audio' | 'video') => {
    if (isCallLoading) {
      return;
    }

    if (boardingConfirmed) {
      void tapButtonHaptic();
      appAlert('Bilgi', BOARDING_COMMS_CLOSED_USER_MSG, [], {
        variant: 'info',
        autoDismissMs: 3200,
        cancelable: true,
      });
      return;
    }

    if (userLocation && otherLocation) {
      const dM = haversineMeters(userLocation, otherLocation);
      if (dM < PROXIMITY_CALL_BLOCK_M) {
        Alert.alert(
          isDriver ? 'Yolcu yanınızda' : 'Sürücü yanınızda',
          'Karşı taraf çok yakın görünüyor; yan yanayken aramaya gerek yok.',
          [{ text: 'Tamam' }]
        );
        return;
      }
    }
    
    setIsCallLoading(true);
    
    try {
      if (!isDriver) callCheck('onCall', onCall);
      await onCall?.(type);
    } finally {
      setTimeout(() => {
        setIsCallLoading(false);
      }, 1000);
    }
  };

  useEffect(() => {
    if (!onCall) return;
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(quickCallBreath, {
          toValue: 1.08,
          duration: 580,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(quickCallBreath, {
          toValue: 1,
          duration: 580,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    breath.start();
    return () => breath.stop();
  }, [onCall, quickCallBreath]);

  // TURUNCU ROTA: Yolcu → Hedef — yalnız gerçek yol geometrisi (kuş uçuşu polyline yok)
  useEffect(() => {
    if (!destinationLocation) {
      setDestinationRoute([]);
      return;
    }
    if (!isValidRouteEndpoint(destinationLocation)) {
      setDestinationRoute([]);
      return;
    }
    const passengerLocation = isDriver ? otherLocation : userLocation;
    if (!isValidRouteEndpoint(passengerLocation)) {
      setDestinationRoute([]);
      return;
    }
    if (isDriver && navigationMode) {
      return;
    }
    const skipOsrmPolylineForDriverQuotedPickupFallback =
      pickupFallbackForDriver &&
      readAuthoritativeTripKmMinFromRouteInfo(routeInfoRef.current) != null;
    if (skipOsrmPolylineForDriverQuotedPickupFallback) {
      logNavDiag('MATCH_ROUTE_METRICS', {
        leg: 'destination_polyline',
        action: 'skip_polyline_preview_pickup_fallback',
        isDriver: true,
        pickup_fallback: true,
        reason: 'quoted_trip_preserves_server_km_no_visible_polyline_preview',
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      const br = await fetchBackendRouteMetrics(
        passengerLocation.latitude,
        passengerLocation.longitude,
        destinationLocation.latitude,
        destinationLocation.longitude,
      );
      if (cancelled) return;
      if (
        br.success &&
        br.overview_polyline &&
        typeof br.overview_polyline === 'string' &&
        br.overview_polyline.length > 2
      ) {
        const coords = decodeOsrmPolyline(br.overview_polyline, 5);
        if (coords.length >= 2) {
          const destCoords = destinationRouteCoordsOrEmpty(coords);
          if (destCoords.length >= 2) {
            setDestinationRoute(destCoords);
            return;
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    userLocation,
    otherLocation,
    destinationLocation,
    isDriver,
    navigationMode,
    pickupFallbackForDriver,
  ]);

  /** Sürücü navigasyon — hedef aşaması: yolcu→varış OSRM + adımlar (kuş uçuşu polyline yok) */
  useEffect(() => {
    if (!isDriver || !navigationMode || navigationStage !== 'destination') return;
    if (!isValidRouteEndpoint(otherLocation) || !isValidRouteEndpoint(destinationLocation)) {
      setDestinationRoute([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await fetchOsrmDrivingRouteWithSteps(
        otherLocation.latitude,
        otherLocation.longitude,
        destinationLocation.latitude,
        destinationLocation.longitude,
      );
      if (cancelled) return;
      if (r?.coordinates && r.coordinates.length >= 2) {
        const destCoords = destinationRouteCoordsOrEmpty(r.coordinates);
        if (destCoords.length >= 2) {
          destNavStepsRef.current = {
            steps: r.steps,
            cumStart: buildCumStartMeters(r.steps),
          };
          setDestinationRoute(destCoords);
          return;
        }
        destNavStepsRef.current = null;
        // OSRM geometrisi düşük kalite — backend overview dene
      }
      const br = await fetchBackendRouteMetrics(
        otherLocation.latitude,
        otherLocation.longitude,
        destinationLocation.latitude,
        destinationLocation.longitude,
      );
      if (cancelled) return;
      if (
        br.success &&
        br.overview_polyline &&
        typeof br.overview_polyline === 'string' &&
        br.overview_polyline.length > 2
      ) {
        const coords = decodeOsrmPolyline(br.overview_polyline, 5);
        if (coords.length >= 2) {
          destNavStepsRef.current = null;
          setDestinationRoute(destinationRouteCoordsOrEmpty(coords));
          return;
        }
      }
      destNavStepsRef.current = null;
    })();
    return () => {
      cancelled = true;
    };
  }, [isDriver, navigationMode, navigationStage, otherLocation, destinationLocation]);

  /**
   * Buluşma km/dk: backend routeInfo (sürücü navigasyon açıkken OSRM — driver→yolcu rota).
   * Sürücü + yolcu pini pickup yedeğindeyken routeInfo ile OSRM aynı anchor değil; yalnız OSRM/fetchRoute günceller.
   */
  useEffect(() => {
    if (pickupFallbackForDriver) {
      return;
    }
    const info = (routeInfo as Record<string, unknown>) || {};
    const meetingKm = Number(info.pickup_distance_km);
    const meetingMin = Number(info.pickup_eta_min);

    setMeetingDistance(Number.isFinite(meetingKm) && meetingKm > 0 ? meetingKm : null);
    setMeetingDuration(
      Number.isFinite(meetingMin) && meetingMin > 0 ? Math.max(0, Math.round(meetingMin)) : null,
    );
    meetingMetricSourceRef.current = 'routeInfo';
    setMeetingRouteMetricsUnavailable(false);
  }, [routeInfo, pickupFallbackForDriver]);

  /**
   * Hedef km/dk: yalnız routeInfo (trip_*) veya backend /route-metrics — istemci OSRM mesafesi gösterilmez.
   * Polyline ayrı effect’lerde OSRM/backend geometry.
   */
  useEffect(() => {
    if (!isValidRouteEndpoint(destinationLocation)) {
      forceDestinationRoadLoadingFalse();
      return;
    }
    const passengerLoc = isDriver ? otherLocation : userLocation;
    if (!isValidRouteEndpoint(passengerLoc)) {
      forceDestinationRoadLoadingFalse();
      return;
    }
    const serverTripGuard = readAuthoritativeTripKmMinFromRouteInfo(routeInfoRef.current);
    if (pickupFallbackForDriver && serverTripGuard != null) {
      destinationMetricSourceRef.current = 'routeInfo';
      forceDestinationRoadLoadingFalse();
      setDestinationRouteMetricsUnavailable(false);
      logNavDiag('MATCH_ROUTE_METRICS', {
        leg: 'destination',
        source: 'routeInfo',
        preserve_quoted: true,
        pickup_fallback: true,
        isDriver: true,
        action: 'skip_osrm_metrics_pickup_anchor',
      });
      return;
    }
    const fetchId = ++destRouteFetchIdRef.current;
    let cancelled = false;
    const quotedNow = readAuthoritativeTripKmMinFromRouteInfo(routeInfoRef.current) != null;
    const destAlreadyDrawn = destinationRouteRef.current.length > 2;
    if (!quotedNow && !destAlreadyDrawn) {
      beginDestinationRoadLoadingUi();
      setDestinationRouteMetricsUnavailable(false);
    } else {
      forceDestinationRoadLoadingFalse();
    }
    void (async () => {
      try {
        if (quotedNow) {
          return;
        }
        const br = await fetchBackendRouteMetrics(
          passengerLoc.latitude,
          passengerLoc.longitude,
          destinationLocation.latitude,
          destinationLocation.longitude,
        );
        if (cancelled) return;
        if (
          br.success &&
          br.distance_km != null &&
          Number.isFinite(br.distance_km) &&
          br.distance_km > 0 &&
          br.duration_min != null &&
          Number.isFinite(br.duration_min) &&
          br.duration_min > 0
        ) {
          if (!readAuthoritativeTripKmMinFromRouteInfo(routeInfoRef.current)) {
            setDestinationDistance(br.distance_km);
            setDestinationDuration(Math.max(0, Math.round(br.duration_min)));
            destinationMetricSourceRef.current = 'backend_route_metrics';
          }
          setDestinationRouteMetricsUnavailable(false);
          logNavDiag('MATCH_ROUTE_METRICS', {
            leg: 'destination',
            source: readAuthoritativeTripKmMinFromRouteInfo(routeInfoRef.current)
              ? 'routeInfo'
              : 'backend_route_metrics',
            isDriver,
            pickup_fallback: pickupFallbackForDriver,
            preserve_quoted: false,
            km: br.distance_km,
            min: br.duration_min,
          });
        } else {
          logNavDiag('MATCH_ROUTE_METRICS', {
            leg: 'destination',
            reason: 'no_backend_route_metrics',
            pickup_fallback: pickupFallbackForDriver,
          });
          if (!readAuthoritativeTripKmMinFromRouteInfo(routeInfoRef.current)) {
            setDestinationRouteMetricsUnavailable(true);
          }
        }
      } finally {
        if (!cancelled && destRouteFetchIdRef.current === fetchId) {
          endDestinationRoadLoadingUi();
        }
      }
    })();
    return () => {
      cancelled = true;
      destRouteFetchIdRef.current += 1;
      forceDestinationRoadLoadingFalse();
    };
  }, [
    destinationLocation,
    otherLocation,
    userLocation,
    isDriver,
    pickupFallbackForDriver,
    beginDestinationRoadLoadingUi,
    endDestinationRoadLoadingUi,
    forceDestinationRoadLoadingFalse,
  ]);

  useEffect(() => {
    if (destinationDistance == null || !Number.isFinite(destinationDistance)) return;
    const isNear = destinationDistance <= 1;
    setNearDestination(isNear);

    // Yolcu: otomatik tamamlama yok (sürücü complete endpoint yanlış aktörle çağrılabiliyordu).
    if (!isDriver) return;

    const tagIdOk = tagId != null && String(tagId).trim() !== '';
    const stageOk = navigationStage === 'destination';
    const tripOk =
      tagStatus === 'in_progress' &&
      !!tagStartedAt &&
      String(tagStartedAt).trim().length > 0;

    if (!tagIdOk || !tripOk || !stageOk) {
      autoCompleteTriggered.current = false;
      return;
    }

    if (isNear && !autoCompleteTriggered.current) {
      autoCompleteTriggered.current = true;
      Alert.alert(
        '🎯 Hedefe Ulaşıldı!',
        'Hedefe 1 km\'den az kaldı. Yolculuk otomatik olarak tamamlanacak ve +1 puan kazanacaksınız!',
        [{ text: 'Tamam', onPress: () => onAutoComplete?.() }],
      );
    }
  }, [
    destinationDistance,
    onAutoComplete,
    isDriver,
    navigationStage,
    tagStatus,
    tagStartedAt,
    tagId,
  ]);

  /** Sürücü: harita merkezi araçta — navigasyon modunda kullanıcı rotayı görüyor; otomatik merkezleme yok */
  useEffect(() => {
    if (!isDriver || navigationMode || !mapRef.current || !userLocation || !otherLocation) return;
    const dLat = Math.abs(userLocation.latitude - otherLocation.latitude);
    const dLng = Math.abs(userLocation.longitude - otherLocation.longitude);
    const latDelta = Math.min(0.14, Math.max(0.0028, dLat * 2.35));
    const lngDelta = Math.min(0.14, Math.max(0.0028, dLng * 2.35));
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        },
        420,
      );
    }, 140);
    return () => clearTimeout(t);
  }, [
    isDriver,
    navigationMode,
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
  ]);

  /**
   * Aktif turn-by-turn: fitToCoordinates yok — heading + pitch + ileri merkez; `setCamera` ile anında hizalama.
   * “Yeniden ortala” / rota tazele bu yolu kullanır.
   */
  const applyDriverActiveFollowViewport = useCallback(() => {
    if (Platform.OS === 'web' || !mapRef.current) return;
    const anchor = resolveNavigationAnchor(navDriverStableRef, navDriverMapCoord, userLocation);
    if (!anchor || !otherLocation) return;
    const dest =
      navigationStage === 'destination' && destinationLocation && isValidMapCoord(destinationLocation)
        ? destinationLocation
        : otherLocation;
    if (!isValidMapCoord(dest)) return;
    const headFallback = bearingDegrees(anchor, dest);
    const head =
      navDriverMarkerSmoothedBearingRef.current != null &&
      Number.isFinite(navDriverMarkerSmoothedBearingRef.current)
        ? navDriverMarkerSmoothedBearingRef.current
        : headFallback;
    navCamDisplayedHeadingRef.current = head;
    const remainKm = straightLineKm(anchor, dest);
    const speedMps = navGpsSpeedMpsRef.current;
    const zoom = clampActiveNavFollowZoom(clampNavZoom(zoomTargetForSpeedMps(speedMps)));
    const polyNav =
      navigationStage === 'pickup' && meetingRouteCoordinates.length >= 2
        ? meetingRouteCoordinates
        : navigationStage === 'destination' && destinationRoute.length > 2
          ? destinationRoute
          : [];
    const center = computeNavCameraCenterFromLookAhead(anchor, polyNav, head, remainKm, zoom, speedMps);
    const pitch = navPitchForSpeedMps(speedMps);
    navProgrammaticCameraRef.current = true;
    if (navCameraAnimClearTimerRef.current) {
      clearTimeout(navCameraAnimClearTimerRef.current);
    }
    snapThenAnimateNavCamera(
      mapRef.current,
      { center, heading: head, pitch, zoom },
      450,
      true,
    );
    navCamLastSentHeadingRef.current = head;
    /** Recenter sonrası takip efekti aynı look-ahead merkezinden lerp etsin (InteractionManager / effect yarışı). */
    navSmoothCenterRef.current = { ...center };
    navCameraAnimClearTimerRef.current = setTimeout(() => {
      navProgrammaticCameraRef.current = false;
      navCameraAnimClearTimerRef.current = null;
    }, 580);
    lastNavCameraAtRef.current = Date.now();
  }, [
    navigationStage,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    userLocation?.latitude,
    userLocation?.longitude,
    navDriverMapCoord?.latitude,
    navDriverMapCoord?.longitude,
    driverNavRouteHeadingDeg,
    meetingRouteCoordinates,
    destinationRoute,
  ]);

  /**
   * Özet / önizleme: rota sınırlarına fit (sürücü navigasyon kapalıyken veya harita genel görünümü).
   * Aktif navigasyon açıkken fitToCoordinates çağrılmaz — applyDriverActiveFollowViewport kullanılır.
   */
  const fitNavigationViewport = useCallback(
    (routeCoords?: MapLatLng[] | null) => {
      const anchor = resolveNavigationAnchor(navDriverStableRef, navDriverMapCoord, userLocation);
      if (!mapRef.current || !anchor || !otherLocation) return;

      if (isDriver && navigationMode) {
        applyDriverActiveFollowViewport();
        return;
      }

      const navMeetingOnly = isDriver && navigationMode && navigationStage === 'pickup';
      const legKm = straightLineKm(anchor, otherLocation);
      const polyForSlice =
        routeCoords && routeCoords.length >= 2 ? routeCoords : [anchor, otherLocation];
      const hasRichPolyline = polyForSlice.length >= 3;
      const longPickupLeg = navMeetingOnly && legKm >= 2.2;

      if (longPickupLeg && !hasRichPolyline && !(isDriver && navigationMode)) {
        mapRef.current.animateCamera(
          { center: anchor, pitch: 0, heading: 0, zoom: 17.4 },
          { duration: 480 },
        );
        lastNavCameraAtRef.current = Date.now();
        return;
      }

      let coords: MapLatLng[] = [...polyForSlice];
      if (longPickupLeg && hasRichPolyline) {
        coords = sliceMeetingRouteForNavFit(anchor, polyForSlice, 3400);
      }
      if (destinationLocation && !navMeetingOnly) {
        const last = coords[coords.length - 1];
        const d = destinationLocation;
        const same =
          Math.abs(last.latitude - d.latitude) < 1e-5 &&
          Math.abs(last.longitude - d.longitude) < 1e-5;
        if (!same) {
          coords.push(destinationLocation);
        }
      }
      const edgePadding = navMeetingOnly
        ? { top: 260, right: 36, bottom: 300, left: 36 }
        : { top: 120, right: 50, bottom: 350, left: 50 };
      try {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding,
          animated: true,
        });
      } catch {
        mapRef.current.animateCamera(
          { center: anchor, pitch: 0, heading: 0, zoom: 16.2 },
          { duration: 420 },
        );
      }
    },
    [
      userLocation,
      otherLocation,
      destinationLocation,
      isDriver,
      navigationMode,
      navigationStage,
      navDriverMapCoord?.latitude,
      navDriverMapCoord?.longitude,
      applyDriverActiveFollowViewport,
    ],
  );

  useEffect(() => {
    fitNavigationViewportRef.current = fitNavigationViewport;
  }, [fitNavigationViewport]);

  useEffect(() => {
    applyDriverActiveFollowViewportRef.current = applyDriverActiveFollowViewport;
  }, [applyDriverActiveFollowViewport]);

  /*
   * DEBUG — polyline render testi: OSRM/timing mi yoksa çizim mi ayırmak için geçici.
   * __DEV__ içinde comment’leri kaldırıp tek seferlik deneyin.
   *
   * useEffect(() => {
   *   if (!__DEV__) return;
   *   setMeetingRouteCoordinates([
   *     { latitude: 39.92, longitude: 32.85 },
   *     { latitude: 39.93, longitude: 32.86 },
   *   ]);
   * }, []);
   */

  /** GPS titreşiminde meeting-route effect’ini her tick tetikleme — ~11 m kovada anahtar */
  const meetingRouteFetchStableKey = useMemo(() => {
    const { ul, ol } = computeMeetingRouteEndpoints(
      isDriver,
      userLocation,
      otherLocation,
      driverYolcuyaGitCoordContext,
      navDriverMapCoord,
      navDriverStableRef.current,
    );
    const r4 = (n: number | undefined) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : 'x';
    if (!isValidMapCoord(ul) || !isValidMapCoord(ol)) {
      return `inv|${isDriver}|${navigationMode}|${navigationStage}|${pickupFallbackForDriver}|${String(tagId ?? '')}`;
    }
    return [
      'm',
      r4(ul!.latitude),
      r4(ul!.longitude),
      r4(ol!.latitude),
      r4(ol!.longitude),
      isDriver,
      navigationMode,
      navigationStage,
      pickupFallbackForDriver,
      String(tagId ?? ''),
    ].join('|');
  }, [
    isDriver,
    userLocation,
    otherLocation,
    driverYolcuyaGitCoordContext,
    navDriverMapCoord,
    navigationMode,
    navigationStage,
    pickupFallbackForDriver,
    tagId,
  ]);

  /**
   * Buluşma (user ↔ other) OSRM: tek ana effect — koordinat + rol/nav/stage closure’dan;
   * yeniden tetikleme: runMeetingRouteOsrmFetchRef (ör. Yolcuya Git).
   */
  useEffect(() => {
    if (__DEV__) {
      console.log('MEETING_ROUTE_EFFECT_ENTER', {
        isDriver,
        navigationMode,
        navigationStage,
        navModeRef: navigationModeRef.current,
        navStageRef: navigationStageRef.current,
        hasUserLocation: isValidRouteEndpoint(userLocation),
        hasOtherLocation: isValidRouteEndpoint(otherLocation),
      });
    }
    const fetchId = ++meetingRouteFetchIdRef.current;
    let cancelled = false;

    const fetchRoute = async () => {
      const { ul, ol } = computeMeetingRouteEndpoints(
        isDriver,
        userLocation,
        otherLocation,
        driverYolcuyaGitCoordContext,
        navDriverMapCoord,
        navDriverStableRef.current,
      );
      const navOn = navigationModeRef.current;
      const navStage = navigationStageRef.current;

      const valid = isValidMapCoord(ul) && isValidMapCoord(ol);
      if (!valid) {
        console.log('Route skipped - invalid coords', { userLocation, otherLocation, resolved: { ul, ol } });
        clearMeetingRouteRef.current('invalid_coords');
        return;
      }

      const uMeet = ul as MapLatLng;
      const oMeet = ol as MapLatLng;

      if (isDriver && navOn && navStage === 'destination') {
        return;
      }

      console.log('TRIGGER ROUTE FETCH', {
        isDriver,
        navigationMode: navOn,
        navigationStage: navStage,
        userLocation,
        otherLocation,
      });

      const start = isDriver ? uMeet : oMeet;
      const end = isDriver ? oMeet : uMeet;

      const meetingEndpointsKeyHere = () =>
        meetingEndpointsKey(start.latitude, start.longitude, end.latitude, end.longitude);

      /** Stale fetch veya boş geometri ile mevcut rotayı silme — yalnızca geçerli yeni polyline ile güncelle */
      const commitMeetingPolyline = (coords: MapLatLng[]): boolean => {
        if (cancelled || meetingRouteFetchIdRef.current !== fetchId) return false;
        if (!Array.isArray(coords) || coords.length < 2) return false;
        setMeetingRouteCoordsLogged(coords);
        return true;
      };

      /** OSRM başarısız: kuş uçuşu çizgi/km UI yok — routeInfo pickup + backend get_route_info / önbellek. */
      const recoverMeetingMetricsNoStraight = async () => {
        if (cancelled) return;
        setMeetingRouteMetricsUnavailable(false);
        const fromRi = readPickupKmMinFromRouteInfo(routeInfoRef.current);
        if (fromRi) {
          setMeetingDistance(fromRi.km);
          setMeetingDuration(fromRi.min);
          meetingMetricSourceRef.current = 'routeInfo';
        }
        try {
          const br = await fetchBackendRouteMetrics(
            start.latitude,
            start.longitude,
            end.latitude,
            end.longitude,
          );
          if (cancelled) return;
          if (
            br.success &&
            br.distance_km != null &&
            Number.isFinite(br.distance_km) &&
            br.distance_km > 0 &&
            br.duration_min != null &&
            Number.isFinite(br.duration_min) &&
            br.duration_min > 0
          ) {
            const km = br.distance_km;
            const min = Math.max(1, Math.round(br.duration_min));
            if (!fromRi) {
              setMeetingDistance(km);
              setMeetingDuration(min);
              meetingMetricSourceRef.current = 'backend_route_metrics';
            }
            logNavDiag('MATCH_ROUTE_METRICS', {
              leg: 'meeting',
              source: fromRi ? 'routeInfo' : 'backend_route_metrics',
              backend_source: br.source ?? null,
              isDriver,
              pickup_fallback: pickupFallbackForDriver,
              km: fromRi ? fromRi.km : km,
              min: fromRi ? fromRi.min : min,
            });
            if (br.overview_polyline && br.overview_polyline.length > 2) {
              const coords = decodeOsrmPolyline(br.overview_polyline, 5);
              if (coords.length >= 2) {
                if (commitMeetingPolyline(coords)) {
                  meetingHasOsrmPolylineRef.current = coords.length >= 3;
                  pickupNavStepsRef.current = null;
                  lastOsrmKeyRef.current = meetingEndpointsKeyHere();
                  if (!navigationModeRef.current) {
                    fitNavigationViewportRef.current?.(coords);
                  }
                  logNavDiag('NAV_ROUTE_SUCCESS', {
                    leg: 'meeting',
                    points: coords.length,
                    source: 'backend_polyline',
                    pickup_fallback: pickupFallbackForDriver,
                  });
                  return;
                }
                return;
              }
            }
            const epKRecover = meetingEndpointsKeyHere();
            if (
              meetingRouteCoordinatesRef.current.length >= 2 &&
              lastOsrmKeyRef.current === epKRecover
            ) {
              logNavDiag('NAV_ROUTE_FALLBACK', {
                leg: 'meeting',
                reason: 'preserve_polyline_same_endpoints',
                visible_straight: false,
                isDriver,
                pickup_fallback: pickupFallbackForDriver,
              });
              return;
            }
            logNavDiag('NAV_ROUTE_FALLBACK', {
              leg: 'meeting',
              reason: 'backend_metrics_no_polyline',
              visible_straight: false,
              isDriver,
            });
            if (!fromRi) {
              setMeetingRouteMetricsUnavailable(true);
            }
            return;
          }
        } catch {
          /* sessiz — routeInfo yukarıda kaldıysa metrik korunur */
        }
        const epKNoRoad = meetingEndpointsKeyHere();
        if (
          meetingRouteCoordinatesRef.current.length >= 2 &&
          lastOsrmKeyRef.current === epKNoRoad
        ) {
          logNavDiag('NAV_ROUTE_FALLBACK', {
            leg: 'meeting',
            reason: 'preserve_polyline_same_endpoints_after_failed_recover',
            visible_straight: false,
            isDriver,
            pickup_fallback: pickupFallbackForDriver,
          });
          if (!fromRi) {
            setMeetingRouteMetricsUnavailable(true);
          }
          return;
        }
        logNavDiag('NAV_ROUTE_FALLBACK', {
          leg: 'meeting',
          reason: 'no_road_metrics_after_osrm',
          visible_straight: false,
          isDriver,
          pickup_fallback: pickupFallbackForDriver,
        });
        if (!fromRi) {
          setMeetingRouteMetricsUnavailable(true);
        }
      };

      const legKeyForLoading = meetingEndpointsKeyHere();
      const alreadyDrawingThisLeg =
        meetingRouteCoordinatesRef.current.length >= 2 &&
        lastOsrmKeyRef.current === legKeyForLoading;
      if (!alreadyDrawingThisLeg) {
        beginMeetingRoadLoadingUi();
      }
      setMeetingRouteMetricsUnavailable(false);
      try {
        let prefetchPickupBackendKm: number | undefined;
        let prefetchPickupBackendMin: number | undefined;
        let prefetchPickupAppliedFromBackend = false;
        if (!readPickupKmMinFromRouteInfo(routeInfoRef.current)) {
          const brPre = await fetchBackendRouteMetrics(
            start.latitude,
            start.longitude,
            end.latitude,
            end.longitude,
          );
          if (cancelled) return;
          if (
            brPre.success &&
            brPre.distance_km != null &&
            Number.isFinite(brPre.distance_km) &&
            brPre.distance_km > 0 &&
            brPre.duration_min != null &&
            Number.isFinite(brPre.duration_min) &&
            brPre.duration_min > 0
          ) {
            const dk = brPre.distance_km;
            const dm = Math.max(1, Math.round(brPre.duration_min));
            setMeetingDistance(dk);
            setMeetingDuration(dm);
            meetingMetricSourceRef.current = 'backend_route_metrics';
            setMeetingRouteMetricsUnavailable(false);
            prefetchPickupAppliedFromBackend = true;
            prefetchPickupBackendKm = dk;
            prefetchPickupBackendMin = dm;
          }
          if (
            brPre.success &&
            typeof brPre.overview_polyline === 'string' &&
            brPre.overview_polyline.length > 2
          ) {
            const coordsPre = decodeOsrmPolyline(brPre.overview_polyline, 5);
            if (coordsPre.length >= 2) {
              if (commitMeetingPolyline(coordsPre)) {
                meetingHasOsrmPolylineRef.current = coordsPre.length >= 3;
                pickupNavStepsRef.current = null;
                lastOsrmKeyRef.current = meetingEndpointsKeyHere();
                if (!navigationModeRef.current) {
                  fitNavigationViewportRef.current?.(coordsPre);
                }
                logNavDiag('NAV_ROUTE_SUCCESS', {
                  leg: 'meeting',
                  points: coordsPre.length,
                  source: 'backend_polyline',
                  pickup_fallback: pickupFallbackForDriver,
                });
              }
            }
          }
        }
        if (isDriver) {
          const riLog = routeInfoRef.current as Record<string, unknown> | null | undefined;
          try {
            console.log('DRIVER_MAP_ROUTE_INPUT', {
              activeTagRouteInfo: riLog,
              propRouteInfo: routeInfoRef.current,
              routeInfoKeys: riLog && typeof riLog === 'object' ? Object.keys(riLog) : null,
              hasOverviewPolyline: !!(
                riLog &&
                typeof riLog.overview_polyline === 'string' &&
                riLog.overview_polyline.length > 2
              ),
              hasPolyline: !!(
                riLog && typeof riLog.polyline === 'string' && riLog.polyline.length > 2
              ),
              hasCoordinates: Array.isArray(riLog?.coordinates)
                ? (riLog.coordinates as unknown[]).length
                : null,
              activeTagId: tagId,
              activeTagStatus: tagStatus,
            });
          } catch {
            /* noop */
          }

          const serverPolyline = decodeMeetingPolylineFromServerRouteInfo(routeInfoRef.current);
          if (serverPolyline && serverPolyline.length >= 2) {
            if (commitMeetingPolyline(serverPolyline)) {
              meetingHasOsrmPolylineRef.current = serverPolyline.length >= 3;
              pickupNavStepsRef.current = null;
              lastOsrmKeyRef.current = meetingEndpointsKeyHere();
              if (!navigationModeRef.current) {
                fitNavigationViewportRef.current?.(serverPolyline);
              }
              endMeetingRoadLoadingUi();
              logNavDiag('NAV_ROUTE_SUCCESS', {
                leg: 'meeting',
                points: serverPolyline.length,
                source: 'google_route_info_polyline',
                pickup_fallback: pickupFallbackForDriver,
              });
            }
          }

          console.log('DRIVER_ROUTE_PREFETCH_START', {
            tagId: tagId != null && String(tagId).trim() !== '' ? String(tagId) : null,
            navigationMode: navOn,
            navigationStage: navStage,
            hasUserLocation: true,
            hasOtherLocation: true,
            meetingRouteCoordinatesLength: meetingRouteCoordinatesRef.current.length,
            otherLocationFromPickupFallback: pickupFallbackForDriver,
            isDriver,
          });
          const rw = await fetchOsrmDrivingRouteWithSteps(
            start.latitude,
            start.longitude,
            end.latitude,
            end.longitude,
          );
          if (cancelled) return;
          if (rw && rw.coordinates.length >= 2) {
            const kmOsrm = rw.distanceM / 1000;
            const minOsrm = Math.max(1, Math.round(rw.durationS / 60));
            const pickupAuth = readPickupKmMinFromRouteInfo(routeInfoRef.current);
            if (commitMeetingPolyline(rw.coordinates)) {
              console.log('DRIVER_ROUTE_PREFETCH_SUCCESS', {
                tagId: tagId != null && String(tagId).trim() !== '' ? String(tagId) : null,
                navigationMode: navigationModeRef.current,
                navigationStage: navigationStageRef.current,
                hasUserLocation: true,
                hasOtherLocation: true,
                points: rw.coordinates.length,
                meetingRouteCoordinatesLength: meetingRouteCoordinatesRef.current.length,
                otherLocationFromPickupFallback: pickupFallbackForDriver,
                isDriver,
              });
              meetingHasOsrmPolylineRef.current = true;
              pickupNavStepsRef.current = {
                steps: rw.steps,
                cumStart: buildCumStartMeters(rw.steps),
              };
              if (pickupAuth) {
                meetingMetricSourceRef.current = 'routeInfo';
                setMeetingRouteMetricsUnavailable(false);
              } else if (!prefetchPickupAppliedFromBackend && !cancelled) {
                setMeetingRouteMetricsUnavailable(true);
              }
              logNavDiag('NAV_ROUTE_SUCCESS', {
                leg: 'meeting',
                points: rw.coordinates.length,
                distance_m: rw.distanceM,
                duration_s: rw.durationS,
                pickup_fallback: pickupFallbackForDriver,
              });
              logNavDiag('MATCH_ROUTE_METRICS', {
                leg: 'meeting',
                source: pickupAuth
                  ? 'routeInfo'
                  : prefetchPickupAppliedFromBackend
                    ? 'backend_route_metrics'
                    : 'polyline_only',
                isDriver: true,
                pickup_fallback: pickupFallbackForDriver,
                km: pickupAuth?.km ?? prefetchPickupBackendKm,
                min: pickupAuth?.min ?? prefetchPickupBackendMin,
                osrm_km: kmOsrm,
                osrm_min: minOsrm,
              });
              console.log('ROUTE FETCH OK', { points: rw.coordinates.length });
              console.log('PICKUP ETA', {
                routeInfo: pickupAuth,
                backend:
                  prefetchPickupAppliedFromBackend && prefetchPickupBackendKm != null
                    ? { km: prefetchPickupBackendKm, min: prefetchPickupBackendMin }
                    : null,
                osrm_geometry_only_km_min: { km: kmOsrm, min: minOsrm },
              });
              lastOsrmAtRef.current = Date.now();
              lastOsrmKeyRef.current = meetingEndpointsKeyHere();
              if (!navigationModeRef.current) {
                fitNavigationViewportRef.current?.(rw.coordinates);
              }
            }
          } else {
            console.log('DRIVER_ROUTE_PREFETCH_EMPTY', {
              tagId: tagId != null && String(tagId).trim() !== '' ? String(tagId) : null,
              navigationMode: navigationModeRef.current,
              navigationStage: navigationStageRef.current,
              hasUserLocation: true,
              hasOtherLocation: true,
              meetingRouteCoordinatesLength: meetingRouteCoordinatesRef.current.length,
              otherLocationFromPickupFallback: pickupFallbackForDriver,
              isDriver,
            });
            console.warn('Route empty');
            await recoverMeetingMetricsNoStraight();
          }
        } else {
          const brPax = await fetchBackendRouteMetrics(
            start.latitude,
            start.longitude,
            end.latitude,
            end.longitude,
          );
          if (cancelled) return;
          const polyPax =
            brPax.success &&
            typeof brPax.overview_polyline === 'string' &&
            brPax.overview_polyline.length > 2
              ? decodeOsrmPolyline(brPax.overview_polyline, 5)
              : [];
          if (polyPax.length >= 2) {
            const pickupAuth = readPickupKmMinFromRouteInfo(routeInfoRef.current);
            if (commitMeetingPolyline(polyPax)) {
              meetingHasOsrmPolylineRef.current = polyPax.length >= 3;
              if (pickupAuth) {
                meetingMetricSourceRef.current = 'routeInfo';
                setMeetingRouteMetricsUnavailable(false);
              } else if (!prefetchPickupAppliedFromBackend && !cancelled) {
                setMeetingRouteMetricsUnavailable(true);
              }
              logNavDiag('NAV_ROUTE_SUCCESS', {
                leg: 'meeting',
                points: polyPax.length,
                source: 'backend_route_metrics',
                pickup_fallback: false,
              });
              logNavDiag('MATCH_ROUTE_METRICS', {
                leg: 'meeting',
                source: pickupAuth ? 'routeInfo' : 'backend_route_metrics',
                isDriver: false,
                pickup_fallback: false,
                km: pickupAuth?.km ?? prefetchPickupBackendKm,
                min: pickupAuth?.min ?? prefetchPickupBackendMin,
              });
              lastOsrmAtRef.current = Date.now();
              lastOsrmKeyRef.current = meetingEndpointsKeyHere();
              fitNavigationViewportRef.current?.(polyPax);
              console.log('ROUTE FETCH OK', { points: polyPax.length });
            }
          } else {
            console.warn('Route empty');
            await recoverMeetingMetricsNoStraight();
          }
        }
      } catch (err) {
        if (isDriver) {
          console.log('DRIVER_ROUTE_PREFETCH_ERROR', {
            tagId: tagId != null && String(tagId).trim() !== '' ? String(tagId) : null,
            navigationMode: navigationModeRef.current,
            navigationStage: navigationStageRef.current,
            hasUserLocation: true,
            hasOtherLocation: true,
            meetingRouteCoordinatesLength: meetingRouteCoordinatesRef.current.length,
            otherLocationFromPickupFallback: pickupFallbackForDriver,
            isDriver,
            message: String(err),
          });
        }
        console.warn('Route error:', err);
        if (!cancelled) await recoverMeetingMetricsNoStraight();
      } finally {
        if (!cancelled && meetingRouteFetchIdRef.current === fetchId) {
          endMeetingRoadLoadingUi();
        }
      }
    };

    void fetchRoute();
    runMeetingRouteOsrmFetchRef.current = () => {
      void fetchRoute();
    };

    return () => {
      cancelled = true;
      meetingRouteFetchIdRef.current += 1;
      forceMeetingRoadLoadingFalse();
    };
  }, [
    meetingRouteFetchStableKey,
    setMeetingRouteCoordsLogged,
    beginMeetingRoadLoadingUi,
    endMeetingRoadLoadingUi,
    forceMeetingRoadLoadingFalse,
  ]);

  const onDriverNavMapReady = useCallback(() => {
    if (
      isDriver &&
      meetingRouteCoordinates.length > 1 &&
      mapRef.current &&
      userLocation &&
      otherLocation
    ) {
      InteractionManager.runAfterInteractions(() => {
        if (navigationModeRef.current) {
          applyDriverActiveFollowViewportRef.current?.();
        } else {
          fitNavigationViewport(meetingRouteCoordinates);
        }
      });
    }
  }, [
    isDriver,
    meetingRouteCoordinates,
    fitNavigationViewport,
    userLocation,
    otherLocation,
    applyDriverActiveFollowViewport,
  ]);

  // Yolcu: tüm noktaları göster; sürücüde fit yok (merkez araçta)
  useEffect(() => {
    if (
      !mapRef.current ||
      !isValidRouteEndpoint(userLocation) ||
      !isValidRouteEndpoint(otherLocation) ||
      isDriver
    ) {
      if (isDriver && isValidRouteEndpoint(userLocation) && isValidRouteEndpoint(otherLocation)) {
        mapFitRef.current.initialDone = true;
        mapFitRef.current.hadDestination = !!destinationLocation;
      }
      return;
    }

    const hasDest = !!destinationLocation;
    const destJustAdded = hasDest && !mapFitRef.current.hadDestination;
    mapFitRef.current.hadDestination = hasDest;

    if (mapFitRef.current.initialDone && !destJustAdded) {
      return;
    }

    const t = setTimeout(() => {
      const coordinates = [userLocation, otherLocation];
      if (destinationLocation) {
        coordinates.push(destinationLocation);
      }
      const map = mapRef.current;
      // `map?.fitToCoordinates(...)` still calls undefined if ref exists but native method not bound yet (Android).
      callCheck('mapRef.current.fitToCoordinates', map?.fitToCoordinates);
      const fit = map && typeof map.fitToCoordinates === 'function' ? map.fitToCoordinates.bind(map) : null;
      console.log('[PAX_DEBUG] LiveMapView passenger fit', { hasMap: !!map, fitToCoordinates: typeof map?.fitToCoordinates });
      if (fit) {
        try {
          fit(coordinates, {
            edgePadding: { top: 210, right: 48, bottom: 300, left: 48 },
            animated: true,
          });
        } catch (e) {
          if (__DEV__) console.warn('[LiveMapView] fitToCoordinates', e);
        }
      }
      mapFitRef.current.initialDone = true;
    }, 650);
    return () => clearTimeout(t);
  }, [userLocation, otherLocation, destinationLocation, isDriver]);

  const driverNavRouteLayers = useMemo(() => {
    const navPos = resolveNavigationAnchor(navDriverStableRef, navDriverMapCoord, userLocation);
    if (!isDriver || !navigationMode || !navPos) return null;
    if (navigationStage === 'pickup' && meetingRouteCoordinates.length >= 2) {
      const p = distanceAlongPolylineM(navPos, meetingRouteCoordinates);
      const s = splitRouteForNavDisplay(meetingRouteCoordinates, p);
      return { ...s, palette: 'pickup' as const };
    }
    if (navigationStage === 'destination' && destinationRoute.length > 2) {
      const p = distanceAlongPolylineM(navPos, destinationRoute);
      const s = splitRouteForNavDisplay(destinationRoute, p);
      return { ...s, palette: 'dest' as const };
    }
    return null;
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    meetingRouteCoordinates,
    destinationRoute,
    userLocation?.latitude,
    userLocation?.longitude,
    navDriverMapCoord?.latitude,
    navDriverMapCoord?.longitude,
  ]);

  const pickupNavStroke = pickupNavRouteStrokeColors(navRouteTrafficLevel);
  const destNavStroke = destinationNavRouteStrokeColors(navRouteTrafficLevel);

  // Web fallback
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.webFallback}>
          <Ionicons name="map" size={64} color={themeColor} />
          <Text style={styles.webFallbackText}>Harita sadece mobil uygulamada görüntülenebilir</Text>
          {meetingDistance && (
            <Text style={styles.distanceText}>
              Buluşma: {meetingDistance.toFixed(1)} km • {meetingDuration} dk
            </Text>
          )}
          {destinationDistance && (
            <Text style={styles.destinationDistanceText}>
              Hedefe: {destinationDistance.toFixed(1)} km • {destinationDuration} dk
            </Text>
          )}
        </View>
      </View>
    );
  }

  const driverNavActive = isDriver && navigationMode;
  /** Tam ekran sürücü navigasyonu: yalnızca arama + üst kart + harita */
  const driverNavImmersive = isDriver && navigationMode;
  /** Modern kart+sheet — yalnız Leylek/Muhabbet teklif akışı (`modernLeylekOfferUi`). Normal ride hep klasik. */
  const driverRideUiModern = !!(isDriver && MapView && !driverNavImmersive && modernLeylekOfferUi);
  /** Üst kart (~alış/hedef/yolcu satırları) + alt sheet yüksekliğine göre harita güvenli alanı */
  const driverRideModernMapPadTop = Math.max(insets.top, 12) + 272;
  const driverRideModernMapPadBottom = 262 + Math.max(insets.bottom, 12);
  const driverRideModernLocateFabBottom = 268 + Math.max(insets.bottom, 10);
  const driverTripTag = (driverYolcuyaGitCoordContext?.activeTag ?? null) as
    | Record<string, unknown>
    | null
    | undefined;
  const driverPickupAddr = String(
    driverTripTag?.pickup_location ?? driverTripTag?.pickup_address ?? '',
  ).trim();
  const driverDropoffAddr = String(
    driverTripTag?.dropoff_location ??
      driverTripTag?.dropoff_address ??
      driverTripTag?.destination ??
      '',
  ).trim();
  const driverNearPickupForQr =
    driverRideUiModern &&
    !boardingConfirmed &&
    meetingDistance != null &&
    Number.isFinite(meetingDistance) &&
    meetingDistance <= 1.2;
  /** Matrix satırı büyük yön butonu — yalnız etiket/renk; handler aynı (boardingConfirmed). */
  const driverMatrixNavChipLabel = boardingConfirmed ? 'Hedefe Git' : 'Yolcuya Git';
  const driverMatrixNavChipGradientColors = boardingConfirmed
    ? (['#C2410C', '#EA580C', '#F97316', '#FB923C'] as const)
    : (['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA'] as const);
  const driverMatrixNavChipIconColor = boardingConfirmed ? '#FFEDD5' : '#EFF6FF';
  const meetingHasUiMetrics =
    meetingDistance != null &&
    meetingDuration != null &&
    Number.isFinite(meetingDistance) &&
    Number.isFinite(meetingDuration);
  const meetingPolylineRoadReady = meetingRouteCoordinates.length >= 2;
  const destinationPolylineRoadReady = destinationRoute.length > 2;
  const showMeetingRouteUnavailable =
    !meetingHasUiMetrics &&
    meetingRouteMetricsUnavailable &&
    meetingUnavailableUiVisible &&
    !meetingRoadLoading;
  const showMeetingRouteCalculating =
    !meetingPolylineRoadReady &&
    !meetingHasUiMetrics &&
    !showMeetingRouteUnavailable &&
    (meetingRoadLoading || meetingRouteMetricsUnavailable);

  const destQuotedTripInfo = readAuthoritativeTripKmMinFromRouteInfo(routeInfo) != null;
  const destHasUiMetrics =
    destQuotedTripInfo ||
    (destinationDistance != null &&
      destinationDuration != null &&
      Number.isFinite(destinationDistance) &&
      Number.isFinite(destinationDuration));
  const showDestinationRouteUnavailable =
    !!destinationLocation &&
    !destHasUiMetrics &&
    destinationRouteMetricsUnavailable &&
    destinationUnavailableUiVisible &&
    !destinationRoadLoading;
  const showDestinationRouteCalculating =
    !!destinationLocation &&
    !destinationPolylineRoadReady &&
    !destHasUiMetrics &&
    !showDestinationRouteUnavailable &&
    (destinationRoadLoading || destinationRouteMetricsUnavailable);

  const showMeetingRoutePolylineLoadingHint =
    meetingHasUiMetrics && !meetingPolylineRoadReady;
  const showDestinationRoutePolylineLoadingHint =
    !!destinationLocation &&
    destHasUiMetrics &&
    !destinationPolylineRoadReady;

  const routeValueStyle = [
    styles.routeValueModern,
    driverNavImmersive ? styles.routeValueModernNav : null,
  ];

  const navMapVehicleCoord =
    driverNavImmersive && userLocation && isValidMapCoord(userLocation)
      ? navDriverMapCoord && isValidMapCoord(navDriverMapCoord)
        ? navDriverMapCoord
        : userLocation
      : null;
  const navMapVehicleRotation =
    (typeof driverNavRouteHeadingDeg === 'number' && Number.isFinite(driverNavRouteHeadingDeg)
      ? driverNavRouteHeadingDeg
      : 0) + getDriverNavRotationOffsetDeg(passMotor ? 'motorcycle' : 'car');

  useEffect(() => {
    if (!driverRideUiModern) return;
    console.log('[ride_ui_modern]', {
      driverRideUiModern,
      modernLeylekOfferUi,
      boardingConfirmed,
      hasForceEnd: typeof onForceEnd === 'function',
      driverNavImmersive,
      hasMapView: !!MapView,
    });
  }, [driverRideUiModern, modernLeylekOfferUi, boardingConfirmed, onForceEnd, driverNavImmersive]);

  useEffect(() => {
    if (!driverRideUiModern || boardingConfirmed) return;
    if (!onForceEnd) {
      console.warn('[ride_ui_modern] onForceEnd missing, Zorla Bitir gizlenir');
    }
  }, [driverRideUiModern, boardingConfirmed, onForceEnd]);

  useEffect(() => {
    if (!__DEV__ || !driverRideUiModern || !boardingConfirmed) return;
    console.log('[ride_ui_modern] boardingConfirmed: QR / Zorla Bitir row suppressed');
  }, [driverRideUiModern, boardingConfirmed]);

  return (
    <View style={styles.container}>
      {/* 🆕 BULUTLU ARKAPLAN - Sadece üst kısım */}
      {!driverRideUiModern ? (
        <>
          <Image 
            source={{ uri: isDriver 
              ? 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80'
              : 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80'
            }}
            style={styles.cloudBackground}
            resizeMode="cover"
          />
          <View
            pointerEvents="none"
            style={[
              styles.cloudTintOverlay,
              { backgroundColor: isDriver ? 'rgba(124, 58, 237, 0.10)' : 'rgba(14, 165, 233, 0.08)' },
            ]}
          />
        </>
      ) : null}

      {driverNavImmersive ? (
        <View
          style={[
            styles.navManeuverBanner,
            styles.navManeuverBannerCompact,
            { paddingTop: Math.max(insets.top, 8) + 4 },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.navManeuverBannerStage, styles.navManeuverBannerStageCompact]}>
            {navigationStage === 'pickup' ? 'Buluşmaya gidiyorsunuz' : 'Hedefe gidiyorsunuz'}
          </Text>
          <View style={[styles.navManeuverBannerRow, styles.navManeuverBannerRowCompact]}>
            <View style={[styles.navManeuverIconCircle, styles.navManeuverIconCircleCompact]}>
              <NavManeuverArrowIcon kind={navManeuverUi?.arrowKind ?? 'unknown'} size={44} />
            </View>
            <View style={styles.navManeuverTextCol}>
              <Text
                style={[styles.navManeuverBannerManeuver, styles.navManeuverBannerManeuverCompact]}
                numberOfLines={2}
              >
                {navManeuverUi?.instructionLine ?? 'Rota hazırlanıyor…'}
              </Text>
              {navManeuverUi?.streetName ? (
                <Text style={[styles.navManeuverStreet, styles.navManeuverStreetCompact]} numberOfLines={1}>
                  {navManeuverUi.streetName}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      
      {/* Uyarı yazısı (matrixStatus) artık üst bilgi panelinin altına sabitleniyor */}

      {/* HARİTA - Google Maps - ZOOM VE SCROLL AKTİF + sol üst Ara (48x48) */}
      {MapView ? (
        <View style={styles.mapSlot}>
        <MapView
          key={isDriver ? `driver-map-${String(tagId ?? 'active')}` : 'map-default'}
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: userLocation?.latitude || 39.9334,
            longitude: userLocation?.longitude || 32.8597,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={onDriverNavMapReady}
          mapPadding={
            driverNavImmersive
              ? {
                  top: Math.max(insets.top, 12) + 152,
                  right: 12,
                  bottom: driverNavImmersiveMapPaddingBottomPx(insets.bottom),
                  left: 12,
                }
              : driverRideUiModern
                ? {
                    top: driverRideModernMapPadTop,
                    right: 12,
                    bottom: driverRideModernMapPadBottom,
                    left: 12,
                  }
                : driverNavActive
                ? { top: 270, right: 12, bottom: 300, left: 12 }
                : { top: 200, right: 14, bottom: 268, left: 14 }
          }
          followsUserLocation={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          scrollEnabled
          zoomEnabled
          rotateEnabled={!driverNavImmersive}
          pitchEnabled
          onPanDrag={() => {
            if (Platform.OS === 'web' || !isDriver) return;
            scheduleNavMapGesturePause();
          }}
          onPress={() => {
            if (Platform.OS === 'web' || !isDriver) return;
            scheduleNavMapGesturePause();
          }}
          onRegionChangeComplete={(_region: any, details?: { isGesture?: boolean }) => {
            if (Platform.OS === 'web' || !isDriver) return;
            if (navProgrammaticCameraRef.current) return;
            if (details && details.isGesture === false) return;
            scheduleNavMapGesturePause();
          }}
          minZoomLevel={4}
          maxZoomLevel={22}
          customMapStyle={mapStyle}
          showsTraffic
        >
          {isDriver &&
            navigationMode &&
            navigationStage === 'pickup' &&
            driverNavRouteLayers?.palette === 'pickup' && (
              <>
                {driverNavRouteLayers.dim.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.dim}
                    strokeWidth={6}
                    strokeColor={pickupNavStroke.dim}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={8}
                  />
                ) : null}
                {driverNavRouteLayers.bright.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.bright}
                    strokeWidth={12}
                    strokeColor={pickupNavStroke.bright}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={9}
                  />
                ) : null}
                {driverNavRouteLayers.hot.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.hot}
                    strokeWidth={16}
                    strokeColor={pickupNavStroke.hot}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={10}
                  />
                ) : null}
              </>
            )}
          {isDriver &&
            navigationMode &&
            navigationStage === 'pickup' &&
            !driverNavRouteLayers &&
            Array.isArray(meetingRouteCoordinates) &&
            meetingRouteCoordinates.length > 1 && (
              <Polyline
                coordinates={meetingRouteCoordinates}
                strokeWidth={11}
                strokeColor={pickupNavStroke.bright}
                lineCap="round"
                lineJoin="round"
                zIndex={10}
              />
            )}
          {!isDriver &&
            !boardingConfirmed &&
            Array.isArray(meetingRouteCoordinates) &&
            meetingRouteCoordinates.length > 1 && (
              <Polyline
                coordinates={meetingRouteCoordinates}
                strokeColor="#047857"
                strokeWidth={8}
                lineJoin="round"
                lineCap="round"
              />
            )}
          {isDriver &&
            !navigationMode &&
            !boardingConfirmed &&
            Array.isArray(meetingRouteCoordinates) &&
            meetingRouteCoordinates.length > 1 && (
              <Polyline
                coordinates={meetingRouteCoordinates}
                strokeWidth={7}
                strokeColor="rgba(37, 99, 235, 0.88)"
                lineCap="round"
                lineJoin="round"
                zIndex={10}
              />
            )}
          
          {/* TURUNCU ROTA: Yolcu → Hedef - KALIN */}
          {isDriver &&
            navigationMode &&
            navigationStage === 'destination' &&
            driverNavRouteLayers?.palette === 'dest' && (
              <>
                {driverNavRouteLayers.dim.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.dim}
                    strokeWidth={6}
                    strokeColor={destNavStroke.dim}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={8}
                  />
                ) : null}
                {driverNavRouteLayers.bright.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.bright}
                    strokeWidth={12}
                    strokeColor={destNavStroke.bright}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={9}
                  />
                ) : null}
                {driverNavRouteLayers.hot.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.hot}
                    strokeWidth={16}
                    strokeColor={destNavStroke.hot}
                    lineCap="round"
                    lineJoin="round"
                    zIndex={10}
                  />
                ) : null}
              </>
            )}
          {destinationRoute.length > 2 &&
            destinationLocation &&
            !(isDriver && navigationMode && navigationStage === 'pickup') &&
            !(isDriver && navigationMode && navigationStage === 'destination' && driverNavRouteLayers?.palette === 'dest') && (
              <Polyline
                coordinates={destinationRoute}
                strokeColor="#EA580C"
                strokeWidth={8}
                lineDashPattern={[12, 6]}
                lineJoin="round"
                lineCap="round"
              />
            )}

          {/* Navigasyon: araç haritada (flat + rota bearing); çizgiler zIndex 8–10 altında */}
          {driverNavImmersive && navMapVehicleCoord && Marker ? (
            <Marker
              coordinate={navMapVehicleCoord}
              flat
              rotation={navMapVehicleRotation}
              anchor={getDriverNavMarkerAnchor(passMotor ? 'motorcycle' : 'car')}
              zIndex={6000}
              tracksViewChanges={false}
            >
              <TripMapMarkerImage
                source={getDriverMarkerImage(passMotor ? 'motorcycle' : 'car')}
                size={passMotor ? MARKER_PIXEL.driverMotor : MARKER_PIXEL.driverCar}
              />
            </Marker>
          ) : null}

          {/* BEN — PNG (bekleme ekranı ile aynı ölçü / tracks kuralı) */}
          {userLocation && !driverNavActive && !(boardingConfirmed && !isDriver) && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={pinTracks}
              zIndex={isDriver ? 5000 : 5200}
            >
              <TripMapMarkerImage
                source={
                  isDriver
                    ? getDriverMarkerImage(passMotor ? 'motorcycle' : 'car')
                    : getPassengerMarkerImage(selfGender ?? null, userId ?? null)
                }
                size={
                  isDriver
                    ? passMotor
                      ? MARKER_PIXEL.driverMotor
                      : MARKER_PIXEL.driverCar
                    : MARKER_PIXEL.passenger
                }
              />
            </Marker>
          )}

          {/* KARŞI TARAF — sürücü: yolcu PNG; yolcu: sürücü araç PNG */}
          {otherLocation && !(boardingConfirmed && isDriver) && (
            <Marker 
              coordinate={otherLocation} 
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={pinTracks}
              zIndex={isDriver ? 4800 : 4100}
              onPress={() => setShowInfoCard(true)}
            >
              <TripMapMarkerImage
                source={
                  isDriver
                    ? getPassengerMarkerImage(otherPassengerGender ?? null, otherUserId ?? null)
                    : getDriverMarkerImage(passMotor ? 'motorcycle' : 'car')
                }
                scale={peerMapPinScale}
                size={
                  isDriver
                    ? MARKER_PIXEL.passenger
                    : passMotor
                      ? MARKER_PIXEL.driverMotor
                      : MARKER_PIXEL.driverCar
                }
              />
            </Marker>
          )}

          {/* HEDEF - Bayrak Stili */}
          {destinationLocation && (
            <Marker
              coordinate={destinationLocation}
              anchor={{ x: 0.15, y: 0.95 }}
              tracksViewChanges={pinTracks}
              zIndex={3000}
            >
              <View style={styles.proFlagMarker} collapsable={false}>
                <View style={styles.proFlagPole} />
                <View style={styles.proFlagBody}>
                  <Ionicons name="flag" size={14} color="#FFF" />
                </View>
                <View style={styles.proFlagBase} />
              </View>
            </Marker>
          )}
        </MapView>
        </View>
      ) : (
        // Web fallback - harita yok
        <View style={styles.webFallback}>
          <Ionicons name="map-outline" size={64} color="#3FA9F5" />
          <Text style={styles.webFallbackText}>Harita mobil cihazda görüntülenir</Text>
        </View>
      )}

      {/* Sürücü ekranında "Yolcu burada..." yazısı kaldırıldı */}

      {/* ÜST BİLGİ PANELİ — sürücü özet kartı veya klasik gradient kart */}
      {driverRideUiModern ? (
        <View style={[styles.driverRideTopWrap, { top: Math.max(insets.top, 10) + 6 }]} pointerEvents="box-none">
          <View style={styles.driverRideTopCard}>
            {__DEV__ ? (
              <View style={styles.driverRideUiDebugBadge} pointerEvents="none">
                <Text style={styles.driverRideUiDebugBadgeText}>MODERN RIDE UI</Text>
              </View>
            ) : null}
            <View style={styles.driverRideTopHeader}>
              <View
                style={[
                  styles.driverRideStatusPill,
                  boardingConfirmed ? styles.driverRideStatusPillStarted : null,
                ]}
              >
                <View style={styles.driverRideStatusDot} />
                <Text
                  style={[
                    styles.driverRideStatusPillText,
                    boardingConfirmed ? styles.driverRideStatusPillTextStarted : null,
                  ]}
                >
                  {boardingConfirmed ? 'Yolculuk başladı' : 'Yolculuk aktif'}
                </Text>
              </View>
              <View style={styles.driverRideTopHeaderRight}>
                <Text style={styles.driverRideLiveTag}>CANLI</Text>
                <View style={styles.driverRideVehicleChip}>
                  <Text style={styles.driverRideVehicleChipText}>{passMotor ? 'Motor' : 'Araba'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.driverRideLocRow}>
              <View style={[styles.driverRideLocIconWrap, styles.driverRideLocIconPickup]}>
                <Ionicons name="navigate-circle" size={20} color="#15803D" />
              </View>
              <View style={styles.driverRideLocTextCol}>
                <Text style={styles.driverRideSectionLabel}>Buluşma noktası</Text>
                <Text
                  style={styles.driverRideAddr}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.88}
                >
                  {driverPickupAddr || 'Alış noktası'}
                </Text>
              </View>
            </View>

            <View style={[styles.driverRideLocRow, { marginTop: 12 }]}>
              <View style={[styles.driverRideLocIconWrap, styles.driverRideLocIconDest]}>
                <Ionicons name="flag" size={18} color="#C2410C" />
              </View>
              <View style={styles.driverRideLocTextCol}>
                <Text style={styles.driverRideSectionLabel}>Hedef</Text>
                <Text
                  style={styles.driverRideAddr}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.88}
                >
                  {driverDropoffAddr || 'Varış'}
                </Text>
              </View>
            </View>

            <View style={styles.driverRideMetricsRow}>
              <Text style={styles.driverRideMetricsText} numberOfLines={2}>
                {showMeetingRouteCalculating || showMeetingRouteUnavailable
                  ? 'Buluşma: hesaplanıyor…'
                  : `Buluşma: ${formatRouteKmMin(meetingDistance, meetingDuration)}`}
                {destinationLocation
                  ? showDestinationRouteCalculating || showDestinationRouteUnavailable
                    ? '  ·  Hedef: …'
                    : `  ·  Hedef: ${formatRouteKmMin(destinationDistance, destinationDuration)}`
                  : ''}
              </Text>
            </View>

            <View style={styles.driverRidePriceRow}>
              {passengerPaymentMethod ? (
                <Text style={styles.driverRidePayHint} numberOfLines={1}>
                  {passengerPaymentMethod === 'card' ? 'Sanal kart' : 'Nakit'}
                </Text>
              ) : (
                <View style={styles.driverRidePriceRowSpacer} />
              )}
              {offeredPrice || price ? (
                <View style={styles.driverRidePriceBadge}>
                  <Text style={styles.driverRidePriceBadgeText}>₺{offeredPrice ?? price}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.driverRidePassengerRow}>
              <View style={styles.driverRidePassengerAvatarWrap}>
                <TripMapMarkerImage
                  source={getPassengerMarkerImage(otherPassengerGender ?? null, otherUserId ?? null)}
                  size={40}
                />
              </View>
              <View style={styles.driverRidePassengerTextCol}>
                <Text style={styles.driverRidePassengerLabel}>Yolcu</Text>
                <Text
                  style={styles.driverRidePassengerName}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {displayFirstName(otherUserName, 'Yolcu')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.topInfoPanel,
            driverNavImmersive ? { paddingTop: Math.max(insets.top, 8) + 100 } : null,
          ]}
        >
        <View
          style={[
            styles.topInfoBorder,
            driverNavImmersive ? styles.topInfoBorderNav : null,
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FAFBFC', '#F4F7FA', '#FAFBFC']}
            locations={[0, 0.3, 0.65, 1]}
            style={styles.infoGradient}
          >
            <View style={styles.topCardPatternRoot} pointerEvents="none">
              {[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
              ].map((i) => (
                <View key={i} style={[styles.topCardStripe, { left: -72 + i * 26 }]} />
              ))}
            </View>
            <View
              style={[
                styles.topCardContent,
                driverNavImmersive ? styles.topCardContentNav : null,
              ]}
            >
              <View
                style={[
                  styles.routeInfoRow,
                  driverNavImmersive ? styles.routeInfoRowNav : null,
                  isDriver && navigationMode
                    ? { opacity: navigationStage === 'pickup' ? 1 : 0.42 }
                    : null,
                ]}
              >
                <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
                <View style={styles.routeTextStack}>
                  <Text
                    style={[
                      styles.routeLabelModern,
                      driverNavImmersive ? styles.routeLabelModernNav : null,
                    ]}
                  >
                    Buluşma
                  </Text>
                  <View style={{ alignSelf: 'stretch' }}>
                    {showMeetingRouteCalculating ? (
                      <RouteCalculatingPremium compact={driverNavImmersive} />
                    ) : showMeetingRouteUnavailable ? (
                      <RouteUnavailableMuted compact={driverNavImmersive} />
                    ) : (
                      <View>
                        <Text style={routeValueStyle}>
                          {formatRouteKmMin(meetingDistance, meetingDuration)}
                        </Text>
                        {showMeetingRoutePolylineLoadingHint ? (
                          <Text
                            style={[
                              styles.routePolylineHint,
                              driverNavImmersive ? styles.routePolylineHintNav : null,
                            ]}
                          >
                            Rota yükleniyor
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {destinationLocation ? (
                <View
                  style={[
                    styles.routeInfoRow,
                    driverNavImmersive ? styles.routeInfoRowNav : null,
                    isDriver && navigationMode
                      ? { opacity: navigationStage === 'destination' ? 1 : 0.42 }
                      : null,
                  ]}
                >
                  <View style={[styles.routeDot, { backgroundColor: '#F97316' }]} />
                  <View style={styles.routeTextStack}>
                    <Text
                      style={[
                        styles.routeLabelModern,
                        driverNavImmersive ? styles.routeLabelModernNav : null,
                      ]}
                    >
                      Hedef
                    </Text>
                    <View style={{ alignSelf: 'stretch' }}>
                      {showDestinationRouteCalculating ? (
                        <RouteCalculatingPremium compact={driverNavImmersive} />
                      ) : showDestinationRouteUnavailable ? (
                        <RouteUnavailableMuted compact={driverNavImmersive} />
                      ) : (
                        <View>
                          <Text style={routeValueStyle}>
                            {formatRouteKmMin(destinationDistance, destinationDuration)}
                          </Text>
                          {showDestinationRoutePolylineLoadingHint ? (
                            <Text
                              style={[
                                styles.routePolylineHint,
                                driverNavImmersive ? styles.routePolylineHintNav : null,
                              ]}
                            >
                              Rota yükleniyor
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.routeRowTrailColumn}>
                    <View style={styles.routeRowTrail}>
                      {nearDestination ? (
                        <View
                          style={[
                            styles.nearBadge,
                            driverNavImmersive ? styles.nearBadgeNav : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.nearBadgeText,
                              driverNavImmersive ? styles.nearBadgeTextNav : null,
                            ]}
                          >
                            YAKIN!
                          </Text>
                        </View>
                      ) : null}
                      {offeredPrice ? (
                        <View
                          style={[
                            styles.offeredPriceBadge,
                            driverNavImmersive ? styles.offeredPriceBadgeNav : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.offeredPriceText,
                              driverNavImmersive ? styles.offeredPriceTextNav : null,
                            ]}
                          >
                            ₺{offeredPrice}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : null}

              {price && !offeredPrice ? (
                <View
                  style={[
                    styles.priceRow,
                    driverNavImmersive ? styles.priceRowNav : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.priceLabel,
                      driverNavImmersive ? styles.priceLabelNav : null,
                    ]}
                  >
                    Ücret
                  </Text>
                  <View style={styles.priceRowRightCol}>
                    <Text
                      style={[
                        styles.priceValue,
                        driverNavImmersive ? styles.priceValueNav : null,
                      ]}
                    >
                      ₺{price}
                    </Text>
                  </View>
                </View>
              ) : null}

              {isDriver && passengerPaymentMethod ? (
                <View
                  style={[
                    styles.paymentMethodPill,
                    driverNavImmersive ? styles.paymentMethodPillNav : null,
                  ]}
                >
                  <Ionicons
                    name={passengerPaymentMethod === 'card' ? 'card-outline' : 'cash-outline'}
                    size={driverNavImmersive ? 13 : 15}
                    color="#334155"
                  />
                  <Text
                    style={[
                      styles.paymentMethodPillText,
                      driverNavImmersive ? styles.paymentMethodPillTextNav : null,
                    ]}
                  >
                    {passengerPaymentMethod === 'card' ? 'Yolcu: sanal kart' : 'Yolcu: nakit'}
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        {driverNavImmersive && MapView && (onCall || onTrustRequest) ? (
          <View style={styles.navImmersiveBelowCard} pointerEvents="box-none">
            <View style={styles.navImmersiveBelowCardRow}>
              {onCall ? (
                <TouchableOpacity
                  style={[styles.navImmersiveAraBtn, boardingConfirmed && !isCallLoading && { opacity: 0.45 }]}
                  onPress={() => {
                    void tapButtonHaptic();
                    void handleCall('audio');
                  }}
                  disabled={isCallLoading}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Yolcuyu ara"
                >
                  <LinearGradient
                    colors={['#16A34A', '#22C55E', '#4ADE80']}
                    style={styles.navImmersiveAraGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="call" size={18} color="#FFF" />
                    <Text style={styles.navImmersiveAraText}>Ara</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.navImmersiveBelowCardSpacer} />
              )}
              {onTrustRequest ? (
                <View style={styles.navImmersiveBelowCardGuvenCol}>
                  <Animated.Text
                    pointerEvents="none"
                    style={[
                      styles.navImmersiveTrustHint,
                      {
                        opacity: guvenHintOpacity.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 0.68],
                        }),
                      },
                    ]}
                  >
                    Güven mi istiyorsun? Yolcudan güven al
                  </Animated.Text>
                  <TouchableOpacity
                    style={[styles.navImmersiveGuvenBtn, boardingConfirmed && { opacity: 0.45 }]}
                    onPress={() => {
                      void tapButtonHaptic();
                      if (boardingConfirmed) {
                        appAlert('Bilgi', BOARDING_COMMS_CLOSED_USER_MSG, [], {
                          variant: 'info',
                          autoDismissMs: 3200,
                          cancelable: true,
                        });
                        return;
                      }
                      if (trustRequestDisabled) return;
                      onTrustRequest();
                    }}
                    activeOpacity={0.88}
                    disabled={!!trustRequestDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={trustRequestLabel ?? 'Güven AL'}
                  >
                    <LinearGradient
                      colors={['#0E7490', '#059669', '#10B981', '#22C55E']}
                      locations={[0, 0.3, 0.65, 1]}
                      style={styles.navImmersiveGuvenGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Animated.View style={{ transform: [{ scale: guvenShieldPulse }] }}>
                        <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                      </Animated.View>
                      <Text style={styles.navImmersiveGuvenText}>Güven AL</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.navImmersiveBelowCardSpacer} />
              )}
            </View>
          </View>
        ) : null}

        {/* Sürücü matrix + Yolcuya Git — modern özet ekranda alt panele taşındı */}
        {driverRideUiModern ? null : isDriver && !driverNavImmersive ? (
          <View style={styles.driverMatchMatrixRow} pointerEvents="box-none">
            {matrixStatus ? (
              <View style={[styles.matrixContainerDriver, styles.matrixContainerDriverInRow]} pointerEvents="none">
                <Text style={styles.matrixTextDriver}>{matrixStatus}</Text>
              </View>
            ) : (
              <View style={styles.driverMatchMatrixRowFlex1} />
            )}
            <View style={styles.driverMatchYgitOuter}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.driverMatchYgitGlowAura,
                  {
                    opacity: matchYgitGlowAnim,
                    transform: [{ scale: matchYgitBreathAnim }],
                  },
                ]}
              />
              <TouchableOpacity
                onPress={handleYolcuyaGitPress}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={driverMatrixNavChipLabel}
                style={styles.driverMatchYgitTouch}
              >
                <Animated.View style={{ transform: [{ scale: matchYgitBreathAnim }] }}>
                  <LinearGradient
                    colors={[...driverMatrixNavChipGradientColors]}
                    style={styles.driverYolcuyaGitChip}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Animated.View style={{ transform: [{ rotate: tripCompassRotate }] }}>
                      <Ionicons name="compass" size={22} color={driverMatrixNavChipIconColor} />
                    </Animated.View>
                    <Text style={styles.driverYolcuyaGitChipLabel} numberOfLines={1}>
                      {driverMatrixNavChipLabel}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {matrixStatus && !isDriver && (
          <View style={styles.matrixContainerPassenger} pointerEvents="none">
            <Text style={styles.matrixTextPassenger}>
              {matrixStatus
                .replace('SURUCU', 'SÜRÜCÜ')
                .replace('SIZIN', 'SİZİN')
                .replace('ICIN', 'İÇİN')}
            </Text>
          </View>
        )}

        {!isDriver && userLocation && otherLocation ? (
          <View style={styles.passengerLiveBlock} pointerEvents="none">
            <Animated.Text style={[styles.passengerLiveLabel, { opacity: canliBlink }]}>
              CANLI
            </Animated.Text>
            {passengerDriverHint ? (
              <Text style={styles.passengerLiveHint}>{passengerDriverHint}</Text>
            ) : null}
          </View>
        ) : null}
        </View>
      )}

      {driverNavImmersive && MapView && !driverRideUiModern ? (
        <View style={styles.navImmersiveLayerRoot} pointerEvents="box-none">
          <View
            style={[
              styles.driverNavRecenterFabWrap,
              { bottom: 18 + Math.max(insets.bottom, 0) },
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.driverNavRecenterFab}
              onPress={handleYolcuyaGitPress}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={navigationMode ? 'Rotayı yeniden ortala' : 'Yolcuya Git'}
            >
              <Animated.View style={{ transform: [{ rotate: navGitCompassRotate }] }}>
                <Ionicons name="compass" size={18} color="#DBEAFE" />
              </Animated.View>
              <Text style={styles.driverNavRecenterFabText}>Yeniden ortala</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.driverNavCloseFab, { bottom: 18 + Math.max(insets.bottom, 0) }]}
            onPress={() => {
              void tapButtonHaptic();
              console.log('NAVIGATION_MODE_FORCED_FALSE', { reason: 'driver_nav_close_fab' });
              setNavigationMode(false);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Navigasyonu kapat"
          >
            <Ionicons name="close-circle" size={22} color="#FFF" />
            <Text style={styles.driverNavCloseFabText}>Navigasyonu kapat</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ALT BUTONLAR */}
      <View style={styles.bottomPanel}>
        <View style={styles.bottomGradient}>
          {driverRideUiModern ? (
            <View
              style={[
                styles.driverRideBottomSheet,
                { paddingBottom: 14 + Math.max(insets.bottom, 10) },
              ]}
            >
              {onCall ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.driverRidePrimaryBtn, isCallLoading && { opacity: 0.55 }]}
                  onPress={() => {
                    void tapButtonHaptic();
                    void handleCall('audio');
                  }}
                  disabled={isCallLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Yolcuyu ara"
                >
                  <LinearGradient
                    colors={['#16A34A', '#22C55E']}
                    style={styles.driverRidePrimaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="call" size={22} color="#FFF" />
                    <Text
                      style={styles.driverRidePrimaryBtnText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      Yolcuyu Ara
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.driverRideSecondaryBtn,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() => handleYolcuyaGitPress()}
                accessibilityRole="button"
                accessibilityLabel={driverMatrixNavChipLabel}
              >
                <Ionicons name="navigate" size={20} color="#334155" />
                <Text
                  style={styles.driverRideSecondaryBtnText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {driverMatrixNavChipLabel}
                </Text>
              </Pressable>

              {!boardingConfirmed ? (
                <View style={styles.driverRideSheetRow2}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={[
                      styles.driverRideQrBtn,
                      driverNearPickupForQr ? styles.driverRideQrBtnProminent : null,
                    ]}
                    onPress={() => {
                      void tapButtonHaptic();
                      handleBoardingQrPress();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Biniş QR göster"
                  >
                    <LinearGradient
                      colors={driverNearPickupForQr ? ['#7C3AED', '#6D28D9'] : ['#8B5CF6', '#7C3AED']}
                      style={styles.driverRideQrBtnGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="qr-code" size={20} color="#FFF" />
                      <Text
                        style={styles.driverRideQrBtnText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                      >
                        Biniş QR Göster
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  {onForceEnd ? (
                    <TouchableOpacity
                      style={styles.driverRideForceBtn}
                      activeOpacity={0.82}
                      onPress={() => {
                        void tapButtonHaptic();
                        if (tripOnboardSaferForceEnd && onInRideComplaintForceEnd) {
                          if (inRideComplaintInFlightRef.current || inRideComplaintSubmitting) {
                            return;
                          }
                          if (!tagId || String(tagId).trim() === '') {
                            Alert.alert(
                              'İşlem yapılamıyor',
                              'Eşleşme bilgisi bulunamadı. Sayfayı yenileyip tekrar deneyin.',
                            );
                            return;
                          }
                          const stOpen = String(tagStatus || '').toLowerCase();
                          if (['completed', 'cancelled', 'force_ended'].includes(stOpen)) {
                            Alert.alert('İşlem yapılamıyor', 'Bu yolculuk artık aktif değil.');
                            return;
                          }
                          setInRideSaferFeStep('choice');
                          setInRideSaferFeVisible(true);
                          return;
                        }
                        Alert.alert(
                          '⚠️ Zorla Bitir',
                          'Bu işlem puanınızı düşürebilir. Mümkünse QR ile tamamlayın.',
                          [
                            { text: 'Vazgeç', style: 'cancel' },
                            {
                              text: 'Zorla Bitir',
                              style: 'destructive',
                              onPress: () => onForceEnd?.(),
                            },
                          ],
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Zorla bitir"
                    >
                      <Ionicons name="warning" size={18} color="#FFF" />
                      <Text
                        style={styles.driverRideForceBtnText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                      >
                        Zorla Bitir
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Ara (sol) · pusula Yolcuya Git (orta) · Güven Al (sağ) — yolcu / klasik sürücü */}
          {driverRideUiModern ? null : MapView && onCall && !driverNavImmersive ? (
            <View style={styles.tripActionBar} pointerEvents="box-none">
              <View style={styles.tripActionBarCol}>
                {isDriver ? (
                  <Text style={styles.driverTripCallTitle} numberOfLines={1}>
                    Yolcuyu Ara
                  </Text>
                ) : (
                  <Animated.View style={{ opacity: callLabelBlink }}>
                    <Text style={styles.callPromptLabelSingle} numberOfLines={1}>
                      {callPromptLine}
                    </Text>
                  </Animated.View>
                )}
                <View style={styles.tripCallGuvenRow}>
                  <View style={styles.tripCallChatCluster}>
                    <Animated.View style={{ transform: [{ scale: quickCallBreath }] }}>
                      <TouchableOpacity
                        style={[
                          styles.mapCallFabCircle,
                          isCallLoading && styles.mapCallFabCircleDisabled,
                          boardingConfirmed && !isCallLoading ? { opacity: 0.45 } : null,
                        ]}
                        onPress={() => {
                          logPax('tapButtonHaptic', tapButtonHaptic);
                          void tapButtonHaptic();
                          void handleCall('audio');
                        }}
                        activeOpacity={0.88}
                        disabled={isCallLoading}
                        accessibilityRole="button"
                        accessibilityLabel={isDriver ? 'Yolcuyu ara' : 'Sürücüyü ara'}
                      >
                        <Ionicons name="call" size={22} color="#FFF" />
                      </TouchableOpacity>
                    </Animated.View>
                    {onChat ? (
                      <TouchableOpacity
                        style={[styles.tripInlineChatBtn, boardingConfirmed && { opacity: 0.45 }]}
                        onPress={() => {
                          logPax('tapButtonHaptic', tapButtonHaptic);
                          void tapButtonHaptic();
                          if (boardingConfirmed) {
                            appAlert('Bilgi', BOARDING_COMMS_CLOSED_USER_MSG, [], {
                              variant: 'info',
                              autoDismissMs: 3200,
                              cancelable: true,
                            });
                            return;
                          }
                          logPax('onChat', onChat);
                          onChat();
                        }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={isDriver ? 'Yolcuya yaz' : 'Sürücüye yaz'}
                      >
                        <LinearGradient
                          colors={isDriver ? ['#F97316', '#EA580C'] : ['#3B82F6', '#2563EB']}
                          style={styles.tripInlineChatBtnGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
                          <Text style={styles.tripInlineChatBtnText} numberOfLines={1}>
                            {isDriver ? 'Yolcuya Yaz' : 'Sürücüye Yaz'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {onTrustRequest ? (
                    <View style={styles.tripGuvenMirrorWrap}>
                      <TouchableOpacity
                        style={[styles.tripGuvenFabCompact, boardingConfirmed && { opacity: 0.45 }]}
                        onPress={() => {
                          logPax('tapButtonHaptic', tapButtonHaptic);
                          void tapButtonHaptic();
                          if (boardingConfirmed) {
                            appAlert('Bilgi', BOARDING_COMMS_CLOSED_USER_MSG, [], {
                              variant: 'info',
                              autoDismissMs: 3200,
                              cancelable: true,
                            });
                            return;
                          }
                          if (trustRequestDisabled) return;
                          logPax('onTrustRequest', onTrustRequest);
                          onTrustRequest();
                        }}
                        activeOpacity={0.88}
                        disabled={!!trustRequestDisabled}
                        accessibilityRole="button"
                        accessibilityLabel={trustRequestLabel ?? 'Güven AL'}
                      >
                        <LinearGradient
                          colors={['#0D9488', '#059669', '#10B981', '#34D399']}
                          locations={[0, 0.35, 0.7, 1]}
                          style={styles.tripGuvenFabCompactInner}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Animated.View style={{ transform: [{ scale: guvenShieldPulse }] }}>
                            <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                          </Animated.View>
                          <Text style={styles.tripGuvenFabLabel}>Güven AL</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.tripGuvenMirrorSpacer} />
                  )}
                </View>
              </View>
            </View>
          ) : null}

          {/* AI / QR / Zorla — yolcu ve klasik sürücü */}
          {driverRideUiModern ? null : !driverNavImmersive ? (
          <View style={styles.actionButtons}>
            {onOpenLeylekZekaSupport ? (
              <Pressable
                style={({ pressed }) => [styles.tripAiFabWrap, pressed && { opacity: 0.92 }]}
                onPress={() => {
                  void tapButtonHaptic();
                  onOpenLeylekZekaSupport();
                }}
                accessibilityRole="button"
                accessibilityLabel="AI — Leylek Zeka"
              >
                <LinearGradient
                  colors={['#22D3EE', '#3FA9F5', '#6366F1', '#8B5CF6']}
                  locations={[0, 0.35, 0.65, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tripAiFabGrad}
                >
                  <Ionicons name="sparkles" size={26} color="#FFF" />
                </LinearGradient>
                <Text style={styles.tripAiFabLabel} numberOfLines={1}>
                  AI
                </Text>
              </Pressable>
            ) : (
              <TouchableOpacity
                style={styles.supportDestekTouch}
                onPress={() => {
                  const phoneNumber = '905326497412';
                  const message = 'Merhaba, Leylek Tag uygulaması hakkında destek almak istiyorum.';
                  const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
                  const fallbackUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                  const canOpen = Linking.canOpenURL;
                  const openUrl = Linking.openURL;
                  callCheck('Linking.canOpenURL', canOpen);
                  callCheck('Linking.openURL', openUrl);
                  if (typeof canOpen !== 'function' || typeof openUrl !== 'function') {
                    return;
                  }
                  canOpen(whatsappUrl)
                    .then((supported) => {
                      if (supported) {
                        void openUrl(whatsappUrl);
                      } else {
                        void openUrl(fallbackUrl);
                      }
                    })
                    .catch(() => {
                      void openUrl(fallbackUrl);
                    });
                }}
                activeOpacity={0.75}
                accessibilityLabel="Destek — WhatsApp"
              >
                <View style={styles.supportSplitIcon} pointerEvents="none">
                  <View style={styles.supportSplitLeft}>
                    <Ionicons name="chatbubbles" size={13} color="#FFF" />
                  </View>
                  <View style={styles.supportSplitRight}>
                    <Ionicons name="alert" size={15} color="#713F12" />
                  </View>
                </View>
                <Text style={styles.supportDestekLabel} numberOfLines={1}>
                  Destek
                </Text>
              </TouchableOpacity>
            )}

            {/* 🆕 YOL PAYLAŞIMINI BİTİR BUTONU - QR ile + KONUM KONTROLÜ */}
            <Animated.View style={{ 
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.6, 1], outputRange: [0.98, 1.02] }) }]
            }}>
              <TouchableOpacity 
                style={styles.qrEndButton} 
                onPress={() => {
                  // Pickup öncesi: sürücü–yolcu meeting mesafesi + 1 km. Biniş sonrası meetingDistance güvenilir değil; finish QR engellenmesin.
                  if (!boardingConfirmed && isDriver && userLocation && otherLocation) {
                    const distanceKm =
                      meetingDistance != null && Number.isFinite(meetingDistance) && meetingDistance >= 0
                        ? meetingDistance
                        : null;
                    if (distanceKm == null) {
                      Alert.alert(
                        '📍 Mesafe',
                        'Yolcuya mesafe sunucudan henüz gelmedi. Bir süre sonra tekrar deneyin.',
                        [{ text: 'Tamam', style: 'default' }],
                      );
                      return;
                    }
                    const distanceMeters = distanceKm * 1000;

                    if (distanceMeters > 1000) {
                      // Yolcu 1km'den uzakta - QR gösterme
                      Alert.alert(
                        '📍 Yakın değil',
                        `${riderNoun} sizden ${distanceMeters < 1000 ? Math.round(distanceMeters) + ' metre' : distanceKm.toFixed(1) + ' km'} uzakta.\n\nQR kodu göstermek için ${passMotor ? 'motor yolcusunun' : 'yolcunun'} yakınınızda olmanız gerekir.`,
                        [{ text: 'Tamam', style: 'default' }]
                      );
                      return;
                    }
                  }
                  // Yolcu yakında veya konum bilgisi yok - QR göster
                  onShowQRModal?.();
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.qrEndButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="qr-code" size={18} color="#FFF" />
                  <Text style={styles.qrEndButtonText}>Yol Paylaşımını Bitir</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* 🆕 BİTİR BUTONU - Donuk Kırmızı, Sadece Zorla Bitir */}
            <TouchableOpacity 
              style={styles.endButton} 
              onPress={() => {
                void tapButtonHaptic();
                if (tripOnboardSaferForceEnd && onInRideComplaintForceEnd) {
                  if (inRideComplaintInFlightRef.current || inRideComplaintSubmitting) {
                    return;
                  }
                  if (!tagId || String(tagId).trim() === '') {
                    Alert.alert(
                      'İşlem yapılamıyor',
                      'Eşleşme bilgisi bulunamadı. Sayfayı yenileyip tekrar deneyin.',
                    );
                    return;
                  }
                  const stOpen = String(tagStatus || '').toLowerCase();
                  if (['completed', 'cancelled', 'force_ended'].includes(stOpen)) {
                    Alert.alert('İşlem yapılamıyor', 'Bu yolculuk artık aktif değil.');
                    return;
                  }
                  setInRideSaferFeStep('choice');
                  setInRideSaferFeVisible(true);
                  return;
                }
                Alert.alert(
                  '⚠️ Zorla Bitir',
                  'Bu işlem puanınızı 5 düşürecektir!\n\nYol Paylaşımını Bitir butonu ile QR okutarak +3 puan kazanabilirsiniz.',
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    { 
                      text: 'Zorla Bitir (-5 Puan)', 
                      style: 'destructive', 
                      onPress: () => onForceEnd?.() 
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <Text style={styles.endButtonText}>Zorla Bitir</Text>
            </TouchableOpacity>
          </View>
          ) : null}
        </View>
      </View>

      {driverRideUiModern ? (
        <View
          pointerEvents="box-none"
          style={[styles.driverRideLocateFabWrap, { bottom: driverRideModernLocateFabBottom }]}
        >
          <TouchableOpacity
            style={styles.driverRideLocateFab}
            onPress={() => {
              void tapButtonHaptic();
              fitNavigationViewport(meetingRouteCoordinates);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Konumuma göre haritayı ortala"
          >
            <Ionicons name="locate" size={22} color="#0f172a" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 🆕 KULLANICI BİLGİ KARTI MODAL */}
      <Modal
        visible={showInfoCard}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInfoCard(false)}
      >
        <TouchableOpacity 
          style={styles.infoCardOverlay} 
          activeOpacity={1} 
          onPress={() => setShowInfoCard(false)}
        >
          <View style={styles.infoCardContainer}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              {/* Kapatma Butonu */}
              <TouchableOpacity 
                style={styles.infoCardCloseButton} 
                onPress={() => setShowInfoCard(false)}
              >
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Başlık */}
              <View style={styles.infoCardHeader}>
                <View style={[styles.infoCardIconCircle, { backgroundColor: isDriver ? '#8B5CF6' : '#22C55E' }]}>
                  <Text style={styles.infoCardIcon}>{isDriver ? '👤' : '🚗'}</Text>
                </View>
                <Text style={styles.infoCardTitle}>
                  {isDriver ? 'Yolcu Bilgileri' : 'Sürücü Bilgileri'}
                </Text>
              </View>

              {/* İçerik */}
              <View style={styles.infoCardContent}>
                {/* İsim */}
                <View style={styles.infoCardRow}>
                  <Ionicons name="person" size={20} color="#6B7280" />
                  <Text style={styles.infoCardLabel}>İsim</Text>
                  <Text style={styles.infoCardValue}>{displayFirstName(otherUserName, 'Bilinmiyor')}</Text>
                </View>

                {/* Sürücü için Araç Bilgileri */}
                {!isDriver && otherUserDetails && (
                  <>
                    {/* Araç Fotoğrafı */}
                    {otherUserDetails.vehiclePhoto && (
                      <View style={styles.infoCardImageContainer}>
                        <Image 
                          source={{ uri: otherUserDetails.vehiclePhoto }} 
                          style={styles.infoCardVehicleImage}
                          resizeMode="cover"
                        />
                      </View>
                    )}

                    {/* Marka & Model */}
                    {(otherUserDetails.vehicleBrand || otherUserDetails.vehicleModel) && (
                      <View style={styles.infoCardRow}>
                        <Ionicons name="car-sport" size={20} color="#6B7280" />
                        <Text style={styles.infoCardLabel}>Araç:</Text>
                        <Text style={styles.infoCardValue}>
                          {otherUserDetails.vehicleBrand || ''} {otherUserDetails.vehicleModel || ''}
                          {otherUserDetails.vehicleYear ? ` (${otherUserDetails.vehicleYear})` : ''}
                        </Text>
                      </View>
                    )}

                    {/* Renk */}
                    {otherUserDetails.vehicleColor && (
                      <View style={styles.infoCardRow}>
                        <Ionicons name="color-palette" size={20} color="#6B7280" />
                        <Text style={styles.infoCardLabel}>Renk:</Text>
                        <View style={styles.infoCardColorContainer}>
                          <View style={[styles.infoCardColorDot, { backgroundColor: getColorCode(otherUserDetails.vehicleColor) }]} />
                          <Text style={styles.infoCardValue}>{otherUserDetails.vehicleColor}</Text>
                        </View>
                      </View>
                    )}

                    {/* Plaka */}
                    {otherUserDetails.plateNumber && (
                      <View style={styles.infoCardRow}>
                        <Ionicons name="document-text" size={20} color="#6B7280" />
                        <Text style={styles.infoCardLabel}>Plaka:</Text>
                        <View style={styles.infoCardPlateContainer}>
                          <Text style={styles.infoCardPlateText}>{otherUserDetails.plateNumber}</Text>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* Başarılı Eşleşme Sayısı */}
                <View style={styles.infoCardRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <Text style={styles.infoCardLabel}>Başarılı Eşleşme:</Text>
                  <View style={styles.infoCardBadge}>
                    <Text style={styles.infoCardBadgeText}>
                      {otherUserDetails?.totalTrips ?? 0} Yolculuk
                    </Text>
                  </View>
                </View>

                {/* Puan */}
                <View style={styles.infoCardRow}>
                  <Ionicons name="star" size={20} color="#F59E0B" />
                  <Text style={styles.infoCardLabel}>Puan</Text>
                  <View style={styles.infoCardRatingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons 
                        key={star}
                        name={star <= Math.round(otherUserDetails?.rating ?? 4) ? "star" : "star-outline"} 
                        size={18} 
                        color="#F59E0B" 
                      />
                    ))}
                    <Text style={styles.infoCardRatingText}>
                      {(otherUserDetails?.rating ?? 4).toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Alt Bilgi */}
              <View style={styles.infoCardFooter}>
                <Text style={styles.infoCardFooterText}>
                  {isDriver ? '🔒 Yolcu bilgileri doğrulanmıştır' : '🔒 Sürücü KYC onaylıdır'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {onInRideComplaintForceEnd ? (
        <InRideSaferForceEndModal
          visible={inRideSaferFeVisible}
          step={inRideSaferFeStep}
          submitting={inRideComplaintSubmitting}
          onClose={() => {
            setInRideSaferFeVisible(false);
            setInRideSaferFeStep('choice');
          }}
          onChooseQr={() => {
            setInRideSaferFeVisible(false);
            setInRideSaferFeStep('choice');
            onShowQRModal?.();
          }}
          onChooseIssue={() => setInRideSaferFeStep('complaint')}
          onSubmitComplaintAndEnd={async (reasonKey, details) => {
            if (!onInRideComplaintForceEnd || inRideComplaintInFlightRef.current) return;
            inRideComplaintInFlightRef.current = true;
            setInRideComplaintSubmitting(true);
            try {
              const result = await onInRideComplaintForceEnd({ reasonKey, details });
              if (result.ok) {
                setInRideSaferFeVisible(false);
                setInRideSaferFeStep('choice');
              } else {
                Alert.alert(
                  'Şikayet gönderilemedi',
                  result.message ||
                    'Bağlantı veya sunucu hatası. Tekrar deneyebilir veya “Yine de zorla bitir” seçebilirsiniz.',
                );
              }
            } finally {
              inRideComplaintInFlightRef.current = false;
              setInRideComplaintSubmitting(false);
            }
          }}
          onBluntForceEnd={() => {
            if (inRideComplaintInFlightRef.current) return;
            setInRideSaferFeVisible(false);
            setInRideSaferFeStep('choice');
            Alert.alert(
              '⚠️ Zorla Bitir',
              'Bu işlem puanınızı 5 düşürecektir!\n\nYol Paylaşımını Bitir butonu ile QR okutarak +3 puan kazanabilirsiniz.',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Zorla Bitir (-5 Puan)',
                  style: 'destructive',
                  onPress: () => onForceEnd?.(),
                },
              ],
            );
          }}
        />
      ) : null}
    </View>
  );
}

// Renk kodlarını döndüren yardımcı fonksiyon
const getColorCode = (colorName: string): string => {
  const colorMap: { [key: string]: string } = {
    'Beyaz': '#FFFFFF',
    'Siyah': '#1F2937',
    'Gri': '#6B7280',
    'Gümüş': '#9CA3AF',
    'Kırmızı': '#EF4444',
    'Mavi': '#3B82F6',
    'Lacivert': '#1E3A8A',
    'Yeşil': '#22C55E',
    'Sarı': '#EAB308',
    'Turuncu': '#F97316',
    'Kahverengi': '#78350F',
    'Bej': '#D4C5A9',
    'Bordo': '#881337',
    'Mor': '#7C3AED',
  };
  return colorMap[colorName] || '#6B7280';
};

// Harita stili - Temiz görünüm
const mapStyle = [
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "off" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  
  // 🆕 Bulutlu Arkaplan - Sadece üst kısım
  cloudBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
    opacity: 0.14, // bulutlar daha silik
  },
  cloudTintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },
  
  mapSlot: {
    flex: 1,
    position: 'relative',
  },
  map: { flex: 1 },
  navManeuverBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 100,
    backgroundColor: '#0F172A',
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  navManeuverBannerCompact: {
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  navManeuverBannerStage: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  navManeuverBannerStageCompact: {
    fontSize: 10,
    marginBottom: 3,
    letterSpacing: 0.35,
  },
  navManeuverBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  navManeuverBannerRowCompact: {
    marginTop: 2,
  },
  navManeuverIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  navManeuverIconCircleCompact: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 10,
    borderWidth: 1.5,
  },
  navManeuverTextCol: {
    flex: 1,
    minWidth: 0,
  },
  navManeuverBannerManeuver: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
  },
  navManeuverBannerManeuverCompact: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  navManeuverStreet: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '600',
  },
  navManeuverStreetCompact: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  navImmersiveLayerRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 92,
  },
  navImmersiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  navImmersiveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    width: '100%',
  },
  navImmersiveTopSpacer: {
    minWidth: 122,
    minHeight: 42,
  },
  navImmersiveBelowCard: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
    zIndex: 91,
  },
  navImmersiveBelowCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  navImmersiveBelowCardGuvenCol: {
    alignItems: 'flex-end',
    maxWidth: '52%',
  },
  navImmersiveBelowCardSpacer: {
    minWidth: 122,
    minHeight: 1,
  },
  navImmersiveTrustHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 4,
    paddingRight: 2,
    maxWidth: 220,
    lineHeight: 13,
  },
  driverMatchMatrixRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 6,
    zIndex: 91,
  },
  driverMatchMatrixRowFlex1: {
    flex: 1,
    minWidth: 8,
  },
  matrixContainerDriverInRow: {
    marginLeft: 0,
    marginTop: 0,
    flexShrink: 1,
    maxWidth: '58%',
  },
  driverMatchYgitOuter: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  driverMatchYgitGlowAura: {
    position: 'absolute',
    width: 152,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(37, 99, 235, 0.38)',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 12,
  },
  driverMatchYgitTouch: {
    zIndex: 2,
  },
  navImmersiveGuvenBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  navImmersiveGuvenGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minWidth: 122,
  },
  navImmersiveGuvenText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  navImmersiveAraBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.26,
    shadowRadius: 6,
  },
  navImmersiveAraGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minWidth: 122,
  },
  navImmersiveAraText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  driverNavRecenterFabWrap: {
    position: 'absolute',
    left: 10,
    zIndex: 40,
  },
  driverNavRecenterFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(29, 78, 216, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.75)',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 44,
  },
  driverNavRecenterFabText: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  driverNavCloseFab: {
    position: 'absolute',
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.35)',
    zIndex: 40,
    elevation: 8,
    minHeight: 44,
  },
  driverNavCloseFabText: {
    marginLeft: 8,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  callPromptRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },
  tripActionBar: {
    width: '100%',
    marginBottom: 10,
  },
  tripActionBarCol: {
    width: '100%',
    paddingHorizontal: 2,
  },
  tripCallGuvenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tripCallChatCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  tripInlineChatBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    maxWidth: SCREEN_WIDTH * 0.48,
    flexShrink: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  tripInlineChatBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  tripInlineChatBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  tripGuvenMirrorWrap: {
    marginTop: -4,
  },
  tripGuvenMirrorSpacer: {
    width: 48,
    height: 48,
  },
  tripActionBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  tripActionBarRowDriver: {
    alignItems: 'center',
  },
  tripActionLeft: {
    width: 118,
    alignItems: 'flex-start',
  },
  tripActionLeftDriver: {
    width: 92,
  },
  driverTripCallTitle: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  tripActionCenter: {
    flex: 1,
    alignItems: 'center',
    minHeight: 96,
    justifyContent: 'flex-start',
  },
  tripActionCenterDriver: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tripNavCtaHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
    maxWidth: SCREEN_WIDTH * 0.42,
  },
  tripNavCtaHorizontalLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  tripActionCenterSpacer: {
    flex: 1,
    minHeight: 8,
  },
  tripActionRight: {
    width: 118,
    alignItems: 'flex-end',
  },
  tripActionRightDriver: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripGuvenFabCompact: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 10,
  },
  tripGuvenFabCompactInner: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  tripGuvenFabLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tripActionRightSpacer: {
    width: 88,
    height: 88,
  },
  tripCompassCta: {
    width: 122,
    minHeight: 100,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 14,
  },
  tripCompassCtaLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 15,
  },
  tripGuvenFab: {
    marginTop: 14,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  tripGuvenFabInner: {
    width: 88,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tripGuvenFabText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  callPromptColumn: {
    alignItems: 'flex-start',
  },
  callPromptLabelSingle: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.25,
    maxWidth: SCREEN_WIDTH * 0.88,
    marginBottom: 8,
    textShadowColor: 'rgba(74, 222, 128, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  mapCallFabCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#0D4F3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 8,
  },
  mapCallFabCircleDisabled: {
    opacity: 0.55,
  },
  webFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F8' },
  webFallbackText: { fontSize: 16, color: '#666', marginTop: 16, textAlign: 'center' },
  distanceText: { fontSize: 18, fontWeight: 'bold', color: '#22C55E', marginTop: 12 },
  destinationDistanceText: { fontSize: 16, color: '#F97316', marginTop: 8 },
  
  // Marker Styles
  markerContainer: { alignItems: 'center' },
  markerCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  markerIcon: { fontSize: 22 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  
  // 🆕 Profesyonel Marker Stilleri
  proMarkerContainer: {
    alignItems: 'center',
  },
  proMarkerHead: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  proMarkerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -3,
  },
  proMarkerShadow: {
    width: 26,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 13,
    marginTop: 4,
  },
  
  // 🆕 Profesyonel Bayrak Marker
  proFlagMarker: {
    alignItems: 'flex-start',
  },
  proFlagPole: {
    width: 4,
    height: 50,
    backgroundColor: '#1F2937',
    borderRadius: 2,
  },
  proFlagBody: {
    position: 'absolute',
    top: 0,
    left: 4,
    width: 38,
    height: 26,
    backgroundColor: '#DC2626',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 7,
  },
  proFlagBase: {
    width: 14,
    height: 7,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginLeft: -5,
    marginTop: 2,
  },
  
  // Destination Marker
  destinationMarker: { alignItems: 'center' },
  destinationCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  destinationIcon: { fontSize: 26 },
  destinationLabel: { marginTop: 4, fontSize: 11, fontWeight: 'bold', color: '#F97316', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  
  // 🆕 Floating Navigation Icon (Sürücü için)
  floatingNavIcon: {
    position: 'absolute',
    top: 180,
    right: 12,
    alignItems: 'center',
    zIndex: 100,
  },
  bigNavButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingNavText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B00',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  navIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  navIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Top Info Panel — buluşma / hedef kartı (dar, premium, nav’da kompakt)
  topInfoPanel: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 90 },
  topInfoBorder: {
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.885,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.38)',
    borderRadius: 20,
    marginTop: 40,
    marginBottom: 6,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  topInfoBorderNav: {
    marginTop: 4,
    marginBottom: 4,
  },
  infoGradient: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 19, overflow: 'hidden' },
  topCardPatternRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topCardStripe: {
    position: 'absolute',
    top: -80,
    width: 1,
    height: 320,
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
    transform: [{ rotate: '32deg' }],
  },
  topCardContent: {
    position: 'relative',
    zIndex: 2,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  topCardContentNav: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  routeInfoRowNav: {
    marginBottom: 2,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  routeTextStack: {
    flex: 1,
    minWidth: 0,
  },
  routeRowTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 6,
    marginLeft: 4,
  },
  routeRowTrailColumn: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 4,
    flexShrink: 0,
  },
  driverYolcuyaGitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    minWidth: 168,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 8,
  },
  driverYolcuyaGitChipLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  priceRowRightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  routeLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  routeValue: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  routeLabelModern: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  routeLabelModernNav: {
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 0,
  },
  routeValueModern: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.15,
    marginTop: 0,
  },
  routeValueModernNav: {
    fontSize: 13,
    fontWeight: '700',
  },
  routePolylineHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  routePolylineHintNav: {
    fontSize: 9,
    marginTop: 1,
  },
  nearBadge: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nearBadgeNav: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nearBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  nearBadgeTextNav: { fontSize: 9 },
  offeredPriceBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  offeredPriceBadgeNav: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 48,
    borderRadius: 8,
  },
  offeredPriceText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  offeredPriceTextNav: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.45)',
  },
  priceRowNav: {
    marginTop: 0,
    paddingTop: 5,
  },
  priceLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.6 },
  priceLabelNav: { fontSize: 11 },
  priceValue: { fontSize: 18, fontWeight: '800', color: '#0284C7' },
  priceValueNav: { fontSize: 15 },
  paymentMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  paymentMethodPillNav: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 5,
  },
  paymentMethodPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  paymentMethodPillTextNav: {
    fontSize: 12,
    fontWeight: '600',
  },

  passengerLiveBlock: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    marginRight: 18,
    marginTop: 4,
    marginBottom: 2,
    maxWidth: SCREEN_WIDTH * 0.62,
  },
  passengerLiveLabel: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 4,
  },
  passengerLiveHint: {
    marginTop: 6,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 17,
  },
  
  // Bottom Panel
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomGradient: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: 'transparent',
  },
  
  // 🆕 Ortalı Navigasyon Butonu (Alt Panelde)
  centeredNavButton: {
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 2000,
  },
  centeredNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  // 🆕 "Yolcuya Git" purple buton (keskin köşeli)
  centeredNavBtnPurple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  centeredNavBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    marginLeft: 8,
  },
  nav3dIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mainChatButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 18,
  },
  
  // 🆕 Animated Border
  animatedBorderOuter: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#8B5CF6',
    padding: 3,
  },
  animatedGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: 'rgba(139, 92, 246, 0.5)',
    borderRightColor: 'rgba(139, 92, 246, 0.3)',
  },
  
  // 🆕 Call Section
  callSection: {
    marginBottom: 14,
    alignItems: 'center',
  },
  mainCallButton: {
    width: SCREEN_WIDTH - 48,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  callButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mainCallButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // 🆕 Chat Button (Ana Buton)
  mainChatButton: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 9,
    marginBottom: 10,
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chatButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconWrapperLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mainChatButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  tripTrustLeylekRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    width: SCREEN_WIDTH - 48,
    alignSelf: 'center',
  },
  mapTripAuxBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapTripAuxBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  mapTripAuxBtnText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 14,
  },
  chatIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  // 🆕 Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  tripAiFabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    maxWidth: 56,
  },
  tripAiFabGrad: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 10,
  },
  tripAiFabLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#334155',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  supportDestekTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    maxWidth: 48,
    paddingHorizontal: 2,
  },
  supportSplitIcon: {
    flexDirection: 'row',
    width: 36,
    height: 26,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.2)',
  },
  supportSplitLeft: {
    flex: 1,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportSplitRight: {
    flex: 1,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportDestekLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#334155',
    marginTop: 3,
    letterSpacing: 0.15,
  },
  supportButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
  },
  supportButtonText: { 
    fontSize: 14, 
    fontWeight: '500', 
    marginLeft: 6, 
    color: '#6B7280',
  },
  endButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 12,
    backgroundColor: '#DC2626', // Kırmızı - Bitir butonu
    borderRadius: 12,
  },
  endButtonText: { 
    fontSize: 12, 
    fontWeight: '600', 
    marginLeft: 4, 
    color: '#FFF',
  },
  
  // 🆕 QR ile Bitir Butonu
  qrEndButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qrEndButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  qrEndButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    color: '#FFF',
  },

  // 🆕 Kullanıcı Bilgi Kartı Stilleri
  infoCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardContainer: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  infoCardCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 8,
  },
  infoCardIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardIcon: {
    fontSize: 28,
  },
  infoCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoCardContent: {
    marginBottom: 16,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoCardLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 10,
    width: 100,
  },
  infoCardValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoCardImageContainer: {
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  infoCardVehicleImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#F3F4F6',
  },
  infoCardColorContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  infoCardPlateContainer: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  infoCardPlateText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 1,
  },
  infoCardBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  infoCardBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  infoCardRatingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCardRatingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 8,
  },
  infoCardFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  infoCardFooterText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // 🆕 Matrix Durum Yazısı Stilleri - SÜRÜCÜ (YEŞİL) - Üst çerçevenin altında
  matrixContainerDriver: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginTop: 6,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 20, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#00FF00',
  },
  matrixTextDriver: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00FF00',
    letterSpacing: 1.5,
  },
  // 🆕 Matrix Durum Yazısı Stilleri - YOLCU (KIRMIZI) - Üst çerçevenin altında
  matrixContainerPassenger: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginTop: 6,
    zIndex: 1000,
    backgroundColor: 'rgba(30, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  matrixTextPassenger: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF3B30',
    letterSpacing: 1.5,
  },
  driverPassengerCueAboveNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.45)',
  },
  driverPassengerCueAccent: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 24,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
    marginRight: 10,
  },
  driverPassengerCueTextAboveNav: {
    flex: 1,
    color: '#4C1D95',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 17,
  },

  driverRideTopWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 4000,
    alignItems: 'stretch',
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  driverRideTopCard: {
    position: 'relative',
    alignSelf: 'stretch',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 9,
  },
  driverRideUiDebugBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 20,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(107, 33, 168, 0.92)',
  },
  driverRideUiDebugBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  driverRideLocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  driverRideLocIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  driverRideLocIconPickup: {
    backgroundColor: '#DCFCE7',
  },
  driverRideLocIconDest: {
    backgroundColor: '#FFEDD5',
  },
  driverRideLocTextCol: {
    flex: 1,
    minWidth: 0,
  },
  driverRideTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  driverRideStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  driverRideStatusPillStarted: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  driverRideStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  driverRideStatusPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.2,
  },
  driverRideStatusPillTextStarted: {
    color: '#1D4ED8',
  },
  driverRideTopHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverRideLiveTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#DC2626',
  },
  driverRideVehicleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverRideVehicleChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  driverRideSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  driverRideAddr: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 21,
    flexShrink: 1,
  },
  driverRideMetricsRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  driverRideMetricsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 19,
    flexShrink: 1,
  },
  driverRidePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    flexWrap: 'nowrap',
  },
  driverRidePriceRowSpacer: {
    flex: 1,
    minWidth: 0,
  },
  driverRidePriceBadge: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#111827',
    marginLeft: 'auto',
  },
  driverRidePriceBadgeText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  driverRidePayHint: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  driverRidePassengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  driverRidePassengerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverRidePassengerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  driverRidePassengerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  driverRidePassengerName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  driverRideMiniCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#16A34A',
  },
  driverRideMiniCallText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  driverRideMatrixBanner: {
    marginTop: 8,
    maxWidth: SCREEN_WIDTH - 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
  driverRideMatrixBannerText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  driverRideBottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 16,
  },
  driverRidePrimaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 11,
  },
  driverRidePrimaryBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
  },
  driverRidePrimaryBtnText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    flexShrink: 1,
  },
  driverRideSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    paddingVertical: 0,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 11,
  },
  driverRideSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    flexShrink: 1,
  },
  driverRideSheetRow2: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'stretch',
    marginBottom: 11,
  },
  driverRideSheetRowGrow: {
    flex: 1,
    minHeight: 48,
  },
  driverRideQrBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 56,
  },
  driverRideQrBtnProminent: {
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    transform: [{ scale: 1.02 }],
  },
  driverRideQrBtnGrad: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 8,
  },
  driverRideQrBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
    flexShrink: 1,
  },
  driverRideForceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    minHeight: 56,
  },
  driverRideForceBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    flexShrink: 1,
  },
  driverRideAuxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  driverRideAuxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverRideAuxChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  driverRideLocateFabWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 3500,
    pointerEvents: 'box-none',
  },
  driverRideLocateFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  navModeExitRow: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  navModeExitText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
