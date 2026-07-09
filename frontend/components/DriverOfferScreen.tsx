/**
 * DriverOfferScreen - Sürücü Teklif Ekranı
 * 
 * Yolcunun gördüğü teklif ekranına benzer tasarım:
 * - Üstte harita (20km çevresindeki yolcuları gösterir)
 * - Altta kompakt kart listesi (scroll edilebilir)
 * - Her kartta: yolcu konumu, hedef, mesafe, süre bilgileri
 * - Hızlı teklif gönderme
 */

import React, { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../lib/backendConfig';
import { appAlert } from '../contexts/AppAlertContext';
import { playFeedbackErrorSound, playUiTapSound } from '../utils/sound';
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
import { useDriverTheme } from '../lib/theme/useDriverTheme';
import {
  ROUTE_LOADING_MIN_VISIBLE_MS,
  ROUTE_LOADING_UI,
  ROUTE_UNAVAILABLE_REVEAL_DELAY_MS,
} from '../lib/routeLoadingUiConstants';
import {
  type OfferSeenSource,
  reportDriverOfferSeen,
  normalizeOfferSeenSource,
} from '../lib/offerSeenTelemetry';
import {
  computeDriverOfferCountdownRemainingSec,
  resolveDriverOfferCountdownTotalSec,
  resolveOfferCountdownTier,
  compareDriverOffersByUrgency,
  DRIVER_OFFER_NEW_EMPHASIS_MS,
  DRIVER_OFFER_URGENCY_PULSE_MS,
  DRIVER_OFFER_URGENCY_PULSE_CYCLES,
  type OfferCountdownTier,
} from '../lib/driverOfferUrgency';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MAP_POLL_INTERVAL_MS = 9000;
/** Dispatch radius ile hizalı saha tarama yarıçapı (backend `DISPATCH_RADIUS_KM` default) */
const FIELD_DEFAULT_RADIUS_KM = 10;
/** Embedded kokpit — liste peek yüksekliği (drag sheet yok) */
const EMBEDDED_LIST_PEEK_HEIGHT = Math.min(Math.max(Math.round(SCREEN_HEIGHT * 0.36), 220), 320);

/** Legacy (non-embedded) saha haritası — bölge/şehir zoom */
const FIELD_INITIAL_DELTA_LEGACY = 0.12;
const FIELD_FALLBACK_DELTA_LEGACY = 0.15;
const FIELD_SINGLE_POINT_MIN_DELTA_LEGACY = 0.14;
const FIELD_FIT_CAP_KM_LEGACY = 45;
const FIELD_FIT_RADIUS_FACTOR_LEGACY = 1.2;

/** Embedded map-first — sokak/mahalle zoom */
const FIELD_INITIAL_DELTA_MAP_FIRST = 0.016;
const FIELD_FALLBACK_DELTA_MAP_FIRST = 0.02;
const FIELD_SINGLE_POINT_MIN_DELTA_MAP_FIRST = 0.018;
const FIELD_SINGLE_POINT_MAX_DELTA_MAP_FIRST = 0.022;
const FIELD_FIT_CAP_KM_MAP_FIRST = 4;
const FIELD_FIT_RADIUS_FACTOR_MAP_FIRST = 0.35;

/** Zoom LOD — latitudeDelta eşikleri (client-only, backend yok) */
const FIELD_ZOOM_NEAR_MAX_DELTA = 0.04;
const FIELD_ZOOM_MID_MAX_DELTA = 0.12;
const FIELD_ZOOM_NEAR_MAX_DELTA_MAP_FIRST = 0.025;
const FIELD_ZOOM_MID_MAX_DELTA_MAP_FIRST = 0.06;
const FIELD_ZOOM_NEAR_HEAT_MAX = 20;
const FIELD_ZOOM_MID_LIGHT_MAX = 20;

/** FI-06B — temporal ring buffer (~5 dk @ 9s poll) */
const FIELD_TEMPORAL_BUFFER_MAX = 34;
const FIELD_TEMPORAL_MIN_SNAPSHOTS = 3;
const FIELD_TEMPORAL_MIN_COVERAGE_MS = 27_000;
const FIELD_TEMPORAL_DRIVER_RESET_KM = 2;

type FieldMapZoomBand = 'near' | 'mid' | 'far';

function resolveFieldRadiusKm(radius: number | undefined | null): number {
  const n = Number(radius);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : FIELD_DEFAULT_RADIUS_KM;
}

function resolveFieldInitialMapDelta(mapFirstLayout: boolean): number {
  return mapFirstLayout ? FIELD_INITIAL_DELTA_MAP_FIRST : FIELD_INITIAL_DELTA_LEGACY;
}

function resolveFieldFallbackMapDelta(mapFirstLayout: boolean): number {
  return mapFirstLayout ? FIELD_FALLBACK_DELTA_MAP_FIRST : FIELD_FALLBACK_DELTA_LEGACY;
}

function resolveFieldFitCapKm(radiusKm: number, mapFirstLayout: boolean): number {
  const rk = resolveFieldRadiusKm(radiusKm);
  if (mapFirstLayout) {
    return Math.min(FIELD_FIT_CAP_KM_MAP_FIRST, rk * FIELD_FIT_RADIUS_FACTOR_MAP_FIRST);
  }
  return Math.min(FIELD_FIT_CAP_KM_LEGACY, rk * FIELD_FIT_RADIUS_FACTOR_LEGACY);
}

function resolveFieldSinglePointDeltas(
  driverLocation: { latitude: number; longitude: number },
  radiusKm: number,
  mapFirstLayout: boolean,
): { latitudeDelta: number; longitudeDelta: number } {
  const rk = resolveFieldRadiusKm(radiusKm);
  const cosLat = Math.cos((driverLocation.latitude * Math.PI) / 180);
  if (mapFirstLayout) {
    const latDelta = Math.min(
      FIELD_SINGLE_POINT_MAX_DELTA_MAP_FIRST,
      Math.max(FIELD_SINGLE_POINT_MIN_DELTA_MAP_FIRST, (rk / 111) * 0.35),
    );
    const lngDelta = Math.min(
      FIELD_SINGLE_POINT_MAX_DELTA_MAP_FIRST,
      Math.max(FIELD_SINGLE_POINT_MIN_DELTA_MAP_FIRST, (rk / (111 * Math.max(cosLat, 0.2))) * 0.35),
    );
    return { latitudeDelta: latDelta, longitudeDelta: lngDelta };
  }
  const latDelta = Math.max(FIELD_SINGLE_POINT_MIN_DELTA_LEGACY, (rk / 111) * 1.1);
  const lngDelta = Math.max(
    FIELD_SINGLE_POINT_MIN_DELTA_LEGACY,
    (rk / (111 * Math.max(cosLat, 0.2))) * 1.1,
  );
  return { latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

function resolveFieldMapEdgePadding(mapFirstLayout: boolean): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (mapFirstLayout) {
    return {
      top: 128,
      right: 28,
      bottom: EMBEDDED_LIST_PEEK_HEIGHT + 28,
      left: 28,
    };
  }
  return { top: 44, right: 36, bottom: 36, left: 36 };
}

function resolveFieldMapZoomBand(
  latitudeDelta: number | undefined | null,
  mapFirstLayout = false,
): FieldMapZoomBand {
  const d = Number(latitudeDelta);
  const nearMax = mapFirstLayout ? FIELD_ZOOM_NEAR_MAX_DELTA_MAP_FIRST : FIELD_ZOOM_NEAR_MAX_DELTA;
  const midMax = mapFirstLayout ? FIELD_ZOOM_MID_MAX_DELTA_MAP_FIRST : FIELD_ZOOM_MID_MAX_DELTA;
  if (!Number.isFinite(d) || d <= 0) return 'near';
  if (d < nearMax) return 'near';
  if (d < midMax) return 'mid';
  return 'far';
}

function selectFieldLightPinsForZoom(
  pins: DriverMapLightPin[],
  band: FieldMapZoomBand,
): DriverMapLightPin[] {
  if (band === 'far') return [];
  if (band === 'near') return pins;
  if (pins.length <= FIELD_ZOOM_MID_LIGHT_MAX) return pins;
  return [...pins]
    .sort((a, b) => {
      const da = Number(a.distance_km);
      const db = Number(b.distance_km);
      const na = Number.isFinite(da) && da > 0 ? da : 999;
      const nb = Number.isFinite(db) && db > 0 ? db : 999;
      return na - nb;
    })
    .slice(0, FIELD_ZOOM_MID_LIGHT_MAX);
}

function selectFieldSeekingPinsForZoom(
  pins: DriverMapSeekingPin[],
  listedIds: Set<string>,
  band: FieldMapZoomBand,
): DriverMapSeekingPin[] {
  if (band === 'far') return [];
  if (band === 'near') return pins;
  return pins.filter((pin) => listedIds.has(String(pin.tag_id)));
}

function selectFieldHeatCellsForZoom(
  grid: DriverMapCityGridCell[],
  band: FieldMapZoomBand,
): DriverMapCityGridCell[] {
  if (band !== 'near') return grid;
  if (grid.length <= FIELD_ZOOM_NEAR_HEAT_MAX) return grid;
  return [...grid].sort((a, b) => b.intensity - a.intensity).slice(0, FIELD_ZOOM_NEAR_HEAT_MAX);
}

function clampFieldHeatIntensity(intensity: number): number {
  const n = Number(intensity);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** FI-04C — zoom band ile görsel önem (LOD filtresi değişmez) */
function resolveFieldHeatZoomPresence(band: FieldMapZoomBand): { size: number; alpha: number } {
  switch (band) {
    case 'near':
      return { size: 0.86, alpha: 0.58 };
    case 'mid':
      return { size: 1, alpha: 0.78 };
    default:
      return { size: 1.2, alpha: 0.94 };
  }
}

/** FI-04A/B/E — intensity → yarı saydam operasyon diski (client-only görsel) */
function resolveFieldHeatCellVisual(intensity: number, zoomBand: FieldMapZoomBand) {
  const t = clampFieldHeatIntensity(intensity);
  const presence = resolveFieldHeatZoomPresence(zoomBand);

  const coreBase = 34 + t * 42;
  const coreSize = Math.round(coreBase * presence.size);
  const haloSize = Math.round(coreSize * 1.62);
  const wrapSize = Math.max(haloSize + 8, coreSize + 12);

  let fillRgb: [number, number, number];
  let strokeRgb: [number, number, number];
  let fillAlphaBase: number;
  let strokeAlphaBase: number;
  let strokeWidth: number;

  if (t < 0.35) {
    fillRgb = [251, 191, 36];
    strokeRgb = [217, 119, 6];
    fillAlphaBase = 0.14 + t * 0.12;
    strokeAlphaBase = 0.22 + t * 0.15;
    strokeWidth = 1;
  } else if (t <= 0.7) {
    fillRgb = [249, 115, 22];
    strokeRgb = [234, 88, 12];
    fillAlphaBase = 0.18 + (t - 0.35) * 0.22;
    strokeAlphaBase = 0.28 + (t - 0.35) * 0.2;
    strokeWidth = 1.25;
  } else if (t <= 0.85) {
    fillRgb = [251, 146, 60];
    strokeRgb = [234, 88, 12];
    fillAlphaBase = 0.26 + (t - 0.7) * 0.18;
    strokeAlphaBase = 0.38 + (t - 0.7) * 0.15;
    strokeWidth = 1.5;
  } else {
    fillRgb = [251, 146, 60];
    strokeRgb = [220, 38, 38];
    fillAlphaBase = 0.32 + (t - 0.85) * 0.12;
    strokeAlphaBase = 0.42 + (t - 0.85) * 0.1;
    strokeWidth = 1.75;
  }

  const fillAlpha = Math.min(0.48, fillAlphaBase * presence.alpha);
  const strokeAlpha = Math.min(0.58, strokeAlphaBase * presence.alpha);
  const fillColor = `rgba(${fillRgb[0]}, ${fillRgb[1]}, ${fillRgb[2]}, ${fillAlpha.toFixed(3)})`;
  const strokeColor = `rgba(${strokeRgb[0]}, ${strokeRgb[1]}, ${strokeRgb[2]}, ${strokeAlpha.toFixed(3)})`;
  const haloFillColor = `rgba(${fillRgb[0]}, ${fillRgb[1]}, ${fillRgb[2]}, ${(fillAlpha * 0.45).toFixed(3)})`;

  return {
    wrapSize,
    coreSize,
    haloSize,
    fillColor,
    haloFillColor,
    strokeColor,
    strokeWidth,
    animate: t >= 0.7,
  };
}

type FieldActivityBand = 'Pasif' | 'Sakin' | 'Canlı' | 'Yoğun';

function resolveFieldActivityBand(score: number): FieldActivityBand {
  const n = Math.max(0, Math.floor(Number(score) || 0));
  if (n === 0) return 'Pasif';
  if (n <= 2) return 'Sakin';
  if (n <= 5) return 'Canlı';
  return 'Yoğun';
}

function resolveCardinalBearing(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string {
  const dLng = (toLng - fromLng) * (Math.PI / 180);
  const lat1 = fromLat * (Math.PI / 180);
  const lat2 = toLat * (Math.PI / 180);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;
  if (brng >= 315 || brng < 45) return 'Kuzey';
  if (brng >= 45 && brng < 135) return 'Doğu';
  if (brng >= 135 && brng < 225) return 'Güney';
  return 'Batı';
}

function resolveFieldDensityBand(intensity: number): string {
  const n = Number(intensity);
  if (!Number.isFinite(n) || n < 0.35) return 'Düşük yoğunluk';
  if (n <= 0.7) return 'Orta yoğunluk';
  return 'Yüksek yoğunluk';
}

function resolveFieldDenseRegionLabel(
  grid: DriverMapCityGridCell[],
  driverLocation: { latitude: number; longitude: number } | null,
): string {
  if (!grid.length || !driverLocation) return 'Belirsiz';
  let best = grid[0];
  for (const cell of grid) {
    if (cell.intensity > best.intensity) best = cell;
  }
  const dir = resolveCardinalBearing(
    driverLocation.latitude,
    driverLocation.longitude,
    best.center_lat,
    best.center_lng,
  );
  return `${dir} · ${resolveFieldDensityBand(best.intensity)}`;
}

function resolveMinLightDistanceKm(pins: DriverMapLightPin[]): number | null {
  let min: number | null = null;
  for (const p of pins) {
    const d = Number(p.distance_km);
    if (!Number.isFinite(d) || d <= 0) continue;
    min = min == null ? d : Math.min(min, d);
  }
  return min;
}

type FieldCardinalSector = 'Kuzey' | 'Doğu' | 'Güney' | 'Batı';
type FieldSpatialDensityBand = 'Düşük' | 'Orta' | 'Yüksek';
type FieldOperationScoreBand = 'Zayıf' | 'Orta' | 'Güçlü' | 'Çok güçlü';
type FieldNearSignalLevel = 'Yok' | 'Düşük' | 'Orta' | 'Yüksek';

function resolveFieldCardinalSector(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): FieldCardinalSector {
  return resolveCardinalBearing(fromLat, fromLng, toLat, toLng) as FieldCardinalSector;
}

function resolveFieldHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveFieldSpatialDensityBand(intensity: number): FieldSpatialDensityBand {
  const n = Number(intensity);
  if (!Number.isFinite(n) || n < 0.35) return 'Düşük';
  if (n <= 0.7) return 'Orta';
  return 'Yüksek';
}

function resolveFieldSectorActivityLabel(band: FieldSpatialDensityBand): string {
  if (band === 'Yüksek') return 'hareketli';
  if (band === 'Orta') return 'aktif';
  return 'sakin';
}

function resolveFieldOperationScoreBand(score: number): FieldOperationScoreBand {
  const n = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  if (n <= 24) return 'Zayıf';
  if (n <= 49) return 'Orta';
  if (n <= 74) return 'Güçlü';
  return 'Çok güçlü';
}

function resolveFieldNearSignalLevel(
  count: number,
  minKm: number | null,
): FieldNearSignalLevel {
  const c = Math.max(0, Math.floor(Number(count) || 0));
  if (c <= 0) return 'Yok';
  if (c >= 8 || (minKm != null && minKm <= 1.5)) return 'Yüksek';
  if (c >= 3 || (minKm != null && minKm <= 3.5)) return 'Orta';
  return 'Düşük';
}

function resolveFieldAreaOccupancyLevel(
  grid: DriverMapCityGridCell[],
  seeking: number,
  nearby: number,
): FieldSpatialDensityBand {
  const activeCells = grid.filter((cell) => Number(cell.count) > 0).length;
  const gridRatio = grid.length > 0 ? activeCells / grid.length : 0;
  const activityRatio = Math.min(1, (Math.max(0, seeking) + Math.max(0, nearby) * 0.45) / 10);
  const blend = grid.length > 0 ? 0.4 * gridRatio + 0.6 * activityRatio : activityRatio;
  if (blend < 0.22) return 'Düşük';
  if (blend < 0.52) return 'Orta';
  return 'Yüksek';
}

function resolveFieldDominantSector(
  driverLocation: { latitude: number; longitude: number },
  grid: DriverMapCityGridCell[],
  seekingPins: DriverMapSeekingPin[],
  lightPins: DriverMapLightPin[],
): { sector: FieldCardinalSector; band: FieldSpatialDensityBand } | null {
  const totals = resolveFieldSectorScores(driverLocation, grid, seekingPins, lightPins);

  let bestSector: FieldCardinalSector | null = null;
  let bestScore = 0;
  let total = 0;
  (Object.keys(totals) as FieldCardinalSector[]).forEach((sector) => {
    total += totals[sector];
    if (totals[sector] > bestScore) {
      bestScore = totals[sector];
      bestSector = sector;
    }
  });
  if (!bestSector || bestScore <= 0) return null;

  const share = total > 0 ? bestScore / total : 0;
  let band: FieldSpatialDensityBand = 'Düşük';
  if (bestScore >= 2.5 || share >= 0.45) band = 'Yüksek';
  else if (bestScore >= 1 || share >= 0.28) band = 'Orta';
  return { sector: bestSector, band };
}

function resolveFieldSectorScores(
  driverLocation: { latitude: number; longitude: number },
  grid: DriverMapCityGridCell[],
  seekingPins: DriverMapSeekingPin[],
  lightPins: DriverMapLightPin[],
): Record<FieldCardinalSector, number> {
  const totals: Record<FieldCardinalSector, number> = {
    Kuzey: 0,
    Doğu: 0,
    Güney: 0,
    Batı: 0,
  };

  for (const cell of grid) {
    const sector = resolveFieldCardinalSector(
      driverLocation.latitude,
      driverLocation.longitude,
      cell.center_lat,
      cell.center_lng,
    );
    totals[sector] += Number(cell.intensity) * 2 + Number(cell.count) * 0.15;
  }
  for (const pin of seekingPins) {
    const sector = resolveFieldCardinalSector(
      driverLocation.latitude,
      driverLocation.longitude,
      pin.pickup_lat,
      pin.pickup_lng,
    );
    totals[sector] += 1;
  }
  for (const pin of lightPins) {
    const sector = resolveFieldCardinalSector(
      driverLocation.latitude,
      driverLocation.longitude,
      pin.latitude,
      pin.longitude,
    );
    totals[sector] += 0.35;
  }

  return totals;
}

function resolveFieldNearestDenseRegion(
  driverLocation: { latitude: number; longitude: number },
  grid: DriverMapCityGridCell[],
): { km: number; band: FieldSpatialDensityBand } | null {
  if (!grid.length) return null;

  const ranked = [...grid].sort((a, b) => b.intensity - a.intensity);
  const threshold = 0.35;
  const candidates = ranked.filter((cell) => Number(cell.intensity) >= threshold);
  const pool = candidates.length > 0 ? candidates : ranked.slice(0, 1);

  let bestKm: number | null = null;
  let bestBand: FieldSpatialDensityBand = 'Düşük';
  for (const cell of pool) {
    const km = resolveFieldHaversineKm(
      driverLocation.latitude,
      driverLocation.longitude,
      cell.center_lat,
      cell.center_lng,
    );
    if (bestKm == null || km < bestKm) {
      bestKm = km;
      bestBand = resolveFieldSpatialDensityBand(cell.intensity);
    }
  }
  if (bestKm == null) return null;
  return { km: bestKm, band: bestBand };
}

function resolveFieldOperationScore(input: {
  seeking: number;
  nearby: number;
  peakIntensity: number;
  listedCount: number;
  occupancy: FieldSpatialDensityBand;
}): number {
  const seekingNorm = Math.min(1, Math.max(0, input.seeking) / 8);
  const nearbyNorm = Math.min(1, Math.max(0, input.nearby) / 20);
  const peakNorm = Math.min(1, Math.max(0, input.peakIntensity));
  const listedNorm = Math.min(1, Math.max(0, input.listedCount) / 5);
  const occupancyNorm =
    input.occupancy === 'Yüksek' ? 1 : input.occupancy === 'Orta' ? 0.55 : 0.2;

  const raw =
    seekingNorm * 30 +
    nearbyNorm * 20 +
    peakNorm * 25 +
    listedNorm * 15 +
    occupancyNorm * 10;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** FI-05B — presentation-only Spatial Insight Engine (backend yok) */
function resolveFieldSpatialInsights(input: {
  mapExpanded: boolean;
  driverLocation: { latitude: number; longitude: number } | null;
  grid: DriverMapCityGridCell[];
  seekingPins: DriverMapSeekingPin[];
  lightPins: DriverMapLightPin[];
  seeking: number;
  nearby: number;
  listedCount: number;
}): {
  dominantSector: FieldCardinalSector | null;
  dominantSectorBand: FieldSpatialDensityBand | null;
  nearestDenseRegionKm: number | null;
  nearestDenseRegionBand: FieldSpatialDensityBand | null;
  areaOccupancy: FieldSpatialDensityBand;
  nearSignalLevel: FieldNearSignalLevel;
  operationScore: number;
  operationScoreBand: FieldOperationScoreBand;
  insightLine: string;
} {
  const minLightKm = resolveMinLightDistanceKm(input.lightPins);
  const nearSignalLevel = resolveFieldNearSignalLevel(input.nearby, minLightKm);
  const areaOccupancy = resolveFieldAreaOccupancyLevel(input.grid, input.seeking, input.nearby);

  let peakIntensity = 0;
  for (const cell of input.grid) {
    if (Number(cell.intensity) > peakIntensity) peakIntensity = Number(cell.intensity);
  }

  const operationScore = resolveFieldOperationScore({
    seeking: input.seeking,
    nearby: input.nearby,
    peakIntensity,
    listedCount: input.listedCount,
    occupancy: areaOccupancy,
  });
  const operationScoreBand = resolveFieldOperationScoreBand(operationScore);

  if (!input.mapExpanded || !input.driverLocation) {
    return {
      dominantSector: null,
      dominantSectorBand: null,
      nearestDenseRegionKm: null,
      nearestDenseRegionBand: null,
      areaOccupancy,
      nearSignalLevel,
      operationScore,
      operationScoreBand,
      insightLine: 'Saha analizi için haritayı aç',
    };
  }

  const dominant = resolveFieldDominantSector(
    input.driverLocation,
    input.grid,
    input.seekingPins,
    input.lightPins,
  );
  const nearestDense = resolveFieldNearestDenseRegion(input.driverLocation, input.grid);
  const hasSpatialData =
    input.grid.length > 0 ||
    input.seekingPins.length > 0 ||
    input.lightPins.length > 0 ||
    input.seeking > 0 ||
    input.nearby > 0;

  if (!hasSpatialData) {
    return {
      dominantSector: null,
      dominantSectorBand: null,
      nearestDenseRegionKm: null,
      nearestDenseRegionBand: null,
      areaOccupancy,
      nearSignalLevel,
      operationScore,
      operationScoreBand,
      insightLine: `Saha sakin · Skor ${operationScore}`,
    };
  }

  if (dominant) {
    const activity = resolveFieldSectorActivityLabel(dominant.band);
    return {
      dominantSector: dominant.sector,
      dominantSectorBand: dominant.band,
      nearestDenseRegionKm: nearestDense?.km ?? null,
      nearestDenseRegionBand: nearestDense?.band ?? null,
      areaOccupancy,
      nearSignalLevel,
      operationScore,
      operationScoreBand,
      insightLine: `${dominant.sector} sektörü ${activity} · Skor ${operationScore}`,
    };
  }

  return {
    dominantSector: null,
    dominantSectorBand: null,
    nearestDenseRegionKm: nearestDense?.km ?? null,
    nearestDenseRegionBand: nearestDense?.band ?? null,
    areaOccupancy,
    nearSignalLevel,
    operationScore,
    operationScoreBand,
    insightLine: `Saha sakin · Skor ${operationScore}`,
  };
}

type FieldTemporalTrendDirection = 'insufficient' | 'stable' | 'increasing' | 'decreasing';
type FieldTemporalTrendConfidence = 'low' | 'medium' | 'high';

type FieldTemporalSnapshot = {
  ts: number;
  seekingCount: number;
  nearbyCount: number;
  peakIntensity: number;
  dominantSector: FieldCardinalSector | null;
  sectorScores: Record<FieldCardinalSector, number>;
  operationScore: number;
  listedCount: number;
  radiusKm: number;
};

type FieldTemporalTrendResult = {
  overall: FieldTemporalTrendDirection;
  seeking: FieldTemporalTrendDirection;
  nearby: FieldTemporalTrendDirection;
  operationScore: FieldTemporalTrendDirection;
  confidence: FieldTemporalTrendConfidence;
  coverageMs: number;
  snapshotCount: number;
};

type FieldTemporalBufferState = {
  snapshots: FieldTemporalSnapshot[];
  origin: { latitude: number; longitude: number } | null;
};

function createFieldTemporalBufferState(): FieldTemporalBufferState {
  return { snapshots: [], origin: null };
}

function resetFieldTemporalBuffer(state: FieldTemporalBufferState): void {
  state.snapshots.length = 0;
  state.origin = null;
}

function shouldResetFieldTemporalBuffer(
  state: FieldTemporalBufferState,
  driverLocation: { latitude: number; longitude: number },
): boolean {
  if (!state.origin) return false;
  return (
    resolveFieldHaversineKm(
      state.origin.latitude,
      state.origin.longitude,
      driverLocation.latitude,
      driverLocation.longitude,
    ) > FIELD_TEMPORAL_DRIVER_RESET_KM
  );
}

function buildFieldTemporalSnapshot(input: {
  driverLocation: { latitude: number; longitude: number };
  grid: DriverMapCityGridCell[];
  seekingPins: DriverMapSeekingPin[];
  lightPins: DriverMapLightPin[];
  seeking: number;
  nearby: number;
  listedCount: number;
  radiusKm: number;
}): FieldTemporalSnapshot {
  const sectorScores = resolveFieldSectorScores(
    input.driverLocation,
    input.grid,
    input.seekingPins,
    input.lightPins,
  );
  const dominant = resolveFieldDominantSector(
    input.driverLocation,
    input.grid,
    input.seekingPins,
    input.lightPins,
  );

  let peakIntensity = 0;
  for (const cell of input.grid) {
    if (Number(cell.intensity) > peakIntensity) peakIntensity = Number(cell.intensity);
  }

  const areaOccupancy = resolveFieldAreaOccupancyLevel(input.grid, input.seeking, input.nearby);
  const operationScore = resolveFieldOperationScore({
    seeking: input.seeking,
    nearby: input.nearby,
    peakIntensity,
    listedCount: input.listedCount,
    occupancy: areaOccupancy,
  });

  return {
    ts: Date.now(),
    seekingCount: Math.max(0, Math.floor(Number(input.seeking) || 0)),
    nearbyCount: Math.max(0, Math.floor(Number(input.nearby) || 0)),
    peakIntensity,
    dominantSector: dominant?.sector ?? null,
    sectorScores,
    operationScore,
    listedCount: Math.max(0, Math.floor(Number(input.listedCount) || 0)),
    radiusKm: resolveFieldRadiusKm(input.radiusKm),
  };
}

function appendFieldTemporalSnapshot(
  state: FieldTemporalBufferState,
  snapshot: FieldTemporalSnapshot,
  driverLocation: { latitude: number; longitude: number },
): void {
  if (shouldResetFieldTemporalBuffer(state, driverLocation)) {
    resetFieldTemporalBuffer(state);
  }
  if (!state.origin) {
    state.origin = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    };
  }
  state.snapshots.push(snapshot);
  if (state.snapshots.length > FIELD_TEMPORAL_BUFFER_MAX) {
    state.snapshots.splice(0, state.snapshots.length - FIELD_TEMPORAL_BUFFER_MAX);
  }
}

function resolveFieldMetricTrendDirection(
  first: number,
  last: number,
  stableThreshold: number,
): Exclude<FieldTemporalTrendDirection, 'insufficient'> {
  const delta = last - first;
  if (Math.abs(delta) <= stableThreshold) return 'stable';
  return delta > 0 ? 'increasing' : 'decreasing';
}

function resolveFieldTemporalTrendConfidence(
  seeking: Exclude<FieldTemporalTrendDirection, 'insufficient'>,
  nearby: Exclude<FieldTemporalTrendDirection, 'insufficient'>,
  operationScore: Exclude<FieldTemporalTrendDirection, 'insufficient'>,
): FieldTemporalTrendConfidence {
  const inc = [seeking, nearby, operationScore].filter((d) => d === 'increasing').length;
  const dec = [seeking, nearby, operationScore].filter((d) => d === 'decreasing').length;
  const aligned = Math.max(inc, dec);
  if (aligned >= 3) return 'high';
  if (aligned >= 2) return 'medium';
  return 'low';
}

function resolveFieldTemporalOverallTrend(
  seeking: Exclude<FieldTemporalTrendDirection, 'insufficient'>,
  nearby: Exclude<FieldTemporalTrendDirection, 'insufficient'>,
  operationScore: Exclude<FieldTemporalTrendDirection, 'insufficient'>,
): Exclude<FieldTemporalTrendDirection, 'insufficient'> {
  const inc = [seeking, nearby, operationScore].filter((d) => d === 'increasing').length;
  const dec = [seeking, nearby, operationScore].filter((d) => d === 'decreasing').length;
  if (inc >= 2) return 'increasing';
  if (dec >= 2) return 'decreasing';
  if (seeking !== 'stable') return seeking;
  if (nearby !== 'stable') return nearby;
  return operationScore;
}

function resolveFieldTemporalTrend(snapshots: FieldTemporalSnapshot[]): FieldTemporalTrendResult {
  const snapshotCount = snapshots.length;
  if (snapshotCount < FIELD_TEMPORAL_MIN_SNAPSHOTS) {
    return {
      overall: 'insufficient',
      seeking: 'insufficient',
      nearby: 'insufficient',
      operationScore: 'insufficient',
      confidence: 'low',
      coverageMs: 0,
      snapshotCount,
    };
  }

  const first = snapshots[0];
  const last = snapshots[snapshotCount - 1];
  const coverageMs = Math.max(0, last.ts - first.ts);
  if (coverageMs < FIELD_TEMPORAL_MIN_COVERAGE_MS) {
    return {
      overall: 'insufficient',
      seeking: 'insufficient',
      nearby: 'insufficient',
      operationScore: 'insufficient',
      confidence: 'low',
      coverageMs,
      snapshotCount,
    };
  }

  const seeking = resolveFieldMetricTrendDirection(first.seekingCount, last.seekingCount, 1);
  const nearby = resolveFieldMetricTrendDirection(first.nearbyCount, last.nearbyCount, 1);
  const operationScore = resolveFieldMetricTrendDirection(
    first.operationScore,
    last.operationScore,
    3,
  );
  const confidence = resolveFieldTemporalTrendConfidence(seeking, nearby, operationScore);
  const overall = resolveFieldTemporalOverallTrend(seeking, nearby, operationScore);

  return {
    overall,
    seeking,
    nearby,
    operationScore,
    confidence,
    coverageMs,
    snapshotCount,
  };
}

/** FI-06C — Opportunity Engine: spatial + score + trend gözlemi (AI/tahmin değil) */
function resolveFieldOpportunityComment(input: {
  mapExpanded: boolean;
  operationScore: number;
  trendOverall: FieldTemporalTrendDirection | null;
  listedCount: number;
}): string {
  if (!input.mapExpanded) return 'Saha analizi için haritayı aç';
  if (!input.trendOverall || input.trendOverall === 'insufficient') {
    return 'Veri toplanıyor';
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(input.operationScore) || 0)));
  const listed = Math.max(0, Math.floor(Number(input.listedCount) || 0));

  if (input.trendOverall === 'decreasing') return 'Saha sakinleşiyor';

  if (input.trendOverall === 'increasing') {
    if (score >= 75 || listed >= 2) return 'Operasyon canlı';
    return 'Saha güçleniyor';
  }

  if (score >= 75 || listed >= 2) return 'Operasyon canlı';
  return 'Saha stabil';
}

function resolveFieldOpportunityInsightLine(input: {
  mapExpanded: boolean;
  spatialInsightLine: string;
  operationScore: number;
  trend: FieldTemporalTrendResult | null;
  listedCount: number;
}): string {
  if (!input.mapExpanded) return 'Saha analizi için haritayı aç';

  const opportunity = resolveFieldOpportunityComment({
    mapExpanded: input.mapExpanded,
    operationScore: input.operationScore,
    trendOverall: input.trend?.overall ?? null,
    listedCount: input.listedCount,
  });

  return `${input.spatialInsightLine} · ${opportunity}`;
}

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
  const { ui } = useDriverTheme();
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
  const routeUiText = ui.textSoft;
  const routeUiDot = ui.accent;
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
  // offer flow
  offered_price?: number;
  notes?: string;
  created_at?: string;
  /** Server hint (seconds) — local countdown anchor only; not authoritative revoke time. */
  dispatch_timeout?: number;
  is_dispatch?: boolean;
  /** Yolcu talebi: car | motorcycle (socket / dispatch) */
  passenger_vehicle_kind?: 'car' | 'motorcycle';
  /** Yolcu ödeme: nakit | card (UI: kart yakında — iş mantığı değişmez) */
  passenger_payment_method?: 'cash' | 'card';
  /** Offer ingress channel for seen telemetry (P0, flag-gated). */
  ingressSource?: OfferSeenSource;
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
  onAcceptFlowStart?: (tagId: string) => void | Promise<void>;
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

// Yolcu Request Kartı Bileşeni — offer flow modeli
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
  isFreshOffer = false,
  firstSeenAtMs,
}: { 
  request: PassengerRequest; 
  driverLocation: { latitude: number; longitude: number } | null;
  driverId: string;
  playTapSound?: () => void;
  onDismiss: () => void;
  onDriverAcceptMatch?: (match: Record<string, unknown>) => void;
  onAcceptFlowStart?: (tagId: string) => void | Promise<void>;
  onAcceptFlowEnd?: (tagId: string) => void;
  onOfferUnavailable?: (info: { tagId: string; requestId?: string }) => void;
  index: number;
  globalAcceptFrozen: boolean;
  setGlobalAcceptFrozen: (v: boolean) => void;
  isFreshOffer?: boolean;
  /** Parent-owned anchor for countdown + sort alignment (5E-4A). */
  firstSeenAtMs?: number;
}) {
  const { offerScreenSurfaces: osLt, ui } = useDriverTheme();
  const [accepting, setAccepting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const urgencyGlowAnim = useRef(new Animated.Value(0)).current;
  const seenLayoutReportedRef = useRef(false);
  const firstSeenAtRef = useRef(firstSeenAtMs ?? Date.now());
  const countdownTotalSec = useMemo(
    () => resolveDriverOfferCountdownTotalSec(request),
    [request.dispatch_timeout],
  );
  const [countdownSec, setCountdownSec] = useState(() =>
    computeDriverOfferCountdownRemainingSec(firstSeenAtRef.current, countdownTotalSec),
  );
  const countdownTier: OfferCountdownTier = resolveOfferCountdownTier(countdownSec);
  const isExpiredCard = countdownTier === 'expired';
  const hasDispatchTimeoutHint =
    Number.isFinite(Number(request.dispatch_timeout)) && Number(request.dispatch_timeout) > 0;

  useEffect(() => {
    seenLayoutReportedRef.current = false;
    firstSeenAtRef.current = firstSeenAtMs ?? Date.now();
  }, [request.tag_id, request.id, firstSeenAtMs]);

  useEffect(() => {
    const tick = () => {
      setCountdownSec(
        computeDriverOfferCountdownRemainingSec(firstSeenAtRef.current, countdownTotalSec),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [countdownTotalSec, request.tag_id, request.id]);

  useEffect(() => {
    if (!isFreshOffer || isExpiredCard) {
      urgencyGlowAnim.setValue(0);
      return;
    }
    urgencyGlowAnim.setValue(0);
    const pulseOnce = Animated.sequence([
      Animated.timing(urgencyGlowAnim, {
        toValue: 1,
        duration: DRIVER_OFFER_URGENCY_PULSE_MS * 0.45,
        useNativeDriver: false,
      }),
      Animated.timing(urgencyGlowAnim, {
        toValue: 0.22,
        duration: DRIVER_OFFER_URGENCY_PULSE_MS * 0.55,
        useNativeDriver: false,
      }),
    ]);
    const loop = Animated.loop(pulseOnce, { iterations: DRIVER_OFFER_URGENCY_PULSE_CYCLES });
    loop.start();
    return () => {
      loop.stop();
      urgencyGlowAnim.setValue(0);
    };
  }, [isFreshOffer, isExpiredCard, request.tag_id, request.id, urgencyGlowAnim]);

  const reportSeenIfVisible = useCallback(() => {
    if (seenLayoutReportedRef.current) return;
    seenLayoutReportedRef.current = true;
    const tagId = String(request.tag_id || request.id || '').trim();
    if (!tagId) return;
    void reportDriverOfferSeen(
      driverId,
      tagId,
      normalizeOfferSeenSource(request.ingressSource),
    );
  }, [driverId, request.id, request.tag_id, request.ingressSource]);

  const handleOfferCardLayout = useCallback(() => {
    reportSeenIfVisible();
  }, [reportSeenIfVisible]);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      reportSeenIfVisible();
    }, 450);
    return () => clearTimeout(fallbackTimer);
  }, [reportSeenIfVisible]);

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

  const countdownPillStyle =
    countdownTier === 'critical'
      ? styles.reqCountdownPillCritical
      : countdownTier === 'warn'
        ? styles.reqCountdownPillWarn
        : countdownTier === 'expired'
          ? styles.reqCountdownPillExpired
          : styles.reqCountdownPillNormal;
  const countdownTextStyle =
    countdownTier === 'critical'
      ? styles.reqCountdownTextCritical
      : countdownTier === 'warn'
        ? styles.reqCountdownTextWarn
        : countdownTier === 'expired'
          ? styles.reqCountdownTextExpired
          : styles.reqCountdownTextNormal;
  const countdownIconColor =
    countdownTier === 'critical'
      ? '#FCA5A5'
      : countdownTier === 'warn'
        ? '#FCD34D'
        : countdownTier === 'expired'
          ? ui.iconMuted
          : ui.accent;
  const urgencyBorderColor = urgencyGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(34,211,238,0.16)', 'rgba(34,211,238,0.62)'],
  });
  const acceptGradientColors = isExpiredCard
    ? osLt
      ? (['#64748B', '#94A3B8'] as const)
      : (['#1E3A5F', '#334155', '#475569'] as const)
    : osLt
      ? (['#0891B2', '#06B6D4'] as const)
      : (['#0E7490', '#0891B2', '#22D3EE'] as const);

  return (
    <Animated.View
      style={[
        styles.reqCardWrap,
        isExpiredCard && styles.reqCardWrapExpired,
        isExpiredCard && osLt?.reqCardWrapExpired,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
      onLayout={handleOfferCardLayout}
    >
      <Animated.View
        style={[
          styles.reqCardUrgencyRing,
          isFreshOffer && !isExpiredCard
            ? { borderColor: urgencyBorderColor }
            : styles.reqCardUrgencyRingIdle,
          isExpiredCard && styles.reqCardUrgencyRingExpired,
        ]}
      >
      <GlassSurface
        variant="plain"
        borderRadius={LDS_RADIUS.lg}
        style={[styles.reqCard, isExpiredCard && styles.reqCardExpired, osLt?.reqCard, osLt?.reqCardExpired]}
      >
        <View style={styles.reqUrgencyRow}>
          <View style={[styles.reqCountdownPill, countdownPillStyle, osLt?.reqCountdownPill]}>
            <Ionicons name="timer-outline" size={12} color={countdownIconColor} />
            <PremiumText variant="caption" style={[styles.reqCountdownText, countdownTextStyle, osLt?.reqCountdownText]}>
              {countdownSec > 0 ? `${countdownSec} sn` : 'Süre doldu'}
            </PremiumText>
          </View>
          {isFreshOffer ? (
            <View style={[styles.reqNewBadge, osLt?.reqNewBadge]}>
              <View style={styles.reqNewBadgeDot} />
              <PremiumText variant="caption" style={[styles.reqNewBadgeText, osLt?.reqNewBadgeText]}>
                Yeni teklif
              </PremiumText>
            </View>
          ) : null}
        </View>
        {!hasDispatchTimeoutHint ? (
          <PremiumText variant="caption" muted style={styles.reqCountdownHint}>
            Tahmini yanıt süresi
          </PremiumText>
        ) : null}

        <View style={styles.reqHeaderRow}>
          <View style={styles.reqPriceBlock}>
            <PremiumText variant="caption" muted style={styles.reqRevenueLabel}>
              Teklif
            </PremiumText>
            <PremiumText variant="title" style={[styles.reqPriceText, osLt?.reqPriceText]}>
              {request.offered_price || 0} ₺
            </PremiumText>
          </View>
          <View style={styles.reqSecondLine}>
            <View style={styles.reqPassengerChip}>
              <Ionicons name="person-circle-outline" size={13} color={ui.iconMuted} />
              <PremiumText variant="caption" style={[styles.reqPassengerName, osLt?.reqPassengerName]} numberOfLines={1}>
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
            <PremiumText variant="caption" style={[styles.reqMetaValue, osLt?.reqMetaValue]}>
              {distanceToPassenger} km
            </PremiumText>
          </View>
          <View style={styles.reqMetaDivider} />
          <View style={styles.reqMetaCellCompact}>
            <PremiumText variant="caption" muted style={styles.reqMetaLabel}>
              Yolcuya
            </PremiumText>
            <PremiumText variant="caption" style={[styles.reqMetaValue, osLt?.reqMetaValue]}>
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
              <PremiumText variant="caption" style={[styles.reqMetaValue, osLt?.reqMetaValue]}>
                {routeDistanceText}
              </PremiumText>
            )}
          </View>
          <View style={styles.reqMetaDivider} />
          <View style={styles.reqMetaCellCompact}>
            <PremiumText variant="caption" muted style={styles.reqMetaLabel}>
              Süre
            </PremiumText>
            <PremiumText variant="caption" style={[styles.reqMetaValue, osLt?.reqMetaValue]}>
              {rideDurationText}
            </PremiumText>
          </View>
        </View>

        <View style={styles.reqRouteBlock}>
          <View style={styles.reqRouteLine}>
            <View style={[styles.reqDot, styles.reqDotPickup]} />
            <PremiumText variant="caption" style={[styles.reqRouteText, osLt?.reqRouteText]} numberOfLines={1}>
              {pickupLineFromRequest(request)}
            </PremiumText>
          </View>
          <View style={styles.reqRouteLine}>
            <View style={[styles.reqDot, styles.reqDotDropoff]} />
            <PremiumText variant="caption" style={[styles.reqRouteText, osLt?.reqRouteText]} numberOfLines={1}>
              {dropoffLineFromRequest(request)}
            </PremiumText>
          </View>
        </View>

        <View style={styles.reqActionsRow}>
          <TouchableOpacity
            style={[styles.reqDismissBtn, osLt?.reqDismissBtn]}
            onPress={onDismiss}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Geç"
          >
            <PremiumText variant="caption" muted style={[styles.reqDismissText, osLt?.reqDismissText]}>
              Geç
            </PremiumText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.reqAcceptBtnOuter,
              isExpiredCard && styles.reqAcceptBtnOuterExpired,
              isExpiredCard && osLt?.reqAcceptBtnOuterExpired,
              accepting && styles.acceptButtonDisabledOuter,
            ]}
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
              await Promise.resolve(onAcceptFlowStart?.(tagIdForAccept));
              try {
                playTapSound?.();
                void playUiTapSound();
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
                  void playFeedbackErrorSound();
                  appAlert(
                    'Eşleşme olmadı',
                    errMsg,
                    [{ text: 'Tamam', style: 'default' }],
                    { variant: 'warning' },
                  );
                }
              } catch (e) {
                console.error('[driver/accept-offer] fetch', e);
                void playFeedbackErrorSound();
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
              <LinearGradient
                colors={[...acceptGradientColors]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.reqAcceptGradient,
                  isExpiredCard && styles.reqAcceptGradientExpired,
                  osLt?.reqAcceptBtn,
                  isExpiredCard && osLt?.reqAcceptBtnExpired,
                  accepting && styles.acceptButtonDisabled,
                ]}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#F8FAFC" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={isExpiredCard ? 'rgba(248,250,252,0.78)' : '#F8FAFC'}
                    />
                    <PremiumText
                      variant="step"
                      style={[
                        styles.reqAcceptBtnText,
                        isExpiredCard && styles.reqAcceptBtnTextExpired,
                        osLt?.reqAcceptText,
                        isExpiredCard && osLt?.reqAcceptTextExpired,
                      ]}
                    >
                      Kabul et
                    </PremiumText>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
        </View>
      </GlassSurface>
      </Animated.View>
    </Animated.View>
  );
}

/** Şehir içi talep yoğunluğu — LHIS operasyon alanı diski (API `city_grid.intensity`) */
const CityHeatCellMarker = memo(function CityHeatCellMarker({
  cell,
  zoomBand,
}: {
  cell: DriverMapCityGridCell;
  zoomBand: FieldMapZoomBand;
}) {
  const visual = useMemo(
    () => resolveFieldHeatCellVisual(cell.intensity, zoomBand),
    [cell.intensity, zoomBand],
  );
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visual.animate) return;
    const dur = 2800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.1,
            duration: dur,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.88,
            duration: dur,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: dur,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: dur,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [visual.animate, pulseScale, pulseOpacity]);

  const diskBody = (
    <>
      <View
        style={[
          styles.cityHeatHalo,
          {
            width: visual.haloSize,
            height: visual.haloSize,
            borderRadius: visual.haloSize / 2,
            backgroundColor: visual.haloFillColor,
          },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.cityHeatDisk,
          {
            width: visual.coreSize,
            height: visual.coreSize,
            borderRadius: visual.coreSize / 2,
            backgroundColor: visual.fillColor,
            borderColor: visual.strokeColor,
            borderWidth: visual.strokeWidth,
          },
        ]}
        pointerEvents="none"
      />
    </>
  );

  return (
    <View
      style={[
        styles.cityHeatWrap,
        { width: visual.wrapSize, height: visual.wrapSize },
      ]}
      collapsable={false}
    >
      {visual.animate ? (
        <Animated.View
          style={[
            styles.cityHeatDiskStack,
            { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
          ]}
        >
          {diskBody}
        </Animated.View>
      ) : (
        <View style={styles.cityHeatDiskStack}>{diskBody}</View>
      )}
    </View>
  );
});

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
  const { offerScreenSurfaces: osLt, ui } = useDriverTheme();
  const isMotor = vehicleKind === 'motorcycle';
  const [globalAcceptFrozen, setGlobalAcceptFrozen] = useState(false);
  const [freshOfferTagId, setFreshOfferTagId] = useState<string | null>(null);
  const knownOfferTagIdsRef = useRef<Set<string>>(new Set());
  const freshOfferClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listHeaderPulse = useRef(new Animated.Value(1)).current;
  const offerFirstShownAtRef = useRef<Record<string, number>>({});
  const [offerSortTick, setOfferSortTick] = useState(0);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapSeekingPins, setMapSeekingPins] = useState<DriverMapSeekingPin[]>([]);
  const [mapLightPins, setMapLightPins] = useState<DriverMapLightPin[]>([]);
  const [mapCityGrid, setMapCityGrid] = useState<DriverMapCityGridCell[]>([]);
  const [mapDriverCity, setMapDriverCity] = useState('');
  const [mapHud, setMapHud] = useState({ seeking: 0, nearby: 0, radius: FIELD_DEFAULT_RADIUS_KM });
  const [mapExpanded, setMapExpanded] = useState(embedded);
  const mapFirstLayout = embedded;
  const [mapPinsLoadError, setMapPinsLoadError] = useState<string | null>(null);
  const [mapZoomBand, setMapZoomBand] = useState<FieldMapZoomBand>(embedded ? 'near' : 'mid');
  const driverPulseScale = useRef(new Animated.Value(1)).current;
  const driverPulseOpacity = useRef(new Animated.Value(0.55)).current;
  const driverPulse2Scale = useRef(new Animated.Value(1)).current;
  const driverPulse2Opacity = useRef(new Animated.Value(0.35)).current;
  const fieldTemporalBufferRef = useRef(createFieldTemporalBufferState());
  const fieldTemporalTrendRef = useRef<FieldTemporalTrendResult | null>(null);
  const fieldListedCountRef = useRef(0);

  useEffect(() => {
    const dur = 1800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.sequence([
            Animated.parallel([
              Animated.timing(driverPulseScale, {
                toValue: 2.2,
                duration: dur,
                useNativeDriver: true,
              }),
              Animated.timing(driverPulseOpacity, {
                toValue: 0,
                duration: dur,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(driverPulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(driverPulseOpacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
            ]),
          ]),
          Animated.sequence([
            Animated.delay(650),
            Animated.parallel([
              Animated.timing(driverPulse2Scale, {
                toValue: 2.05,
                duration: dur,
                useNativeDriver: true,
              }),
              Animated.timing(driverPulse2Opacity, {
                toValue: 0,
                duration: dur,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(driverPulse2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
              Animated.timing(driverPulse2Opacity, { toValue: 0.35, duration: 0, useNativeDriver: true }),
            ]),
          ]),
        ]),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [driverPulseScale, driverPulseOpacity, driverPulse2Scale, driverPulse2Opacity]);

  useEffect(() => {
    if (!mapExpanded) {
      setMapReady(false);
      setMapZoomBand('mid');
    }
  }, [mapExpanded]);

  const handleFieldMapRegionChangeComplete = useCallback(
    (region: { latitudeDelta?: number }) => {
      const next = resolveFieldMapZoomBand(region?.latitudeDelta, mapFirstLayout);
      setMapZoomBand((prev) => (prev === next ? prev : next));
    },
    [mapFirstLayout],
  );

  /** Collapsed: yalnızca mini HUD bar; MapView yalnızca expanded iken mount */
  const showMapHost = mapExpanded;

  /** Genişletilmiş harita yüksekliği — legacy non-embedded; embedded map-first flex ile dolar */
  const mapExpandedHeight = mapFirstLayout ? undefined : Math.min(SCREEN_HEIGHT * 0.42, 360);

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

  const sortedVisibleRequests = useMemo(() => {
    const now = Date.now();
    const active = new Set<string>();
    for (const req of visibleRequests) {
      const key = String(req.tag_id || req.id || '').trim();
      if (!key) continue;
      active.add(key);
      if (offerFirstShownAtRef.current[key] == null) {
        offerFirstShownAtRef.current[key] = now;
      }
    }
    for (const key of Object.keys(offerFirstShownAtRef.current)) {
      if (!active.has(key)) {
        delete offerFirstShownAtRef.current[key];
      }
    }
    if (visibleRequests.length <= 1) return visibleRequests;
    return [...visibleRequests].sort((a, b) =>
      compareDriverOffersByUrgency(a, b, offerFirstShownAtRef.current, now),
    );
  }, [visibleRequests, offerSortTick]);

  useEffect(() => {
    if (visibleRequests.length === 0) return;
    const id = setInterval(() => {
      setOfferSortTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [visibleRequests.length]);

  const listedTagIds = useMemo(() => {
    const s = new Set<string>();
    visibleRequests.forEach((r) => {
      const id = r.id || r.tag_id || r.request_id;
      if (id) s.add(String(id));
    });
    return s;
  }, [visibleRequests]);

  useEffect(() => {
    if (visibleRequests.length === 0) {
      knownOfferTagIdsRef.current.clear();
      setFreshOfferTagId(null);
      if (freshOfferClearTimerRef.current != null) {
        clearTimeout(freshOfferClearTimerRef.current);
        freshOfferClearTimerRef.current = null;
      }
      return;
    }
    let newTag: string | null = null;
    for (const req of visibleRequests) {
      const tid = String(req.tag_id || req.id || '').trim();
      if (!tid || knownOfferTagIdsRef.current.has(tid)) continue;
      knownOfferTagIdsRef.current.add(tid);
      newTag = tid;
      break;
    }
    if (!newTag) return;
    setFreshOfferTagId(newTag);
    if (freshOfferClearTimerRef.current != null) {
      clearTimeout(freshOfferClearTimerRef.current);
    }
    freshOfferClearTimerRef.current = setTimeout(() => {
      setFreshOfferTagId((cur) => (cur === newTag ? null : cur));
      freshOfferClearTimerRef.current = null;
    }, DRIVER_OFFER_NEW_EMPHASIS_MS);
    Animated.sequence([
      Animated.timing(listHeaderPulse, {
        toValue: 1.1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(listHeaderPulse, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visibleRequests, listHeaderPulse]);

  fieldListedCountRef.current = visibleRequests.length;

  const fieldIntelMetrics = useMemo(() => {
    const scanLabel = `${resolveFieldRadiusKm(mapHud.radius)} km`;
    const nearRequestsLabel = mapExpanded ? String(mapHud.seeking) : String(visibleRequests.length);
    const activityScore = mapExpanded ? mapHud.seeking + mapHud.nearby : visibleRequests.length;
    const fieldStatus = resolveFieldActivityBand(activityScore);
    const nearSignalLabel = mapExpanded
      ? (() => {
          const count = mapHud.nearby;
          const minKm = resolveMinLightDistanceKm(mapLightPins);
          if (count <= 0 && minKm == null) return 'Sinyal yok';
          if (minKm != null) return `${count} · ${minKm.toFixed(1)} km`;
          return `${count} sinyal`;
        })()
      : 'Saha haritasını aç';
    const denseRegionLabel = mapExpanded
      ? resolveFieldDenseRegionLabel(mapCityGrid, driverLocation)
      : 'Saha haritasını aç';
    const spatialInsights = resolveFieldSpatialInsights({
      mapExpanded,
      driverLocation,
      grid: mapCityGrid,
      seekingPins: mapSeekingPins,
      lightPins: mapLightPins,
      seeking: mapExpanded ? mapHud.seeking : visibleRequests.length,
      nearby: mapExpanded ? mapHud.nearby : 0,
      listedCount: visibleRequests.length,
    });
    return {
      nearRequestsLabel,
      scanLabel,
      fieldStatus,
      nearSignalLabel,
      denseRegionLabel,
      spatialInsightLine: spatialInsights.insightLine,
      operationScore: spatialInsights.operationScore,
      operationScoreBand: spatialInsights.operationScoreBand,
      areaOccupancy: spatialInsights.areaOccupancy,
      nearSignalLevel: spatialInsights.nearSignalLevel,
      dominantSector: spatialInsights.dominantSector,
      nearestDenseRegionKm: spatialInsights.nearestDenseRegionKm,
    };
  }, [
    mapExpanded,
    mapHud.seeking,
    mapHud.nearby,
    mapHud.radius,
    mapLightPins,
    mapSeekingPins,
    mapCityGrid,
    driverLocation,
    visibleRequests.length,
  ]);

  // Saha haritası pinleri — yalnızca expanded iken poll (collapsed: dispatch listesi canlı kalır)
  useEffect(() => {
    if (!mapExpanded || !driverId || !driverLocation) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const q = new URLSearchParams({
          user_id: String(driverId),
          latitude: String(driverLocation.latitude),
          longitude: String(driverLocation.longitude),
          radius_km: String(FIELD_DEFAULT_RADIUS_KM),
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
          radius: resolveFieldRadiusKm(j.radius_km),
        });
        if (driverLocation) {
          appendFieldTemporalSnapshot(
            fieldTemporalBufferRef.current,
            buildFieldTemporalSnapshot({
              driverLocation,
              grid: Array.isArray(j.city_grid) ? j.city_grid : [],
              seekingPins: Array.isArray(j.seeking) ? j.seeking : [],
              lightPins: Array.isArray(j.nearby_app_users) ? j.nearby_app_users : [],
              seeking: Number(j.seeking_count) || 0,
              nearby: Number(j.nearby_light_count) || 0,
              listedCount: fieldListedCountRef.current,
              radiusKm: resolveFieldRadiusKm(j.radius_km),
            }),
            driverLocation,
          );
          fieldTemporalTrendRef.current = resolveFieldTemporalTrend(
            fieldTemporalBufferRef.current.snapshots,
          );
        }
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
  }, [mapExpanded, driverId, driverLocation?.latitude, driverLocation?.longitude]);

  useEffect(() => {
    if (!driverId || !driverLocation) {
      setMapSeekingPins([]);
      setMapLightPins([]);
      setMapCityGrid([]);
      setMapDriverCity('');
      setMapPinsLoadError(null);
      resetFieldTemporalBuffer(fieldTemporalBufferRef.current);
      fieldTemporalTrendRef.current = null;
    }
  }, [driverId, driverLocation?.latitude, driverLocation?.longitude]);

  // Harita sınırları: sürücü + yalnızca tarama yarıçapı içindeki pinler (şehir grid zoom’u şişirmez)
  useEffect(() => {
    if (!mapExpanded || !mapReady || !mapRef.current || !driverLocation) return;

    const rk = resolveFieldRadiusKm(mapHud.radius);
    const fitKm = resolveFieldFitCapKm(rk, mapFirstLayout);
    const edgePadding = resolveFieldMapEdgePadding(mapFirstLayout);

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
      const { latitudeDelta, longitudeDelta } = resolveFieldSinglePointDeltas(
        driverLocation,
        rk,
        mapFirstLayout,
      );
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta,
          longitudeDelta,
        },
        400
      );
      return;
    }

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding,
        animated: true,
      });
    }, 350);
  }, [mapExpanded, mapReady, driverLocation, mapSeekingPins, mapLightPins, mapHud.radius, mapFirstLayout]);

  const listedTagIdKey = useMemo(() => {
    const ids: string[] = [];
    listedTagIds.forEach((id) => ids.push(id));
    ids.sort();
    return ids.join('|');
  }, [listedTagIds]);

  const mapHeatMarkerElements = useMemo(() => {
    const cells = selectFieldHeatCellsForZoom(mapCityGrid, mapZoomBand);
    return cells.map((cell, idx) => (
      <Marker
        key={`heat-${idx}-${cell.center_lat}-${cell.center_lng}`}
        coordinate={{ latitude: cell.center_lat, longitude: cell.center_lng }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
      >
        <CityHeatCellMarker cell={cell} zoomBand={mapZoomBand} />
      </Marker>
    ));
  }, [mapCityGrid, mapZoomBand]);

  const mapSeekingMarkerElements = useMemo(() => {
    const pins = selectFieldSeekingPinsForZoom(mapSeekingPins, listedTagIds, mapZoomBand);
    return pins.map((pin) => {
      const listed = listedTagIds.has(String(pin.tag_id));
      return (
        <Marker
          key={`seek-${pin.tag_id}`}
          coordinate={{ latitude: pin.pickup_lat, longitude: pin.pickup_lng }}
          title={listed ? 'Aktif Talep' : 'Yakın Talep'}
          description={listed ? 'Dispatch listesinde' : 'Aktif yolcu talebi'}
          tracksViewChanges={false}
        >
          {listed ? (
            <View style={styles.passengerMarkerSeekingActive}>
              <Ionicons name="navigate" size={16} color="#FFF" />
            </View>
          ) : (
            <View style={styles.passengerMarkerSeekingNear}>
              <View style={styles.passengerMarkerSeekingNearRing} pointerEvents="none" />
              <Ionicons name="navigate" size={13} color="#EA580C" />
            </View>
          )}
        </Marker>
      );
    });
  }, [mapSeekingPins, listedTagIdKey, listedTagIds, mapZoomBand]);

  const mapLightMarkerElements = useMemo(() => {
    const pins = selectFieldLightPinsForZoom(mapLightPins, mapZoomBand);
    return pins.map((pin) => (
      <Marker
        key={`light-${pin.user_id}`}
        coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
        title="Konum Paylaşan Yolcu"
        description="Yakın çevre sinyali"
        tracksViewChanges={false}
      >
        <View style={styles.passengerMarkerLightSignal} collapsable={false} />
      </Marker>
    ));
  }, [mapLightPins, mapZoomBand]);

  const driverMapMarkerElement = useMemo(() => {
    if (!driverLocation) return null;
    return (
      <Marker
        coordinate={driverLocation}
        title="Siz"
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges
      >
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
              <MaterialCommunityIcons name="motorbike" size={22} color="#FFF" />
            ) : (
              <Ionicons name="car" size={22} color="#FFF" />
            )}
          </View>
        </View>
      </Marker>
    );
  }, [
    driverLocation?.latitude,
    driverLocation?.longitude,
    isMotor,
    driverPulseScale,
    driverPulseOpacity,
    driverPulse2Scale,
    driverPulse2Opacity,
  ]);

  // Web fallback veya harita yoksa
  const renderMap = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={[styles.mapFallback, osLt?.mapFallback]}>
          <Ionicons name="map" size={40} color={ui.mapFallback} />
          <PremiumText variant="caption" muted style={styles.mapFallbackText}>
            Talep {mapHud.seeking} · {resolveFieldRadiusKm(mapHud.radius)} km
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
                latitudeDelta: resolveFieldInitialMapDelta(mapFirstLayout),
                longitudeDelta: resolveFieldInitialMapDelta(mapFirstLayout),
              }
            : {
                latitude: 39.92,
                longitude: 32.85,
                latitudeDelta: resolveFieldFallbackMapDelta(mapFirstLayout),
                longitudeDelta: resolveFieldFallbackMapDelta(mapFirstLayout),
              }
        }
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleFieldMapRegionChangeComplete}
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
              radius={resolveFieldRadiusKm(mapHud.radius) * 1000}
              strokeColor="rgba(34,211,238,0.45)"
              fillColor="rgba(34,211,238,0.06)"
              strokeWidth={2}
            />
            <Circle
              center={driverLocation}
              radius={resolveFieldRadiusKm(mapHud.radius) * 500}
              strokeColor="rgba(34,211,238,0.22)"
              fillColor="rgba(34,211,238,0.04)"
              strokeWidth={1}
            />
          </>
        ) : null}

        {mapHeatMarkerElements}

        {driverMapMarkerElement}

        {mapSeekingMarkerElements}

        {mapLightMarkerElements}
      </MapView>
    );
  };

  const driverMapRatingText =
    Number.isFinite(Number(driverRating)) && Number(driverRating) > 0
      ? Number(driverRating).toFixed(1)
      : null;

  const body = (
    <View style={[styles.driverOfferBody, mapFirstLayout && styles.driverOfferBodyMapFirst]}>
      {/* Liste — legacy: üstte flex:1; embedded map-first: altta peek panel */}
      <View style={[styles.listContainer, mapFirstLayout && styles.listContainerMapFirst]}>
        {!mapFirstLayout ? (
          <>
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
          </>
        ) : null}
        <GlassSurface
          variant="panel"
          style={[
            styles.dispatchDeck,
            mapExpanded && !mapFirstLayout && styles.dispatchDeckMapExpanded,
            mapFirstLayout && styles.dispatchDeckMapFirstPeek,
            osLt?.dispatchDeck,
          ]}
          borderRadius={LDS_RADIUS.xl}
        >
          <View style={[styles.listHeader, mapExpanded && styles.listHeaderMapExpanded, osLt?.listHeader]}>
            <View style={styles.listHeaderCompactRow}>
              <View style={styles.listHeaderLiveDotWrap} pointerEvents="none">
                <View style={styles.listHeaderAccentDotOuter} />
                <View style={styles.listHeaderAccentDot} />
              </View>
              <PremiumText variant="step" style={[styles.listTitleCompact, osLt?.listTitleCompact]} numberOfLines={1}>
                Yakın talepler · {resolveFieldRadiusKm(mapHud.radius)} km
              </PremiumText>
              {visibleRequests.length > 0 ? (
                <Animated.View
                  style={[
                    styles.listHeaderCountPill,
                    osLt?.listHeaderCountPill,
                    freshOfferTagId ? styles.listHeaderCountPillFresh : null,
                    { transform: [{ scale: listHeaderPulse }] },
                  ]}
                >
                  <PremiumText variant="caption" style={[styles.listHeaderCountText, osLt?.listHeaderCountText]}>
                    {visibleRequests.length}
                  </PremiumText>
                </Animated.View>
              ) : null}
            </View>
          </View>

        {visibleRequests.length === 0 ? (
          <View style={[
            styles.emptyState,
            mapExpanded && !mapFirstLayout && styles.emptyStateMapExpanded,
            mapFirstLayout && styles.emptyStateMapFirstPeek,
          ]}>
            <GlassSurface
              variant="plain"
              style={[
                styles.emptyStateCard,
                mapExpanded && !mapFirstLayout && styles.emptyStateCardMapExpanded,
                mapFirstLayout && styles.emptyStateCardMapFirstPeek,
                osLt?.emptyStateCard,
              ]}
              borderRadius={LDS_RADIUS.lg}
            >
              {!mapFirstLayout ? (
                <View style={[styles.emptyBrandStrip, osLt?.emptyBrandStrip]}>
                  <View style={styles.emptyBrandDotWrap} pointerEvents="none">
                    <View style={styles.emptyBrandDotOuter} />
                    <View style={styles.emptyBrandDot} />
                  </View>
                  <PremiumText variant="caption" style={[styles.emptyBrandLabel, osLt?.emptyBrandLabel]}>
                    Leylek Yolculuk · Saha operasyonu
                  </PremiumText>
                </View>
              ) : null}

              {!mapFirstLayout ? (
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
                      osLt?.emptyOrbRingOuter,
                    ]}
                  />
                  <View
                    style={[
                      styles.emptyOrbRing,
                      styles.emptyOrbRingMid,
                      mapExpanded && styles.emptyOrbRingMidMapExpanded,
                      isMotor && styles.emptyOrbRingMidMotor,
                      osLt?.emptyOrbRingMid,
                    ]}
                  />
                  <View style={[styles.emptyOrbCore, mapExpanded && styles.emptyOrbCoreMapExpanded, osLt?.emptyOrbCore]}>
                    <Ionicons
                      name="radio-outline"
                      size={mapExpanded ? 16 : 18}
                      color={isMotor ? ui.motorAccent : ui.accent}
                    />
                  </View>
                </View>
              ) : null}

              <View
                style={[
                  styles.emptyStatusPill,
                  mapExpanded && !mapFirstLayout && styles.emptyStatusPillMapExpanded,
                  isMotor && styles.emptyStatusPillMotor,
                  osLt?.emptyStatusPill,
                ]}
              >
                <View style={styles.emptyStatusLiveDot} />
                <PremiumText variant="step" style={[styles.emptyStatusText, osLt?.emptyStatusText]}>
                  Saha taraması aktif
                </PremiumText>
              </View>

              <PremiumText
                variant="title"
                style={[
                  styles.emptyTitle,
                  mapExpanded && !mapFirstLayout && styles.emptyTitleMapExpanded,
                  mapFirstLayout && styles.emptyTitleMapFirstPeek,
                  osLt?.emptyTitle,
                ]}
              >
                Teklif bekleniyor
              </PremiumText>
              <PremiumText
                variant="caption"
                muted
                style={[
                  styles.emptySubtitle,
                  mapExpanded && !mapFirstLayout && styles.emptySubtitleMapExpanded,
                  mapFirstLayout && styles.emptySubtitleMapFirstPeek,
                  osLt?.emptySubtitle,
                ]}
              >
                {resolveFieldRadiusKm(mapHud.radius)} km saha çevresinde tarama sürüyor.
              </PremiumText>

              {!mapFirstLayout ? (
                <View style={styles.emptyChipRow}>
                  <View style={[styles.emptyChip, osLt?.emptyChip]}>
                    <Ionicons name="pulse-outline" size={11} color={ui.emptyChip} />
                    <PremiumText variant="caption" style={[styles.emptyChipText, osLt?.emptyChipText]}>
                      Canlı tarama
                    </PremiumText>
                  </View>
                  <View style={[styles.emptyChip, osLt?.emptyChip]}>
                    <Ionicons name="shield-checkmark-outline" size={11} color={ui.emptyChip} />
                    <PremiumText variant="caption" style={[styles.emptyChipText, osLt?.emptyChipText]}>
                      Leylek Yolculuk saha
                    </PremiumText>
                  </View>
                </View>
              ) : null}
            </GlassSurface>
          </View>
        ) : (
          <FlatList
            data={sortedVisibleRequests.slice(0, 20)}
            extraData={offerSortTick}
            keyExtractor={(item, index) => item.id || item.request_id || index.toString()}
            renderItem={({ item, index }) => {
              const tagKey = String(item.tag_id || item.id || '').trim();
              return (
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
                isFreshOffer={!!tagKey && freshOfferTagId === tagKey}
                firstSeenAtMs={
                  tagKey ? offerFirstShownAtRef.current[tagKey] : undefined
                }
              />
            );}}
            contentContainerStyle={[
              styles.listContent,
              mapExpanded && !mapFirstLayout && styles.listContentMapExpanded,
              mapFirstLayout && styles.listContentMapFirstPeek,
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}
        </GlassSurface>
      </View>

      <View
        style={[
          styles.mapCardShell,
          mapExpanded && !mapFirstLayout && styles.mapCardShellExpandedLayer,
          mapFirstLayout && styles.mapCardShellMapFirst,
        ]}
      >
        {!mapFirstLayout ? (
          <GlassSurface
            variant={mapExpanded ? 'plain' : 'panel'}
            borderRadius={mapExpanded ? LDS_RADIUS.lg : LDS_RADIUS.xl}
            style={[
              styles.mapChromeShell,
              mapExpanded ? styles.mapChromeShellExpanded : styles.mapChromeShellCollapsed,
              mapExpanded ? osLt?.mapChromeShell : osLt?.mapChromeShellCollapsed,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.fieldOpHud,
                mapExpanded ? styles.fieldOpHudExpanded : styles.fieldOpHudCollapsed,
                !mapExpanded && osLt?.fieldOpHudCollapsed,
              ]}
              onPress={() => setMapExpanded((v) => !v)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={mapExpanded ? 'Saha haritasını gizle' : 'Saha haritasını göster'}
            >
              <View style={styles.fieldOpHudTopRow}>
                <View style={styles.fieldOpHudBrandCol}>
                  <PremiumText variant="caption" style={[styles.fieldOpHudBrand, osLt?.fieldOpHudBrand]}>
                    LEYLEK YOLCULUK
                  </PremiumText>
                  {mapExpanded ? (
                    <>
                      <PremiumText variant="step" style={[styles.fieldOpHudTitle, osLt?.fieldOpHudTitle]} numberOfLines={1}>
                        Saha Operasyon Merkezi
                      </PremiumText>
                      <PremiumText variant="caption" muted style={[styles.fieldOpHudCaption, osLt?.fieldOpHudCaption]} numberOfLines={1}>
                        Field Intelligence
                      </PremiumText>
                    </>
                  ) : (
                    <PremiumText variant="caption" muted style={[styles.fieldOpHudCaption, osLt?.fieldOpHudCaption]} numberOfLines={1}>
                      Saha Operasyon Merkezi · Field Intelligence
                    </PremiumText>
                  )}
                </View>
                <View style={styles.mapMiniHudChevronWrap}>
                  <Ionicons
                    name={mapExpanded ? 'chevron-down' : 'chevron-up'}
                    size={mapExpanded ? 15 : 16}
                    color={ui.accent}
                  />
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.fieldOpHudMetricsScroll}
                contentContainerStyle={styles.fieldOpHudMetricsContent}
              >
                <View style={[styles.fieldOpMetricCell, osLt?.fieldOpMetricCell]}>
                  <PremiumText variant="caption" muted style={[styles.fieldOpMetricLabel, osLt?.fieldOpMetricLabel]} numberOfLines={1}>
                    Yakın Talepler
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.fieldOpMetricValue, osLt?.fieldOpMetricValue]} numberOfLines={1}>
                    {fieldIntelMetrics.nearRequestsLabel}
                  </PremiumText>
                </View>
                <View style={[styles.fieldOpMetricCell, osLt?.fieldOpMetricCell]}>
                  <PremiumText variant="caption" muted style={[styles.fieldOpMetricLabel, osLt?.fieldOpMetricLabel]} numberOfLines={1}>
                    Tarama Alanı
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.fieldOpMetricValue, osLt?.fieldOpMetricValue]} numberOfLines={1}>
                    {fieldIntelMetrics.scanLabel}
                  </PremiumText>
                </View>
                <View style={[styles.fieldOpMetricCell, osLt?.fieldOpMetricCell]}>
                  <PremiumText variant="caption" muted style={[styles.fieldOpMetricLabel, osLt?.fieldOpMetricLabel]} numberOfLines={1}>
                    Saha Durumu
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.fieldOpMetricValue, osLt?.fieldOpMetricValue]} numberOfLines={1}>
                    {fieldIntelMetrics.fieldStatus}
                  </PremiumText>
                </View>
                <View style={[styles.fieldOpMetricCell, osLt?.fieldOpMetricCell]}>
                  <PremiumText variant="caption" muted style={[styles.fieldOpMetricLabel, osLt?.fieldOpMetricLabel]} numberOfLines={1}>
                    Yakın Sinyal
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.fieldOpMetricValue, osLt?.fieldOpMetricValue]} numberOfLines={1}>
                    {fieldIntelMetrics.nearSignalLabel}
                  </PremiumText>
                </View>
                <View style={[styles.fieldOpMetricCell, osLt?.fieldOpMetricCell]}>
                  <PremiumText variant="caption" muted style={[styles.fieldOpMetricLabel, osLt?.fieldOpMetricLabel]} numberOfLines={1}>
                    Yoğun Bölge
                  </PremiumText>
                  <PremiumText variant="caption" style={[styles.fieldOpMetricValue, osLt?.fieldOpMetricValue]} numberOfLines={1}>
                    {fieldIntelMetrics.denseRegionLabel}
                  </PremiumText>
                </View>
              </ScrollView>
              <PremiumText
                variant="caption"
                muted
                style={[styles.fieldOpInsightLine, osLt?.fieldOpInsightLine]}
                numberOfLines={1}
              >
                {resolveFieldOpportunityInsightLine({
                  mapExpanded,
                  spatialInsightLine: fieldIntelMetrics.spatialInsightLine,
                  operationScore: fieldIntelMetrics.operationScore,
                  trend: fieldTemporalTrendRef.current,
                  listedCount: fieldListedCountRef.current,
                })}
              </PremiumText>
            </TouchableOpacity>
          </GlassSurface>
        ) : null}

        {showMapHost ? (
          <View
            style={[
              styles.mapExpandedMapHost,
              mapFirstLayout && styles.mapExpandedMapHostMapFirst,
              !mapFirstLayout && mapExpandedHeight != null ? { height: mapExpandedHeight } : null,
            ]}
            pointerEvents="box-none"
          >
            <View style={[
              styles.mapViewportFixed,
              mapExpanded && styles.mapContainerSolidExpanded,
              mapFirstLayout && styles.mapViewportMapFirst,
            ]}>
              {renderMap()}
              {!mapFirstLayout ? <View style={styles.mapDimOverlay} pointerEvents="none" /> : null}
              {!driverLocation || !mapReady ? (
                <View style={styles.mapLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="small" color={ui.activity} />
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
              {!mapFirstLayout ? (
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
              ) : null}
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
    <SafeAreaView style={[styles.container, osLt?.container]} edges={['top']}>
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
  /** Legacy: dispatch üstte; embedded map-first: column-reverse ile harita üstte */
  driverOfferBody: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    flexDirection: 'column',
    backgroundColor: 'transparent',
  },
  driverOfferBodyMapFirst: {
    position: 'relative',
    flexDirection: 'column-reverse',
  },
  listContainerMapFirst: {
    flex: 0,
    flexGrow: 0,
    height: EMBEDDED_LIST_PEEK_HEIGHT,
    maxHeight: EMBEDDED_LIST_PEEK_HEIGHT,
    zIndex: 10,
    elevation: 10,
  },
  dispatchDeckMapFirstPeek: {
    marginHorizontal: LDS_SPACING.xs,
    marginBottom: LDS_SPACING.xxs,
    marginTop: 0,
  },
  listContentMapFirstPeek: {
    paddingTop: LDS_SPACING.xxs,
    paddingBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
  },
  emptyStateMapFirstPeek: {
    paddingVertical: LDS_SPACING.xs,
    justifyContent: 'flex-start',
  },
  emptyStateCardMapFirstPeek: {
    paddingTop: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
  },
  emptyTitleMapFirstPeek: {
    fontSize: 16,
    lineHeight: 20,
  },
  emptySubtitleMapFirstPeek: {
    fontSize: 11,
    lineHeight: 15,
  },
  mapCardShellMapFirst: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
    zIndex: 0,
    elevation: 0,
    paddingHorizontal: LDS_SPACING.xs,
    paddingBottom: LDS_SPACING.xxs,
  },
  mapExpandedMapHostMapFirst: {
    flex: 1,
    minHeight: 0,
    zIndex: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  mapViewportMapFirst: {
    borderRadius: LDS_RADIUS.md,
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
  fieldOpHud: {
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  fieldOpHudCollapsed: {
    maxHeight: 60,
    paddingVertical: 3,
    paddingHorizontal: LDS_SPACING.sm,
    gap: 2,
  },
  fieldOpHudExpanded: {
    maxHeight: 68,
    paddingVertical: 4,
    paddingHorizontal: LDS_SPACING.sm,
    gap: 3,
  },
  fieldOpHudTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: LDS_SPACING.xs,
  },
  fieldOpHudBrandCol: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  fieldOpHudBrand: {
    fontSize: 9,
    letterSpacing: 0.14,
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
    opacity: 0.88,
  },
  fieldOpHudTitle: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.02,
    color: PREMIUM_TEXT_SOFT,
  },
  fieldOpHudCaption: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.04,
  },
  fieldOpHudMetricsScroll: {
    flexGrow: 0,
  },
  fieldOpHudMetricsContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: LDS_SPACING.xxs,
    paddingRight: LDS_SPACING.xxs,
  },
  fieldOpMetricCell: {
    minWidth: 72,
    maxWidth: 108,
    paddingVertical: 2,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.sm,
    backgroundColor: 'rgba(8,17,31,0.52)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    gap: 1,
  },
  fieldOpMetricLabel: {
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.03,
    fontWeight: '600',
  },
  fieldOpMetricValue: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: PREMIUM_TEXT_SOFT,
  },
  fieldOpInsightLine: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.02,
    color: PREMIUM_TEXT_MUTED,
    opacity: 0.92,
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
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
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
    padding: 6,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: 'rgba(243,248,255,0.92)',
    ...Platform.select({
      ios: {
        shadowColor: PREMIUM_NAVY_DEEP,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.32,
        shadowRadius: 5,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  cityHeatWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityHeatDiskStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityHeatHalo: {
    position: 'absolute',
  },
  cityHeatDisk: {
    position: 'absolute',
  },
  passengerMarker: {
    backgroundColor: COLORS.secondary,
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(243, 248, 255, 0.85)',
  },
  passengerMarkerSeekingActive: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(110, 231, 183, 0.62)',
    shadowColor: '#064e3b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.38,
    shadowRadius: 4,
    elevation: 5,
  },
  passengerMarkerSeekingNear: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(8, 17, 31, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#EA580C',
  },
  passengerMarkerSeekingNearRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(234, 88, 12, 0.48)',
    backgroundColor: 'transparent',
  },
  passengerMarkerLightSignal: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: 'rgba(34, 211, 238, 0.68)',
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
  listHeaderCountPillFresh: {
    backgroundColor: 'rgba(34,211,238,0.22)',
    borderColor: 'rgba(34,211,238,0.48)',
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
  reqCardWrapExpired: {
    opacity: 0.58,
  },
  reqCardUrgencyRingExpired: {
    borderColor: 'rgba(100,116,139,0.18)',
  },
  reqCardExpired: {
    backgroundColor: 'rgba(8,17,31,0.22)',
  },
  reqCardUrgencyRing: {
    borderRadius: LDS_RADIUS.lg + 2,
    borderWidth: LDS_BORDER_WIDTH.standard,
    padding: 1,
  },
  reqCardUrgencyRingIdle: {
    borderColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  reqUrgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: LDS_SPACING.xs,
    marginBottom: LDS_SPACING.xxs,
  },
  reqCountdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.full,
    borderWidth: LDS_BORDER_WIDTH.hairline,
  },
  reqCountdownPillNormal: {
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderColor: 'rgba(34,211,238,0.28)',
  },
  reqCountdownPillWarn: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderColor: 'rgba(251,191,36,0.38)',
  },
  reqCountdownPillCritical: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(248,113,113,0.42)',
  },
  reqCountdownPillExpired: {
    backgroundColor: 'rgba(100,116,139,0.12)',
    borderColor: 'rgba(148,163,184,0.28)',
  },
  reqCountdownText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.04,
    fontSize: 11,
  },
  reqCountdownTextNormal: {
    color: PREMIUM_AUTH_CYAN,
  },
  reqCountdownTextWarn: {
    color: '#FCD34D',
  },
  reqCountdownTextCritical: {
    color: '#FCA5A5',
  },
  reqCountdownTextExpired: {
    color: PREMIUM_TEXT_MUTED,
  },
  reqCountdownHint: {
    marginTop: -2,
    marginBottom: LDS_SPACING.xxs,
    fontSize: 9,
    letterSpacing: 0.06,
    opacity: 0.72,
  },
  reqNewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(34,211,238,0.14)',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: 'rgba(34,211,238,0.32)',
  },
  reqNewBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22D3EE',
  },
  reqNewBadgeText: {
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
    fontSize: 10,
    letterSpacing: 0.08,
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
    flex: 0.68,
    minHeight: 40,
    backgroundColor: 'transparent',
    borderRadius: LDS_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: LDS_BORDER_WIDTH.hairline,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  reqDismissText: {
    fontWeight: '500',
    letterSpacing: 0.08,
    opacity: 0.58,
    fontSize: 12,
  },
  reqAcceptBtnOuter: {
    flex: 3.2,
    minHeight: 52,
    borderRadius: LDS_RADIUS.md,
    overflow: 'hidden',
    ...LDS_ELEVATION.chip,
  },
  reqAcceptBtnOuterExpired: {
    opacity: 0.82,
  },
  reqAcceptGradient: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.sm,
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(34,211,238,0.45)',
    borderTopColor: 'rgba(34,211,238,0.62)',
  },
  reqAcceptGradientExpired: {
    borderColor: 'rgba(100,116,139,0.32)',
    borderTopColor: 'rgba(148,163,184,0.28)',
  },
  acceptButtonDisabledOuter: {
    opacity: 0.72,
  },
  acceptButtonDisabled: {
    backgroundColor: 'rgba(30, 50, 72, 0.85)',
    borderColor: 'rgba(30, 58, 95, 0.5)',
    borderTopColor: 'rgba(30, 58, 95, 0.5)',
  },
  reqAcceptBtnText: {
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.22,
    fontSize: 15,
  },
  reqAcceptBtnTextExpired: {
    color: 'rgba(248,250,252,0.78)',
    fontWeight: '700',
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
