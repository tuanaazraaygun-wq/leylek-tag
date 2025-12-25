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
  onAutoComplete?: () => void; // Hedefe yaklaşınca otomatik bitirme
}

// OpenRouteService API Key
const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjQwM2JjMWQ2MDVlYjQyOTc5MzExNzg3NmRhMmU2NDViIiwiaCI6Im11cm11cjY0In0=';

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

  // OpenRouteService'den rota al
  const fetchRoute = async (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ): Promise<{ coordinates: {latitude: number, longitude: number}[], distance: number, duration: number } | null> => {
    try {
      const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': OPENROUTE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coordinates: [
            [start.longitude, start.latitude],
            [end.longitude, end.latitude]
          ]
        })
      });
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const route = data.features[0];
        const props = route.properties;
        const coords = route.geometry.coordinates;
        
        const points = coords.map((c: number[]) => ({
          latitude: c[1],
          longitude: c[0]
        }));
        
        const distKm = (props.summary?.distance || 0) / 1000;
        const durMin = Math.round((props.summary?.duration || 0) / 60);
        
        return { coordinates: points, distance: distKm, duration: durMin };
      }
    } catch (error) {
      console.log('OpenRouteService hatası:', error);
    }
    return null;
  };

  // YEŞİL ROTA: Şoför → Yolcu
  useEffect(() => {
    if (!userLocation || !otherLocation) return;
    
    const updateMeetingRoute = async () => {
      let start, end;
      if (isDriver) {
        start = userLocation; // Şoför
        end = otherLocation;   // Yolcu
      } else {
        start = otherLocation; // Şoför
        end = userLocation;    // Yolcu
      }
      
      const result = await fetchRoute(start, end);
      if (result) {
        setMeetingRoute(result.coordinates);
        setMeetingDistance(result.distance);
        setMeetingDuration(result.duration);
        console.log('✅ Buluşma rotası:', result.distance.toFixed(1), 'km,', result.duration, 'dk');
      } else {
        // Fallback: Düz çizgi
        setMeetingRoute([start, end]);
        const dist = calculateDistance(start.latitude, start.longitude, end.latitude, end.longitude);
        setMeetingDistance(dist * 1.3);
        setMeetingDuration(Math.round((dist * 1.3 / 40) * 60));
      }
    };
    
    updateMeetingRoute();
    const interval = setInterval(updateMeetingRoute, 30000); // 30 saniyede bir güncelle
    return () => clearInterval(interval);
  }, [userLocation?.latitude, userLocation?.longitude, otherLocation?.latitude, otherLocation?.longitude, isDriver]);

  // TURUNCU ROTA: Yolcu → Hedef
  useEffect(() => {
    if (!userLocation || !destinationLocation) return;
    
    const updateDestinationRoute = async () => {
      // Yolcunun konumundan hedefe
      const passengerLocation = isDriver ? otherLocation : userLocation;
      if (!passengerLocation) return;
      
      const result = await fetchRoute(passengerLocation, destinationLocation);
      if (result) {
        setDestinationRoute(result.coordinates);
        setDestinationDistance(result.distance);
        setDestinationDuration(result.duration);
        console.log('✅ Hedef rotası:', result.distance.toFixed(1), 'km,', result.duration, 'dk');
        
        // 1 km'den az mı kontrol et
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
      } else {
        // Fallback
        setDestinationRoute([passengerLocation, destinationLocation]);
        const dist = calculateDistance(
          passengerLocation.latitude, passengerLocation.longitude,
          destinationLocation.latitude, destinationLocation.longitude
        );
        setDestinationDistance(dist * 1.3);
        setDestinationDuration(Math.round((dist * 1.3 / 40) * 60));
      }
    };
    
    updateDestinationRoute();
    const interval = setInterval(updateDestinationRoute, 30000);
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
            strokeWidth={5}
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
              <Text style={styles.routeLabel}>Buluşma</Text>
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
                <Text style={styles.routeLabel}>Hedefe</Text>
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
          {/* Navigasyon Butonu */}
          <TouchableOpacity style={styles.navButton} onPress={openNavigation}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.navButtonGradient}>
              <Ionicons name="navigate" size={24} color="#FFF" />
              <Text style={styles.navButtonText}>Navigasyon</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Arama Butonları */}
          <View style={styles.callButtons}>
            <TouchableOpacity style={styles.callButton} onPress={() => onCall?.('audio')}>
              <Ionicons name="call" size={22} color="#22C55E" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton} onPress={() => onCall?.('video')}>
              <Ionicons name="videocam" size={22} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {/* Diğer Butonlar */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={() => {
              Alert.prompt(
                'Şikayet',
                'Lütfen şikayet sebebinizi yazın:',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Gönder', onPress: (text) => text && onReport?.() }
                ],
                'plain-text'
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
                  { text: 'Onay İste', onPress: () => onRequestTripEnd?.() },
                  { text: 'Tamamla', onPress: () => onComplete?.(), style: 'destructive' }
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

// Harita stili
const mapStyle = [
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
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
  markerCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  myCircle: { backgroundColor: '#3B82F6' },
  driverCircle: { backgroundColor: '#22C55E' },
  passengerCircle: { backgroundColor: '#8B5CF6' },
  markerIcon: { fontSize: 20 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  myArrow: { borderTopColor: '#3B82F6' },
  driverArrow: { borderTopColor: '#22C55E' },
  passengerArrow: { borderTopColor: '#8B5CF6' },
  
  // Destination Marker
  destinationMarker: { alignItems: 'center' },
  destinationCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  destinationIcon: { fontSize: 24 },
  destinationLabel: { marginTop: 4, fontSize: 11, fontWeight: 'bold', color: '#F97316', backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  
  // Top Info Panel
  topInfoPanel: { position: 'absolute', top: 0, left: 0, right: 0 },
  infoGradient: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  routeInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  routeIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  routeDetails: { flex: 1 },
  routeLabel: { fontSize: 12, color: '#666' },
  routeValue: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  nearBadge: { backgroundColor: '#F97316', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  nearBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 20, fontWeight: 'bold', color: '#22C55E' },
  
  // Bottom Panel
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomGradient: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  navButton: { marginBottom: 12 },
  navButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  navButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  callButtons: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
  callButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 10 },
  actionButtonText: { fontSize: 14, fontWeight: '500', marginLeft: 6, color: '#374151' },
  endButton: { backgroundColor: '#22C55E' },
});
