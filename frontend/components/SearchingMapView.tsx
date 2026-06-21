/**
 * SearchingMapView - Teklif Arama Fazında Harita
 * 
 * SEARCHING phase'de kullanılır:
 * - Yolcu konumu (mavi)
 * - Hedef konum (kırmızı)
 * - Teklif veren sürücüler (gerçek konumlar; sahte pin yok)
 * - driver_location_update ile canlı güncellenir
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callCheck } from '../lib/callCheck';
import { displayFirstName } from '../lib/displayName';
import { getDriverMarkerImage, getPassengerMarkerImage, MARKER_PIXEL } from '../lib/mapNavMarkers';
import { MapDestinationFlagPin, MapEntityMarkerImage } from '../lib/mapMarkerChrome';
import { GlassSurface, PremiumText } from '../design-system/primitives';
import { PREMIUM_AUTH_CYAN } from './auth/premiumAuthStyles';
import { usePassengerTheme } from '../lib/theme/usePassengerTheme';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING } from '../design-system/tokens/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// react-native-maps'i sadece native platformlarda yükle
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
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

export interface DriverLocation {
  driver_id: string;
  driver_name: string;
  latitude: number;
  longitude: number;
  vehicle_model?: string;
  price?: number;
  /** Teklif / socket — LiveMapView / bekleme ekranı ile aynı araç–motor PNG seçimi */
  vehicle_kind?: 'car' | 'motorcycle';
}

/** Android: Marker içi Image ilk karede çizilsin */
function MarkerPinWrap({ children }: { children: React.ReactNode }) {
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </View>
  );
}

interface SearchingMapViewProps {
  userLocation: { latitude: number; longitude: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  driverLocations: DriverLocation[];
  height?: number;
  nearbyDriverCount?: number; // 20 km içindeki toplam sürücü sayısı
  selfUserId?: string | null;
}

export default function SearchingMapView({
  userLocation,
  destinationLocation,
  driverLocations,
  height = SCREEN_HEIGHT * 0.35,
  nearbyDriverCount = 0,
  selfUserId = null,
}: SearchingMapViewProps) {
  const { searchingSurfaces: lt, ui } = usePassengerTheme();
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searchingMapTracks, setSearchingMapTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSearchingMapTracks(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const offerDriverCount = driverLocations.length;

  // Harita sınırlarını hesapla ve fit et
  useEffect(() => {
    if (!mapReady || !mapRef.current || !userLocation) return;

    const coordinates: { latitude: number; longitude: number }[] = [userLocation];
    
    if (destinationLocation) {
      coordinates.push(destinationLocation);
    }
    
    driverLocations.forEach((driver) => {
      coordinates.push({ latitude: driver.latitude, longitude: driver.longitude });
    });

    if (coordinates.length > 1) {
      setTimeout(() => {
        const map = mapRef.current;
        callCheck('mapRef.current.fitToCoordinates', map?.fitToCoordinates);
        const fit = map && typeof map.fitToCoordinates === 'function' ? map.fitToCoordinates.bind(map) : null;
        console.log('[PAX_DEBUG] SearchingMapView fit', { hasMap: !!map, fitToCoordinates: typeof map?.fitToCoordinates });
        if (fit) {
          try {
            fit(coordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          } catch (e) {
            if (__DEV__) console.warn('[SearchingMapView] fitToCoordinates', e);
          }
        }
      }, 300);
    }
  }, [mapReady, userLocation, destinationLocation, driverLocations.length]);

  // Web fallback
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={[styles.container, { height }, lt?.container]}>
        <View style={[styles.webFallback, lt?.webFallback]}>
          <Ionicons name="map" size={40} color={ui.accent} />
          <PremiumText variant="body" muted style={styles.webFallbackText}>
            {driverLocations.length > 0
              ? `${driverLocations.length} sürücü teklifi`
              : 'Eşleşme aranıyor'}
          </PremiumText>
          {driverLocations.map((driver) => (
            <PremiumText key={driver.driver_id} variant="caption" style={styles.driverItem}>
              {displayFirstName(driver.driver_name, 'Sürücü')}
              {driver.price ? ` · ₺${driver.price}` : ''}
            </PremiumText>
          ))}
        </View>
      </View>
    );
  }

  const initialRegion = userLocation ? {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <View style={[styles.container, { height }, lt?.container]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={() => setMapReady(true)}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        minZoomLevel={10}
        maxZoomLevel={18}
        mapType="standard"
      >
        {/* Yolcu Konumu - Profesyonel 3D Pin */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Konumunuz"
            anchor={{ x: 0.5, y: 1 }}
            flat={false}
            tracksViewChanges={searchingMapTracks}
            zIndex={5000}
          >
            <MarkerPinWrap>
              <MapEntityMarkerImage
                source={getPassengerMarkerImage()}
                size={MARKER_PIXEL.passenger}
              />
            </MarkerPinWrap>
          </Marker>
        )}

        {/* Hedef Konum - Bayrak Stili */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="Hedef"
            anchor={{ x: 0.15, y: 0.95 }}
          >
            <MapDestinationFlagPin />
          </Marker>
        )}

        {/* Teklif veren sürücüler — yalnızca gerçek konumlar */}
        {driverLocations.map((driver, index) => {
          const isM = driver.vehicle_kind === 'motorcycle';
          const src = getDriverMarkerImage(isM ? 'motorcycle' : 'car');
          const px = isM ? MARKER_PIXEL.driverMotor : MARKER_PIXEL.driverCar;
          return (
            <Marker
              key={driver.driver_id}
              coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
              title={displayFirstName(driver.driver_name, 'Sürücü')}
              description={driver.vehicle_model || (driver.price ? `₺${driver.price}` : undefined)}
              anchor={{ x: 0.5, y: 1 }}
              flat={false}
              tracksViewChanges={searchingMapTracks}
              zIndex={4000 + (index % 40)}
            >
              <View style={{ alignItems: 'center' }} collapsable={false}>
              <MarkerPinWrap>
                <MapEntityMarkerImage source={src} size={px} />
              </MarkerPinWrap>
              {driver.price ? (
                <GlassSurface
                  variant="plain"
                  borderRadius={LDS_RADIUS.sm}
                  style={[styles.carPriceTag, lt?.carPriceTag]}
                >
                  <PremiumText variant="caption" style={[styles.carPriceText, lt?.carPriceText]}>
                    ₺{driver.price}
                  </PremiumText>
                </GlassSurface>
              ) : null}
            </View>
            </Marker>
          );
        })}
      </MapView>

      {offerDriverCount > 0 ? (
        <GlassSurface variant="plain" borderRadius={LDS_RADIUS.full} style={[styles.driverCountBadge, lt?.driverCountBadge]}>
          <Ionicons name="car" size={16} color={ui.accent} />
          <PremiumText variant="caption" style={styles.driverCountText}>
            {offerDriverCount} teklif
          </PremiumText>
        </GlassSurface>
      ) : null}

      <GlassSurface variant="plain" borderRadius={LDS_RADIUS.md} style={[styles.infoBanner, lt?.infoBanner]}>
        <PremiumText variant="body" style={styles.infoBannerText}>
          {offerDriverCount > 0 ? 'Sürücü teklifleri hazır' : 'Eşleşme aranıyor'}
        </PremiumText>
        <PremiumText variant="caption" muted style={styles.infoBannerSubtext}>
          {offerDriverCount > 0
            ? 'Haritada görüntüleniyor'
            : 'Uygun sürücüler değerlendiriliyor'}
        </PremiumText>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(6,14,26,0.72)',
  },
  map: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(6,14,26,0.72)',
    padding: LDS_SPACING.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
  },
  webFallbackText: {
    marginTop: LDS_SPACING.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  driverItem: {
    marginTop: LDS_SPACING.xxs,
    textAlign: 'center',
  },
  carPriceTag: {
    position: 'absolute',
    top: -22,
    paddingHorizontal: LDS_SPACING.xs,
    paddingVertical: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5, 11, 24, 0.72)',
    ...LDS_ELEVATION.chip,
  },
  carPriceText: {
    color: PREMIUM_AUTH_CYAN,
    fontWeight: '700',
  },
  driverCountBadge: {
    position: 'absolute',
    top: LDS_SPACING.sm,
    right: LDS_SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    gap: LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.72)',
    ...LDS_ELEVATION.chip,
  },
  driverCountText: {
    fontWeight: '700',
  },
  infoBanner: {
    position: 'absolute',
    bottom: LDS_SPACING.sm,
    left: LDS_SPACING.sm,
    right: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 11, 24, 0.72)',
    ...LDS_ELEVATION.chip,
  },
  infoBannerText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBannerSubtext: {
    marginTop: LDS_SPACING.xxs,
    textAlign: 'center',
  },
});
