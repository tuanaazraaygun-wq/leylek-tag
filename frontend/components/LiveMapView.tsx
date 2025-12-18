import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  otherUserId?: string;
  price?: number;
  onBlock?: () => void;
  onReport?: () => void;
  onCall?: (type: 'audio' | 'video') => void;
  onComplete?: () => void;
}

// Kullanıcının kendi API anahtarı
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function LiveMapView({
  userLocation,
  otherLocation,
  isDriver,
  userName = 'Sen',
  otherUserName = 'Karşı Taraf',
  otherUserId,
  price,
  onBlock,
  onReport,
  onCall,
  onComplete,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [streetName, setStreetName] = useState<string>('');

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

  // Google Directions API ile rota al
  const fetchRoute = async () => {
    if (!userLocation || !otherLocation) return;

    try {
      // Her zaman şoförden yolcuya hesapla - her iki taraf da aynı değeri görsün
      let origin, destination;
      if (isDriver) {
        origin = `${userLocation.latitude},${userLocation.longitude}`;
        destination = `${otherLocation.latitude},${otherLocation.longitude}`;
      } else {
        origin = `${otherLocation.latitude},${otherLocation.longitude}`;
        destination = `${userLocation.latitude},${userLocation.longitude}`;
      }
      
      console.log('🗺️ Rota hesaplanıyor:', origin, '->', destination);
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=tr`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Mesafe ve süre - Google'dan gelen gerçek değerler
        const distKm = leg.distance.value / 1000;
        const durMin = Math.round(leg.duration.value / 60);
        
        setDistance(distKm);
        setDuration(durMin);
        
        console.log('✅ Rota bulundu:', distKm.toFixed(1), 'km,', durMin, 'dakika');
        
        // Polyline decode
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
        
        // Şoförün bulunduğu sokak/cadde adı
        if (!isDriver && leg.start_address) {
          setStreetName(leg.start_address.split(',')[0]);
        }
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
      }
    } catch (error) {
      console.error('Rota hatası:', error);
      if (userLocation && otherLocation) {
        const dist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        const dur = Math.round((dist / 40) * 60);
        setDistance(dist);
        setDuration(dur);
        setRouteCoordinates([userLocation, otherLocation]);
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
    if (userLocation && otherLocation) {
      fetchRoute();
    }
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude]);

  // Haritayı konumlara fit et
  useEffect(() => {
    if (mapRef.current && userLocation && otherLocation) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([userLocation, otherLocation], {
          edgePadding: { top: 150, right: 50, bottom: 250, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, otherLocation]);

  // Google Maps'te navigasyon aç
  const openNavigation = () => {
    if (!otherLocation) return;
    
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${otherLocation.latitude},${otherLocation.longitude}&directionsmode=driving`,
      android: `google.navigation:q=${otherLocation.latitude},${otherLocation.longitude}&mode=d`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${otherLocation.latitude},${otherLocation.longitude}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            Linking.openURL(webUrl);
          }
        })
        .catch(() => Linking.openURL(webUrl));
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
        showsCompass={false}
        mapType="standard"
      >
        {/* ROTA ÇİZGİSİ */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#22C55E"
            strokeWidth={5}
          />
        )}

        {/* BEN */}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.marker, isDriver ? styles.driverMarker : styles.passengerMarker]}>
              <Text style={styles.markerEmoji}>{isDriver ? '🚗' : '🧍'}</Text>
            </View>
          </Marker>
        )}

        {/* KARŞI TARAF */}
        {otherLocation && (
          <Marker coordinate={otherLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.marker, !isDriver ? styles.driverMarker : styles.passengerMarker]}>
              <Text style={styles.markerEmoji}>{!isDriver ? '🚗' : '🧍'}</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ÜST BİLGİ - Transparan */}
      <View style={styles.topInfo}>
        {/* Mesafe ve Süre */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            📍 {distance ? `${distance.toFixed(1)} km` : '--'}
          </Text>
          <Text style={styles.infoText}>
            ⏱️ {duration ? `${duration} dk` : '--'}
          </Text>
          {price && (
            <Text style={styles.priceText}>💰 {price} ₺</Text>
          )}
        </View>
        
        {/* Buluşma Mesajı */}
        {duration && (
          <Text style={styles.meetingText}>
            🤝 {duration} dakika sonra buluşacaksınız!
          </Text>
        )}
        
        {/* Şoförün bulunduğu sokak (yolcu için) */}
        {!isDriver && streetName && (
          <Text style={styles.streetText}>📍 {streetName}</Text>
        )}
      </View>

      {/* ALT BUTONLAR */}
      <View style={styles.bottomButtons}>
        {/* Navigasyon Butonu */}
        <TouchableOpacity style={styles.navButton} onPress={openNavigation}>
          <Ionicons name="navigate" size={24} color="#FFF" />
          <Text style={styles.navButtonText}>
            {isDriver ? 'Yolcuya Git' : 'Şoförü Gör'}
          </Text>
        </TouchableOpacity>

        {/* Arama Butonları */}
        <View style={styles.actionButtons}>
          {/* Sesli Arama */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => onCall?.('audio')}
          >
            <View style={styles.callIcon}>
              <Ionicons name="call" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Sesli</Text>
          </TouchableOpacity>

          {/* Görüntülü Arama */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => onCall?.('video')}
          >
            <View style={[styles.callIcon, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="videocam" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Video</Text>
          </TouchableOpacity>

          {/* Bitir */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={onComplete}
          >
            <View style={[styles.callIcon, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="checkmark-done" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Bitir</Text>
          </TouchableOpacity>

          {/* Engelle/Şikayet */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => {
              Alert.alert(
                'İşlem Seçin',
                `${otherUserName} için ne yapmak istiyorsunuz?`,
                [
                  { text: 'İptal', style: 'cancel' },
                  { 
                    text: '🚫 Engelle', 
                    style: 'destructive',
                    onPress: onBlock 
                  },
                  { 
                    text: '⚠️ Şikayet Et', 
                    onPress: onReport 
                  },
                ]
              );
            }}
          >
            <View style={[styles.callIcon, { backgroundColor: '#6B7280' }]}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Diğer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CANLI Gösterge */}
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
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
  // Marker
  marker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  driverMarker: {
    backgroundColor: '#EF4444',
  },
  passengerMarker: {
    backgroundColor: '#3B82F6',
  },
  markerEmoji: {
    fontSize: 24,
  },
  // Üst Bilgi - Transparan
  topInfo: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  infoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  meetingText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  streetText: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  // Alt Butonlar
  bottomButtons: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
  },
  navButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  callIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Canlı Gösterge
  liveIndicator: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 16,
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
    backgroundColor: '#FFF',
  },
  liveText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
