import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_TR_MAP_FALLBACK_CENTER } from '../lib/mapDefaults';

type Coord = { latitude: number; longitude: number };

type LeylekTripMapPreviewProps = {
  pickup?: Coord | null;
  dropoff?: Coord | null;
  passengerLocation?: Coord | null;
  driverLocation?: Coord | null;
  deviceLocation?: Coord | null;
  routePolyline?: string | null;
  sessionStatus?: string | null;
  style?: StyleProp<ViewStyle>;
};

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
  } catch {
    MapView = null;
  }
}

function isCoord(v?: Coord | null): v is Coord {
  return !!v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude);
}

function decodePolyline(encoded?: string | null): Coord[] {
  if (!encoded || typeof encoded !== 'string') return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Coord[] = [];
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coordinates.filter(isCoord);
}

/** İki uç varsa düz segment (backend polyline yokken önizleme). */
function computeFallbackSegment(
  tripStarted: boolean,
  pickup: Coord | null | undefined,
  dropoff: Coord | null | undefined,
  driverLocation: Coord | null | undefined,
  passengerLocation: Coord | null | undefined,
): Coord[] {
  if (tripStarted) {
    if (isCoord(driverLocation) && isCoord(dropoff)) return [driverLocation, dropoff];
    if (isCoord(passengerLocation) && isCoord(dropoff)) return [passengerLocation, dropoff];
    if (isCoord(pickup) && isCoord(dropoff)) return [pickup, dropoff];
    return [];
  }
  if (isCoord(driverLocation)) {
    const toPass = isCoord(passengerLocation) ? passengerLocation : null;
    const toPickup = isCoord(pickup) ? pickup : null;
    const legEnd = toPass || toPickup;
    if (legEnd) return [driverLocation, legEnd];
  }
  if (isCoord(pickup) && isCoord(dropoff)) return [pickup, dropoff];
  if (isCoord(driverLocation) && isCoord(passengerLocation)) return [driverLocation, passengerLocation];
  return [];
}

function MarkerBubble({ label, color, icon }: { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.markerBubble, { borderColor: color }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.markerText, { color }]}>{label}</Text>
    </View>
  );
}

export default function LeylekTripMapPreview({
  pickup,
  dropoff,
  passengerLocation,
  driverLocation,
  deviceLocation,
  routePolyline,
  sessionStatus,
  style,
}: LeylekTripMapPreviewProps) {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [routeBannerPhase, setRouteBannerPhase] = useState<'idle' | 'waiting' | 'stale'>('idle');
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routeCoordinates = useMemo(() => decodePolyline(routePolyline), [routePolyline]);
  const st = String(sessionStatus || '').trim().toLowerCase();
  const tripStarted = st === 'started' || st === 'finished' || st === 'active';

  const backendPolyReady = routeCoordinates.length >= 2;
  const fallbackSegment = useMemo(
    () => computeFallbackSegment(tripStarted, pickup, dropoff, driverLocation, passengerLocation),
    [tripStarted, pickup, dropoff, driverLocation, passengerLocation],
  );
  const hasFallbackLine = fallbackSegment.length >= 2;

  const effectivePolylineCoords = backendPolyReady ? routeCoordinates : hasFallbackLine ? fallbackSegment : [];

  const wantsRoadPolyline =
    !backendPolyReady &&
    !hasFallbackLine &&
    (isCoord(pickup) || isCoord(dropoff) || (isCoord(driverLocation) && (isCoord(passengerLocation) || isCoord(pickup))));

  useEffect(() => {
    console.log('[leylek_route]', {
      pickup,
      dropoff,
      driverLoc: driverLocation,
      passengerLoc: passengerLocation,
      sessionStatus: st || sessionStatus,
      polylineLength: routeCoordinates.length,
      fallbackLen: fallbackSegment.length,
    });
  }, [
    driverLocation,
    dropoff,
    fallbackSegment.length,
    passengerLocation,
    pickup,
    routeCoordinates.length,
    sessionStatus,
    st,
  ]);

  useEffect(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    if (backendPolyReady || hasFallbackLine || !wantsRoadPolyline) {
      setRouteBannerPhase('idle');
      return;
    }
    setRouteBannerPhase('waiting');
    bannerTimerRef.current = setTimeout(() => {
      setRouteBannerPhase('stale');
      bannerTimerRef.current = null;
    }, 5000);
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [backendPolyReady, hasFallbackLine, wantsRoadPolyline, routePolyline, sessionStatus]);

  const approachTarget = passengerLocation || pickup;
  const approachCoordinates = useMemo(
    () => (isCoord(driverLocation) && isCoord(approachTarget) ? [driverLocation, approachTarget] : []),
    [approachTarget, driverLocation],
  );

  const fitCoords = useMemo(() => {
    const livePair = [driverLocation, passengerLocation].filter(isCoord);
    if (livePair.length >= 2) return livePair;
    if (effectivePolylineCoords.length >= 2) return effectivePolylineCoords;
    if (!tripStarted && approachCoordinates.length >= 2) return approachCoordinates;
    return [driverLocation, passengerLocation, pickup, dropoff, deviceLocation].filter(isCoord);
  }, [
    approachCoordinates,
    deviceLocation,
    driverLocation,
    dropoff,
    effectivePolylineCoords,
    passengerLocation,
    pickup,
    tripStarted,
  ]);

  const center = useMemo(
    () =>
      [driverLocation, passengerLocation, pickup, dropoff, deviceLocation].filter(isCoord)[0] ||
      DEFAULT_TR_MAP_FALLBACK_CENTER,
    [deviceLocation, driverLocation, dropoff, passengerLocation, pickup],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current || fitCoords.length < 1) return;
    const t = setTimeout(() => {
      try {
        const { height: H } = Dimensions.get('window');
        const bottomPad = Math.round(H * 0.36);
        if (fitCoords.length >= 2) {
          mapRef.current?.fitToCoordinates(fitCoords, {
            edgePadding: { top: Math.round(H * 0.22), right: 48, bottom: bottomPad, left: 48 },
            animated: true,
          });
        } else {
          mapRef.current?.animateToRegion(
            {
              latitude: fitCoords[0].latitude,
              longitude: fitCoords[0].longitude,
              latitudeDelta: 0.045,
              longitudeDelta: 0.045,
            },
            450,
          );
        }
      } catch {
        /* map readiness can be racy on Android */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [fitCoords, mapReady]);

  const polylineStroke = tripStarted ? '#EA580C' : '#047857';

  const showRouteBanner =
    wantsRoadPolyline && routeBannerPhase !== 'idle' && !backendPolyReady && !hasFallbackLine;

  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={[styles.map, style, styles.fallback]}>
        <Ionicons name="map-outline" size={36} color="#3B82F6" />
        <Text style={styles.fallbackTitle}>Muhabbet yolculuk haritası</Text>
        <Text style={styles.fallbackSub}>Konum ve rota önizlemesi cihazda gösterilir.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.map, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={() => setMapReady(true)}
      >
        {isCoord(pickup) ? (
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1 }}>
            <MarkerBubble label="Alış" color="#2563EB" icon="location" />
          </Marker>
        ) : null}
        {isCoord(dropoff) ? (
          <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 1 }}>
            <MarkerBubble label="Varış" color="#16A34A" icon="flag" />
          </Marker>
        ) : null}
        {isCoord(driverLocation) ? (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 1 }}>
            <MarkerBubble label="Sürücü" color="#0EA5E9" icon="car-sport" />
          </Marker>
        ) : null}
        {isCoord(passengerLocation) ? (
          <Marker coordinate={passengerLocation} anchor={{ x: 0.5, y: 1 }}>
            <MarkerBubble label="Yolcu" color="#F97316" icon="person" />
          </Marker>
        ) : null}
        {effectivePolylineCoords.length >= 2 ? (
          <Polyline
            coordinates={effectivePolylineCoords}
            strokeColor={backendPolyReady ? polylineStroke : '#94A3B8'}
            strokeWidth={backendPolyReady ? 8 : 5}
            lineDashPattern={backendPolyReady ? undefined : [10, 6]}
            lineJoin="round"
            lineCap="round"
          />
        ) : null}
      </MapView>
      {showRouteBanner ? (
        <View style={[styles.fallbackBadge, routeBannerPhase === 'stale' && styles.fallbackBadgeStale]} pointerEvents="none">
          <Ionicons name="time-outline" size={13} color={routeBannerPhase === 'stale' ? '#92400E' : '#92400E'} />
          <Text style={styles.fallbackBadgeText}>
            {routeBannerPhase === 'stale'
              ? 'Rota alınamadı, konumlar güncelleniyor…'
              : 'Rota hesaplanıyor'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#DBEAFE',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  fallbackSub: {
    marginTop: 5,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  markerBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  markerText: {
    fontSize: 11,
    fontWeight: '800',
  },
  fallbackBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(254, 243, 199, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.25)',
    maxWidth: Dimensions.get('window').width - 28,
  },
  fallbackBadgeStale: {
    backgroundColor: 'rgba(254, 243, 199, 0.92)',
  },
  fallbackBadgeText: {
    flexShrink: 1,
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
});
