import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Linking, Alert, Dimensions, Animated, Easing, Modal, Image, ImageBackground } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { tapButtonHaptic } from '../utils/touchHaptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { displayFirstName } from '../lib/displayName';
import { API_BASE_URL } from '../lib/backendConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  onAutoComplete?: () => void;
  onShowEndTripModal?: () => void;
  onShowQRModal?: () => void;  // 🆕 QR Modal aç
  /** Sürücü haritasında: yolcu araç/motor tercihi (marker ve uyarı metinleri) */
  otherTripVehicleKind?: 'car' | 'motorcycle';
  /** Sürücü: yolcunun teklifte seçtiği ödeme */
  passengerPaymentMethod?: 'cash' | 'card';
  /** Sürücü uygulama-içi navigasyon açıkken üst bileşen GPS aralığını kısaltır */
  onNavigationModeChange?: (active: boolean) => void;
}

/** Yolcu ekranı — buluşma kartının altındaki kırmızı ipucu (rota süresi + mesafe + periyodik hatırlatma) */
function buildPassengerDriverHint(
  meters: number,
  meetingDurationMin: number | null,
  meetingDistanceKm: number | null,
  otherUserName: string,
  reminderCycle: number,
): string {
  const name = displayFirstName(otherUserName, 'Sürücünüz');
  if (meters <= 80) {
    return 'Sürücü yanınızda';
  }
  if (meters <= 220) {
    return 'Sürücü geldi — buluşabilirsiniz';
  }
  const dur = meetingDurationMin;
  if (dur != null && dur <= 1) {
    return `${name} yaklaşık 1 dk içinde yanınızda`;
  }
  if (dur != null && dur === 2) {
    return `${name} yaklaşık 2 dk içinde yanınızda`;
  }
  if (dur != null && dur > 2) {
    return `${name} yaklaşık ${dur} dk sonra yanınızda`;
  }
  const km = meetingDistanceKm;
  if (km != null && km < 8) {
    return `${name} yaklaşık ${km.toFixed(1)} km uzağınızda — yolda`;
  }
  const alt = [
    `${name} size doğru geliyor`,
    'Konumunuz açık kalsın — sürücü sizi görsün',
  ];
  return alt[reminderCycle % alt.length];
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

type MapLatLng = { latitude: number; longitude: number };

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

/** OSRM (Project OSRM) — yalnızca polyline çizimi; km/dk backend’ten gelir */
async function fetchOsrmDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ distanceM: number; durationS: number; coordinates: MapLatLng[] } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
    const data = await res.json();
    if (data?.code !== 'Ok' || !data?.routes?.[0]) return null;
    const r = data.routes[0];
    const coords = osrmGeometryToCoords(r.geometry);
    if (!coords) return null;
    return {
      distanceM: Number(r.distance) || 0,
      durationS: Number(r.duration) || 0,
      coordinates: coords,
    };
  } catch {
    return null;
  }
}

/** Sürücü nav tetikleyicisi: doğrudan iki konum */
async function fetchOsrmDrivingRouteBetween(
  from: MapLatLng,
  to: MapLatLng,
): Promise<MapLatLng[] | null> {
  const r = await fetchOsrmDrivingRoute(from.latitude, from.longitude, to.latitude, to.longitude);
  return r?.coordinates ?? null;
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
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { headers: { 'User-Agent': 'LeylekTAG-App/1.0' } });
    const data = await res.json();
    if (data?.code !== 'Ok' || !data?.routes?.[0]) return null;
    const r = data.routes[0];
    const coords = osrmGeometryToCoords(r.geometry);
    if (!coords) return null;
    const leg = r.legs?.[0];
    const steps = buildOsrmStepsFromLeg(leg);
    return {
      distanceM: Number(r.distance) || 0,
      durationS: Number(r.duration) || 0,
      coordinates: coords,
      steps,
    };
  } catch {
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
    };
  }
  if (k >= steps.length) {
    const last = steps[steps.length - 1];
    return {
      instructionLine: 'Hedefe yaklaşın',
      streetName: last.name?.trim() || null,
      arrowKind: 'straight',
      speechKey: `${stage}-arrive-end`,
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
  return { instructionLine, streetName, arrowKind, speechKey };
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

function zoomForRemainKm(remainKm: number): number {
  if (remainKm > 5) return 15;
  if (remainKm >= 1) return 16.5;
  return 18;
}

/**
 * Gidiş yönünde kamera merkezini ileri alır; pitch + heading ile araç noktası ekranda ~alt 1/3 bandına kayar.
 */
function offsetCameraCenterForward(from: MapLatLng, bearingDeg: number, remainKm: number): MapLatLng {
  let forwardM = 155;
  if (remainKm > 5) forwardM = 240;
  else if (remainKm >= 1) forwardM = 185;
  else forwardM = 125;
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

function bearingDegrees(from: MapLatLng, to: MapLatLng): number {
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
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

/** NAV REFRESH: OSRM spam / flicker önleme — en az ms aralık */
const NAV_REFRESH_OSRM_MIN_MS = 3000;

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
      return <MaterialCommunityIcons name="u-turn-left" size={size} color={green} />;
    case 'roundabout':
      return <MaterialCommunityIcons name="roundabout" size={size} color={green} />;
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
  onAutoComplete,
  onShowEndTripModal,
  onShowQRModal,  // 🆕
  otherTripVehicleKind = 'car',
  passengerPaymentMethod,
  onNavigationModeChange,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  // BİLGİ KARTI STATE'İ
  const [showInfoCard, setShowInfoCard] = useState(false);
  
  // ARAMA STATE'LERİ
  const [isCallLoading, setIsCallLoading] = useState(false);
  
  // YEŞİL ROTA: Şoför → Yolcu (buluşma) — koordinatlar yalnız OSRM polyline / düz çizgi
  const [meetingRouteCoordinates, setMeetingRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [meetingDistance, setMeetingDistance] = useState<number | null>(null);
  const [meetingDuration, setMeetingDuration] = useState<number | null>(null);
  
  // TURUNCU ROTA: Yolcu → Hedef (varış)
  const [destinationRoute, setDestinationRoute] = useState<{latitude: number, longitude: number}[]>([]);
  const [destinationDistance, setDestinationDistance] = useState<number | null>(null);
  const [destinationDuration, setDestinationDuration] = useState<number | null>(null);
  
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

  /** pickup: sürücü→yolcu | destination: yolcu konumu→varış (rota çizimi) */
  const [navigationStage, setNavigationStage] = useState<'pickup' | 'destination'>('pickup');
  const navigationStageRef = useRef<'pickup' | 'destination'>('pickup');
  useEffect(() => {
    navigationStageRef.current = navigationStage;
  }, [navigationStage]);

  const pickupNavStepsRef = useRef<{
    steps: OsrmNavStepParsed[];
    cumStart: number[];
  } | null>(null);
  const destNavStepsRef = useRef<{
    steps: OsrmNavStepParsed[];
    cumStart: number[];
  } | null>(null);

  const [navManeuverUi, setNavManeuverUi] = useState<NavManeuverUi | null>(null);
  const [navHeadingUi, setNavHeadingUi] = useState(0);

  const lastNavSpeechKeyRef = useRef('');

  /** Sürücü gerçek navigasyon: harita kamerası heading (pusula) */
  const navHeadingRef = useRef(0);
  const lastNavCameraAtRef = useRef(0);

  /** Sürücü navigasyonu kapatınca buluşma polyline’ını kaldır (yolcu ekranı etkilenmez) */
  useEffect(() => {
    if (!navigationMode && isDriver) {
      setMeetingRouteCoordinates([]);
      meetingHasOsrmPolylineRef.current = false;
      lastNavRefreshDedupeKeyRef.current = '';
      lastNavRefreshThrottleAtRef.current = 0;
      setNavigationStage('pickup');
      pickupNavStepsRef.current = null;
      destNavStepsRef.current = null;
      setNavManeuverUi(null);
    }
  }, [navigationMode, isDriver]);

  /** Yolcuya 50 m: hedef aşamasına geç (varış noktası varsa) */
  useEffect(() => {
    if (!isDriver || !navigationMode || !userLocation || !otherLocation) return;
    if (navigationStage !== 'pickup') return;
    if (!destinationLocation) return;
    if (haversineMeters(userLocation, otherLocation) < 50) {
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
  const meetingHasOsrmPolylineRef = useRef(false);
  const refreshMeetingRouteOsrmRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const loadDriverNavMeetingRouteRef = useRef<() => Promise<void>>(async () => {});
  const lastNavRefreshDedupeKeyRef = useRef('');
  const lastNavRefreshThrottleAtRef = useRef(0);

  useEffect(() => {
    meetingHasOsrmPolylineRef.current = false;
    lastOsrmKeyRef.current = '';
    lastOsrmAtRef.current = 0;
    mapFitRef.current = { initialDone: false, hadDestination: false };
    setNavigationMode(false);
    setNavigationStage('pickup');
    setMeetingRouteCoordinates([]);
    pickupNavStepsRef.current = null;
    destNavStepsRef.current = null;
    setNavManeuverUi(null);
  }, [tagId]);

  useEffect(() => {
    if (!isDriver) return;
    onNavigationModeChange?.(navigationMode);
  }, [isDriver, navigationMode, onNavigationModeChange]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isDriver || !navigationMode) return;
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }
        sub = await Location.watchHeadingAsync((h) => {
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (Number.isFinite(deg)) navHeadingRef.current = deg;
        });
      } catch {
        /* heading opsiyonel */
      }
    })();
    return () => {
      sub?.remove();
    };
  }, [isDriver, navigationMode]);

  /**
   * Sürücü gerçek navigasyon: her GPS güncellemesinde kamera (pitch 60, kullanıcı heading, dinamik zoom).
   */
  useEffect(() => {
    if (Platform.OS === 'web' || !isDriver || !navigationMode || !userLocation || !mapRef.current) {
      return;
    }
    const h = navHeadingRef.current;
    const userHeading =
      typeof h === 'number' && Number.isFinite(h) && h >= 0
        ? h
        : navigationStage === 'destination' && destinationLocation
          ? bearingDegrees(userLocation, destinationLocation)
          : otherLocation
            ? bearingDegrees(userLocation, otherLocation)
            : 0;

    let remainKm = 0;
    if (navigationStage === 'pickup' && otherLocation) {
      remainKm = straightLineKm(userLocation, otherLocation);
    } else if (navigationStage === 'destination' && destinationLocation) {
      remainKm = straightLineKm(userLocation, destinationLocation);
    } else if (otherLocation) {
      remainKm = straightLineKm(userLocation, otherLocation);
    }

    const zoom = zoomForRemainKm(remainKm);
    const cameraCenter = offsetCameraCenterForward(userLocation, userHeading, remainKm);
    setNavHeadingUi(userHeading);
    lastNavCameraAtRef.current = Date.now();
    const t = setTimeout(() => {
      mapRef.current?.animateCamera(
        {
          center: cameraCenter,
          pitch: 60,
          heading: userHeading,
          zoom,
        },
        { duration: 280 },
      );
    }, 0);
    return () => clearTimeout(t);
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

  /** Turn-by-turn kartı (ok + mesafe + sokak) */
  useEffect(() => {
    if (!isDriver || !navigationMode || !userLocation) {
      setNavManeuverUi(null);
      return;
    }
    if (navigationStage === 'pickup') {
      const poly = meetingRouteCoordinates;
      const meta = pickupNavStepsRef.current;
      if (poly.length >= 2 && meta?.steps?.length && meta.cumStart.length) {
        const p = distanceAlongPolylineM(userLocation, poly);
        setNavManeuverUi(buildNavManeuverUiFromSteps(p, meta.steps, meta.cumStart, 'pickup'));
      } else if (otherLocation) {
        const d = haversineMeters(userLocation, otherLocation);
        const label = d >= 950 ? `${(d / 1000).toFixed(1)} km` : `${Math.max(20, Math.round(d / 10) * 10)} m`;
        setNavManeuverUi({
          instructionLine: `${label} sonra yolcuya yaklaşın`,
          streetName: null,
          arrowKind: 'straight',
          speechKey: 'pickup-fallback-approach',
        });
      } else {
        setNavManeuverUi({
          instructionLine: 'Rotayı takip edin',
          streetName: null,
          arrowKind: 'unknown',
          speechKey: 'pickup-nolocation',
        });
      }
      return;
    }
    if (navigationStage === 'destination') {
      const poly = destinationRoute;
      const meta = destNavStepsRef.current;
      if (poly.length >= 2 && meta?.steps?.length && meta.cumStart.length) {
        const p = distanceAlongPolylineM(userLocation, poly);
        setNavManeuverUi(buildNavManeuverUiFromSteps(p, meta.steps, meta.cumStart, 'destination'));
      } else if (destinationLocation) {
        const d = haversineMeters(userLocation, destinationLocation);
        const label = d >= 950 ? `${(d / 1000).toFixed(1)} km` : `${Math.max(20, Math.round(d / 10) * 10)} m`;
        setNavManeuverUi({
          instructionLine: `${label} sonra hedefe yaklaşın`,
          streetName: null,
          arrowKind: 'straight',
          speechKey: 'dest-fallback-approach',
        });
      } else {
        setNavManeuverUi({
          instructionLine: 'Hedefe gidin',
          streetName: null,
          arrowKind: 'unknown',
          speechKey: 'dest-nodropoff',
        });
      }
    }
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    userLocation?.latitude,
    userLocation?.longitude,
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
        Speech.stop();
      }
      lastNavSpeechKeyRef.current = '';
    }
  }, [navigationMode]);

  /** Yalnızca yeni manevra (speechKey değişince) sesli oku */
  useEffect(() => {
    if (Platform.OS === 'web' || !isDriver || !navigationMode || !navManeuverUi) {
      return;
    }
    const key = navManeuverUi.speechKey;
    if (!key || key === lastNavSpeechKeyRef.current) {
      return;
    }
    lastNavSpeechKeyRef.current = key;
    const line = navManeuverUi.instructionLine.trim();
    const street = navManeuverUi.streetName?.trim();
    const utterance = street ? `${line}. ${street}` : line;
    Speech.stop();
    Speech.speak(utterance, { language: 'tr-TR', rate: 0.92, pitch: 1.0 });
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
  const [passengerReminderCycle, setPassengerReminderCycle] = useState(0);

  const passMotor = otherTripVehicleKind === 'motorcycle';
  const riderNoun = passMotor ? 'Motor yolcusu' : 'Yolcu';
  
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

  const callPromptNameUpper = useMemo(() => {
    const name = displayFirstName(otherUserName, isDriver ? 'Yolcu' : 'Sürücü');
    return name.toLocaleUpperCase('tr-TR');
  }, [isDriver, otherUserName]);

  useEffect(() => {
    if (isDriver) return;
    const id = setInterval(() => setPassengerEtaTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isDriver]);

  useEffect(() => {
    if (isDriver) return;
    const id = setInterval(() => setPassengerReminderCycle((c) => c + 1), 120_000);
    return () => clearInterval(id);
  }, [isDriver]);

  const passengerDriverHint = useMemo(() => {
    if (isDriver || !userLocation || !otherLocation) {
      return '';
    }
    if (meetingDistance == null || !Number.isFinite(meetingDistance)) {
      const name = displayFirstName(otherUserName, 'Sürücünüz');
      return `${name} yolda — tahmini süre backend güncellemesiyle gösterilecek`;
    }
    const meters = meetingDistance * 1000;
    return buildPassengerDriverHint(
      meters,
      meetingDuration,
      meetingDistance,
      otherUserName,
      passengerReminderCycle,
    );
  }, [
    isDriver,
    userLocation,
    otherLocation,
    meetingDuration,
    meetingDistance,
    otherUserName,
    passengerEtaTick,
    passengerReminderCycle,
  ]);
  
  // Matrix durumları — yalnızca backend meetingDistance (km); yoksa nötr metin
  useEffect(() => {
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
  }, [userLocation, otherLocation, isDriver, destinationLocation, passMotor, meetingDistance]);
  
  // Renk teması - Yolcu: Mor, Sürücü: Mavi
  const themeColor = isDriver ? '#3B82F6' : '#8B5CF6';
  const themeLightColor = isDriver ? '#DBEAFE' : '#EDE9FE';
  const themeGradient = isDriver ? ['#3B82F6', '#2563EB'] : ['#8B5CF6', '#7C3AED'];
  
  // Arama fonksiyonu - hızlı ve direkt
  const handleCall = async (type: 'audio' | 'video') => {
    if (isCallLoading) {
      return;
    }
    
    setIsCallLoading(true);
    
    try {
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

  // OSRM gelene kadar düz segment (yolcu); sürücü nav kapalıyken çizgi basma (nav açılınca OSRM/fallback)
  useEffect(() => {
    if (!userLocation || !otherLocation) return;
    if (isDriver && !navigationMode) return;
    if (isDriver && navigationMode && navigationStage === 'destination') {
      setMeetingRouteCoordinates([]);
      return;
    }
    const start = isDriver ? userLocation : otherLocation;
    const end = isDriver ? otherLocation : userLocation;
    if (!meetingHasOsrmPolylineRef.current) {
      setMeetingRouteCoordinates([start, end]);
    }
  }, [
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    isDriver,
    navigationMode,
    navigationStage,
  ]);

  // TURUNCU ROTA: Yolcu → Hedef — düz çizgi sonra OSRM polyline (etiketteki km/süre routeInfo’dan)
  useEffect(() => {
    if (!destinationLocation) {
      setDestinationRoute([]);
      return;
    }
    const passengerLocation = isDriver ? otherLocation : userLocation;
    if (!passengerLocation) return;
    if (isDriver && navigationMode) {
      return;
    }
    setDestinationRoute([passengerLocation, destinationLocation]);
    let cancelled = false;
    void (async () => {
      const r = await fetchOsrmDrivingRoute(
        passengerLocation.latitude,
        passengerLocation.longitude,
        destinationLocation.latitude,
        destinationLocation.longitude,
      );
      if (cancelled || !r?.coordinates || r.coordinates.length < 2) return;
      setDestinationRoute(r.coordinates);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
    isDriver,
    navigationMode,
  ]);

  /** Sürücü navigasyon — hedef aşaması: yolcu→varış OSRM + adımlar */
  useEffect(() => {
    if (!isDriver || !navigationMode || navigationStage !== 'destination') return;
    if (!otherLocation || !destinationLocation) return;
    let cancelled = false;
    void (async () => {
      const r = await fetchOsrmDrivingRouteWithSteps(
        otherLocation.latitude,
        otherLocation.longitude,
        destinationLocation.latitude,
        destinationLocation.longitude,
      );
      if (cancelled || !r?.coordinates || r.coordinates.length < 2) return;
      destNavStepsRef.current = {
        steps: r.steps,
        cumStart: buildCumStartMeters(r.steps),
      };
      setDestinationRoute(r.coordinates);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isDriver,
    navigationMode,
    navigationStage,
    otherLocation?.latitude,
    otherLocation?.longitude,
    destinationLocation?.latitude,
    destinationLocation?.longitude,
  ]);

  // Tüm gösterilen km/dk tek kaynak: backend routeInfo (pickup_*, trip_*); OSRM kullanılmaz
  useEffect(() => {
    const info = (routeInfo as Record<string, unknown>) || {};
    const meetingKm = Number(info.pickup_distance_km);
    const meetingMin = Number(info.pickup_eta_min);
    const tripKm = Number(info.trip_distance_km);
    const tripMin = Number(info.trip_duration_min);

    setMeetingDistance(Number.isFinite(meetingKm) && meetingKm > 0 ? meetingKm : null);
    setMeetingDuration(
      Number.isFinite(meetingMin) && meetingMin > 0 ? Math.max(0, Math.round(meetingMin)) : null,
    );
    if (Number.isFinite(tripKm) && tripKm > 0) {
      setDestinationDistance(tripKm);
    }
    if (Number.isFinite(tripMin) && tripMin > 0) {
      setDestinationDuration(Math.max(0, Math.round(tripMin)));
    }

    if (Number.isFinite(tripKm) && tripKm > 0) {
      const isNear = tripKm <= 1;
      setNearDestination(isNear);
      if (isNear && !autoCompleteTriggered.current) {
        autoCompleteTriggered.current = true;
        Alert.alert(
          '🎯 Hedefe Ulaşıldı!',
          'Hedefe 1 km\'den az kaldı. Yolculuk otomatik olarak tamamlanacak ve +1 puan kazanacaksınız!',
          [{ text: 'Tamam', onPress: () => onAutoComplete?.() }],
        );
      }
    }
  }, [routeInfo, onAutoComplete]);

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
   * Önce viewport’u rota noktalarına oturt; polyline state’i bundan sonra verilmeli (viewport gecikmesi).
   * @param routeCoords Verilirse fit bu noktalara (ve gerekiyorsa hedefe) göre yapılır.
   */
  const fitNavigationViewport = useCallback(
    (routeCoords?: MapLatLng[] | null) => {
      if (!mapRef.current || !userLocation || !otherLocation) return;
      const navMeetingOnly = isDriver && navigationMode;
      const legKm = straightLineKm(userLocation, otherLocation);
      /** OSRM öncesi / hata: sadece 2 nokta — tüm mesafeyi fit etmek şehir zoom’u (ekrandaki bug) */
      const polyForSlice =
        routeCoords && routeCoords.length >= 2 ? routeCoords : [userLocation, otherLocation];
      /** OSRM en az bir ara düğüm döndüyse (≥3 nokta) segment dilimle; 2 nokta = düz çizgi = şehir zoom’u */
      const hasRichPolyline = polyForSlice.length >= 3;
      const longPickupLeg = navMeetingOnly && legKm >= 2.2;

      if (longPickupLeg && !hasRichPolyline) {
        const head = bearingDegrees(userLocation, otherLocation);
        mapRef.current.animateCamera(
          { center: userLocation, pitch: 54, heading: head, zoom: 17.9 },
          { duration: 480 },
        );
        lastNavCameraAtRef.current = Date.now();
        return;
      }

      let coords: MapLatLng[] = [...polyForSlice];
      if (longPickupLeg && hasRichPolyline) {
        coords = sliceMeetingRouteForNavFit(userLocation, polyForSlice, 3400);
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
      mapRef.current.fitToCoordinates(coords, {
        edgePadding,
        animated: true,
      });
    },
    [userLocation, otherLocation, destinationLocation, isDriver, navigationMode],
  );

  const loadDriverNavMeetingRoute = useCallback(async () => {
    if (!isDriver || !userLocation || !otherLocation) return;
    const r = await fetchOsrmDrivingRouteWithSteps(
      userLocation.latitude,
      userLocation.longitude,
      otherLocation.latitude,
      otherLocation.longitude,
    );
    let coords: MapLatLng[];
    if (!r || r.coordinates.length < 2) {
      coords = [userLocation, otherLocation];
      meetingHasOsrmPolylineRef.current = false;
      pickupNavStepsRef.current = null;
    } else {
      meetingHasOsrmPolylineRef.current = true;
      coords = r.coordinates;
      pickupNavStepsRef.current = {
        steps: r.steps,
        cumStart: buildCumStartMeters(r.steps),
      };
    }
    lastOsrmAtRef.current = Date.now();
    lastOsrmKeyRef.current = meetingEndpointsKey(
      userLocation.latitude,
      userLocation.longitude,
      otherLocation.latitude,
      otherLocation.longitude,
    );
    if (navigationModeRef.current) {
      setMeetingRouteCoordinates(coords);
    } else {
      fitNavigationViewport(coords);
      setTimeout(() => {
        setMeetingRouteCoordinates(coords);
      }, 150);
    }
  }, [isDriver, userLocation, otherLocation, fitNavigationViewport]);

  useEffect(() => {
    loadDriverNavMeetingRouteRef.current = loadDriverNavMeetingRoute;
  }, [loadDriverNavMeetingRoute]);

  useEffect(() => {
    if (!navigationMode || !isDriver) return;
    if (!userLocation || !otherLocation) return;
    console.log('NAV FETCH', userLocation, otherLocation);
    const openKey = meetingEndpointsKey(
      userLocation.latitude,
      userLocation.longitude,
      otherLocation.latitude,
      otherLocation.longitude,
    );
    lastNavRefreshDedupeKeyRef.current = openKey;
    void loadDriverNavMeetingRouteRef.current();
    // navigationMode açılışında tek zorunlu tetik; throttle NAV REFRESH’te (konum primitive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationMode]);

  useEffect(() => {
    if (!navigationMode || !isDriver) return;
    if (!userLocation || !otherLocation) return;
    const key = meetingEndpointsKey(
      userLocation.latitude,
      userLocation.longitude,
      otherLocation.latitude,
      otherLocation.longitude,
    );
    const now = Date.now();
    if (key === lastNavRefreshDedupeKeyRef.current) {
      return;
    }
    if (now - lastNavRefreshThrottleAtRef.current < NAV_REFRESH_OSRM_MIN_MS) {
      return;
    }
    lastNavRefreshDedupeKeyRef.current = key;
    lastNavRefreshThrottleAtRef.current = now;
    console.log('NAV REFRESH');
    void loadDriverNavMeetingRouteRef.current();
  }, [
    navigationMode,
    isDriver,
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
  ]);

  const onDriverNavMapReady = useCallback(() => {
    if (isDriver && navigationMode) return;
    if (
      isDriver &&
      meetingRouteCoordinates.length > 1 &&
      mapRef.current &&
      userLocation &&
      otherLocation
    ) {
      fitNavigationViewport(meetingRouteCoordinates);
    }
  }, [
    isDriver,
    navigationMode,
    meetingRouteCoordinates,
    fitNavigationViewport,
    userLocation,
    otherLocation,
  ]);

  // Buluşma: OSRM polyline; sürücü nav pickup aşamasında steps ile
  useEffect(() => {
    const pollMs = navigationMode && isDriver ? 12000 : 28000;
    const throttleMs = navigationMode && isDriver ? 9000 : 22000;

    refreshMeetingRouteOsrmRef.current = async (force = false) => {
      if (!userLocation || !otherLocation) return;
      const dLat = isDriver ? userLocation.latitude : otherLocation.latitude;
      const dLng = isDriver ? userLocation.longitude : otherLocation.longitude;
      const pLat = isDriver ? otherLocation.latitude : userLocation.latitude;
      const pLng = isDriver ? otherLocation.longitude : userLocation.longitude;
      const key = meetingEndpointsKey(dLat, dLng, pLat, pLng);
      const now = Date.now();
      const navOn = navigationModeRef.current && isDriver;
      if (navOn && navigationStageRef.current !== 'pickup') {
        return;
      }
      if (!force && !navOn) {
        if (now - lastOsrmAtRef.current < throttleMs && key === lastOsrmKeyRef.current) {
          return;
        }
      }
      lastOsrmKeyRef.current = key;
      lastOsrmAtRef.current = now;

      if (navOn) {
        const rw = await fetchOsrmDrivingRouteWithSteps(dLat, dLng, pLat, pLng);
        if (!rw || rw.coordinates.length < 2) return;
        meetingHasOsrmPolylineRef.current = true;
        pickupNavStepsRef.current = {
          steps: rw.steps,
          cumStart: buildCumStartMeters(rw.steps),
        };
        setMeetingRouteCoordinates(rw.coordinates);
        return;
      }

      const r = await fetchOsrmDrivingRoute(dLat, dLng, pLat, pLng);
      if (!r || r.coordinates.length < 2) return;
      meetingHasOsrmPolylineRef.current = true;
      if (isDriver && !navigationModeRef.current) {
        return;
      }
      setMeetingRouteCoordinates(r.coordinates);
    };

    void refreshMeetingRouteOsrmRef.current(true);

    const id = setInterval(() => {
      void refreshMeetingRouteOsrmRef.current(false);
    }, pollMs);
    return () => clearInterval(id);
  }, [
    userLocation?.latitude,
    userLocation?.longitude,
    otherLocation?.latitude,
    otherLocation?.longitude,
    isDriver,
    navigationMode,
  ]);

  // Yolcu: tüm noktaları göster; sürücüde fit yok (merkez araçta)
  useEffect(() => {
    if (!mapRef.current || !userLocation || !otherLocation || isDriver) {
      if (isDriver && userLocation && otherLocation) {
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
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 210, right: 48, bottom: 300, left: 48 },
        animated: true,
      });
      mapFitRef.current.initialDone = true;
    }, 650);
    return () => clearTimeout(t);
  }, [userLocation, otherLocation, destinationLocation, isDriver]);

  const driverNavRouteLayers = useMemo(() => {
    if (!isDriver || !navigationMode || !userLocation) return null;
    if (navigationStage === 'pickup' && meetingRouteCoordinates.length >= 2) {
      const p = distanceAlongPolylineM(userLocation, meetingRouteCoordinates);
      const s = splitRouteForNavDisplay(meetingRouteCoordinates, p);
      return { ...s, palette: 'pickup' as const };
    }
    if (navigationStage === 'destination' && destinationRoute.length >= 2) {
      const p = distanceAlongPolylineM(userLocation, destinationRoute);
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
  ]);

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

  return (
    <View style={styles.container}>
      {/* 🆕 BULUTLU ARKAPLAN - Sadece üst kısım */}
      <Image 
        source={{ uri: isDriver 
          ? 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80'
          : 'https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80'
        }}
        style={styles.cloudBackground}
        resizeMode="cover"
      />
      {/* 🆕 Bulut renk tint'i (silince arkaplan + buton uyumu) */}
      <View
        pointerEvents="none"
        style={[
          styles.cloudTintOverlay,
          { backgroundColor: isDriver ? 'rgba(124, 58, 237, 0.10)' : 'rgba(14, 165, 233, 0.08)' },
        ]}
      />

      {driverNavImmersive ? (
        <View
          style={[
            styles.navManeuverBanner,
            { paddingTop: Math.max(insets.top, 8) + 8 },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.navManeuverBannerStage}>
            {navigationStage === 'pickup' ? 'Buluşmaya gidiyorsunuz' : 'Hedefe gidiyorsunuz'}
          </Text>
          <View style={styles.navManeuverBannerRow}>
            <View style={styles.navManeuverIconCircle}>
              <NavManeuverArrowIcon kind={navManeuverUi?.arrowKind ?? 'unknown'} size={52} />
            </View>
            <View style={styles.navManeuverTextCol}>
              <Text style={styles.navManeuverBannerManeuver} numberOfLines={2}>
                {navManeuverUi?.instructionLine ?? 'Rota hazırlanıyor…'}
              </Text>
              {navManeuverUi?.streetName ? (
                <Text style={styles.navManeuverStreet} numberOfLines={1}>
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
                  top: Math.max(insets.top, 12) + 200,
                  right: 12,
                  bottom: Math.min(100, Math.max(72, SCREEN_HEIGHT * 0.11)),
                  left: 12,
                }
              : driverNavActive
                ? { top: 270, right: 12, bottom: 300, left: 12 }
                : { top: 200, right: 14, bottom: 268, left: 14 }
          }
          followsUserLocation={driverNavActive}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          scrollEnabled={!driverNavImmersive}
          zoomEnabled={!driverNavImmersive}
          rotateEnabled={!driverNavActive}
          pitchEnabled={driverNavActive}
          minZoomLevel={4}
          maxZoomLevel={22}
          customMapStyle={mapStyle}
        >
          {isDriver &&
            navigationMode &&
            navigationStage === 'pickup' &&
            driverNavRouteLayers?.palette === 'pickup' && (
              <>
                {driverNavRouteLayers.dim.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.dim}
                    strokeWidth={5}
                    strokeColor="rgba(20, 83, 45, 0.38)"
                    lineCap="round"
                    lineJoin="round"
                    zIndex={8}
                  />
                ) : null}
                {driverNavRouteLayers.bright.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.bright}
                    strokeWidth={11}
                    strokeColor="#22C55E"
                    lineCap="round"
                    lineJoin="round"
                    zIndex={9}
                  />
                ) : null}
                {driverNavRouteLayers.hot.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.hot}
                    strokeWidth={14}
                    strokeColor="rgba(255,255,255,0.88)"
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
                strokeWidth={8}
                strokeColor="#22C55E"
                lineCap="round"
                lineJoin="round"
                zIndex={10}
              />
            )}
          {!isDriver &&
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
          
          {/* TURUNCU ROTA: Yolcu → Hedef - KALIN */}
          {isDriver &&
            navigationMode &&
            navigationStage === 'destination' &&
            driverNavRouteLayers?.palette === 'dest' && (
              <>
                {driverNavRouteLayers.dim.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.dim}
                    strokeWidth={5}
                    strokeColor="rgba(154, 52, 18, 0.4)"
                    lineCap="round"
                    lineJoin="round"
                    zIndex={8}
                  />
                ) : null}
                {driverNavRouteLayers.bright.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.bright}
                    strokeWidth={10}
                    strokeColor="#FB923C"
                    lineCap="round"
                    lineJoin="round"
                    zIndex={9}
                  />
                ) : null}
                {driverNavRouteLayers.hot.length >= 2 ? (
                  <Polyline
                    coordinates={driverNavRouteLayers.hot}
                    strokeWidth={13}
                    strokeColor="#FFFBEB"
                    lineCap="round"
                    lineJoin="round"
                    zIndex={10}
                  />
                ) : null}
              </>
            )}
          {destinationRoute.length > 1 &&
            destinationLocation &&
            !(isDriver && navigationMode && navigationStage === 'pickup') &&
            !(isDriver && navigationMode && navigationStage === 'destination' && driverNavRouteLayers?.palette === 'dest') && (
              <Polyline
                coordinates={destinationRoute}
                strokeColor="#EA580C"
                strokeWidth={6}
                lineDashPattern={[12, 6]}
                lineJoin="round"
                lineCap="round"
              />
            )}

          {userLocation && driverNavActive && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              rotation={navHeadingUi}
              tracksViewChanges={false}
            >
              <View style={styles.driverNavVehicleMark}>
                {passMotor ? (
                  <MaterialCommunityIcons name="motorbike" size={26} color="#FFF" />
                ) : (
                  <MaterialCommunityIcons name="car" size={26} color="#FFF" />
                )}
              </View>
            </Marker>
          )}

          {/* BEN — nav dışı özel marker */}
          {userLocation && !driverNavActive && (
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.9 }}>
              <View style={styles.proMarkerContainer}>
                <View style={[styles.proMarkerHead, { backgroundColor: themeColor }]}>
                  <Ionicons name={isDriver ? "car" : "person"} size={20} color="#FFF" />
                </View>
                <View style={[styles.proMarkerTail, { borderTopColor: themeColor }]} />
                <View style={styles.proMarkerShadow} />
              </View>
            </Marker>
          )}

          {/* KARŞI TARAF - Profesyonel Marker - Tıklanabilir */}
          {otherLocation && (
            <Marker 
              coordinate={otherLocation} 
              anchor={{ x: 0.5, y: 0.9 }}
              onPress={() => setShowInfoCard(true)}
            >
              <View style={styles.proMarkerContainer}>
                <View style={[styles.proMarkerHead, { backgroundColor: isDriver ? '#8B5CF6' : '#059669' }]}>
                  {isDriver ? (
                    passMotor ? (
                      <MaterialCommunityIcons name="motorbike" size={20} color="#FFF" />
                    ) : (
                      <Ionicons name="person" size={20} color="#FFF" />
                    )
                  ) : (
                    <Ionicons name="car" size={20} color="#FFF" />
                  )}
                </View>
                <View style={[styles.proMarkerTail, { borderTopColor: isDriver ? '#8B5CF6' : '#059669' }]} />
                <View style={styles.proMarkerShadow} />
              </View>
            </Marker>
          )}

          {/* HEDEF - Bayrak Stili */}
          {destinationLocation && (
            <Marker coordinate={destinationLocation} anchor={{ x: 0.15, y: 0.95 }}>
              <View style={styles.proFlagMarker}>
                <View style={styles.proFlagPole} />
                <View style={styles.proFlagBody}>
                  <Ionicons name="flag" size={14} color="#FFF" />
                </View>
                <View style={styles.proFlagBase} />
              </View>
            </Marker>
          )}
        </MapView>
        {driverNavImmersive ? (
          <TouchableOpacity
            style={styles.driverNavCloseFab}
            onPress={() => {
              void tapButtonHaptic();
              setNavigationMode(false);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Navigasyonu kapat"
          >
            <Ionicons name="close-circle" size={22} color="#FFF" />
            <Text style={styles.driverNavCloseFabText}>Navigasyonu kapat</Text>
          </TouchableOpacity>
        ) : null}
        </View>
      ) : (
        // Web fallback - harita yok
        <View style={styles.webFallback}>
          <Ionicons name="map-outline" size={64} color="#3FA9F5" />
          <Text style={styles.webFallbackText}>Harita mobil cihazda görüntülenir</Text>
        </View>
      )}

      {/* Sürücü ekranında "Yolcu burada..." yazısı kaldırıldı */}

      {/* ÜST BİLGİ PANELİ — gök mavisi, desenli, profesyonel tipografi */}
      <View style={styles.topInfoPanel}>
        <View style={styles.topInfoBorder}>
          <LinearGradient
            colors={['#F0F9FF', '#E0F2FE', '#DBEAFE', '#F8FAFC']}
            locations={[0, 0.35, 0.7, 1]}
            style={styles.infoGradient}
          >
            <View style={styles.topCardPatternRoot} pointerEvents="none">
              {[
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
              ].map((i) => (
                <View key={i} style={[styles.topCardStripe, { left: -72 + i * 26 }]} />
              ))}
            </View>
            <View style={styles.topCardContent}>
              {/* Manevra metni üst banner’da; kartta yalnızca km/dk */}
              <View style={styles.routeInfoRow}>
                <View style={[styles.routeIndicator, { backgroundColor: '#059669' }]} />
                <View style={styles.routeDetails}>
                  <Text style={styles.routeLabelModern}>BULUŞMA</Text>
                  <Text style={styles.routeValueModern}>
                    {formatRouteKmMin(meetingDistance, meetingDuration)}
                  </Text>
                </View>
              </View>

              {destinationLocation ? (
                <View style={styles.routeInfoRow}>
                  <View style={[styles.routeIndicator, { backgroundColor: '#EA580C' }]} />
                  <View style={styles.routeDetails}>
                    <Text style={styles.routeLabelModern}>HEDEF</Text>
                    <Text style={styles.routeValueModern}>
                      {formatRouteKmMin(destinationDistance, destinationDuration)}
                    </Text>
                  </View>
                  {nearDestination ? (
                    <View style={styles.nearBadge}>
                      <Text style={styles.nearBadgeText}>YAKIN!</Text>
                    </View>
                  ) : null}
                  {offeredPrice ? (
                    <View style={styles.offeredPriceBadge}>
                      <Text style={styles.offeredPriceText}>₺{offeredPrice}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {price && !offeredPrice ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Ücret</Text>
                  <Text style={styles.priceValue}>₺{price}</Text>
                </View>
              ) : null}

              {isDriver && passengerPaymentMethod ? (
                <View style={styles.paymentMethodPill}>
                  <Ionicons
                    name={passengerPaymentMethod === 'card' ? 'card-outline' : 'cash-outline'}
                    size={16}
                    color="#0F172A"
                  />
                  <Text style={styles.paymentMethodPillText}>
                    {passengerPaymentMethod === 'card' ? 'Yolcu: sanal kart' : 'Yolcu: nakit'}
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        {/* 🆕 MATRIX DURUM YAZISI - kutuların hemen altına */}
        {matrixStatus && isDriver && !driverNavImmersive && (
          <View style={styles.matrixContainerDriver} pointerEvents="none">
            <Text style={styles.matrixTextDriver}>{matrixStatus}</Text>
          </View>
        )}

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

      {/* ALT BUTONLAR */}
      <View style={styles.bottomPanel}>
        <View style={styles.bottomGradient}>
          {/* Ara: alt panelde, Yaz butonunun hemen üstünde — yeşil yanıp sönen etiket + FAB (sol) */}
          {MapView && onCall ? (
            <View style={styles.callPromptRow} pointerEvents="box-none">
              <View style={styles.callPromptColumn}>
                <Animated.View style={{ opacity: callLabelBlink }}>
                  <Text style={styles.callPromptLabelRole}>
                    {isDriver ? 'YOLCU' : 'SÜRÜCÜ'}{' '}
                    <Text style={styles.callPromptLabelName}>{callPromptNameUpper}</Text>
                  </Text>
                  <Text style={styles.callPromptLabelAra}>ARA</Text>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: quickCallBreath }] }}>
                  <TouchableOpacity
                    style={[styles.mapCallFabCircle, isCallLoading && styles.mapCallFabCircleDisabled]}
                    onPress={() => {
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
              </View>
            </View>
          ) : null}

          {/* 🆕 SÜRÜCÜ İÇİN - YOLCUYA GİT BUTONU (Ortalı, Yaz butonunun üstünde) */}
          {isDriver && !driverNavImmersive && (
            <Animated.View
              style={[
                styles.centeredNavButton,
                {
                  opacity: pulseAnim,
                  transform: [{ scale: navBreathAnim }],
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  void tapButtonHaptic();
                  if (!userLocation || !otherLocation) {
                    Alert.alert('Konum', 'Harita için sizin ve yolcunun konumu gerekli.');
                    return;
                  }
                  if (!navigationMode) {
                    setNavigationStage('pickup');
                    setNavigationMode(true);
                    if (userId && tagId) {
                      const q = new URLSearchParams({ user_id: userId, tag_id: tagId });
                      void fetch(`${API_BASE_URL}/driver/on-the-way?${q}`, { method: 'POST' });
                    }
                  } else {
                    lastNavCameraAtRef.current = 0;
                    void loadDriverNavMeetingRouteRef.current();
                  }
                }}
                activeOpacity={0.7}
              >
                <LinearGradient 
                  colors={['#10B981', '#22C55E', '#34D399']} 
                  style={styles.centeredNavBtnPurple}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.nav3dIconWrap}>
                    {/* 3D hissi için arka gölge katmanı */}
                    <Ionicons
                      name="navigate"
                      size={22}
                      color="rgba(4, 120, 87, 0.35)"
                      style={{ position: 'absolute', left: 2, top: 4 }}
                    />
                    <Ionicons name="navigate" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.centeredNavBtnText}>
                    {navigationMode ? 'Rotayı yeniden ortala' : 'Yolcuya Git'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

            {/* 🆕 YAZ BUTONU - Ana Buton Olarak */}
            {!driverNavImmersive ? (
            <TouchableOpacity
              style={styles.mainChatButton}
              onPress={() => {
                void tapButtonHaptic();
                onChat?.();
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isDriver ? ['#F97316', '#EA580C'] : ['#3B82F6', '#2563EB']}
                style={styles.mainChatButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.chatButtonContent}>
                  <View style={styles.chatIconWrapperLarge}>
                    <Ionicons name="chatbubble-ellipses" size={26} color="#FFF" />
                  </View>
                  <Text style={styles.mainChatButtonText}>
                    {isDriver ? 'Yolcuya Yaz' : 'Sürücüye Yaz'}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            ) : null}

          {/* 🆕 ALT BUTONLAR - Destek ve Bitir */}
          {!driverNavImmersive ? (
          <View style={styles.actionButtons}>
            {/* Destek — aynı WhatsApp linki; görünüm: yeşil sohbet + sarı uyarı, logo yok */}
            <TouchableOpacity
              style={styles.supportDestekTouch}
              onPress={() => {
                const phoneNumber = '905326497412';
                const message = 'Merhaba, Leylek Tag uygulaması hakkında destek almak istiyorum.';
                const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;

                Linking.canOpenURL(whatsappUrl)
                  .then((supported) => {
                    if (supported) {
                      Linking.openURL(whatsappUrl);
                    } else {
                      Linking.openURL(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`);
                    }
                  })
                  .catch(() => {
                    Linking.openURL(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`);
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

            {/* 🆕 YOL PAYLAŞIMINI BİTİR BUTONU - QR ile + KONUM KONTROLÜ */}
            <Animated.View style={{ 
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.6, 1], outputRange: [0.98, 1.02] }) }]
            }}>
              <TouchableOpacity 
                style={styles.qrEndButton} 
                onPress={() => {
                  // 🔥 KONUM KONTROLÜ - Sadece sürücü için (1 KM mesafe)
                  if (isDriver && userLocation && otherLocation) {
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
  container: { flex: 1 },
  
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
  navManeuverBannerStage: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  navManeuverBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
  navManeuverStreet: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '600',
  },
  driverNavVehicleMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#15803D',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  driverNavCloseFab: {
    position: 'absolute',
    right: 10,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    zIndex: 40,
    elevation: 8,
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
  callPromptColumn: {
    alignItems: 'flex-start',
  },
  callPromptLabelRole: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.35,
    maxWidth: SCREEN_WIDTH * 0.72,
  },
  callPromptLabelName: {
    color: '#15803D',
    fontWeight: '900',
  },
  callPromptLabelAra: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 2,
    marginBottom: 8,
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
  
  // Top Info Panel — gök mavisi / desen
  topInfoPanel: { position: 'absolute', top: 0, left: 0, right: 0 },
  topInfoBorder: {
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 26,
    margin: 8,
    marginTop: 40,
    overflow: 'hidden',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  infoGradient: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 24, overflow: 'hidden' },
  topCardPatternRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  topCardStripe: {
    position: 'absolute',
    top: -80,
    width: 1,
    height: 320,
    backgroundColor: 'rgba(14, 165, 233, 0.09)',
    transform: [{ rotate: '32deg' }],
  },
  topCardContent: {
    position: 'relative',
    zIndex: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  routeInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  routeIndicator: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  routeDetails: { flex: 1 },
  routeLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  routeValue: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  routeLabelModern: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '800',
    letterSpacing: 2.8,
    marginBottom: 4,
  },
  routeValueModern: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0C4A6E',
    letterSpacing: 0.2,
  },
  nearBadge: { backgroundColor: '#EA580C', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  nearBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  offeredPriceBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    marginLeft: 'auto',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  offeredPriceText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(14, 165, 233, 0.22)',
  },
  priceLabel: { fontSize: 13, fontWeight: '700', color: '#0369A1', letterSpacing: 1 },
  priceValue: { fontSize: 24, fontWeight: '800', color: '#0EA5E9' },
  paymentMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
  },
  paymentMethodPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
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
    paddingVertical: 14,
    borderRadius: 16,
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
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 10,
    alignSelf: 'center',
    overflow: 'hidden',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
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
