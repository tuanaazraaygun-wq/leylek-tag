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
  destinationLocation?: { latitude: number; longitude: number } | null;
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
  onRequestTripEnd?: () => void;
  onForceEnd?: () => void;
  onAutoComplete?: () => void;
}

// Haversine mesafe hesaplama (km)
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

// Polyline decode fonksiyonu (OSRM formatı)
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
      longitude: lng / 1e5
    });
  }
  return points;
};

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
  onAutoComplete,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  
  // ARAMA STATE'LERİ
  const [isCallLoading, setIsCallLoading] = useState(false);
  const [lastCallTime, setLastCallTime] = useState<number>(0);
  
  // YEŞİL ROTA: Şoför → Yolcu (buluşma)
  const [meetingRoute, setMeetingRoute] = useState<{latitude: number, longitude: number}[]>([]);
  const [meetingDistance, setMeetingDistance] = useState<number | null>(null);
  const [meetingDuration, setMeetingDuration] = useState<number | null>(null);
  
  // TURUNCU ROTA: Yolcu → Hedef (varış)
  const [destinationRoute, setDestinationRoute] = useState<{latitude: number, longitude: number}[]>([]);
  const [destinationDistance, setDestinationDistance] = useState<number | null>(null);
  const [destinationDuration, setDestinationDuration] = useState<number | null>(null);
  
  // Hedefe yaklaşma kontrolü
  const [nearDestination, setNearDestination] = useState(false);
  const autoCompleteTriggered = useRef(false);
  
  // API çağrı sayacı (rate limiting için)
  const lastRouteCall = useRef<number>(0);
  
  // Arama fonksiyonu - 5 saniye cooldown ile
  const handleCall = async (type: 'audio' | 'video') => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    // 5 saniye cooldown kontrolü
    if (timeSinceLastCall < 5000) {
      const remaining = Math.ceil((5000 - timeSinceLastCall) / 1000);
      Alert.alert('⏳ Bekleyin', `Yeni arama için ${remaining} saniye bekleyin`);
      return;
    }
    
    if (isCallLoading) {
      Alert.alert('⏳ Bekleyin', 'Arama isteği gönderiliyor...');
      return;
    }
    
    setIsCallLoading(true);
    Alert.alert('📞 Arama Başlatılıyor', type === 'video' ? 'Görüntülü arama isteği gönderiliyor...' : 'Sesli arama isteği gönderiliyor...');
    
    try {
      await onCall?.(type);
      setLastCallTime(Date.now());
    } finally {
      setTimeout(() => setIsCallLoading(false), 2000);
    }
  };

  // OSRM API ile rota al (TAMAMEN ÜCRETSİZ - Limitsiz)
  const fetchRoute = async (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ): Promise<{ coordinates: {latitude: number, longitude: number}[], distance: number, duration: number } | null> => {
    try {
      // Rate limiting - en az 2 saniye bekle
      const now = Date.now();
      if (now - lastRouteCall.current < 2000) {
        return null;
      }
      lastRouteCall.current = now;
      
      // OSRM Public API (Tamamen ücretsiz, limitsiz)
      const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=polyline`;
      
      console.log('🗺️ OSRM rota isteği...');
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Polyline decode et
        const points = decodePolyline(route.geometry);
        
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);
        
        console.log('✅ OSRM rota:', distKm.toFixed(1), 'km,', durMin, 'dk');
        
        return { coordinates: points, distance: distKm, duration: durMin };
      }
    } catch (error) {
      console.log('OSRM hatası:', error);
    }
    return null;
  };

  // YEŞİL ROTA: Şoför → Yolcu (her 5 saniyede güncelle)
  useEffect(() => {
    if (!userLocation || !otherLocation) return;
    
    const updateMeetingRoute = async () => {
      let start, end;
      if (isDriver) {
        start = userLocation;
        end = otherLocation;
      } else {
        start = otherLocation;
        end = userLocation;
      }
      
      // Önce düz çizgi mesafesini hesapla
      const straightDistance = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
      
      // Hemen düz çizgi göster (anlık geri bildirim)
      if (meetingRoute.length === 0) {
        setMeetingRoute([start, end]);
        setMeetingDistance(straightDistance * 1.3);
        setMeetingDuration(Math.round((straightDistance * 1.3 / 40) * 60));
      }
      
      // Gerçek rotayı al
      const result = await fetchRoute(start, end);
      if (result && result.coordinates.length > 2) {
        setMeetingRoute(result.coordinates);
        setMeetingDistance(result.distance);
        setMeetingDuration(result.duration);
      }
    };
    
    updateMeetingRoute();
    const interval = setInterval(updateMeetingRoute, 5000); // 5 saniyede bir güncelle
    return () => clearInterval(interval);
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude, isDriver]);

  // TURUNCU ROTA: Yolcu → Hedef
  useEffect(() => {
    if (!destinationLocation) return;
    
    const passengerLocation = isDriver ? otherLocation : userLocation;
    if (!passengerLocation) return;
    
    const updateDestinationRoute = async () => {
      // Düz çizgi mesafesi
      const straightDistance = calculateDistance(
        passengerLocation.latitude, passengerLocation.longitude,
        destinationLocation.latitude, destinationLocation.longitude
      );
      
      // Hemen göster
      if (destinationRoute.length === 0) {
        setDestinationRoute([passengerLocation, destinationLocation]);
        setDestinationDistance(straightDistance * 1.3);
        setDestinationDuration(Math.round((straightDistance * 1.3 / 40) * 60));
      }
      
      // Gerçek rota
      const result = await fetchRoute(passengerLocation, destinationLocation);
      if (result && result.coordinates.length > 2) {
        setDestinationRoute(result.coordinates);
        setDestinationDistance(result.distance);
        setDestinationDuration(result.duration);
        
        // 1 km kontrolü
        if (result.distance <= 1 && !autoCompleteTriggered.current) {
          setNearDestination(true);
          autoCompleteTriggered.current = true;
          
          Alert.alert(
            '🎯 Hedefe Yaklaştınız!',
            'Hedefe 1 km\'den az kaldı. Yolculuğu tamamlamak ister misiniz?',
            [
              { text: 'Hayır', style: 'cancel' },
              { text: 'Evet, Tamamla', onPress: () => onAutoComplete?.() }
            ]
          );
        }
      }
    };
    
    updateDestinationRoute();
    const interval = setInterval(updateDestinationRoute, 10000); // 10 saniyede bir
    return () => clearInterval(interval);
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude, destinationLocation?.latitude, destinationLocation?.longitude, isDriver]);

  // Harita sınırlarını ayarla
  useEffect(() => {
    if (mapRef.current && userLocation && otherLocation) {
      setTimeout(() => {
        const coordinates = [userLocation, otherLocation];
        if (destinationLocation) {
          coordinates.push(destinationLocation);
        }
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 180, right: 50, bottom: 280, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [userLocation, otherLocation, destinationLocation]);

  // Google/Apple Maps navigasyon aç
  const openNavigation = () => {
    if (!otherLocation) return;
    
    const destination = `${otherLocation.latitude},${otherLocation.longitude}`;
    const label = encodeURIComponent(otherUserName);
    
    const googleUrl = `google.navigation:q=${destination}&mode=d`;
    const appleUrl = `maps://app?daddr=${destination}&dirflg=d`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    
    if (Platform.OS === 'android') {
      Linking.openURL(googleUrl).catch(() => Linking.openURL(webUrl));
    } else if (Platform.OS === 'ios') {
      Linking.openURL(appleUrl).catch(() => Linking.openURL(webUrl));
    } else {
      Linking.openURL(webUrl);
    }
  };

  // Web fallback
  if (Platform.OS === 'web' || !MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.webFallback}>
          <Ionicons name="map" size={64} color="#3FA9F5" />
          <Text style={styles.webFallbackText}>Harita sadece mobil uygulamada görüntülenebilir</Text>
          {meetingDistance && (
            <Text style={styles.distanceText}>
              Buluşma: {meetingDistance.toFixed(1)} km • {meetingDuration} dk
            </Text>
          )}
          {destinationDistance && (
            <Text style={styles.destinationDistanceText}>
              Hedefe: {destinationDistance.toFixed(1)} km • {destinationDuration} dk
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HARİTA */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: userLocation?.latitude || 39.9334,
          longitude: userLocation?.longitude || 32.8597,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={mapStyle}
      >
        {/* YEŞİL ROTA: Şoför → Yolcu (Buluşma) */}
        {meetingRoute.length > 1 && (
          <Polyline
            coordinates={meetingRoute}
            strokeColor="#22C55E"
            strokeWidth={6}
            lineDashPattern={[0]}
          />
        )}
        
        {/* TURUNCU ROTA: Yolcu → Hedef */}
        {destinationRoute.length > 1 && destinationLocation && (
          <Polyline
            coordinates={destinationRoute}
            strokeColor="#F97316"
            strokeWidth={5}
            lineDashPattern={[10, 5]}
          />
        )}

        {/* BEN - Mavi Marker */}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerContainer}>
              <View style={[styles.markerCircle, styles.myCircle]}>
                <Text style={styles.markerIcon}>{isDriver ? '🚗' : '👤'}</Text>
              </View>
              <View style={[styles.markerArrow, styles.myArrow]} />
            </View>
          </Marker>
        )}

        {/* KARŞI TARAF - Yeşil/Mor Marker */}
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

        {/* HEDEF - Turuncu Bayrak */}
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

      {/* ÜST BİLGİ PANELİ */}
      <View style={styles.topInfoPanel}>
        <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.95)']} style={styles.infoGradient}>
          {/* Buluşma Bilgisi - Yeşil */}
          <View style={styles.routeInfoRow}>
            <View style={[styles.routeIndicator, { backgroundColor: '#22C55E' }]} />
            <View style={styles.routeDetails}>
              <Text style={styles.routeLabel}>🚗 Buluşma</Text>
              <Text style={styles.routeValue}>
                {meetingDistance ? `${meetingDistance.toFixed(1)} km` : '...'} • {meetingDuration ? `${meetingDuration} dk` : '...'}
              </Text>
            </View>
          </View>
          
          {/* Hedef Bilgisi - Turuncu */}
          {destinationLocation && (
            <View style={styles.routeInfoRow}>
              <View style={[styles.routeIndicator, { backgroundColor: '#F97316' }]} />
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>🏁 Hedefe</Text>
                <Text style={styles.routeValue}>
                  {destinationDistance ? `${destinationDistance.toFixed(1)} km` : '...'} • {destinationDuration ? `${destinationDuration} dk` : '...'}
                </Text>
              </View>
              {nearDestination && (
                <View style={styles.nearBadge}>
                  <Text style={styles.nearBadgeText}>YAKIN!</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Fiyat */}
          {price && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Ücret:</Text>
              <Text style={styles.priceValue}>₺{price}</Text>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* ALT BUTONLAR */}
      <View style={styles.bottomPanel}>
        <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,1)']} style={styles.bottomGradient}>
          
          {/* YOLCU İÇİN - Canlı İzleme Bilgisi */}
          {!isDriver && (
            <View style={styles.liveTrackingInfo}>
              <View style={styles.liveTrackingHeader}>
                <View style={styles.liveIndicatorBig}>
                  <View style={styles.liveDotBig} />
                  <Text style={styles.liveTextBig}>CANLI</Text>
                </View>
                <Text style={styles.liveTrackingTitle}>🚗 Şoförü Canlı İzliyorsunuz</Text>
              </View>
              <Text style={styles.liveTrackingSubtitle}>
                Şoförü sesli ve görüntülü arayabilirsiniz
              </Text>
            </View>
          )}
          
          {/* ŞOFÖR İÇİN - Yolcuya Git Butonu */}
          {isDriver && (
            <TouchableOpacity style={styles.navButton} onPress={openNavigation}>
              <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.navButtonGradient}>
                <Ionicons name="navigate" size={24} color="#FFF" />
                <Text style={styles.navButtonText}>Yolcuya Git</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Arama Butonları - HER İKİ ROL İÇİN */}
          <View style={styles.callButtons}>
            <TouchableOpacity 
              style={[styles.callButton, isCallLoading && styles.callButtonDisabled]} 
              onPress={() => handleCall('audio')}
              disabled={isCallLoading}
            >
              <Ionicons name="call" size={22} color="#22C55E" />
              <Text style={styles.callButtonText}>{isCallLoading ? 'Aranıyor...' : 'Sesli Ara'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.callButton, styles.videoCallButton, isCallLoading && styles.callButtonDisabled]} 
              onPress={() => handleCall('video')}
              disabled={isCallLoading}
            >
              <Ionicons name="videocam" size={22} color="#3B82F6" />
              <Text style={styles.callButtonText}>{isCallLoading ? 'Aranıyor...' : 'Görüntülü Ara'}</Text>
            </TouchableOpacity>
          </View>

          {/* Diğer Butonlar */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={() => {
              Alert.alert(
                'Şikayet',
                'Ne tür bir şikayet bildirmek istiyorsunuz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Uygunsuz Davranış', onPress: () => onReport?.() },
                  { text: 'Güvenlik Sorunu', onPress: () => onReport?.() }
                ]
              );
            }}>
              <Ionicons name="flag" size={18} color="#EF4444" />
              <Text style={styles.actionButtonText}>Şikayet</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.endButton]} onPress={() => {
              Alert.alert(
                'Yolculuğu Bitir',
                'Nasıl bitirmek istiyorsunuz?',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Karşı Taraftan Onay İste', onPress: () => onRequestTripEnd?.() },
                  { text: 'Tamamla', onPress: () => onComplete?.() },
                  { text: '⚠️ Zorla Bitir (-5 Puan)', onPress: () => {
                    Alert.alert(
                      '⚠️ Dikkat!',
                      'Zorla bitirme işlemi puanınızı 5 düşürecektir. Devam etmek istiyor musunuz?',
                      [
                        { text: 'Vazgeç', style: 'cancel' },
                        { text: 'Evet, Zorla Bitir', style: 'destructive', onPress: () => onForceEnd?.() }
                      ]
                    );
                  }, style: 'destructive' }
                ]
              );
            }}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Bitir</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// Harita stili - Temiz görünüm
const mapStyle = [
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "off" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  webFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F8' },
  webFallbackText: { fontSize: 16, color: '#666', marginTop: 16, textAlign: 'center' },
  distanceText: { fontSize: 18, fontWeight: 'bold', color: '#22C55E', marginTop: 12 },
  destinationDistanceText: { fontSize: 16, color: '#F97316', marginTop: 8 },
  
  // Marker Styles
  markerContainer: { alignItems: 'center' },
  markerCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  myCircle: { backgroundColor: '#3B82F6' },
  driverCircle: { backgroundColor: '#22C55E' },
  passengerCircle: { backgroundColor: '#8B5CF6' },
  markerIcon: { fontSize: 22 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  myArrow: { borderTopColor: '#3B82F6' },
  driverArrow: { borderTopColor: '#22C55E' },
  passengerArrow: { borderTopColor: '#8B5CF6' },
  
  // Destination Marker
  destinationMarker: { alignItems: 'center' },
  destinationCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  destinationIcon: { fontSize: 26 },
  destinationLabel: { marginTop: 4, fontSize: 11, fontWeight: 'bold', color: '#F97316', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  
  // Top Info Panel
  topInfoPanel: { position: 'absolute', top: 0, left: 0, right: 0 },
  infoGradient: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  routeInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  routeIndicator: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  routeDetails: { flex: 1 },
  routeLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  routeValue: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  nearBadge: { backgroundColor: '#F97316', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  nearBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 22, fontWeight: 'bold', color: '#22C55E' },
  
  // Bottom Panel
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomGradient: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  navButton: { marginBottom: 14 },
  navButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14 },
  navButtonText: { color: '#FFF', fontSize: 17, fontWeight: '600', marginLeft: 10 },
  callButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 14 },
  callButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1.5, borderColor: '#22C55E' },
  videoCallButton: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  callButtonText: { fontSize: 15, fontWeight: '600', marginLeft: 8, color: '#374151' },
  callButtonDisabled: { opacity: 0.6 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' },
  actionButtonText: { fontSize: 14, fontWeight: '500', marginLeft: 6, color: '#DC2626' },
  endButton: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  
  // Canlı İzleme Bilgisi (Yolcu için)
  liveTrackingInfo: { backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  liveTrackingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  liveIndicatorBig: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 10 },
  liveDotBig: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', marginRight: 6 },
  liveTextBig: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  liveTrackingTitle: { fontSize: 16, fontWeight: '700', color: '#065F46' },
  liveTrackingSubtitle: { fontSize: 14, color: '#059669', marginLeft: 4 },
});
