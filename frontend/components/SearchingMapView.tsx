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
}

interface SearchingMapViewProps {
  userLocation: { latitude: number; longitude: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null;
  driverLocations: DriverLocation[];
  height?: number;
}

export default function SearchingMapView({
  userLocation,
  destinationLocation,
  driverLocations,
  height = SCREEN_HEIGHT * 0.35,
}: SearchingMapViewProps) {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Harita sınırlarını hesapla ve fit et
  useEffect(() => {
    if (!mapReady || !mapRef.current || !userLocation) return;

    const coordinates: { latitude: number; longitude: number }[] = [userLocation];
    
    if (destinationLocation) {
      coordinates.push(destinationLocation);
    }
    
    driverLocations.forEach(driver => {
      coordinates.push({ latitude: driver.latitude, longitude: driver.longitude });
    });

    if (coordinates.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 300);
    }
  }, [mapReady, userLocation, destinationLocation, driverLocations.length]);

  // Web fallback
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.webFallback}>
          <Ionicons name="map" size={40} color="#3FA9F5" />
          <Text style={styles.webFallbackText}>Harita - {driverLocations.length} sürücü</Text>
          {driverLocations.map((driver, i) => (
            <Text key={driver.driver_id} style={styles.driverItem}>
              🚗 {driver.driver_name} {driver.price ? `- ₺${driver.price}` : ''}
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
      >
        {/* Yolcu Konumu - Mavi */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Konumunuz"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner}>
                <Ionicons name="person" size={16} color="#FFF" />
              </View>
              <View style={styles.userMarkerPulse} />
            </View>
          </Marker>
        )}

        {/* Hedef Konum - Kırmızı */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="Hedef"
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="location" size={32} color="#EF4444" />
            </View>
          </Marker>
        )}

        {/* Teklif Veren Sürücüler - Yeşil Araç İkonları */}
        {driverLocations.map((driver) => (
          <Marker
            key={driver.driver_id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            title={driver.driver_name}
            description={driver.price ? `₺${driver.price}` : undefined}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={24} color="#FFF" />
              {driver.price && (
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>₺{driver.price}</Text>
                </View>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Sürücü Sayısı Badge */}
      <View style={styles.driverCountBadge}>
        <Ionicons name="car" size={16} color="#FFF" />
        <Text style={styles.driverCountText}>{driverLocations.length} sürücü</Text>
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
});
