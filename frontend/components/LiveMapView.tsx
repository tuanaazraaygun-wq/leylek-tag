import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    console.log('✅ react-native-maps yüklendi');
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

interface LiveMapViewProps {
  userLocation: { latitude: number; longitude: number } | null;
  otherLocation: { latitude: number; longitude: number } | null;
  isDriver: boolean;
  userName?: string;
  otherUserName?: string;
  destinationLocation?: { latitude: number; longitude: number; address?: string } | null;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAKqhXyi2cUC3GHLxjom4R_tQ3UfR5auUw';

export default function LiveMapView({
  userLocation,
  otherLocation,
  isDriver,
  userName = 'Sen',
  otherUserName = 'Karşı Taraf',
  destinationLocation,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);

  // Haversine formülü ile mesafe hesapla
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Rota ve mesafe hesapla
  useEffect(() => {
    if (userLocation && otherLocation) {
      const dist = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        otherLocation.latitude, otherLocation.longitude
      );
      setDistance(dist);
      setDuration(Math.round((dist / 40) * 60)); // 40 km/h ortalama
      
      // Basit rota (düz çizgi)
      setRouteCoordinates([userLocation, otherLocation]);
    }
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude]);

  // Haritayı konumlara fit et
  useEffect(() => {
    if (mapRef.current && userLocation && otherLocation) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([userLocation, otherLocation], {
          edgePadding: { top: 80, right: 50, bottom: 80, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, otherLocation]);

  // Web placeholder
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webPlaceholder}>
        <Ionicons name="map" size={60} color="#00A67E" />
        <Text style={styles.webText}>Harita (Mobil Uygulamada)</Text>
      </View>
    );
  }

  const initialRegion = userLocation ? {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : {
    latitude: 39.9334,
    longitude: 32.8597,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        mapType="standard"
      >
        {/* Şoför Marker - Araba */}
        {isDriver && userLocation && (
          <Marker
            coordinate={userLocation}
            title={userName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.carMarker}>
              <Text style={styles.carEmoji}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Yolcu Marker - İnsan */}
        {!isDriver && userLocation && (
          <Marker
            coordinate={userLocation}
            title={userName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.personMarker}>
              <Text style={styles.personEmoji}>🧍</Text>
            </View>
          </Marker>
        )}

        {/* Karşı Taraf - Şoför ise Araba, Yolcu ise İnsan */}
        {otherLocation && (
          <Marker
            coordinate={otherLocation}
            title={otherUserName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={isDriver ? styles.personMarker : styles.carMarker}>
              <Text style={isDriver ? styles.personEmoji : styles.carEmoji}>
                {isDriver ? '🧍' : '🚗'}
              </Text>
            </View>
          </Marker>
        )}

        {/* Rota Çizgisi */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#00A67E"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Üst Bilgi Bandı - Sadece Mesafe ve Süre */}
      <View style={styles.topBanner}>
        <View style={styles.bannerItem}>
          <Ionicons name="navigate" size={20} color="#00A67E" />
          <Text style={styles.bannerValue}>
            {distance ? `${distance.toFixed(1)} km` : '--'}
          </Text>
        </View>
        <View style={styles.bannerDivider} />
        <View style={styles.bannerItem}>
          <Ionicons name="time" size={20} color="#FF6B35" />
          <Text style={styles.bannerValue}>
            {duration ? `${duration} dk sonra buluşacaksınız` : 'Hesaplanıyor...'}
          </Text>
        </View>
      </View>

      {/* Canlı Takip İndikatörü */}
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Canlı</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  webText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  // Marker Styles
  carMarker: {
    width: 50,
    height: 50,
    backgroundColor: '#E74C3C',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  carEmoji: {
    fontSize: 28,
  },
  personMarker: {
    width: 50,
    height: 50,
    backgroundColor: '#3498DB',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  personEmoji: {
    fontSize: 28,
  },
  // Top Banner
  topBanner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bannerDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  // Live Indicator
  liveIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '600',
  },
});
