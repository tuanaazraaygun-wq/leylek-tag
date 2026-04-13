/**
 * SearchingMapView - Teklif Arama Fazında Harita
 * 
 * SEARCHING phase'de kullanılır:
 * - Yolcu konumu (mavi)
 * - Hedef konum (kırmızı)
 * - Teklif veren TÜM sürücüler (yeşil araç ikonları)
 * - driver_location_update ile canlı güncellenir
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callCheck } from '../lib/callCheck';
import { displayFirstName } from '../lib/displayName';
import { getDriverMarkerImage, getPassengerMarkerImage, MARKER_PIXEL } from '../lib/mapNavMarkers';

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
  /** index.tsx’ten — PassengerWaitingScreen / LiveMapView ile aynı yolcu PNG mantığı */
  selfGender?: 'female' | 'male' | null;
  selfUserId?: string | null;
}

export default function SearchingMapView({
  userLocation,
  destinationLocation,
  driverLocations,
  height = SCREEN_HEIGHT * 0.35,
  nearbyDriverCount = 0,
  selfGender = null,
  selfUserId = null,
}: SearchingMapViewProps) {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searchingMapTracks, setSearchingMapTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSearchingMapTracks(false), 2200);
    return () => clearTimeout(t);
  }, []);
  
  // 🎭 Hayali sürücüler - Gerçek sürücü yoksa göster
  const [fakeDrivers, setFakeDrivers] = useState<DriverLocation[]>([]);
  
  useEffect(() => {
    // Gerçek sürücü yoksa hayali sürücüler oluştur
    if (driverLocations.length === 0 && userLocation) {
      const names = ['Mehmet', 'Ali', 'Ahmet', 'Mustafa', 'Emre'];
      const fakes: DriverLocation[] = [];
      
      for (let i = 0; i < 5; i++) {
        // Kullanıcının etrafında rastgele konumlar (2-8 km arası)
        const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
        const distance = 0.02 + Math.random() * 0.05; // ~2-8 km
        
        fakes.push({
          driver_id: `fake_${i}`,
          driver_name: names[i],
          latitude: userLocation.latitude + Math.sin(angle) * distance,
          longitude: userLocation.longitude + Math.cos(angle) * distance,
          vehicle_model: ['Toyota Corolla', 'Honda Civic', 'Hyundai i20', 'Fiat Egea', 'Renault Clio'][i],
        });
      }
      
      setFakeDrivers(fakes);
    } else {
      setFakeDrivers([]);
    }
  }, [driverLocations.length, userLocation]);
  
  // Gösterilecek sürücüler (gerçek veya hayali)
  const displayDrivers = driverLocations.length > 0 ? driverLocations : fakeDrivers;
  const displayDriverCount = nearbyDriverCount > 0 ? nearbyDriverCount : Math.floor(Math.random() * 3) + 5; // 5-7 arası

  // Harita sınırlarını hesapla ve fit et
  useEffect(() => {
    if (!mapReady || !mapRef.current || !userLocation) return;

    const coordinates: { latitude: number; longitude: number }[] = [userLocation];
    
    if (destinationLocation) {
      coordinates.push(destinationLocation);
    }
    
    displayDrivers.forEach(driver => {
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
  }, [mapReady, userLocation, destinationLocation, displayDrivers.length]);

  // Web fallback
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.webFallback}>
          <Ionicons name="map" size={40} color="#3FA9F5" />
          <Text style={styles.webFallbackText}>Harita - {driverLocations.length} sürücü</Text>
          {driverLocations.map((driver, i) => (
            <Text key={driver.driver_id} style={styles.driverItem}>
              🚗 {displayFirstName(driver.driver_name, 'Sürücü')} {driver.price ? `- ₺${driver.price}` : ''}
            </Text>
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
    <View style={[styles.container, { height }]}>
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
              <Image
                source={getPassengerMarkerImage(selfGender ?? null, selfUserId)}
                style={{
                  width: MARKER_PIXEL.passenger,
                  height: MARKER_PIXEL.passenger,
                }}
                resizeMode="contain"
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
            <View style={styles.flagMarker}>
              <View style={styles.flagPole} />
              <View style={styles.flagBody}>
                <Ionicons name="flag" size={16} color="#FFF" />
              </View>
              <View style={styles.flagBase} />
            </View>
          </Marker>
        )}

        {/* Sürücüler - Profesyonel Araç Görünümü */}
        {displayDrivers.map((driver, index) => {
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
                <Image source={src} style={{ width: px, height: px }} resizeMode="contain" />
              </MarkerPinWrap>
              {driver.price ? (
                <View style={styles.carPriceTag} pointerEvents="none">
                  <Text style={styles.carPriceText}>₺{driver.price}</Text>
                </View>
              ) : null}
            </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Sürücü Sayısı Badge */}
      <View style={styles.driverCountBadge}>
        <Ionicons name="car" size={16} color="#FFF" />
        <Text style={styles.driverCountText}>
          {displayDriverCount} sürücü yakında
        </Text>
      </View>
      
      {/* Bilgi Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🔄 Teklifiniz değerlendiriliyor...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
  },
  webFallbackText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '600',
  },
  driverItem: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
  },
  // Yolcu marker
  userMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  // Hedef marker
  destinationMarker: {
    alignItems: 'center',
  },
  // Sürücü marker
  driverMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  priceTag: {
    position: 'absolute',
    top: -20,
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priceText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  
  // 🆕 Profesyonel Yolcu Pin Marker
  passengerMarker: {
    alignItems: 'center',
  },
  passengerPin: {
    alignItems: 'center',
  },
  passengerPinHead: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  passengerPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#3B82F6',
    marginTop: -2,
  },
  markerShadow: {
    width: 24,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    marginTop: 4,
  },
  
  // 🆕 Bayrak Stili Hedef Marker
  flagMarker: {
    alignItems: 'flex-start',
  },
  flagPole: {
    width: 3,
    height: 45,
    backgroundColor: '#1F2937',
    borderRadius: 2,
  },
  flagBody: {
    position: 'absolute',
    top: 0,
    left: 3,
    width: 36,
    height: 24,
    backgroundColor: '#EF4444',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  flagBase: {
    width: 12,
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginLeft: -4,
  },
  
  // 🆕 Profesyonel Araç Marker
  carMarker: {
    alignItems: 'center',
  },
  carBody: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  carPriceTag: {
    position: 'absolute',
    top: -22,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  carPriceText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  // Sürücü sayısı badge
  driverCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  driverCountText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  infoBanner: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoBannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
