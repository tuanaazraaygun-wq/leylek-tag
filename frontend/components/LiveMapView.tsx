import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, Image, TouchableOpacity, Linking, Alert } from 'react-native';
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

const GOOGLE_MAPS_API_KEY = 'AIzaSyAKqhXyi2cUC3GHLxjom4R_tQ3UfR5auUw';

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
  const [isConnected, setIsConnected] = useState(false);

  // Polyline decode fonksiyonu
  const decodePolyline = (encoded: string): {latitude: number, longitude: number}[] => {
    const points: {latitude: number, longitude: number}[] = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return points;
  };

  // Google Directions API ile EN KISA YOL rotası al
  const fetchRoute = async () => {
    if (!userLocation || !otherLocation) return;

    try {
      const origin = `${userLocation.latitude},${userLocation.longitude}`;
      const destination = `${otherLocation.latitude},${otherLocation.longitude}`;
      
      console.log('🗺️ Rota hesaplanıyor:', origin, '->', destination);
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=tr&alternatives=false`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Mesafe ve süre (en kısa yol)
        const distKm = leg.distance.value / 1000;
        const durMin = Math.round(leg.duration.value / 60);
        
        setDistance(distKm);
        setDuration(durMin);
        setIsConnected(true);
        
        console.log('✅ Rota bulundu:', distKm.toFixed(1), 'km,', durMin, 'dakika');
        
        // Polyline decode - yeşil çizgi için
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
      } else {
        console.log('⚠️ Rota bulunamadı, düz çizgi kullanılıyor');
        // Fallback: Düz çizgi mesafe
        const dist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        setDistance(dist);
        setDuration(Math.round((dist / 40) * 60));
        setRouteCoordinates([userLocation, otherLocation]);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Rota hatası:', error);
      // Fallback
      if (userLocation && otherLocation) {
        const dist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        setDistance(dist);
        setDuration(Math.round((dist / 40) * 60));
        setRouteCoordinates([userLocation, otherLocation]);
        setIsConnected(true);
      }
    }
  };

  // Haversine formülü
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

  // Konum değiştiğinde rota güncelle
  useEffect(() => {
    console.log('🗺️ LiveMapView - userLocation:', userLocation);
    console.log('🗺️ LiveMapView - otherLocation:', otherLocation);
    console.log('🗺️ LiveMapView - isDriver:', isDriver);
    
    if (userLocation && otherLocation) {
      console.log('🗺️ İki konum da var, rota hesaplanıyor...');
      fetchRoute();
    } else {
      console.log('⚠️ Konum eksik - userLocation:', !!userLocation, 'otherLocation:', !!otherLocation);
    }
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude]);

  // Haritayı konumlara fit et
  useEffect(() => {
    if (mapRef.current && userLocation && otherLocation) {
      setTimeout(() => {
        const coordinates = [userLocation, otherLocation];
        if (destinationLocation) {
          coordinates.push(destinationLocation);
        }
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, otherLocation, destinationLocation]);

  // Web placeholder
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webPlaceholder}>
        <Ionicons name="map" size={60} color="#22C55E" />
        <Text style={styles.webText}>Harita (Mobil Uygulamada)</Text>
        {distance && (
          <View style={styles.webInfo}>
            <Text style={styles.webInfoText}>📍 {distance.toFixed(1)} km</Text>
            <Text style={styles.webInfoText}>⏱️ {duration} dk</Text>
          </View>
        )}
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
        {/* YEŞİL ROTA ÇİZGİSİ - EN KISA YOL */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#22C55E"
            strokeWidth={5}
            lineDashPattern={[0]}
          />
        )}

        {/* KULLANICI - Ben */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title={`${userName} (Sen)`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.markerContainer,
              isDriver ? styles.driverMarker : styles.passengerMarker,
              isConnected && styles.connectedMarker
            ]}>
              <Text style={styles.markerEmoji}>
                {isDriver ? '🚗' : '🧍'}
              </Text>
            </View>
          </Marker>
        )}

        {/* KARŞI TARAF */}
        {otherLocation && (
          <Marker
            coordinate={otherLocation}
            title={otherUserName}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.markerContainer,
              !isDriver ? styles.driverMarker : styles.passengerMarker,
              isConnected && styles.connectedMarker
            ]}>
              <Text style={styles.markerEmoji}>
                {!isDriver ? '🚗' : '🧍'}
              </Text>
            </View>
          </Marker>
        )}

        {/* HEDEF NOKTASI */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="Hedef"
            description={destinationLocation.address}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={24} color="#FFF" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ÜST BİLGİ BANDI - YEŞİL TEMA */}
      <View style={[styles.topBanner, isConnected && styles.topBannerConnected]}>
        {/* Bağlantı Durumu */}
        <View style={styles.connectionStatus}>
          <View style={[styles.connectionDot, isConnected && styles.connectionDotActive]} />
          <Text style={[styles.connectionText, isConnected && styles.connectionTextActive]}>
            {isConnected ? 'Bağlantı Aktif' : 'Bağlanıyor...'}
          </Text>
        </View>

        {/* Mesafe ve Süre */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="navigate" size={22} color="#22C55E" />
            <Text style={styles.infoValue}>
              {distance ? `${distance.toFixed(1)} km` : '--'}
            </Text>
          </View>
          
          <View style={styles.infoDivider} />
          
          <View style={styles.infoItem}>
            <Ionicons name="time" size={22} color="#22C55E" />
            <Text style={styles.infoValue}>
              {duration ? `${duration} dk` : '--'}
            </Text>
          </View>
        </View>

        {/* Buluşma Mesajı */}
        {duration && (
          <Text style={styles.meetingText}>
            🤝 {duration} dakika sonra buluşacaksınız!
          </Text>
        )}
      </View>

      {/* LEGEND - Sol Alt */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Şoför 🚗</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.legendText}>Yolcu 🧍</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.legendText}>Rota</Text>
        </View>
      </View>

      {/* CANLI GÖSTERGE - Sağ Alt */}
      <View style={styles.liveIndicator}>
        <View style={styles.livePulse} />
        <Text style={styles.liveText}>CANLI</Text>
      </View>

      {/* GOOGLE MAPS NAVİGASYON BUTONU - Herkes için */}
      {otherLocation && (
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => openGoogleMapsNavigation(otherLocation)}
        >
          <Ionicons name="navigate-circle" size={28} color="#FFF" />
          <Text style={styles.navigationButtonText}>
            {isDriver ? 'Yolcuya Git' : 'Şoförü Gör'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Google Maps'te navigasyon aç
  function openGoogleMapsNavigation(destination: { latitude: number; longitude: number }) {
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${destination.latitude},${destination.longitude}&directionsmode=driving`,
      android: `google.navigation:q=${destination.latitude},${destination.longitude}&mode=d`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            // Google Maps yüklü değilse web versiyonu aç
            Linking.openURL(webUrl);
          }
        })
        .catch(() => {
          Linking.openURL(webUrl);
        });
    } else {
      Linking.openURL(webUrl);
    }
  }
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
  webInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  webInfoText: {
    fontSize: 18,
    color: '#333',
    marginVertical: 4,
  },
  // Marker Styles - Daha büyük ve net
  markerContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  driverMarker: {
    backgroundColor: '#EF4444',
  },
  passengerMarker: {
    backgroundColor: '#3B82F6',
  },
  connectedMarker: {
    borderColor: '#22C55E',
    borderWidth: 5,
  },
  markerEmoji: {
    fontSize: 30,
  },
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  // Top Banner
  topBanner: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  topBannerConnected: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9CA3AF',
    marginRight: 6,
  },
  connectionDotActive: {
    backgroundColor: '#22C55E',
  },
  connectionText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  connectionTextActive: {
    color: '#22C55E',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  infoDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  meetingText: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#22C55E',
  },
  // Legend
  legend: {
    position: 'absolute',
    bottom: 160,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  // Live Indicator
  liveIndicator: {
    position: 'absolute',
    bottom: 160,
    right: 10,
    backgroundColor: '#22C55E',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  liveText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Google Maps Navigasyon Butonu
  navigationButton: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: '#4285F4',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  navigationButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
