/**
 * PassengerWaitingScreen - Premium Yolcu Bekleme Ekranı
 * 
 * Özellikler:
 * - 20 km çevredeki sürücüleri haritada gösterir
 * - Zonklama/sinyal efekti ile 20 km yarıçap
 * - Sakin bilgilendirme metni (gerçek dispatch süresi sunucuda)
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
  ScrollView,
  BackHandler,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getPassengerMarkerImage, getDriverMarkerImage } from '../lib/mapNavMarkers';
import { isNativeGoogleMapsSupported } from '../lib/nativeGoogleMaps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

import { API_BASE_URL } from '../lib/backendConfig';
import { callCheck } from '../lib/callCheck';
import { displayFirstName } from '../lib/displayName';
import { useLeylekZekaChrome } from '../contexts/LeylekZekaChromeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = API_BASE_URL;

/** Android: Marker içi Image bazen collapsable yüzünden 0×0 kalır — DriverOfferScreen ile aynı sarmalayıcı. */
function MarkerPinWrap({ children }: { children: React.ReactNode }) {
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </View>
  );
}

function parseMarkerCoord(
  lat: unknown,
  lng: unknown,
): { latitude: number; longitude: number } | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/** Bekleme haritası: MARKER_PIXEL ile aynı hedef boyutlar (harita ölçeği). */
const WAIT_MAP_PIN = {
  passenger: 30,
  car: 32,
  motor: 28,
} as const;

export interface NearbyDriver {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating?: number;
  vehicle?: string;
  distance_km?: number;
  vehicle_kind?: 'car' | 'motorcycle';
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
  /** Geri — rol seçimine; yapay zeka girişi yalnızca üst sağdaki Leylek Zeka satırı */
  onPressBack?: () => void;
  onMatch: (driverData: any) => void;
  /** Yolcu araç/motor tercihi — yakındaki sürücü sayısı dispatch ile aynı filtreyi kullanır */
  passengerVehicleKind?: 'car' | 'motorcycle';
  /** Harita: yolcu kendi pini (kadın/erkek PNG) */
  passengerGender?: 'female' | 'male' | null;
  selfUserId?: string | null;
}

export default function PassengerWaitingScreen({
  userLocation,
  destinationLocation,
  pickupAddress,
  dropoffAddress,
  tagId,
  offeredPrice,
  onCancel,
  onPressBack,
  onMatch,
  passengerVehicleKind = 'car',
  passengerGender = null,
  selfUserId = null,
}: Props) {
  const insets = useSafeAreaInsets();
  const { setLeylekZekaChatOpen } = useLeylekZekaChrome();
  const openMatchScreenAi = () => {
    console.log('[PAX_DEBUG] PassengerWaitingScreen openMatchScreenAi');
    callCheck('Haptics.impactAsync', Haptics?.impactAsync);
    if (Platform.OS !== 'web') {
      try {
        const impact = Haptics?.impactAsync;
        if (typeof impact === 'function') {
          void impact(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch {
        /* ignore */
      }
    }
    callCheck('setLeylekZekaChatOpen', setLeylekZekaChatOpen);
    if (typeof setLeylekZekaChatOpen === 'function') {
      setLeylekZekaChatOpen(true);
    }
  };

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [nearbyDriverCount, setNearbyDriverCount] = useState(0);
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatus>({
    current_driver_index: 0,
    total_drivers: 0,
    timeout_remaining: 10,
    status: 'searching',
  });
  const [selectedDriver, setSelectedDriver] = useState<NearbyDriver | null>(null);
  const [showDriverProfile, setShowDriverProfile] = useState(false);
  
  const mapRef = useRef<any>(null);
  const dotScale = useRef(new Animated.Value(1)).current;
  /** Android: özel marker görünümü ilk karede çizilsin */
  const [waitingMapTracks, setWaitingMapTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setWaitingMapTracks(false), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onPressBack) {
        onPressBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onPressBack]);

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
        const vk = encodeURIComponent(passengerVehicleKind);
        const response = await fetch(
          `${API_URL}/driver/nearby-activity?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=20&passenger_vehicle_kind=${vk}`
        );
        const data = await response.json();
        
        if (data.success) {
          setNearbyDriverCount(data.nearby_driver_count || 0);
          
          // Sürücü konumlarını al
          const driversResponse = await fetch(
            `${API_URL}/drivers/nearby?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=20&passenger_vehicle_kind=${vk}`
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
  }, [userLocation, passengerVehicleKind]);
  
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
        }
      } catch (error) {
        // Sessizce geç
      }
    };
    
    checkDispatch();
    const interval = setInterval(checkDispatch, 2000);
    return () => clearInterval(interval);
  }, [tagId]);
  
  // Paylaş
  const handleShare = async () => {
    console.log('[PAX_DEBUG] PassengerWaitingScreen handleShare');
    try {
      callCheck('Share.share', Share.share);
      if (typeof Share.share !== 'function') return;
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
    if (dispatchStatus.total_drivers === 0 && nearbyDriverCount > 0) {
      return `${nearbyDriverCount} sürücü yakında; talep türünüze uygun sıra oluşunca teklif gidecek`;
    }
    if (dispatchStatus.total_drivers > 0) {
      return `Kuyrukta ${dispatchStatus.total_drivers} uygun sürücü`;
    }
    return `${nearbyDriverCount} sürücü 20 km içinde`;
  };

  const destinationMarkerCoord = destinationLocation
    ? parseMarkerCoord(destinationLocation.latitude, destinationLocation.longitude)
    : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#EFF6FF', '#DBEAFE', '#E0F2FE']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        style={styles.waitingScroll}
        contentContainerStyle={styles.waitingScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (onPressBack ? onPressBack() : onCancel())}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Ionicons name="chevron-back" size={28} color="#3FA9F5" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Eşleşme Aranıyor</Text>
          <Text style={styles.headerSubtitle}>Teklif bekleniyor</Text>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>₺{offeredPrice}</Text>
          </View>
        </View>
        
        <View style={styles.headerRightCluster}>
          <TouchableOpacity
            onPress={openMatchScreenAi}
            style={styles.headerAiPill}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Leylek Zeka — yapay zeka desteği"
          >
            <LinearGradient
              colors={['#22D3EE', '#3FA9F5', '#6366F1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerAiPillGradient}
            >
              <Ionicons name="sparkles" size={18} color="#FFF" />
              <Text style={styles.headerAiPillText} numberOfLines={1}>
                Leylek Zeka
              </Text>
            </LinearGradient>
            <View style={styles.headerAiBadge} pointerEvents="none">
              <Text style={styles.headerAiBadgeText}>AI</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton} accessibilityRole="button" accessibilityLabel="Teklifi iptal et">
            <Ionicons name="close" size={28} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Harita — GMS yoksa MapView mount edilmez (Huawei çökme önlemi) */}
      <View style={styles.mapContainer}>
        {MapView && userLocation && isNativeGoogleMapsSupported() ? (
          <MapView
            ref={mapRef}
            style={[styles.map, { zIndex: 2 }]}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.22,
              longitudeDelta: 0.22,
            }}
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
            
            {/* Yolcu — kadın/erkek PNG (sürücü ekranındaki yolcu pini ile aynı kaynak) */}
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 1 }}
              flat={false}
              tracksViewChanges={waitingMapTracks}
              zIndex={5000}
            >
              <MarkerPinWrap>
                <Image
                  source={getPassengerMarkerImage(passengerGender ?? null, selfUserId)}
                  style={{
                    width: WAIT_MAP_PIN.passenger,
                    height: WAIT_MAP_PIN.passenger,
                  }}
                  resizeMode="contain"
                />
              </MarkerPinWrap>
            </Marker>
            
            {/* Hedef konumu */}
            {destinationMarkerCoord ? (
              <Marker
                coordinate={destinationMarkerCoord}
                zIndex={4500}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={waitingMapTracks}
              >
                <MarkerPinWrap>
                  <View style={styles.destinationMarker}>
                    <Ionicons name="flag" size={13} color="#fff" />
                  </View>
                </MarkerPinWrap>
              </Marker>
            ) : null}
            
            {/* Yakındaki sürücüler — araç/motor PNG (repo’da car+motor seti; cinsiyet ayrı asset yok) */}
            {nearbyDrivers.map((driver, index) => {
              const coord = parseMarkerCoord(driver.latitude, driver.longitude);
              if (!coord) return null;
              const isM = driver.vehicle_kind === 'motorcycle';
              const src = getDriverMarkerImage(isM ? 'motorcycle' : 'car');
              const px = isM ? WAIT_MAP_PIN.motor : WAIT_MAP_PIN.car;
              return (
                <Marker
                  key={driver.id || String(index)}
                  coordinate={coord}
                  onPress={() => handleDriverPress(driver)}
                  anchor={{ x: 0.5, y: 1 }}
                  flat={false}
                  tracksViewChanges={waitingMapTracks}
                  zIndex={4000 + (index % 40)}
                >
                  <MarkerPinWrap>
                    <Image source={src} style={{ width: px, height: px }} resizeMode="contain" />
                  </MarkerPinWrap>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={48} color="#60a5fa" />
            <Text style={styles.mapPlaceholderText}>
              {userLocation && !isNativeGoogleMapsSupported()
                ? 'Bu cihazda harita kapalı; eşleşme ve sürücü listesi normal çalışır.'
                : 'Harita yükleniyor...'}
            </Text>
            {userLocation && !isNativeGoogleMapsSupported() && nearbyDrivers.length > 0 ? (
              <Text style={styles.mapPlaceholderSub}>
                {nearbyDrivers.length} sürücü yakınınızda
              </Text>
            ) : null}
          </View>
        )}
        {/* Tek AI girişi: üst sağdaki Leylek Zeka — harita üzerinde ek FAB yok */}
        
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
          <Ionicons name="share-outline" size={18} color="#2563EB" />
          <Text style={styles.shareButtonText}>Paylaş</Text>
        </TouchableOpacity>
      </View>
      
      {/* Durum Paneli */}
      <View style={styles.statusPanel}>
        <View style={styles.calmWaitingBlock}>
          <Text style={styles.calmWaitingLine}>
            Şehir içi yol paylaşımı teklifiniz sürücüler tarafından değerlendiriliyor.
          </Text>
          <Text style={styles.calmWaitingLineMuted}>Eşleşme sağlanıyor, lütfen bekleyin.</Text>
        </View>

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
      </ScrollView>

      <View
        style={[
          styles.cancelTagFooter,
          { paddingBottom: Math.max(insets.bottom, 12) + 6 },
        ]}
      >
        <TouchableOpacity style={styles.cancelTagButton} onPress={onCancel} activeOpacity={0.88}>
          <Text style={styles.cancelTagButtonText}>Teklifi İptal Et</Text>
        </TouchableOpacity>
      </View>
      
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
                <Text style={styles.driverName}>{displayFirstName(selectedDriver.name, 'Sürücü')}</Text>
                
                <View style={styles.driverRating}>
                  <Ionicons name="star" size={18} color="#fbbf24" />
                  <Text style={styles.driverRatingText}>
                    {(selectedDriver.rating != null && selectedDriver.rating > 0
                      ? selectedDriver.rating
                      : 4
                    ).toFixed(1)}
                  </Text>
                </View>
                
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
    backgroundColor: '#F0F9FF',
  },
  waitingScroll: {
    flex: 1,
    minHeight: 0,
  },
  waitingScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  cancelTagFooter: {
    paddingHorizontal: 16,
    paddingTop: 4,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(63, 169, 245, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  priceTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 6,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAiPill: {
    maxWidth: 172,
    borderRadius: 22,
    overflow: 'visible',
  },
  headerAiPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 8,
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  headerAiPillText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  headerAiBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 24,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F0ABFC',
    borderWidth: 1.5,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAiBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4C1D95',
  },
  
  // Harita
  mapContainer: {
    height: SCREEN_HEIGHT * 0.38,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.25)',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },
  mapPlaceholderText: {
    color: '#3FA9F5',
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mapPlaceholderSub: {
    color: '#64748B',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
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
    borderColor: 'rgba(63, 169, 245, 0.65)',
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
    width: 26,
    height: 26,
    borderRadius: 13,
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
    zIndex: 40,
    elevation: 14,
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
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.2)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
    color: '#1E293B',
    fontWeight: '600',
    marginLeft: 12,
  },
  locationDivider: {
    paddingLeft: 12,
    paddingVertical: 8,
  },
  dividerLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.45)',
    marginLeft: 5,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(63, 169, 245, 0.12)',
    borderRadius: 10,
    gap: 6,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  
  // Durum Paneli
  statusPanel: {
    marginHorizontal: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  calmWaitingBlock: {
    marginBottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  calmWaitingLine: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 22,
  },
  calmWaitingLineMuted: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: '#3FA9F5',
  },
  loadingDotDelay1: {
    opacity: 0.6,
  },
  loadingDotDelay2: {
    opacity: 0.3,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
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
    fontWeight: '700',
    color: '#C2410C',
  },
  
  // İptal Butonu
  cancelTagButton: {
    paddingVertical: 14,
    backgroundColor: 'rgba(254, 226, 226, 0.98)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
  },
  cancelTagButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
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
