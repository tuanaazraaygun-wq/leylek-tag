/**
 * PassengerWaitingScreen - Premium Yolcu Bekleme Ekranı
 * 
 * Özellikler:
 * - 20 km çevredeki sürücüleri haritada gösterir
 * - Zonklama/sinyal efekti ile 20 km yarıçap
 * - Geri sayım (10, 9, 8...)
 * - Dispatch durumu (kaç kişiye teklif gösterildi)
 * - Premium tasarım
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
  Animated,
  Share,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// react-native-maps
let MapView: any = null;
let Marker: any = null;
let Circle: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Circle = Maps.Circle;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('⚠️ react-native-maps yüklenemedi:', e);
  }
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.leylektag.com';
const API_URL = `${BACKEND_URL}/api`;

export interface NearbyDriver {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating?: number;
  vehicle?: string;
  distance_km?: number;
}

interface DispatchStatus {
  current_driver_index: number;
  total_drivers: number;
  timeout_remaining: number;
  status: 'searching' | 'offering' | 'matched' | 'no_drivers';
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  destinationLocation: { latitude: number; longitude: number } | null;
  pickupAddress: string;
  dropoffAddress: string;
  tagId: string;
  offeredPrice: number;
  onCancel: () => void;
  onMatch: (driverData: any) => void;
}

// Koyu harita stili
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function PassengerWaitingScreen({
  userLocation,
  destinationLocation,
  pickupAddress,
  dropoffAddress,
  tagId,
  offeredPrice,
  onCancel,
  onMatch,
}: Props) {
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [nearbyDriverCount, setNearbyDriverCount] = useState(0);
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatus>({
    current_driver_index: 0,
    total_drivers: 0,
    timeout_remaining: 10,
    status: 'searching',
  });
  const [countdown, setCountdown] = useState(10);
  const [selectedDriver, setSelectedDriver] = useState<NearbyDriver | null>(null);
  const [showDriverProfile, setShowDriverProfile] = useState(false);
  
  const mapRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const dotScale = useRef(new Animated.Value(1)).current;
  
  // Zonklama animasyonu
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);
  
  // Nokta animasyonu
  useEffect(() => {
    const dotPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    dotPulse.start();
    return () => dotPulse.stop();
  }, []);
  
  // Yakındaki sürücüleri yükle
  useEffect(() => {
    if (!userLocation) return;
    
    const loadNearbyDrivers = async () => {
      try {
        const response = await fetch(
          `${API_URL}/driver/nearby-activity?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=20`
        );
        const data = await response.json();
        
        if (data.success) {
          setNearbyDriverCount(data.nearby_driver_count || 0);
          
          // Sürücü konumlarını al
          const driversResponse = await fetch(
            `${API_URL}/drivers/nearby?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=20`
          );
          const driversData = await driversResponse.json();
          
          if (driversData.drivers) {
            setNearbyDrivers(driversData.drivers);
          }
        }
      } catch (error) {
        console.log('Nearby drivers error:', error);
      }
    };
    
    loadNearbyDrivers();
    const interval = setInterval(loadNearbyDrivers, 5000);
    return () => clearInterval(interval);
  }, [userLocation]);
  
  // Dispatch durumunu kontrol et
  useEffect(() => {
    if (!tagId) return;
    
    const checkDispatch = async () => {
      try {
        const response = await fetch(`${API_URL}/dispatch/queue/${tagId}`);
        const data = await response.json();
        
        if (data.success) {
          setDispatchStatus({
            current_driver_index: data.current_index || 0,
            total_drivers: data.total_drivers || 0,
            timeout_remaining: data.timeout_remaining || 10,
            status: data.status || 'searching',
          });
          setCountdown(data.timeout_remaining || 10);
        }
      } catch (error) {
        // Sessizce geç
      }
    };
    
    checkDispatch();
    const interval = setInterval(checkDispatch, 2000);
    return () => clearInterval(interval);
  }, [tagId]);
  
  // Geri sayım
  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [dispatchStatus.current_driver_index]);
  
  // Paylaş
  const handleShare = async () => {
    try {
      await Share.share({
        message: `LeylekTag ile yolculuk arıyorum!\n\n📍 ${pickupAddress}\n📍 ${dropoffAddress}\n💰 ${offeredPrice} TL`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };
  
  // Sürücü profili göster
  const handleDriverPress = (driver: NearbyDriver) => {
    setSelectedDriver(driver);
    setShowDriverProfile(true);
  };
  
  // Durum mesajı
  const getStatusMessage = () => {
    if (dispatchStatus.status === 'matched') {
      return 'Eşleşme sağlandı!';
    }
    if (dispatchStatus.total_drivers === 0) {
      return 'Yakındaki sürücüler aranıyor...';
    }
    if (dispatchStatus.current_driver_index > 0) {
      return `${dispatchStatus.current_driver_index}. sürücüye teklif gösterildi`;
    }
    return 'Eşleşme sağlanıyor, lütfen bekleyin...';
  };
  
  // Alt durum mesajı
  const getSubStatusMessage = () => {
    if (dispatchStatus.status === 'matched') {
      return 'Sürücünüz yola çıkıyor';
    }
    if (dispatchStatus.current_driver_index > 0 && countdown > 0) {
      return `Yanıt bekleniyor... ${countdown} saniye`;
    }
    if (dispatchStatus.current_driver_index > 0 && countdown === 0) {
      return 'Sonraki sürücüye geçiliyor...';
    }
    return `${nearbyDriverCount} sürücü 20 km içinde`;
  };

  return (
    <View style={styles.container}>
      {/* Gradient Arka Plan */}
      <LinearGradient
        colors={['#0a1628', '#1a365d', '#2d4a6f']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#60a5fa" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Eşleşme Aranıyor</Text>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>₺{offeredPrice}</Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Ionicons name="close" size={28} color="#ef4444" />
        </TouchableOpacity>
      </View>
      
      {/* Harita */}
      <View style={styles.mapContainer}>
        {MapView && userLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.15,
              longitudeDelta: 0.15,
            }}
            customMapStyle={darkMapStyle}
            showsUserLocation={false}
            showsCompass={false}
            showsScale={false}
            pitchEnabled={true}
            rotateEnabled={true}
          >
            {/* 20 km Yarıçap - Dış çember */}
            <Circle
              center={userLocation}
              radius={20000}
              strokeColor="rgba(96, 165, 250, 0.4)"
              fillColor="rgba(96, 165, 250, 0.08)"
              strokeWidth={2}
            />
            
            {/* 10 km Yarıçap - İç çember */}
            <Circle
              center={userLocation}
              radius={10000}
              strokeColor="rgba(96, 165, 250, 0.6)"
              fillColor="rgba(96, 165, 250, 0.12)"
              strokeWidth={1}
            />
            
            {/* Kullanıcı konumu */}
            <Marker coordinate={userLocation}>
              <View style={styles.userMarker}>
                <View style={styles.userMarkerInner}>
                  <Ionicons name="person" size={16} color="#fff" />
                </View>
              </View>
            </Marker>
            
            {/* Hedef konumu */}
            {destinationLocation && (
              <Marker coordinate={destinationLocation}>
                <View style={styles.destinationMarker}>
                  <Ionicons name="flag" size={18} color="#fff" />
                </View>
              </Marker>
            )}
            
            {/* Yakındaki sürücüler */}
            {nearbyDrivers.map((driver, index) => (
              <Marker
                key={driver.id || index}
                coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                onPress={() => handleDriverPress(driver)}
              >
                <TouchableOpacity style={styles.driverMarker}>
                  <Ionicons name="car-sport" size={18} color="#fff" />
                </TouchableOpacity>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={48} color="#60a5fa" />
            <Text style={styles.mapPlaceholderText}>Harita yükleniyor...</Text>
          </View>
        )}
        
        {/* Zonklama Efekti Overlay */}
        <View style={styles.pulseOverlay} pointerEvents="none">
          <Animated.View
            style={[
              styles.pulseCircle,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseOpacity,
              },
            ]}
          />
        </View>
        
        {/* Sürücü Sayısı Badge */}
        <View style={styles.driverCountBadge}>
          <Ionicons name="car" size={20} color="#fff" />
          <Text style={styles.driverCountText}>{nearbyDriverCount}</Text>
          <Text style={styles.driverCountLabel}>sürücü</Text>
        </View>
      </View>
      
      {/* Konum Bilgisi Kartı */}
      <View style={styles.locationCard}>
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: '#60a5fa' }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {pickupAddress || 'Alış noktası'}
          </Text>
        </View>
        
        <View style={styles.locationDivider}>
          <View style={styles.dividerLine} />
        </View>
        
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: '#ef4444' }]} />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {dropoffAddress || 'Varış noktası'}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color="#60a5fa" />
          <Text style={styles.shareButtonText}>Paylaş</Text>
        </TouchableOpacity>
      </View>
      
      {/* Durum Paneli */}
      <View style={styles.statusPanel}>
        {/* Geri Sayım */}
        {dispatchStatus.current_driver_index > 0 && countdown > 0 && (
          <View style={styles.countdownContainer}>
            <Animated.View style={[styles.countdownCircle, { transform: [{ scale: dotScale }] }]}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
            </Animated.View>
          </View>
        )}
        
        {/* Loading Animasyonu */}
        {dispatchStatus.current_driver_index === 0 && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.loadingDot, { transform: [{ scale: dotScale }] }]} />
              <Animated.View style={[styles.loadingDot, styles.loadingDotDelay1]} />
              <Animated.View style={[styles.loadingDot, styles.loadingDotDelay2]} />
            </View>
          </View>
        )}
        
        {/* Durum Mesajları */}
        <Text style={styles.statusTitle}>{getStatusMessage()}</Text>
        <Text style={styles.statusSubtitle}>{getSubStatusMessage()}</Text>
        
        {/* Teklif Gösterilen Kişi Sayısı */}
        {dispatchStatus.current_driver_index > 0 && (
          <View style={styles.dispatchInfo}>
            <View style={styles.dispatchBadge}>
              <Ionicons name="people" size={14} color="#fff" />
              <Text style={styles.dispatchBadgeText}>
                {dispatchStatus.current_driver_index} / {dispatchStatus.total_drivers} sürücüye gösterildi
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {/* İptal Butonu */}
      <TouchableOpacity style={styles.cancelTagButton} onPress={onCancel}>
        <Text style={styles.cancelTagButtonText}>Teklifi İptal Et</Text>
      </TouchableOpacity>
      
      {/* Sürücü Profil Modal */}
      <Modal
        visible={showDriverProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDriverProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.driverProfileModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sürücü Profili</Text>
              <TouchableOpacity onPress={() => setShowDriverProfile(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedDriver && (
              <View style={styles.driverProfileContent}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={40} color="#fff" />
                </View>
                <Text style={styles.driverName}>{selectedDriver.name || 'Sürücü'}</Text>
                
                {selectedDriver.rating && (
                  <View style={styles.driverRating}>
                    <Ionicons name="star" size={18} color="#fbbf24" />
                    <Text style={styles.driverRatingText}>{selectedDriver.rating.toFixed(1)}</Text>
                  </View>
                )}
                
                {selectedDriver.vehicle && (
                  <Text style={styles.driverVehicle}>{selectedDriver.vehicle}</Text>
                )}
                
                {selectedDriver.distance_km && (
                  <Text style={styles.driverDistance}>
                    {selectedDriver.distance_km.toFixed(1)} km uzaklıkta
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  priceTag: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Harita
  mapContainer: {
    height: SCREEN_HEIGHT * 0.38,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
  },
  mapPlaceholderText: {
    color: '#60a5fa',
    marginTop: 8,
  },
  
  // Zonklama
  pulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#60a5fa',
    backgroundColor: 'transparent',
  },
  
  // Marker'lar
  userMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(96, 165, 250, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  destinationMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  
  // Sürücü Sayısı
  driverCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  driverCountText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  driverCountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  
  // Konum Kartı
  locationCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    marginLeft: 12,
  },
  locationDivider: {
    paddingLeft: 12,
    paddingVertical: 8,
  },
  dividerLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginLeft: 5,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderRadius: 10,
    gap: 6,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  
  // Durum Paneli
  statusPanel: {
    marginHorizontal: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  countdownContainer: {
    marginBottom: 16,
  },
  countdownCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    borderWidth: 3,
    borderColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#60a5fa',
  },
  loadingContainer: {
    marginBottom: 16,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#60a5fa',
  },
  loadingDotDelay1: {
    opacity: 0.6,
  },
  loadingDotDelay2: {
    opacity: 0.3,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 6,
    textAlign: 'center',
  },
  dispatchInfo: {
    marginTop: 12,
  },
  dispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  dispatchBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  
  // İptal Butonu
  cancelTagButton: {
    marginHorizontal: 16,
    marginTop: 'auto',
    marginBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  cancelTagButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  driverProfileModal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  driverProfileContent: {
    alignItems: 'center',
  },
  driverAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  driverRatingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fbbf24',
  },
  driverVehicle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  driverDistance: {
    fontSize: 14,
    color: '#60a5fa',
    marginTop: 4,
  },
});
