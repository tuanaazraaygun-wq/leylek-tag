import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions, TouchableOpacity, Linking } from 'react-native';
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
  onDistanceUpdate?: (distance: number, duration: number) => void;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyAKqhXyi2cUC3GHLxjom4R_tQ3UfR5auUw';

export default function LiveMapView({
  userLocation,
  otherLocation,
  isDriver,
  userName = 'Sen',
  otherUserName = 'Karşı Taraf',
  destinationLocation,
  onDistanceUpdate,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);

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
      // Her zaman şoförden yolcuya doğru hesapla - böylece iki taraf da aynı sonucu görür
      let origin, destination;
      if (isDriver) {
        origin = `${userLocation.latitude},${userLocation.longitude}`;
        destination = `${otherLocation.latitude},${otherLocation.longitude}`;
      } else {
        // Yolcu için de şoförden yolcuya hesapla (şoför -> yolcu)
        origin = `${otherLocation.latitude},${otherLocation.longitude}`;
        destination = `${userLocation.latitude},${userLocation.longitude}`;
      }
      
      console.log('🗺️ Rota hesaplanıyor (şoför->yolcu):', origin, '->', destination);
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=tr&alternatives=false`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Mesafe ve süre (en kısa yol) - Google'dan gelen gerçek değerler
        const distKm = leg.distance.value / 1000;
        const durMin = Math.round(leg.duration.value / 60);
        
        setDistance(distKm);
        setDuration(durMin);
        
        // Parent component'e bildir (senkronizasyon için)
        if (onDistanceUpdate) {
          onDistanceUpdate(distKm, durMin);
        }
        
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
        const dur = Math.round((dist / 40) * 60);
        setDistance(dist);
        setDuration(dur);
        setRouteCoordinates([userLocation, otherLocation]);
        if (onDistanceUpdate) {
          onDistanceUpdate(dist, dur);
        }
      }
    } catch (error) {
      console.error('Rota hatası:', error);
      // Fallback
      if (userLocation && otherLocation) {
        const dist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        const dur = Math.round((dist / 40) * 60);
        setDistance(dist);
        setDuration(dur);
        setRouteCoordinates([userLocation, otherLocation]);
        if (onDistanceUpdate) {
          onDistanceUpdate(dist, dur);
        }
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
          edgePadding: { top: 180, right: 60, bottom: 120, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, otherLocation, destinationLocation]);

  // Google Maps'te navigasyon aç
  const openGoogleMapsNavigation = (dest: { latitude: number; longitude: number }) => {
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${dest.latitude},${dest.longitude}&directionsmode=driving`,
      android: `google.navigation:q=${dest.latitude},${dest.longitude}&mode=d`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            Linking.openURL(webUrl);
          }
        })
        .catch(() => {
          Linking.openURL(webUrl);
        });
    } else {
      Linking.openURL(webUrl);
    }
  };

  // Web placeholder
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.webPlaceholder}>
        <Ionicons name="map" size={60} color="#22C55E" />
        <Text style={styles.webText}>Harita (Mobil Uygulamada)</Text>
        {distance && duration && (
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
            strokeWidth={6}
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
            <View style={[styles.markerContainer, isDriver ? styles.driverMarker : styles.passengerMarker]}>
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
            <View style={[styles.markerContainer, !isDriver ? styles.driverMarker : styles.passengerMarker]}>
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

      {/* ÜST KISIM - NAVİGASYON + MESAFE/SÜRE + BULUŞMA */}
      <View style={styles.topContainer}>
        {/* Navigasyon Butonu - En Üstte */}
        {otherLocation && (
          <TouchableOpacity
            style={styles.navigationButton}
            onPress={() => openGoogleMapsNavigation(otherLocation)}
          >
            <Ionicons name="navigate" size={24} color="#FFF" />
            <Text style={styles.navigationButtonText}>
              {isDriver ? 'Yolcuya Git' : 'Şoförü Gör'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mesafe ve Süre Bilgisi */}
        {distance && duration && (
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Ionicons name="speedometer" size={20} color="#22C55E" />
              <Text style={styles.infoText}>{distance.toFixed(1)} km</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Ionicons name="time" size={20} color="#22C55E" />
              <Text style={styles.infoText}>{duration} dk</Text>
            </View>
          </View>
        )}

        {/* Buluşma Mesajı */}
        {duration && (
          <View style={styles.meetingContainer}>
            <Text style={styles.meetingText}>
              🤝 {duration} dakika sonra buluşacaksınız!
            </Text>
          </View>
        )}
      </View>

      {/* CANLI GÖSTERGE - Sağ Alt */}
      <View style={styles.liveIndicator}>
        <View style={styles.livePulse} />
        <Text style={styles.liveText}>CANLI</Text>
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
  webInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  webInfoText: {
    fontSize: 18,
    color: '#333',
    marginVertical: 4,
  },
  // Marker Styles
  markerContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  driverMarker: {
    backgroundColor: '#EF4444',
  },
  passengerMarker: {
    backgroundColor: '#3B82F6',
  },
  markerEmoji: {
    fontSize: 26,
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
  // Üst Container - Tüm üst elemanlar
  topContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
  },
  // Navigasyon Butonu
  navigationButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    marginBottom: 10,
  },
  navigationButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Mesafe/Süre Bilgisi
  infoContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  infoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  // Buluşma Mesajı
  meetingContainer: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  meetingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Live Indicator
  liveIndicator: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    backgroundColor: '#EF4444',
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
});
