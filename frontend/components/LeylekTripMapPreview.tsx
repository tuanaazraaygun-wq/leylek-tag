import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_TR_MAP_FALLBACK_CENTER } from '../lib/mapDefaults';

type Coord = { latitude: number; longitude: number };

type LeylekTripMapPreviewProps = {
  pickup?: Coord | null;
  dropoff?: Coord | null;
  passengerLocation?: Coord | null;
  driverLocation?: Coord | null;
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
  style,
}: LeylekTripMapPreviewProps) {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const coords = useMemo(
    () => [pickup, dropoff, passengerLocation, driverLocation].filter(isCoord),
    [pickup, dropoff, passengerLocation, driverLocation],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current || coords.length < 2) return;
    const t = setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 48, bottom: 80, left: 48 },
          animated: true,
        });
      } catch {
        /* map readiness can be racy on Android */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [coords, mapReady]);

  const center = coords[0] || DEFAULT_TR_MAP_FALLBACK_CENTER;

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
        {isCoord(passengerLocation) && isCoord(driverLocation) ? (
          <Polyline
            coordinates={[passengerLocation, driverLocation]}
            strokeColor="#047857"
            strokeWidth={8}
            lineJoin="round"
            lineCap="round"
          />
        ) : null}
        {isCoord(pickup) && isCoord(dropoff) ? (
          <Polyline
            coordinates={[pickup, dropoff]}
            strokeColor="#EA580C"
            strokeWidth={8}
            lineDashPattern={[12, 6]}
            lineJoin="round"
            lineCap="round"
          />
        ) : null}
      </MapView>
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
});
