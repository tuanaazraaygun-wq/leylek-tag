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
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Google Directions API ile rota al
  const fetchRoute = async () => {
    if (!userLocation || !otherLocation) return;

    try {
      const origin = `${userLocation.latitude},${userLocation.longitude}`;
      const destination = `${otherLocation.latitude},${otherLocation.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=tr`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Mesafe ve süre
        setDistance(leg.distance.value / 1000); // km
        setDuration(Math.round(leg.duration.value / 60)); // dakika
        
        // Polyline decode
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
      }
    } catch (error) {
      console.error('Rota alınamadı:', error);
      // Fallback: Düz çizgi mesafe
      if (userLocation && otherLocation) {
        const dist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        setDistance(dist);
        setDuration(Math.round((dist / 40) * 60)); // 40 km/h ortalama
      }
    }
  };

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

  // Konum değiştiğinde rota güncelle
  useEffect(() => {
    if (userLocation && otherLocation) {
      fetchRoute();
    }
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude]);

  // Haritayı konumlara fit et
  useEffect(() => {
    if (mapRef.current && userLocation && otherLocation) {
      const coordinates = [userLocation, otherLocation];
      if (destinationLocation) {
        coordinates.push(destinationLocation);
      }
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  }, [userLocation, otherLocation, destinationLocation]);

  // Web platformu için placeholder
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webPlaceholder}>
        <Ionicons name="map" size={60} color="#00A67E" />
        <Text style={styles.webPlaceholderText}>Harita Görünümü</Text>
        <Text style={styles.webPlaceholderSubtext}>
          Mobil uygulamada tam ekran harita görüntülenir
        </Text>
        {distance && (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>📍 Mesafe: {distance.toFixed(1)} km</Text>
            {duration && <Text style={styles.infoText}>⏱️ Tahmini: {duration} dakika</Text>}
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
        rotateEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
      >
        {/* Kullanıcı Marker - Şoför ise araba, Yolcu ise insan */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title={userName}
            description={isDriver ? "Şoför (Sen)" : "Yolcu (Sen)"}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.markerContainer, isDriver ? styles.driverMarker : styles.passengerMarker]}>
              {isDriver ? (
                <Text style={styles.markerEmoji}>🚗</Text>
              ) : (
                <Text style={styles.markerEmoji}>🧍</Text>
              )}
            </View>
          </Marker>
        )}

        {/* Karşı Taraf Marker */}
        {otherLocation && (
          <Marker
            coordinate={otherLocation}
            title={otherUserName}
            description={isDriver ? "Yolcu" : "Şoför"}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.markerContainer, isDriver ? styles.passengerMarker : styles.driverMarker]}>
              {isDriver ? (
                <Text style={styles.markerEmoji}>🧍</Text>
              ) : (
                <Text style={styles.markerEmoji}>🚗</Text>
              )}
            </View>
          </Marker>
        )}

        {/* Hedef Marker */}
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="Hedef"
            description={destinationLocation.address || "Varış Noktası"}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="flag" size={30} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Rota Çizgisi */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#00A67E"
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}

        {/* Düz Çizgi (Fallback) */}
        {routeCoordinates.length === 0 && userLocation && otherLocation && (
          <Polyline
            coordinates={[userLocation, otherLocation]}
            strokeColor="#00A67E"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      {/* Bilgi Kartı */}
      <View style={styles.infoOverlay}>
        <View style={styles.infoBox}>
          {/* Mesafe ve Süre */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="navigate" size={24} color="#00A67E" />
              <Text style={styles.infoValue}>
                {distance ? `${distance.toFixed(1)} km` : 'Hesaplanıyor...'}
              </Text>
              <Text style={styles.infoLabel}>Mesafe</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoItem}>
              <Ionicons name="time" size={24} color="#FF6B35" />
              <Text style={styles.infoValue}>
                {duration ? `${duration} dk` : '--'}
              </Text>
              <Text style={styles.infoLabel}>Tahmini Süre</Text>
            </View>
          </View>

          {/* Buluşma Mesajı */}
          <View style={styles.meetingInfo}>
            <Text style={styles.meetingEmoji}>🤝</Text>
            <Text style={styles.meetingText}>
              {duration ? `${duration} dakika sonra buluşacaksınız!` : 'Konum hesaplanıyor...'}
            </Text>
          </View>

          {/* Bağlantı Göstergesi */}
          <View style={styles.connectionIndicator}>
            <View style={styles.connectionDot} />
            <Text style={styles.connectionText}>Canlı Takip Aktif</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🚗</Text>
          <Text style={styles.legendText}>Şoför</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🧍</Text>
          <Text style={styles.legendText}>Yolcu</Text>
        </View>
        {destinationLocation && (
          <View style={styles.legendItem}>
            <Ionicons name="flag" size={16} color="#E74C3C" />
            <Text style={styles.legendText}>Hedef</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  map: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 20,
  },
  webPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00A67E',
    marginTop: 10,
  },
  webPlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  // Marker Styles
  markerContainer: {
    width: 50,
    height: 50,
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
  driverMarker: {
    backgroundColor: '#E74C3C',
  },
  passengerMarker: {
    backgroundColor: '#3498DB',
  },
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  markerEmoji: {
    fontSize: 24,
  },
  // Info Overlay
  infoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
  },
  infoBox: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 50,
    backgroundColor: '#E0E0E0',
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  meetingEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  meetingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00A67E',
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00A67E',
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: '#888',
  },
  // Legend
  legend: {
    position: 'absolute',
    top: 60,
    left: 15,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendEmoji: {
    fontSize: 16,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  infoCard: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginVertical: 4,
  },
});
