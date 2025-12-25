import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Linking, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

interface LiveMapViewProps {
  userLocation: { latitude: number; longitude: number } | null;
  otherLocation: { latitude: number; longitude: number } | null;
  destinationLocation?: { latitude: number; longitude: number } | null; // Hedef konum
  isDriver: boolean;
  userName?: string;
  otherUserName?: string;
  otherUserId?: string;
  price?: number;
  routeInfo?: { distance_km: number; duration_min: number } | null;
  onBlock?: () => void;
  onReport?: () => void;
  onCall?: (type: 'audio' | 'video') => void;
  onComplete?: () => void;
  onRequestTripEnd?: () => void; // Karşılıklı iptal için
  onForceEnd?: () => void; // Zorla bitir için
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function LiveMapView({
  userLocation,
  otherLocation,
  destinationLocation,
  isDriver,
  userName = 'Sen',
  otherUserName = 'Karşı Taraf',
  otherUserId,
  price,
  routeInfo,
  onBlock,
  onReport,
  onCall,
  onComplete,
  onRequestTripEnd,
  onForceEnd,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [streetName, setStreetName] = useState<string>('');
  
  // Rota bilgisi - önce backend, yoksa local hesaplama
  const [localDistance, setLocalDistance] = useState<number | null>(null);
  const [localDuration, setLocalDuration] = useState<number | null>(null);
  
  // Backend değeri varsa onu kullan, yoksa local
  const distance = routeInfo?.distance_km || localDistance;
  const duration = routeInfo?.duration_min || localDuration;

  // Polyline decode
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

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  // Polyline için rota çiz + mesafe/süre hesapla
  const fetchRoutePolyline = async () => {
    if (!userLocation || !otherLocation) {
      setRouteCoordinates([]);
      return;
    }

    try {
      // Her zaman şoförden yolcuya hesapla
      let origin, destination;
      if (isDriver) {
        origin = `${userLocation.latitude},${userLocation.longitude}`;
        destination = `${otherLocation.latitude},${otherLocation.longitude}`;
      } else {
        origin = `${otherLocation.latitude},${otherLocation.longitude}`;
        destination = `${userLocation.latitude},${userLocation.longitude}`;
      }
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=tr`;
      
      console.log('🗺️ Rota isteği:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('🗺️ API yanıtı:', data.status);

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
        
        // Google'dan gelen GERÇEK mesafe ve süre
        const distKm = leg.distance.value / 1000;
        const durMin = Math.round(leg.duration.value / 60);
        setLocalDistance(distKm);
        setLocalDuration(durMin);
        console.log('✅ Google rota:', distKm.toFixed(1), 'km,', durMin, 'dk');
        
        // Şoförün sokak adı (yolcu için)
        if (!isDriver && leg.start_address) {
          setStreetName(leg.start_address.split(',')[0]);
        }
      } else {
        console.log('⚠️ API hatası, fallback kullanılıyor. Status:', data.status);
        // Fallback: Düz çizgi mesafe x 1.8 (şehir içi yol katsayısı)
        const straightDist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        // Şehir içi yollar düz çizginin ~1.8 katı (virajlar, trafik)
        const dist = straightDist * 1.8;
        // Ortalama 30 km/h şehir içi hız
        const dur = Math.round((dist / 30) * 60);
        setLocalDistance(dist);
        setLocalDuration(dur);
        setRouteCoordinates([
          isDriver ? userLocation : otherLocation,
          isDriver ? otherLocation : userLocation
        ]);
      }
    } catch (error) {
      console.error('🗺️ Rota hatası:', error);
      if (userLocation && otherLocation) {
        const dist = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          otherLocation.latitude, otherLocation.longitude
        );
        const dur = Math.round((dist / 40) * 60);
        setLocalDistance(dist);
        setLocalDuration(dur);
        setRouteCoordinates([
          isDriver ? userLocation : otherLocation,
          isDriver ? otherLocation : userLocation
        ]);
      }
    }
  };
  
  // Haversine mesafe hesaplama
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (userLocation && otherLocation) {
      fetchRoutePolyline();
    }
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude]);

  useEffect(() => {
    if (mapRef.current && userLocation && otherLocation) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([userLocation, otherLocation], {
          edgePadding: { top: 180, right: 50, bottom: 280, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, otherLocation]);

  const openNavigation = () => {
    if (!otherLocation) return;
    
    const url = Platform.select({
      ios: `comgooglemaps://?daddr=${otherLocation.latitude},${otherLocation.longitude}&directionsmode=driving`,
      android: `google.navigation:q=${otherLocation.latitude},${otherLocation.longitude}&mode=d`,
    });

    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${otherLocation.latitude},${otherLocation.longitude}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => Linking.openURL(supported ? url : webUrl))
        .catch(() => Linking.openURL(webUrl));
    } else {
      Linking.openURL(webUrl);
    }
  };

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
        toolbarEnabled={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsIndoorLevelPicker={false}
        showsPointsOfInterest={false}
        paddingAdjustmentBehavior="automatic"
        mapPadding={{ left: 0, right: 0, top: 0, bottom: 100 }}
        customMapStyle={[
          {
            "featureType": "administrative",
            "elementType": "geometry",
            "stylers": [{ "visibility": "off" }]
          },
          {
            "featureType": "poi",
            "stylers": [{ "visibility": "off" }]
          }
        ]}
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
            <View style={styles.markerContainer}>
              <View style={[styles.markerCircle, isDriver ? styles.driverCircle : styles.passengerCircle]}>
                <Text style={styles.markerIcon}>{isDriver ? '🚗' : '👤'}</Text>
              </View>
              <View style={[styles.markerArrow, isDriver ? styles.driverArrow : styles.passengerArrow]} />
            </View>
          </Marker>
        )}

        {/* KARŞI TARAF */}
        {otherLocation && (
          <Marker coordinate={otherLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerContainer}>
              <View style={[styles.markerCircle, !isDriver ? styles.driverCircle : styles.passengerCircle]}>
                <Text style={styles.markerIcon}>{!isDriver ? '🚗' : '👤'}</Text>
              </View>
              <View style={[styles.markerArrow, !isDriver ? styles.driverArrow : styles.passengerArrow]} />
            </View>
          </Marker>
        )}

        {/* HEDEF KONUM - Yeşil Bayrak */}
        {destinationLocation && (
          <Marker coordinate={destinationLocation} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destinationMarker}>
              <View style={styles.destinationCircle}>
                <Text style={styles.destinationIcon}>🏁</Text>
              </View>
              <Text style={styles.destinationLabel}>HEDEF</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ÜST BİLGİ KARTI - MAVİ GRADIENT */}
      <View style={styles.topCard}>
        <LinearGradient
          colors={['#3B82F6', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topCardGradient}
        >
          {/* Üst Satır: Mesafe - Süre - Fiyat */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="navigate-circle" size={22} color="#FFF" />
              <Text style={styles.statValue}>{distance ? `${distance.toFixed(1)} km` : '--'}</Text>
              <Text style={styles.statLabel}>Mesafe</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItemMain}>
              <Ionicons name="time" size={26} color="#FFF" />
              <Text style={styles.statValueBig}>{duration ? `${duration} dk` : '--'}</Text>
              <Text style={styles.statLabel}>Tahmini Süre</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Ionicons name="cash" size={22} color="#22C55E" />
              <Text style={styles.statValueGreen}>{price ? `₺${price}` : '--'}</Text>
              <Text style={styles.statLabel}>Fiyat</Text>
            </View>
          </View>

          {/* Alt Satır: Buluşma Mesajı */}
          <View style={styles.meetingRow}>
            <Text style={styles.meetingText}>
              🤝 {duration ? `${duration} dakika sonra buluşacaksınız!` : 'Hesaplanıyor...'}
            </Text>
          </View>

          {/* Şoförün Sokağı (Yolcu için) */}
          {!isDriver && streetName ? (
            <Text style={styles.streetText}>📍 Şoför: {streetName}</Text>
          ) : null}
        </LinearGradient>
      </View>

      {/* CANLI Gösterge */}
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>CANLI</Text>
      </View>

      {/* Sol alt köşe örtücü (Google logosu gizleme) */}
      <View style={styles.bottomLeftCover} />

      {/* ALT BUTONLAR - SİMETRİK DÜZEN */}
      <View style={styles.bottomContainer}>
        {/* Navigasyon Butonu - SADECE ŞOFÖR İÇİN */}
        {isDriver ? (
          <TouchableOpacity style={styles.navButton} onPress={openNavigation} activeOpacity={0.8}>
            <LinearGradient
              colors={['#4285F4', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.navButtonGradient}
            >
              <Ionicons name="navigate" size={22} color="#FFF" />
              <Text style={styles.navButtonText}>Yolcuya Git</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          /* Yolcu için: Şoförü haritada izleme bilgisi */
          <View style={styles.watchingInfo}>
            <Ionicons name="eye" size={20} color="#22C55E" />
            <Text style={styles.watchingText}>Şoförün konumunu canlı izliyorsunuz</Text>
          </View>
        )}

        {/* Arama ve İşlem Butonları - 4 Sütun */}
        <View style={styles.actionRow}>
          {/* Sesli Arama */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => onCall?.('audio')} activeOpacity={0.8}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.actionBtnCircle}>
              <Ionicons name="call" size={26} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionBtnLabel}>Sesli</Text>
          </TouchableOpacity>

          {/* Görüntülü Arama */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => onCall?.('video')} activeOpacity={0.8}>
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.actionBtnCircle}>
              <Ionicons name="videocam" size={26} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionBtnLabel}>Video</Text>
          </TouchableOpacity>

          {/* Bitir - Karşılıklı onay ile */}
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => {
              // Karşılıklı onay sistemi: önce onRequestTripEnd varsa onu dene
              if (onRequestTripEnd) {
                onRequestTripEnd();
              } else if (onComplete) {
                onComplete();
              }
            }} 
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.actionBtnCircle}>
              <Ionicons name="checkmark-done" size={26} color="#FFF" />
            </LinearGradient>
            <Text style={styles.actionBtnLabel}>Bitir</Text>
          </TouchableOpacity>

          {/* Diğer (Engelle/Şikayet/Zorla Bitir) */}
          <TouchableOpacity 
            style={styles.actionBtn} 
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                `${otherUserName}`,
                'Ne yapmak istiyorsunuz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: '🚫 Engelle', style: 'destructive', onPress: onBlock },
                  { text: '⚠️ Şikayet Et', onPress: onReport },
                  { 
                    text: '⛔ Zorla Bitir (-1 puan)', 
                    style: 'destructive', 
                    onPress: () => {
                      Alert.alert(
                        '⚠️ Zorla Bitir',
                        'Yolculuğu zorla bitirmek istediğinize emin misiniz?\n\nBu işlem puanınızı -1 düşürür.',
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          { 
                            text: 'Zorla Bitir', 
                            style: 'destructive',
                            onPress: onForceEnd
                          }
                        ]
                      );
                    }
                  },
                ]
              );
            }}
          >
            <View style={styles.actionBtnCircleGray}>
              <Ionicons name="ellipsis-horizontal" size={26} color="#FFF" />
            </View>
            <Text style={styles.actionBtnLabel}>Diğer</Text>
          </TouchableOpacity>
        </View>
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
  // YENİ Modern Marker Stilleri
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 10,
  },
  driverCircle: {
    backgroundColor: '#DC2626', // Kırmızı - Şoför
  },
  passengerCircle: {
    backgroundColor: '#2563EB', // Mavi - Yolcu
  },
  markerIcon: {
    fontSize: 22,
    textAlign: 'center',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  driverArrow: {
    borderTopColor: '#DC2626',
  },
  passengerArrow: {
    borderTopColor: '#2563EB',
  },
  // Eski stilleri tutuyorum - yedek olarak
  markerOuter: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  markerInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  driverMarker: {
    backgroundColor: '#DC2626',
  },
  passengerMarker: {
    backgroundColor: '#2563EB',
  },
  markerEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  // Üst Kart
  topCard: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  topCardGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemMain: {
    flex: 1.3,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 4,
  },
  statValueBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 4,
  },
  statValueGreen: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22C55E',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  meetingRow: {
    marginTop: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  meetingText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  streetText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  // Canlı Gösterge
  liveIndicator: {
    position: 'absolute',
    top: 56,
    right: 24,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Alt Container
  bottomContainer: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    right: 16,
  },
  navButton: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  navButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  navButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
  },
  watchingInfo: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  watchingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Action Row - 4 sütun simetrik
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  actionBtn: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - 64) / 4,
  },
  actionBtnCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionBtnCircleGray: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionBtnLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  // Sol alt köşe örtücü (Google logosu gizleme)
  bottomLeftCover: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 80,
    height: 25,
    backgroundColor: '#F5F5F5',
  },
});
