/**
 * PassengerWaitingScreen - Premium Yolcu Bekleme Ekranı
 * 
 * Özellikler:
 * - 10 km çevredeki çevrimiçi sürücüleri haritada gösterir (dekoratif; rozet dispatch kuyruğundan)
 * - Zonklama/sinyal efekti ile 10 km yarıçap
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
  ScrollView,
  BackHandler,
} from 'react-native';
import { getPassengerMarkerImage, getDriverMarkerImage } from '../lib/mapNavMarkers';
import { MapDestinationFlagPin, MapEntityMarkerImage } from '../lib/mapMarkerChrome';
import { isNativeGoogleMapsSupported } from '../lib/nativeGoogleMaps';
import { Ionicons } from '@expo/vector-icons';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_ROLE_CARD_BORDER,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from './auth/premiumAuthStyles';
import { CockpitBackground, GlassSurface, PremiumText } from '../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../design-system/tokens/border';
import { LDS_ELEVATION } from '../design-system/tokens/elevation';
import { LDS_RADIUS } from '../design-system/tokens/radius';
import { LDS_SPACING, ldsSnapSpacing } from '../design-system/tokens/spacing';
import { LDS_TYPOGRAPHY } from '../design-system/tokens/typography';
import { API_BASE_URL } from '../lib/backendConfig';
import { callCheck } from '../lib/callCheck';
import { displayFirstName } from '../lib/displayName';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const WAIT_NAV_ACTION_SIZE = LDS_SPACING.xxl + LDS_SPACING.xs;
const WAIT_MAP_STAGE_HEIGHT = ldsSnapSpacing(SCREEN_HEIGHT * 0.38);

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

/** Bekleme haritası — yolcu ekranı fetch yarıçapı (backend dispatch radius ayrı). */
const WAIT_MAP_RADIUS_KM = 10;
const WAIT_MAP_MAX_DRIVER_MARKERS = 15;
const WAIT_MAP_DRIVER_MARKER_OPACITY = 0.55;

/** Bekleme haritası: MARKER_PIXEL ile aynı hedef boyutlar (harita ölçeği). */
const WAIT_MAP_PIN = {
  passenger: 30,
  car: 22,
  motor: 20,
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
  selfUserId = null,
}: Props) {
  const insets = useSafeAreaInsets();

  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
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
        const driversResponse = await fetch(
          `${API_URL}/drivers/nearby?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=${WAIT_MAP_RADIUS_KM}&passenger_vehicle_kind=${vk}`
        );
        const driversData = await driversResponse.json();

        if (driversData.drivers) {
          const wantM = passengerVehicleKind === 'motorcycle';
          setNearbyDrivers(
            driversData.drivers.filter((driver: NearbyDriver) => {
              const kind = String(driver.vehicle_kind ?? 'car').trim().toLowerCase();
              const isM = kind === 'motorcycle' || kind === 'motor';
              return wantM ? isM : !isM;
            }),
          );
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
  
  const dispatchEligibleCount = dispatchStatus.total_drivers;
  const isDispatchEligibleSearching =
    dispatchEligibleCount === 0 || dispatchStatus.status === 'no_drivers';
  const mapDriverMarkers = nearbyDrivers.slice(0, WAIT_MAP_MAX_DRIVER_MARKERS);

  // Durum mesajı
  const getStatusMessage = () => {
    if (dispatchStatus.status === 'matched') {
      return 'Eşleşme sağlandı!';
    }
    if (dispatchEligibleCount > 0) {
      return `Kuyrukta ${dispatchEligibleCount} uygun sürücü var. Teklifiniz sırayla iletiliyor.`;
    }
    return 'Uygun sürücü aranıyor. Çevredeki sürücüler mesafe ve uygunluk durumuna göre değerlendiriliyor.';
  };
  
  // Alt durum mesajı
  const getSubStatusMessage = () => {
    if (dispatchStatus.status === 'matched') {
      return 'Sürücünüz yola çıkıyor';
    }
    if (dispatchStatus.current_driver_index > 0 && dispatchEligibleCount > 0) {
      return `${dispatchStatus.current_driver_index}. sürücüye teklif gösterildi`;
    }
    if (isDispatchEligibleSearching) {
      return 'Bölgedeki çevrimiçi sürücüler mesafe ve uygunluk durumuna göre değerlendiriliyor.';
    }
    return 'Teklifiniz uygun sürücülere sırayla iletiliyor.';
  };

  const destinationMarkerCoord = destinationLocation
    ? parseMarkerCoord(destinationLocation.latitude, destinationLocation.longitude)
    : null;

  return (
    <View style={styles.container}>
      <CockpitBackground />

      <ScrollView
        style={styles.waitingScroll}
        contentContainerStyle={[
          styles.waitingScrollContent,
          { paddingTop: insets.top + LDS_SPACING.xs },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GlassSurface variant="panel" style={styles.waitingCockpitShell}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => (onPressBack ? onPressBack() : onCancel())}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Geri"
            >
              <Ionicons name="chevron-back" size={20} color={PREMIUM_AUTH_CYAN} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.navButtonDanger}
              accessibilityRole="button"
              accessibilityLabel="Teklifi iptal et"
            >
              <Ionicons name="close" size={20} color="rgba(248,113,113,0.92)" />
            </TouchableOpacity>
          </View>

          <View style={styles.phaseBlock}>
            <PremiumText variant="step" style={styles.phaseStep}>
              Yolculuk başladı
            </PremiumText>
            <PremiumText variant="caption" muted style={styles.phaseCaption}>
              LeylekTAG senin adına çalışıyor · eşleşme bekleniyor
            </PremiumText>
            <View style={styles.priceChip}>
              <PremiumText variant="body" style={styles.priceText}>
                ₺{offeredPrice}
              </PremiumText>
            </View>
          </View>

          <GlassSurface variant="stage" style={styles.mapChrome} borderRadius={LDS_RADIUS.lg}>
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
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
            }}
            showsUserLocation={false}
            showsCompass={false}
            showsScale={false}
            pitchEnabled={true}
            rotateEnabled={true}
          >
            {/* 10 km yarıçap — harita fetch ile uyumlu */}
            <Circle
              center={userLocation}
              radius={WAIT_MAP_RADIUS_KM * 1000}
              strokeColor="rgba(34, 211, 238, 0.45)"
              fillColor="rgba(34, 211, 238, 0.08)"
              strokeWidth={1.5}
            />
            
            {/* Yolcu konumu */}
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 1 }}
              flat={false}
              tracksViewChanges={waitingMapTracks}
              zIndex={5000}
            >
              <MarkerPinWrap>
                <MapEntityMarkerImage
                  source={getPassengerMarkerImage()}
                  size={WAIT_MAP_PIN.passenger}
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
                  <MapDestinationFlagPin compact />
                </MarkerPinWrap>
              </Marker>
            ) : null}
            
            {/* Çevrimiçi sürücüler (dekoratif; dispatch uygunluk rozette gösterilir) */}
            {mapDriverMarkers.map((driver, index) => {
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
                  <View style={{ opacity: WAIT_MAP_DRIVER_MARKER_OPACITY }}>
                    <MarkerPinWrap>
                      <MapEntityMarkerImage source={src} size={px} />
                    </MarkerPinWrap>
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map" size={48} color={PREMIUM_AUTH_CYAN} />
            <Text style={styles.mapPlaceholderText}>
              {userLocation && !isNativeGoogleMapsSupported()
                ? 'Bu cihazda harita kapalı; eşleşme ve sürücü listesi normal çalışır.'
                : 'Harita yükleniyor...'}
            </Text>
            {userLocation && !isNativeGoogleMapsSupported() ? (
              <Text style={styles.mapPlaceholderSub}>
                Uygun sürücüler mesafe ve uygunluk durumuna göre değerlendiriliyor.
              </Text>
            ) : null}
          </View>
        )}
        {/* AI: tek merkezi alt-orta LeylekZekaWidget (global) */}
        
        {/* Dispatch uygun sürücü rozeti (nearby sayısı değil) */}
        <View style={styles.driverCountBadge}>
          <Ionicons name="car" size={20} color={PREMIUM_AUTH_CYAN} />
          {dispatchEligibleCount > 0 ? (
            <>
              <Text style={styles.driverCountText}>{dispatchEligibleCount}</Text>
              <Text style={styles.driverCountLabel}>uygun sürücü</Text>
            </>
          ) : (
            <Text style={styles.driverCountSearching}>Uygun sürücü aranıyor</Text>
          )}
        </View>
      </View>
          </GlassSurface>

          <GlassSurface variant="plain" style={styles.locationCard}>
        <View style={styles.locationRow}>
          <View style={styles.locationDot}>
            <View style={[styles.dot, { backgroundColor: PREMIUM_AUTH_CYAN }]} />
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
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: 'rgba(127, 29, 29, 0.55)',
                  borderWidth: 1,
                  borderColor: 'rgba(248, 113, 113, 0.4)',
                },
              ]}
            />
          </View>
          <Text style={styles.locationText} numberOfLines={1}>
            {dropoffAddress || 'Varış noktası'}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={PREMIUM_AUTH_CYAN} />
          <Text style={styles.shareButtonText}>Paylaş</Text>
        </TouchableOpacity>
          </GlassSurface>

          <GlassSurface variant="plain" style={styles.statusPanel}>
        {dispatchStatus.current_driver_index === 0 && (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDots}>
              <Animated.View style={[styles.loadingDot, { transform: [{ scale: dotScale }] }]} />
              <Animated.View style={[styles.loadingDot, styles.loadingDotDelay1]} />
              <Animated.View style={[styles.loadingDot, styles.loadingDotDelay2]} />
            </View>
          </View>
        )}

        <PremiumText variant="body" style={styles.statusTitle}>
          {getStatusMessage()}
        </PremiumText>
        <PremiumText variant="caption" muted style={styles.statusSubtitle}>
          {getSubStatusMessage()}
        </PremiumText>

        {dispatchStatus.current_driver_index > 0 && (
          <View style={styles.dispatchInfo}>
            <View style={styles.dispatchBadge}>
              <Ionicons name="people" size={14} color={PREMIUM_AUTH_CYAN} />
              <Text style={styles.dispatchBadgeText}>
                {dispatchStatus.current_driver_index} / {dispatchStatus.total_drivers} sürücüye gösterildi
              </Text>
            </View>
          </View>
        )}
          </GlassSurface>
        </GlassSurface>
      </ScrollView>

      <View
        style={[
          styles.cancelTagFooter,
          { paddingBottom: Math.max(insets.bottom, LDS_SPACING.sm) + LDS_SPACING.xxs },
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
                <Ionicons name="close" size={24} color="rgba(186,201,222,0.82)" />
              </TouchableOpacity>
            </View>
            
            {selectedDriver && (
              <View style={styles.driverProfileContent}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={40} color="rgba(243,248,255,0.94)" />
                </View>
                <Text style={styles.driverName}>{displayFirstName(selectedDriver.name, 'Sürücü')}</Text>
                
                <View style={styles.driverRating}>
                  <Ionicons name="star" size={18} color={PREMIUM_AUTH_CYAN} />
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
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  waitingScroll: {
    flex: 1,
    minHeight: 0,
  },
  waitingScrollContent: {
    flexGrow: 1,
    paddingBottom: LDS_SPACING.xs,
    paddingHorizontal: LDS_SPACING.md,
  },
  waitingCockpitShell: {
    width: '100%',
    paddingTop: LDS_SPACING.sm,
    paddingBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.sm,
    ...LDS_ELEVATION.cockpit,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: LDS_SPACING.sm,
  },
  navButton: {
    width: WAIT_NAV_ACTION_SIZE,
    height: WAIT_NAV_ACTION_SIZE,
    borderRadius: LDS_SPACING.sm + LDS_SPACING.xxs,
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: PREMIUM_ROLE_CARD_BORDER,
  },
  navButtonDanger: {
    width: WAIT_NAV_ACTION_SIZE,
    height: WAIT_NAV_ACTION_SIZE,
    borderRadius: LDS_SPACING.sm + LDS_SPACING.xxs,
    backgroundColor: PREMIUM_ROLE_CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  phaseBlock: {
    alignItems: 'center',
    gap: LDS_SPACING.xxs,
    marginBottom: LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.xxs,
  },
  phaseStep: {
    textAlign: 'center',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  phaseCaption: {
    textAlign: 'center',
  },
  priceChip: {
    marginTop: LDS_SPACING.xxs,
    paddingHorizontal: LDS_SPACING.md,
    paddingVertical: LDS_SPACING.xxs,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
  },
  priceText: {
    fontWeight: '800',
    color: PREMIUM_AUTH_CYAN,
    letterSpacing: -0.2,
  },
  mapChrome: {
    width: '100%',
    marginBottom: LDS_SPACING.sm,
    overflow: 'hidden',
    ...LDS_ELEVATION.panel,
  },
  mapContainer: {
    height: WAIT_MAP_STAGE_HEIGHT,
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
    backgroundColor: 'rgba(6,14,26,0.72)',
    paddingHorizontal: LDS_SPACING.lg,
  },
  mapPlaceholderText: {
    color: PREMIUM_AUTH_CYAN,
    marginTop: LDS_SPACING.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapPlaceholderSub: {
    color: PREMIUM_TEXT_MUTED,
    marginTop: LDS_SPACING.xxs,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  driverCountBadge: {
    position: 'absolute',
    top: LDS_SPACING.sm,
    right: LDS_SPACING.sm,
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5,11,24,0.72)',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.full,
    gap: LDS_SPACING.xxs,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.chip,
  },
  driverCountText: {
    fontSize: 18,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
  },
  driverCountLabel: {
    ...LDS_TYPOGRAPHY.caption,
    fontWeight: '600',
    color: PREMIUM_TEXT_MUTED,
  },
  driverCountSearching: {
    ...LDS_TYPOGRAPHY.caption,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
    flexShrink: 1,
  },
  locationCard: {
    width: '100%',
    marginBottom: LDS_SPACING.sm,
    padding: LDS_SPACING.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: LDS_SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: LDS_SPACING.sm,
    height: LDS_SPACING.sm,
    borderRadius: LDS_SPACING.xs,
  },
  locationText: {
    flex: 1,
    ...LDS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: PREMIUM_TEXT_SOFT,
    marginLeft: LDS_SPACING.sm,
  },
  locationDivider: {
    paddingLeft: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
  },
  dividerLine: {
    width: LDS_BORDER_WIDTH.emphasis,
    height: LDS_SPACING.lg,
    backgroundColor: PREMIUM_BORDER_SLATE,
    marginLeft: LDS_SPACING.xxs,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.sm,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderRadius: LDS_RADIUS.md,
    gap: LDS_SPACING.xxs,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  shareButtonText: {
    ...LDS_TYPOGRAPHY.body,
    fontWeight: '700',
    color: PREMIUM_AUTH_CYAN,
  },
  statusPanel: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: LDS_SPACING.md,
    paddingHorizontal: LDS_SPACING.sm,
  },
  loadingContainer: {
    marginBottom: LDS_SPACING.sm,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: LDS_SPACING.xs,
  },
  loadingDot: {
    width: LDS_SPACING.xs,
    height: LDS_SPACING.xs,
    borderRadius: LDS_SPACING.xxs,
    backgroundColor: 'rgba(34, 211, 238, 0.72)',
  },
  loadingDotDelay1: {
    opacity: 0.5,
  },
  loadingDotDelay2: {
    opacity: 0.28,
  },
  statusTitle: {
    textAlign: 'center',
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    lineHeight: 22,
  },
  statusSubtitle: {
    textAlign: 'center',
    marginTop: LDS_SPACING.xxs,
    lineHeight: 18,
  },
  dispatchInfo: {
    marginTop: LDS_SPACING.sm,
  },
  dispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5,11,24,0.55)',
    paddingHorizontal: LDS_SPACING.sm,
    paddingVertical: LDS_SPACING.xs,
    borderRadius: LDS_RADIUS.full,
    gap: LDS_SPACING.xxs,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderLeftColor: LDS_BORDER_COLOR.cardLeftCyan,
  },
  dispatchBadgeText: {
    ...LDS_TYPOGRAPHY.caption,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  cancelTagFooter: {
    paddingHorizontal: LDS_SPACING.md,
    paddingTop: LDS_SPACING.xxs,
    backgroundColor: 'transparent',
  },
  cancelTagButton: {
    paddingVertical: LDS_SPACING.sm + LDS_SPACING.xxs,
    backgroundColor: 'rgba(5,11,24,0.55)',
    borderRadius: LDS_RADIUS.md,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    alignItems: 'center',
  },
  cancelTagButtonText: {
    ...LDS_TYPOGRAPHY.body,
    fontWeight: '700',
    color: 'rgba(252, 165, 165, 0.98)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,17,31,0.78)',
    justifyContent: 'flex-end',
  },
  driverProfileModal: {
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderTopLeftRadius: LDS_RADIUS.xl,
    borderTopRightRadius: LDS_RADIUS.xl,
    padding: LDS_SPACING.lg,
    paddingBottom: LDS_SPACING.xxxl,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: PREMIUM_BORDER_SLATE,
    borderBottomWidth: 0,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    ...LDS_ELEVATION.cockpit,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LDS_SPACING.lg,
  },
  modalTitle: {
    ...LDS_TYPOGRAPHY.title,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  driverProfileContent: {
    alignItems: 'center',
  },
  driverAvatar: {
    width: LDS_SPACING.xxxl + LDS_SPACING.xxl,
    height: LDS_SPACING.xxxl + LDS_SPACING.xxl,
    borderRadius: LDS_RADIUS.full,
    backgroundColor: 'rgba(8, 17, 31, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: LDS_SPACING.sm,
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: PREMIUM_BORDER_SLATE,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
  },
  driverName: {
    ...LDS_TYPOGRAPHY.title,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: LDS_SPACING.xs,
    gap: LDS_SPACING.xxs,
  },
  driverRatingText: {
    ...LDS_TYPOGRAPHY.body,
    fontWeight: '600',
    color: PREMIUM_AUTH_CYAN,
  },
  driverVehicle: {
    ...LDS_TYPOGRAPHY.caption,
    color: PREMIUM_TEXT_MUTED,
    marginTop: LDS_SPACING.xs,
  },
  driverDistance: {
    ...LDS_TYPOGRAPHY.caption,
    color: PREMIUM_AUTH_CYAN,
    marginTop: LDS_SPACING.xxs,
  },
});
