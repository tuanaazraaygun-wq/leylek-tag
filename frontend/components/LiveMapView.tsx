import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Linking, Alert, Dimensions, Animated, Easing } from 'react-native';
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
  onChat?: () => void;
  onComplete?: () => void;
  onRequestTripEnd?: () => void;
  onForceEnd?: () => void;
  onAutoComplete?: () => void;
  onShowEndTripModal?: () => void;
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

// 🆕 Hareketli Çerçeve Componenti
const AnimatedBorder = ({ color, children }: { color: string; children: React.ReactNode }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Dönen animasyon
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    
    // Nabız animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <Animated.View style={[{ transform: [{ scale: pulse }] }]}>
      <View style={[styles.animatedBorderOuter, { borderColor: color }]}>
        {children}
      </View>
      <Animated.View 
        style={[
          styles.animatedGlow, 
          { 
            borderColor: color,
            shadowColor: color,
            transform: [{ rotate: spin }] 
          }
        ]} 
      />
    </Animated.View>
  );
};

// 🆕 Işıklı Navigasyon İkonu
const NavigationIcon = ({ onPress }: { onPress: () => void }) => {
  const glow = useRef(new Animated.Value(0.5)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.navIconContainer, { opacity: glow }]}>
        <View style={styles.navIconOuter}>
          <LinearGradient colors={['#F97316', '#EA580C']} style={styles.navIconInner}>
            <Ionicons name="navigate" size={28} color="#FFF" />
          </LinearGradient>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
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
  onChat,
  onComplete,
  onRequestTripEnd,
  onForceEnd,
  onAutoComplete,
  onShowEndTripModal,
}: LiveMapViewProps) {
  const mapRef = useRef<any>(null);
  
  // ARAMA STATE'LERİ
  const [isCallLoading, setIsCallLoading] = useState(false);
  
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
  
  // 🔥 YANIP SÖNEN BUTON ANİMASYONU
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Sürekli yanıp sönen animasyon
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    
    return () => pulseAnimation.stop();
  }, []);
  
  // Renk teması - Yolcu: Mor, Sürücü: Mavi
  const themeColor = isDriver ? '#3B82F6' : '#8B5CF6';
  const themeLightColor = isDriver ? '#DBEAFE' : '#EDE9FE';
  const themeGradient = isDriver ? ['#3B82F6', '#2563EB'] : ['#8B5CF6', '#7C3AED'];
  
  // Arama fonksiyonu - hızlı ve direkt
  const handleCall = async (type: 'audio' | 'video') => {
    if (isCallLoading) {
      return;
    }
    
    setIsCallLoading(true);
    
    try {
      await onCall?.(type);
    } finally {
      setTimeout(() => {
        setIsCallLoading(false);
      }, 1000);
    }
  };

  // OSRM API ile rota al (TAMAMEN ÜCRETSİZ - Limitsiz)
  const fetchRoute = async (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ): Promise<{ coordinates: {latitude: number, longitude: number}[], distance: number, duration: number } | null> => {
    try {
      const now = Date.now();
      if (now - lastRouteCall.current < 2000) {
        return null;
      }
      lastRouteCall.current = now;
      
      const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=polyline`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.geometry);
        const distKm = route.distance / 1000;
        const durMin = Math.round(route.duration / 60);
        
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
      
      const result = await fetchRoute(start, end);
      if (result && result.coordinates.length > 2) {
        setMeetingRoute(result.coordinates);
        setMeetingDistance(result.distance);
        setMeetingDuration(result.duration);
      }
    };
    
    updateMeetingRoute();
    const interval = setInterval(updateMeetingRoute, 5000);
    return () => clearInterval(interval);
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude, isDriver]);

  // TURUNCU ROTA: Yolcu → Hedef
  useEffect(() => {
    if (!destinationLocation) return;
    
    const passengerLocation = isDriver ? otherLocation : userLocation;
    if (!passengerLocation) return;
    
    const updateDestinationRoute = async () => {
      const result = await fetchRoute(passengerLocation, destinationLocation);
      if (result && result.coordinates.length > 2) {
        setDestinationRoute(result.coordinates);
        setDestinationDistance(result.distance);
        setDestinationDuration(result.duration);
        
        // 1 km kontrolü - Otomatik tamamlama
        if (result.distance <= 1 && !autoCompleteTriggered.current) {
          setNearDestination(true);
          autoCompleteTriggered.current = true;
          
          // OTOMATİK BİTİR + 1 PUAN
          Alert.alert(
            '🎯 Hedefe Ulaşıldı!',
            'Hedefe 1 km\'den az kaldı. Yolculuk otomatik olarak tamamlanacak ve +1 puan kazanacaksınız!',
            [
              { text: 'Tamam', onPress: () => onAutoComplete?.() }
            ]
          );
        }
      }
    };
    
    updateDestinationRoute();
    const interval = setInterval(updateDestinationRoute, 10000);
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
          <Ionicons name="map" size={64} color={themeColor} />
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

        {/* BEN - Marker */}
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerContainer}>
              <View style={[styles.markerCircle, { backgroundColor: themeColor }]}>
                <Text style={styles.markerIcon}>{isDriver ? '🚗' : '👤'}</Text>
              </View>
              <View style={[styles.markerArrow, { borderTopColor: themeColor }]} />
            </View>
          </Marker>
        )}

        {/* KARŞI TARAF - Marker */}
        {otherLocation && (
          <Marker coordinate={otherLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.markerContainer}>
              <View style={[styles.markerCircle, { backgroundColor: isDriver ? '#8B5CF6' : '#22C55E' }]}>
                <Text style={styles.markerIcon}>{isDriver ? '👤' : '🚗'}</Text>
              </View>
              <View style={[styles.markerArrow, { borderTopColor: isDriver ? '#8B5CF6' : '#22C55E' }]} />
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

      {/* 🆕 ŞOFÖR İÇİN - BÜYÜK YANIP SÖNEN Navigasyon Butonu */}
      {isDriver && (
        <Animated.View style={[styles.floatingNavIcon, { 
          opacity: pulseAnim,
          transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.6, 1], outputRange: [0.95, 1.05] }) }]
        }]}>
          <TouchableOpacity onPress={openNavigation} activeOpacity={0.7}>
            <LinearGradient 
              colors={['#FF6B00', '#FF8C00', '#FF6B00']} 
              style={styles.bigNavButton}
            >
              <Ionicons name="navigate" size={36} color="white" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.floatingNavText}>🚗 YOLCUYA GİT</Text>
        </Animated.View>
      )}

      {/* ÜST BİLGİ PANELİ - MAVİ ÇERÇEVE */}
      <View style={styles.topInfoPanel}>
        <View style={styles.topInfoBorder}>
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
      </View>

      {/* ALT BUTONLAR */}
      <View style={styles.bottomPanel}>
        <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(255,255,255,1)']} style={styles.bottomGradient}>
          
          {/* 🆕 YAZ BUTONU - Ana Buton Olarak */}
          <TouchableOpacity 
            style={[styles.mainChatButton, { backgroundColor: themeColor }]} 
            onPress={() => onChat?.()}
            activeOpacity={0.8}
          >
            <View style={styles.chatButtonContent}>
              <View style={styles.chatIconWrapperLarge}>
                <Ionicons name="chatbubble-ellipses" size={26} color="#FFF" />
              </View>
              <Text style={styles.mainChatButtonText}>
                {isDriver ? 'Yolcuya Yaz' : 'Sürücüye Yaz'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 🆕 ALT BUTONLAR - Şikayet/Destek ve Bitir */}
          <View style={styles.actionButtons}>
            {/* Şikayet/Destek Butonu */}
            <TouchableOpacity 
              style={styles.supportButton} 
              onPress={() => {
                Alert.alert(
                  'Şikayet / Destek',
                  'Ne tür bir yardım istiyorsunuz?',
                  [
                    { text: 'İptal', style: 'cancel' },
                    { text: '🚨 Güvenlik Sorunu', onPress: () => onReport?.() },
                    { text: '⚠️ Uygunsuz Davranış', onPress: () => onReport?.() },
                    { text: '❓ Destek Al', onPress: () => Alert.alert('Destek', 'Destek ekibimiz en kısa sürede size yardımcı olacak.') }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle" size={18} color="#6B7280" />
              <Text style={styles.supportButtonText}>Şikayet / Destek</Text>
            </TouchableOpacity>

            {/* 🆕 BİTİR BUTONU - Donuk Kırmızı, Sadece Zorla Bitir */}
            <TouchableOpacity 
              style={styles.endButton} 
              onPress={() => {
                Alert.alert(
                  '⚠️ Zorla Bitir',
                  'Bu işlem puanınızı 5 düşürecektir!\n\nHedefe ulaştığınızda yolculuk otomatik olarak tamamlanır ve +1 puan kazanırsınız.',
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    { 
                      text: 'Zorla Bitir (-5 Puan)', 
                      style: 'destructive', 
                      onPress: () => onForceEnd?.() 
                    }
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <Text style={styles.endButtonText}>Bitir</Text>
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
  markerIcon: { fontSize: 22 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  
  // Destination Marker
  destinationMarker: { alignItems: 'center' },
  destinationCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  destinationIcon: { fontSize: 26 },
  destinationLabel: { marginTop: 4, fontSize: 11, fontWeight: 'bold', color: '#F97316', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  
  // 🆕 Floating Navigation Icon (Sürücü için)
  floatingNavIcon: {
    position: 'absolute',
    top: 180,
    right: 12,
    alignItems: 'center',
    zIndex: 100,
  },
  bigNavButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingNavText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6B00',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  navIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  navIconInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Top Info Panel
  topInfoPanel: { position: 'absolute', top: 0, left: 0, right: 0 },
  topInfoBorder: { 
    borderWidth: 2, 
    borderColor: '#3B82F6', 
    borderRadius: 26, 
    margin: 8,
    marginTop: 40,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  infoGradient: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24 },
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
  bottomGradient: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  
  // 🆕 Animated Border
  animatedBorderOuter: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#8B5CF6',
    padding: 3,
  },
  animatedGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: 'rgba(139, 92, 246, 0.5)',
    borderRightColor: 'rgba(139, 92, 246, 0.3)',
  },
  
  // 🆕 Call Section
  callSection: {
    marginBottom: 14,
    alignItems: 'center',
  },
  mainCallButton: {
    width: SCREEN_WIDTH - 48,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  callButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mainCallButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // 🆕 Chat Button
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 14,
  },
  chatIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  // 🆕 Action Buttons
  actionButtons: { 
    flexDirection: 'row', 
    gap: 12,
  },
  supportButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    backgroundColor: '#F3F4F6', 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
  },
  supportButtonText: { 
    fontSize: 14, 
    fontWeight: '500', 
    marginLeft: 6, 
    color: '#6B7280',
  },
  endButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12, 
    backgroundColor: '#9CA3AF', // Donuk kırmızı yerine gri - Donuk görünüm
    borderRadius: 12,
    opacity: 0.8,
  },
  endButtonText: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginLeft: 6, 
    color: '#FFF',
  },
});
