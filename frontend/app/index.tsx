import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, FlatList, Platform, Dimensions, Animated, Image, Linking, PermissionsAndroid, ImageBackground, Share, AppState, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { roleScreenHaptic } from '../utils/roleHaptics';
import { keyCharHaptic, tapButtonHaptic } from '../utils/touchHaptics';
import Logo from '../components/Logo';
import LiveMapView from '../components/LiveMapView';
import QRTripEndModal from '../components/QRTripEndModal';
import RatingModal from '../components/RatingModal';
import SearchingMapView, { DriverLocation } from '../components/SearchingMapView';
import PassengerWaitingScreen from '../components/PassengerWaitingScreen';
import CallScreenV2 from '../components/CallScreenV2';
import { agoraVoiceService } from '../services/agoraVoiceService';
import { agoraUidFromUserId } from '../lib/agoraUid';
import ChatBubble from '../components/ChatBubble'; // 🆕 Bulutlu Chat
import EndTripModal from '../components/EndTripModal'; // 🆕 Modern Yolculuk Bitirme Modalı
import ForceEndConfirmModal from '../components/ForceEndConfirmModal'; // 🆕 Zorla Bitir Onay Modalı
import DriverOfferScreen from '../components/DriverOfferScreen'; // Sürücü Teklif Ekranı (Eski)
import DriverKYCScreen from '../components/DriverKYCScreen'; // 🆕 Sürücü KYC Ekranı
import OfferMapScreen from '../components/OfferMapScreen'; // 🆕 YENİ Modern Teklif Ekranı
import DriverDashboardPanel from '../components/DriverDashboardPanel'; // 🆕 Sürücü Kazanç Paneli
import DriverPackagesModal from '../components/DriverPackagesModal'; // 🆕 Sürücü Paket Satın Alma
import OTPCountdown from '../components/OTPCountdown'; // 🆕 SMS Geri Sayım
import useSocket from '../hooks/useSocket';
import { useSocketContext } from '../contexts/SocketContext'; // 🔥 MERKEZİ ARAMA STATE
// NOT: useAgoraEngine kaldırıldı - CallScreenV2 kendi singleton Agora'sını yönetiyor
import PlacesAutocomplete from '../components/PlacesAutocomplete';
import AdminPanel from '../components/AdminPanel';
import { LegalConsentModal, LegalPage, LocationWarningModal } from '../components/LegalPages';
import SplashScreen from '../components/SplashScreen';
import { KVKKConsentModal, SupportModal } from '../components/KVKKComponents';
import CommunityScreen from '../components/CommunityScreen';
// Push notifications - Expo Push ile (Firebase olmadan)
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useNotifications } from '../contexts/NotificationContext';
// Supabase Realtime hooks - Anlık teklif ve arama güncellemeleri
import { useOffers } from '../hooks/useOffers';
import { BACKEND_BASE_URL, API_BASE_URL } from '../lib/backendConfig';
import { displayFirstName } from '../lib/displayName';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { playMatchChimeSound } from '../utils/sound';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

/** Hedef seçim modalı — yalnız native (web’de metro stub) */
let DestinationPickerMapView: any = null;
let DestinationPickerMarker: any = null;
let DestinationPickerMapProvider: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    DestinationPickerMapView = Maps.default;
    DestinationPickerMarker = Maps.Marker;
    DestinationPickerMapProvider = Maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('⚠️ react-native-maps (hedef modal) yüklenemedi:', e);
  }
}

// Backend URL — lib/backendConfig ile SocketContext aynı kaynağı kullanır
const BACKEND_URL = BACKEND_BASE_URL;
const API_URL = API_BASE_URL;

/** start-call sonrası arayan tarafı Agora kanalına alır (receiver ekranı açılmadan önce). */
async function joinTripCallAgoraAsCaller(
  channelName: string,
  agoraToken: string,
  userId: string
): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (r !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('İzin gerekli', 'Sesli arama için mikrofon izni şart.');
      return false;
    }
  }
  try {
    const tok = String(agoraToken || '').trim();
    if (!tok) {
      Alert.alert('Hata', 'Arama bileti (token) alınamadı');
      return false;
    }
    await agoraVoiceService.initialize();
    agoraVoiceService.joinChannel(channelName, tok, agoraUidFromUserId(userId));
    return true;
  } catch (e) {
    console.error('Agora caller join:', e);
    Alert.alert('Hata', 'Ses kanalına bağlanılamadı');
    return false;
  }
}

/** FastAPI { detail: "..." } veya { message } */
function apiErrMsg(data: { message?: string; detail?: unknown } | null | undefined, fallback: string): string {
  if (!data) return fallback;
  if (data.message) return String(data.message);
  const d = data.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d[0] && typeof (d[0] as { msg?: string }).msg === 'string') {
    return String((d[0] as { msg: string }).msg);
  }
  return fallback;
}

/** HTML/502 gövdelerinde response.json() çökmesini önler */
async function parseApiJson(response: Response): Promise<{ data: Record<string, unknown> }> {
  const text = await response.text();
  if (!text) return { data: {} };
  try {
    return { data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { data: { detail: text.length > 180 ? `${text.slice(0, 180)}…` : text } };
  }
}

console.log('🌐 BACKEND_URL:', BACKEND_URL);
console.log('🌐 API_URL:', API_URL);

// Hareketli Bulutlar Bileşeni (90 FPS animasyon) - Daha fazla bulut
const AnimatedClouds = () => {
  const cloud1X = useRef(new Animated.Value(-100)).current;
  const cloud2X = useRef(new Animated.Value(-150)).current;
  const cloud3X = useRef(new Animated.Value(-80)).current;
  const cloud4X = useRef(new Animated.Value(-120)).current;
  const cloud5X = useRef(new Animated.Value(-90)).current;
  const cloud6X = useRef(new Animated.Value(-130)).current;
  const cloud7X = useRef(new Animated.Value(-70)).current;
  const cloud8X = useRef(new Animated.Value(-110)).current;

  useEffect(() => {
    const animateCloud = (cloudAnim: Animated.Value, duration: number, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(cloudAnim, {
            toValue: SCREEN_WIDTH + 100,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim, {
            toValue: -150,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Üst taraf bulutları (logo bölgesi)
    animateCloud(cloud1X, 20000, 0);
    animateCloud(cloud2X, 25000, 3000);
    animateCloud(cloud5X, 18000, 6000);
    animateCloud(cloud6X, 22000, 9000);
    // Alt taraf bulutları
    animateCloud(cloud3X, 28000, 4000);
    animateCloud(cloud4X, 24000, 7000);
    animateCloud(cloud7X, 26000, 10000);
    animateCloud(cloud8X, 30000, 2000);
  }, []);

  return (
    <View style={cloudStyles.container} pointerEvents="none">
      {/* Üst bölge - Logo etrafı (daha fazla bulut) */}
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud1, { transform: [{ translateX: cloud1X }] }]}>
        <Ionicons name="cloud" size={70} color="rgba(63, 169, 245, 0.18)" />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud2, { transform: [{ translateX: cloud2X }] }]}>
        <Ionicons name="cloud" size={55} color="rgba(63, 169, 245, 0.15)" />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud5, { transform: [{ translateX: cloud5X }] }]}>
        <Ionicons name="cloud" size={65} color="rgba(63, 169, 245, 0.12)" />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud6, { transform: [{ translateX: cloud6X }] }]}>
        <Ionicons name="cloud" size={50} color="rgba(63, 169, 245, 0.16)" />
      </Animated.View>
      {/* Orta ve alt bölge */}
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud3, { transform: [{ translateX: cloud3X }] }]}>
        <Ionicons name="cloud" size={80} color="rgba(63, 169, 245, 0.10)" />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud4, { transform: [{ translateX: cloud4X }] }]}>
        <Ionicons name="cloud" size={60} color="rgba(63, 169, 245, 0.12)" />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud7, { transform: [{ translateX: cloud7X }] }]}>
        <Ionicons name="cloud" size={75} color="rgba(63, 169, 245, 0.08)" />
      </Animated.View>
      <Animated.View style={[cloudStyles.cloud, cloudStyles.cloud8, { transform: [{ translateX: cloud8X }] }]}>
        <Ionicons name="cloud" size={45} color="rgba(63, 169, 245, 0.14)" />
      </Animated.View>
    </View>
  );
};

const cloudStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  cloud: {
    position: 'absolute',
  },
  cloud1: {
    top: '5%',
  },
  cloud2: {
    top: '12%',
  },
  cloud5: {
    top: '18%',
  },
  cloud6: {
    top: '8%',
    left: '30%',
  },
  cloud3: {
    top: '35%',
  },
  cloud4: {
    top: '50%',
  },
  cloud7: {
    top: '60%',
  },
  cloud8: {
    top: '70%',
  },
});

// Mesafe Hesaplama Fonksiyonu (Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // 1 ondalık basamak
};

// 🆕 Google Maps Directions API ile gerçek yol mesafesi hesapla
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const calculateRoadDistance = async (
  originLat: number, 
  originLng: number, 
  destLat: number, 
  destLng: number
): Promise<{ distance_km: number; duration_min: number } | null> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes.length > 0) {
      const route = data.routes[0].legs[0];
      const distanceKm = route.distance.value / 1000; // metre -> km
      const durationMin = Math.ceil(route.duration.value / 60); // saniye -> dakika
      
      console.log(`📍 Gerçek yol mesafesi: ${distanceKm.toFixed(1)} km, ${durationMin} dk`);
      
      return {
        distance_km: Math.round(distanceKm * 10) / 10,
        duration_min: durationMin
      };
    }
    
    console.log('⚠️ Google Directions API hatası:', data.status);
    return null;
  } catch (error) {
    console.error('❌ Yol mesafesi hesaplama hatası:', error);
    return null;
  }
};

// Leylek TAG Colors
const COLORS = {
  primary: '#3FA9F5',
  secondary: '#FF6B35',
  background: '#FFFFFF',
  surface: '#E9EDF2',
  text: '#1B1B1E',
  gray400: '#ADB5BD',
  gray500: '#6C757D',
  gray600: '#495057',
  success: '#00C853',
  info: '#007AFF',
};

// User Context
interface User {
  id: string;
  phone: string;
  name: string;
  role: 'passenger' | 'driver';
  rating: number;
  total_ratings: number;
  city?: string;
}

interface Tag {
  id: string;
  passenger_id: string;
  passenger_name: string;
  pickup_location: string;
  dropoff_location: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  notes?: string;
  status: string;
  driver_id?: string;
  driver_name?: string;
  final_price?: number;
  created_at: string;
  matched_at?: string;
  completed_at?: string;
  driver_location?: { latitude: number; longitude: number };
  passenger_location?: { latitude: number; longitude: number };
  route_info?: any;
  passenger_preferred_vehicle?: 'car' | 'motorcycle';
  passenger_vehicle_kind?: 'car' | 'motorcycle';
  /** Yolcu teklifte seçtiği ödeme (sunucu: cash | card) */
  passenger_payment_method?: 'cash' | 'card';
}

function normalizePassengerPaymentMethod(raw: unknown): 'cash' | 'card' | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'cash' || s === 'nakit') return 'cash';
  if (s === 'card' || s === 'kart' || s === 'sanal' || s === 'sanal_kart' || s === 'virtual_card') {
    return 'card';
  }
  return null;
}

interface Offer {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_rating: number;
  price: number;
  estimated_time: number;
  notes?: string;
  status: string;
  created_at: string;
}

class RuntimeBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`RuntimeBoundary(${this.props.name})`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Sürücü ekranı hata verdi</Text>
          <Text style={{ color: '#CBD5E1', textAlign: 'center' }}>{this.state.error.message || 'Bilinmeyen hata'}</Text>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard' | 'forgot-password' | 'reset-pin' | 'community' | 'driver-kyc'>('login');

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION GATE - All permissions requested ONCE at app start
  // ═══════════════════════════════════════════════════════════════════════════
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionChecking, setPermissionChecking] = useState(true);
  const [microphonePermission, setMicrophonePermission] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);

  // Splash: push/boot’tan bağımsız; süre dolduğunda kapanır
  const [showSplash, setShowSplash] = useState(true);
  
  // KVKK Onayı
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [showKVKKModal, setShowKVKKModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Auth states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  
  // Yeni Auth states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [userExists, setUserExists] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [deviceId, setDeviceId] = useState<string>(''); // Cihaz ID
  const [isDeviceVerified, setIsDeviceVerified] = useState(false); // Cihaz doğrulanmış mı?
  
  // Role Selection (Dinamik - Her girişte seçilir)
  const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver' | null>(null);
  /** Araç veya motor — yolcu tercihi / sürücü kullandığı tip */
  const [rideVehicleKind, setRideVehicleKind] = useState<'car' | 'motorcycle' | null>(null);
  
  // KYC Status (Sürücü başvuru durumu)
  const [kycStatus, setKycStatus] = useState<{status: string; submitted_at: string | null} | null>(null);
  
  // Animation for role selection
  const scaleAnim = useRef(new Animated.Value(1)).current;
  /** Eşleşme sonrası QR’sız çıkışta rol ekranında 3 sn kırmızı şerit */
  const [roleSelectTripExitBanner, setRoleSelectTripExitBanner] = useState<string | null>(null);
  const roleSelectBannerShimmer = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!roleSelectTripExitBanner) return undefined;
    const t = setTimeout(() => setRoleSelectTripExitBanner(null), 3000);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(roleSelectBannerShimmer, {
          toValue: 0.88,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(roleSelectBannerShimmer, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => {
      clearTimeout(t);
      anim.stop();
      roleSelectBannerShimmer.setValue(1);
    };
  }, [roleSelectTripExitBanner, roleSelectBannerShimmer]);
  
  // GPS & Map states
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  
  // Destination states
  const [destination, setDestination] = useState<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  
  // Admin Panel state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Legal Consent state
  const [showLegalConsent, setShowLegalConsent] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  
  // Legal Pages (Gizlilik, Kullanım Şartları, KVKK)
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showKvkk, setShowKvkk] = useState(false);

  // Push Notifications Hook - Expo Push ile (Firebase olmadan)
  const { registerPushToken, removePushToken, notification } = usePushNotifications();
  const lastPushRegisterTimeRef = useRef<number>(0);
  const PUSH_REREGISTER_INTERVAL_MS = 15000; // Uygulama her ön plana geldiğinde en fazla 15 sn'de bir tekrar dene
  /** Splash çıkışında user'a bakılır; user deps ile effect sıfırlanıp timer iptal edilmesin diye ref */
  const splashUserRef = useRef<User | null>(null);
  splashUserRef.current = user;

  // Push: yalnızca splash kapandıktan sonra (loading ile bağlantılı değil)
  useEffect(() => {
    if (!user?.id || showSplash) return;

    const uid = user.id;
    const t = setTimeout(() => {
      registerPushToken(uid, (ok) => {
        if (ok) lastPushRegisterTimeRef.current = Date.now();
      });
    }, 500);
    return () => clearTimeout(t);
  }, [user?.id, registerPushToken, showSplash]);

  // Ön plan: throttle + 500ms gecikme; doğrudan registerPushToken çağrılmaz
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !user?.id) return;
      const now = Date.now();
      if (now - lastPushRegisterTimeRef.current < PUSH_REREGISTER_INTERVAL_MS) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        lastPushRegisterTimeRef.current = Date.now();
        registerPushToken(user.id, () => {});
      }, 500);
    });
    return () => {
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [user?.id, registerPushToken]);

  useEffect(() => {
    if (notification) {
      console.log('📬 Yeni bildirim:', notification.request.content.title);
      // Bildirim geldiğinde aktif tag'i yeniden yükle
      if (screen === 'dashboard' && user) {
        // Dashboard'daki loadActiveTag fonksiyonunu tetiklemek için
        // event emitter veya state güncellemesi yapılabilir
      }
    }
  }, [notification]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION GATE - Request ALL permissions at app start
  // ═══════════════════════════════════════════════════════════════════════════
  const requestAllPermissions = async (): Promise<boolean> => {
    console.log('🔐 Tüm izinler isteniyor...');
    
    try {
      // Bildirim izni usePushNotifications icinde tek noktadan yonetilir.
      // Burada sadece uygulamanin calismasi icin gereken cihaz izinleri istenir.

      // ANDROID SPESİFİK İZİNLER
      if (Platform.OS === 'android') {
        console.log('🔐 Android izinleri isteniyor...');
        
        const permissions: any[] = [
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        console.log('🔐 İzin sonuçları:', JSON.stringify(results, null, 2));

        const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
        const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';

        setMicrophonePermission(audioGranted);
        setCameraPermission(cameraGranted);

        if (!audioGranted) {
          // Açılışı kilitleme: arama ekranında tekrar istenebilir
          console.log('❌ RECORD_AUDIO reddedildi — giriş kullanılabilir');
          setPermissionsGranted(false);
        } else {
          console.log('✅ Mikrofon izni verildi');
          setPermissionsGranted(true);
        }
      } else {
        // iOS / web
        setMicrophonePermission(true);
        setCameraPermission(true);
        setPermissionsGranted(true);
      }

      setPermissionChecking(false);
      return true;
    } catch (error) {
      console.error('🔐 İzin hatası:', error);
      setPermissionChecking(false);
      return false;
    }
  };

  // Mikrofon/kamera: splash kapandıktan sonra (loading ayrı ekran olsa bile)
  useEffect(() => {
    if (showSplash) return;
    const delay = setTimeout(() => {
      void (async () => {
        console.log('🔐 Giriş hazır — izin kontrolü (erteli)');
        await requestAllPermissions();
      })();
    }, 1500);
    return () => clearTimeout(delay);
  }, [showSplash]);

  // Device ID oluştur veya al
  const getOrCreateDeviceId = async (): Promise<string> => {
    try {
      let storedDeviceId = await AsyncStorage.getItem('device_id');
      if (!storedDeviceId) {
        // Yeni cihaz ID oluştur
        storedDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        await AsyncStorage.setItem('device_id', storedDeviceId);
        console.log('🆔 Yeni cihaz ID oluşturuldu:', storedDeviceId);
      } else {
        console.log('🆔 Mevcut cihaz ID:', storedDeviceId);
      }
      return storedDeviceId;
    } catch (error) {
      console.error('Device ID hatası:', error);
      return 'device_' + Date.now();
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  /** Ağ await yok; AsyncStorage + loadUser fire-and-forget — yükleme state’i loadUser.finally + boot watchdog ile kapanır */
  const initializeApp = () => {
    void getOrCreateDeviceId()
      .then((dId) => setDeviceId(dId))
      .catch(() => {});

    void AsyncStorage.getItem('kvkk_accepted_phone')
      .then((storedKVKKPhone) => {
        if (storedKVKKPhone) setKvkkAccepted(true);
      })
      .catch(() => {});

    void loadUser();
  };

  // Splash sonsuz döngü koruması: tam 4000ms sonra kapat (setTimeout 2. arg = ms; [] = effect deps)
  useEffect(() => {
    const watchdogTimerId = setTimeout(() => {
      setShowSplash(false);
      if (!splashUserRef.current) {
        setScreen('login');
      }
    }, 4000);
    return () => clearTimeout(watchdogTimerId);
  }, []);
  
  // KVKK onayını kaydet (telefon numarasına göre)
  const saveKVKKConsent = async (phoneNumber: string) => {
    try {
      await AsyncStorage.setItem('kvkk_accepted_phone', phoneNumber);
      setKvkkAccepted(true);
      console.log('✅ KVKK onayı kaydedildi:', phoneNumber);
    } catch (error) {
      console.error('KVKK kayıt hatası:', error);
    }
  };
  
  // KVKK onayı kontrol (telefon değiştiğinde yeniden iste)
  const checkKVKKConsent = async (phoneNumber: string): Promise<boolean> => {
    try {
      const storedPhone = await AsyncStorage.getItem('kvkk_accepted_phone');
      return storedPhone === phoneNumber;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    if (!user || screen !== 'dashboard') return;

    const pushTimer = setTimeout(() => {
      registerPushToken(user.id, () => {});
    }, 500);

    let interval: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    if (user.role !== 'driver') {
      requestLocationPermission().then((granted) => {
        if (cancelled || !granted) return;
        updateUserLocation();
        interval = setInterval(updateUserLocation, 5000);
      });
    }

    return () => {
      cancelled = true;
      clearTimeout(pushTimer);
      if (interval) clearInterval(interval);
    };
  }, [user, screen]);

  /** Ağ: UI’yı bloklamaz — admin kontrolü + aktif seans (timeout’lı). */
  const runDeferredSessionBootstrap = useCallback(
    async (parsedUser: User, isMainAdmin: boolean, legalWasAccepted: boolean) => {
      const cleanPhone = parsedUser.phone?.replace(/\D/g, '') || '';

      if (!isMainAdmin) {
        try {
          const res = await fetchWithTimeout(
            `${API_URL}/admin/check?phone=${encodeURIComponent(cleanPhone)}`,
            { timeoutMs: 5000 }
          );
          if (res?.ok) {
            const data = await res.json().catch(() => null);
            if (data?.success && data?.is_admin) {
              setIsAdmin(true);
              setShowAdminPanel(true);
            }
          }
        } catch (e) {
          console.warn('Admin check (deferred):', e);
        }
      }

      if (!legalWasAccepted || isMainAdmin) return;

      const activeStatuses = ['waiting', 'pending', 'offers_received', 'matched', 'in_progress'];
      const uid = encodeURIComponent(parsedUser.id);
      const t = 6000;

      try {
        const role = parsedUser.role;
        if (role === 'passenger') {
          const r = await fetchWithTimeout(
            `${API_URL}/passenger/active-tag?user_id=${uid}`,
            { timeoutMs: t }
          );
          if (!r?.ok) return;
          const j = await r.json().catch(() => null);
          const st = j?.tag?.status;
          if (j?.success && j?.tag && st && activeStatuses.includes(st)) {
            setScreen('dashboard');
          }
        } else if (role === 'driver') {
          const r = await fetchWithTimeout(
            `${API_URL}/driver/active-tag?user_id=${uid}`,
            { timeoutMs: t }
          );
          if (r?.ok) {
            const j = await r.json().catch(() => null);
            const st = j?.tag?.status;
            if (j?.success && j?.tag && st && activeStatuses.includes(st)) {
              setScreen('dashboard');
              return;
            }
          }
          const pd = await fetchWithTimeout(
            `${API_URL}/driver/dispatch-pending-offer?user_id=${uid}`,
            { timeoutMs: t }
          );
          if (!pd?.ok) return;
          const pj = await pd.json().catch(() => null);
          if (pj?.success && pj?.offer?.tag_id) {
            setScreen('dashboard');
          }
        }
      } catch (e) {
        console.warn('Active session restore (deferred):', e);
      }
    },
    []
  );

  const loadUser = async () => {
    try {
      let userData: string | null;
      let legalAcceptedStorage: string | null;
      try {
        userData = await AsyncStorage.getItem('user');
        legalAcceptedStorage = await AsyncStorage.getItem('legal_accepted');
      } catch {
        setLoading(false);
        return;
      }

      const legalWasAccepted = legalAcceptedStorage === 'true';

      if (userData) {
        let parsedUser: User;
        try {
          parsedUser = JSON.parse(userData) as User;
        } catch {
          void AsyncStorage.removeItem('user').catch(() => {});
          setLoading(false);
          return;
        }

        setUser(parsedUser);

        const cleanPhone = parsedUser.phone?.replace(/\D/g, '') || '';
        const isMainAdmin =
          cleanPhone === '5326497412' ||
          cleanPhone === '05326497412' ||
          cleanPhone.endsWith('5326497412');

        if (isMainAdmin) {
          setIsAdmin(true);
          setShowAdminPanel(true);
          setScreen('role-select');
        } else {
          setScreen('role-select');
        }

        if (!legalWasAccepted) {
          setShowLegalConsent(true);
        } else {
          setLegalAccepted(true);
        }

        setTimeout(() => {
          void runDeferredSessionBootstrap(parsedUser, isMainAdmin, legalWasAccepted);
        }, 0);
      }
    } catch (error) {
      console.error('Kullanıcı yüklenemedi:', error);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Legal consent kabul
  const handleLegalAccept = async () => {
    await AsyncStorage.setItem('legal_accepted', 'true');
    setLegalAccepted(true);
    setShowLegalConsent(false);
    // İlk açılışta legal sonrası aktif trip / dispatch teklifi varsa dashboard
    if (user?.id && user.role) {
      try {
        const cleanPhone = user.phone?.replace(/\D/g, '');
        const isMainAdmin = cleanPhone === '5326497412' || cleanPhone === '05326497412';
        if (isMainAdmin) return;
        if (user.role === 'passenger') {
          const r = await fetch(`${API_URL}/passenger/active-tag?user_id=${encodeURIComponent(user.id)}`);
          const j = await r.json();
          const st = j.tag?.status;
          if (
            j.success &&
            j.tag &&
            st &&
            ['waiting', 'pending', 'offers_received', 'matched', 'in_progress'].includes(st)
          ) {
            setScreen('dashboard');
          }
        } else if (user.role === 'driver') {
          const r = await fetch(`${API_URL}/driver/active-tag?user_id=${encodeURIComponent(user.id)}`);
          const j = await r.json();
          const st = j.tag?.status;
          if (
            j.success &&
            j.tag &&
            st &&
            ['waiting', 'pending', 'offers_received', 'matched', 'in_progress'].includes(st)
          ) {
            setScreen('dashboard');
            return;
          }
          const pd = await fetch(
            `${API_URL}/driver/dispatch-pending-offer?user_id=${encodeURIComponent(user.id)}`
          );
          const pj = await pd.json();
          if (pj.success && pj.offer?.tag_id) setScreen('dashboard');
        }
      } catch (e) {
        console.warn('Legal accept restore:', e);
      }
    }
  };
  
  // Legal consent red
  const handleLegalDecline = async () => {
    Alert.alert(
      'Uyarı',
      'Kullanım şartlarını kabul etmeden devam edemezsiniz.',
      [{ text: 'Tamam' }]
    );
  };

  const saveUser = async (userData: User) => {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    // Logout sırasında push token'ı sil
    if (user?.id) {
      await removePushToken(user.id);
    }
    await AsyncStorage.removeItem('user');
    setUser(null);
    setScreen('login');
    setPhone('');
    setOtp('');
    setName('');
  };

  // ==================== AUTH FUNCTIONS ====================
  const handleSendOTP = async () => {
    // 🔒 TELEFON NUMARASI VALİDASYONU
    const cleanPhone = phone.replace(/\D/g, ''); // Sadece rakamlar
    
    // 10 hane kontrolü
    if (cleanPhone.length !== 10) {
      Alert.alert('Hata', 'Telefon numarası 10 haneli olmalıdır (5XX XXX XX XX)');
      return;
    }
    
    // 5 ile başlama kontrolü
    if (!cleanPhone.startsWith('5')) {
      Alert.alert('Hata', 'Telefon numarası 5 ile başlamalıdır');
      return;
    }

    try {
      const currentDeviceId = deviceId || await getOrCreateDeviceId();
      const checkResponse = await fetch(`${API_URL}/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, device_id: currentDeviceId })
      });

      const { data: checkData } = await parseApiJson(checkResponse);
      console.log('🔍 Check user response:', checkData, 'status', checkResponse.status);
      if (!checkResponse.ok) {
        Alert.alert('Hata', apiErrMsg(checkData, `Sunucu hatası (${checkResponse.status})`));
        return;
      }

      if (checkData.success && checkData.user_exists && checkData.has_pin) {
        setHasPin(true);
        setUserExists(true);
        setIsDeviceVerified(!!checkData.device_verified);
        // Aynı cihaz: doğrulama kodu gönderilmez, direkt PIN ekranına git
        if (checkData.device_verified) {
          setScreen('enter-pin');
          return;
        }
        // Farklı cihaz: önce OTP ile doğrula, sonra PIN
        const response = await fetch(`${API_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone })
        });
        const { data } = await parseApiJson(response);
        if (!response.ok) {
          Alert.alert('Hata', apiErrMsg(data, 'Doğrulama kodu gönderilemedi'));
          return;
        }
        if (data.success) {
          setScreen('otp');
        } else {
          Alert.alert('Hata', apiErrMsg(data, 'Doğrulama kodu gönderilemedi'));
        }
      } else if (checkData.success && checkData.user_exists && !checkData.has_pin) {
        // Kayıtlı ama PIN yok - OTP gönder ve PIN oluştur
        setUserExists(true);
        setHasPin(false);
        const response = await fetch(`${API_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone })
        });
        const { data } = await parseApiJson(response);
        if (!response.ok) {
          Alert.alert('Hata', apiErrMsg(data, 'SMS gönderilemedi'));
          return;
        }
        if (data.success) {
          Alert.alert('Şifre Oluşturma 🔐', 'Hesabınız için 6 haneli şifre belirlemeniz gerekiyor. SMS ile gelen kodu girin.');
          setScreen('otp');
        } else {
          Alert.alert('Hata', apiErrMsg(data, 'SMS gönderilemedi'));
        }
      } else {
        // 🆕 YENİ KULLANICI - Kayıt sayfasına yönlendir
        Alert.alert(
          'Kayıt Ol 📝', 
          'Bu numara kayıtlı değil. Kayıt olmak ister misiniz?',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Kayıt Ol', 
              onPress: async () => {
                setUserExists(false);
                setHasPin(false);
                const response = await fetch(`${API_URL}/auth/send-otp`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone: cleanPhone })
                });
                const { data } = await parseApiJson(response);
                if (!response.ok) {
                  Alert.alert('Hata', apiErrMsg(data, 'SMS gönderilemedi'));
                  return;
                }
                if (data.success) {
                  Alert.alert('SMS Gönderildi', 'Telefon doğrulaması için SMS kodu gönderildi.');
                  setScreen('otp');
                } else {
                  Alert.alert('Hata', apiErrMsg(data, 'SMS gönderilemedi'));
                }
              }
            }
          ]
        );
        return;
      }
    } catch (error) {
      console.error('handleSendOTP error:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Hata', 'OTP kodunu girin');
      return;
    }
    try {
      const currentDeviceId = deviceId || await getOrCreateDeviceId();
      
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, device_id: currentDeviceId })
      });

      const { data } = await parseApiJson(response);
      console.log('🔐 Verify OTP response:', data, 'status', response.status);
      if (!response.ok) {
        Alert.alert('Hata', apiErrMsg(data, 'OTP doğrulanamadı'));
        return;
      }

      if (data.success) {
        if (data.user_exists && data.user) {
          // Kayıtlı kullanıcı - giriş yapıyor, kayıt sayfasına atma
          await saveUser(data.user);
          setUser(data.user);
          if (data.has_pin) {
            setScreen('enter-pin');
          } else {
            setScreen('set-pin');
          }
        } else {
          // Yeni kullanıcı - Eğer isim ve şehir zaten girilmişse kayıt yap
          if (name && selectedCity) {
            try {
              const currentDeviceId = deviceId || await getOrCreateDeviceId();
              const registerResponse = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  phone, 
                  name, 
                  city: selectedCity,
                  role: 'passenger',
                  device_id: currentDeviceId
                })
              });
              
              const registerData = await registerResponse.json();
              console.log('📝 Register response:', registerData);
              
              if (registerData.success && registerData.user) {
                await saveUser(registerData.user);
                setUser(registerData.user);
                Alert.alert('Kayıt Başarılı', 'Hesabınız oluşturuldu. Şimdi 6 haneli PIN belirleyin.', [
                  { text: 'Tamam', onPress: () => setScreen('set-pin') }
                ]);
              } else {
                Alert.alert('Hata', registerData.detail || 'Kayıt oluşturulamadı');
                setScreen('register');
              }
            } catch (regError) {
              console.error('Kayıt hatası:', regError);
              Alert.alert('Hata', 'Kayıt işlemi başarısız');
              setScreen('register');
            }
          } else {
            // İsim ve şehir girilmemiş - kayıt ekranına git
            setScreen('register');
          }
        }
      } else {
        Alert.alert('Hata', data.detail || 'OTP doğrulanamadı');
      }
    } catch (error) {
      console.error('handleVerifyOTP error:', error);
      Alert.alert('Hata', 'OTP doğrulanamadı');
    }
  };

  const loadCities = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/cities`);
      const data = await response.json();
      if (data.success) {
        setCities(data.cities);
      }
    } catch (error) {
      console.error('Şehirler yüklenemedi:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      console.log('📍 Konum izni isteniyor...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        console.log('✅ Konum izni verildi');
        
        // Konum izni verildiyse hemen konumu al
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High
          });
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
          setUserLocation(coords);
          console.log('📍 Konum alındı:', coords);
        } catch (locErr) {
          console.log('⚠️ İlk konum alınamadı:', locErr);
        }
        
        return true;
      } else {
        Alert.alert(
          'Konum İzni Gerekli',
          'LeylekTag\'ı kullanabilmek için konum izni vermeniz gerekmektedir. Ayarlardan konum iznini açabilirsiniz.',
          [{ text: 'Tamam' }]
        );
        return false;
      }
    } catch (error) {
      console.error('❌ Konum izni hatası:', error);
      return false;
    }
  };

  const updateUserLocation = async () => {
    if (!user) return;
    
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      
      setUserLocation(coords);
      
      // Backend'e gönder
      await fetch(`${API_URL}/user/update-location?user_id=${user.id}&latitude=${coords.latitude}&longitude=${coords.longitude}`, {
        method: 'POST'
      });
      
    } catch (error) {
      console.error('Konum alınamadı:', error);
    }
  };

  const handleRegister = async () => {
    if (!name) {
      Alert.alert('Hata', 'Adınızı girin');
      return;
    }

    if (!selectedCity) {
      Alert.alert('Hata', 'Şehir seçimi yapmalısınız');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, city: selectedCity })
      });

      const data = await response.json();
      if (data.success) {
        await saveUser(data.user);
        
        setScreen('role-select'); // Kayıttan sonra rol seçimi (push: useEffect + splash/loading sonrası)
      } else {
        Alert.alert('Hata', data.detail || 'Kayıt oluşturulamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Kayıt oluşturulamadı');
    }
  };

  // ==================== RENDER SCREENS ====================
  // Sıra: showSplash (yalnızca Leylek) → loading (ayrı spinner) → asıl ekranlar. Birleştirme yok.

  // SPLASH: sadece showSplash — user her güncellendiğinde timer iptal edilmez (sonsuz Leylek önlenir)
  useEffect(() => {
    if (!showSplash) return;
    const splashTimer = setTimeout(() => {
      console.log('🎬 Splash timeout - devam');
      setShowSplash(false);
      if (!splashUserRef.current) {
        setScreen('login');
      }
    }, 2500);
    return () => clearTimeout(splashTimer);
  }, [showSplash]);

  if (showSplash) {
    return (
      <SplashScreen onFinish={() => {
        setShowSplash(false);
        if (!splashUserRef.current) {
          setScreen('login');
        }
      }} />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3FA9F5" />
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    return (
      <View style={{ flex: 1, width: '100%', height: '100%' }}>
        {/* Arka Plan Resmi - SADECE MOBİL */}
        {Platform.OS !== 'web' && (
          <Image 
            source={require('../assets/images/login-background.png')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: screenWidth,
              height: screenHeight,
            }}
            resizeMode="cover"
          />
        )}
        
        {/* Yarı saydam overlay - içeriğin okunabilirliği için (sadece mobil) */}
        {Platform.OS !== 'web' && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255,255,255,0.3)',
          }} />
        )}
        
        <SafeAreaView style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? '#FFFFFF' : 'transparent' }}>
          {/* Hareketli Bulutlar Arka Plan */}
          <AnimatedClouds />
          
          <ScrollView contentContainerStyle={styles.loginScrollContent} style={{ backgroundColor: 'transparent' }}>
            <View style={styles.logoContainer}>
              {/* Yuvarlak Logo */}
              <View style={styles.roundLogoWrapper}>
                <Image 
                  source={require('../assets/images/logo.png')} 
                  style={styles.roundLogo}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.heroTitle}>Yolculuk Eşleştirme</Text>
              <Text style={styles.heroSubtitle}>Güvenli ve hızlı yolculuk deneyimi</Text>
            </View>

            <View style={styles.modernFormContainer}>
              <Text style={styles.modernLabel}>Telefon Numaranız</Text>
              <View style={styles.modernInputContainer}>
                <Ionicons name="call-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
                <TextInput
                  style={styles.modernInput}
                  placeholder="5XX XXX XX XX"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\D/g, '');
                    if (cleaned.length > phone.length) void keyCharHaptic();
                    setPhone(cleaned);
                  }}
                  maxLength={10}
                />
              </View>

              {/* KVKK Checkbox - Tıklanabilir Metin */}
              <TouchableOpacity 
                style={styles.kvkkContainer} 
                onPress={() => {
                  void tapButtonHaptic();
                  setKvkkAccepted(!kvkkAccepted);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, kvkkAccepted && styles.checkboxChecked]}>
                  {kvkkAccepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.kvkkText}>
                  <Text 
                    style={styles.kvkkLink} 
                    onPress={() => setShowKVKKModal(true)}
                  >
                    Aydınlatma Metni ve Gizlilik Politikası
                  </Text>
                  <Text>&apos;nı okudum, anladım ve kabul ediyorum.</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modernPrimaryButton, !kvkkAccepted && styles.buttonDisabled]} 
                onPress={async () => {
                  void tapButtonHaptic();
                  if (!kvkkAccepted) {
                    Alert.alert(
                      '⚠️ Onay Gerekli', 
                      'Devam etmek için Aydınlatma Metni ve Gizlilik Politikasını kabul etmelisiniz.',
                      [{ text: 'Tamam', style: 'default' }]
                    );
                    return;
                  }
                  handleSendOTP();
                }}
              >
                <Text style={styles.modernPrimaryButtonText}>DEVAM ET</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
              
              {/* Kayıt Ol Butonu */}
              <TouchableOpacity 
                style={styles.registerButton}
                onPress={() => {
                  void tapButtonHaptic();
                  setScreen('register');
                }}
              >
                <Ionicons name="person-add-outline" size={20} color="#3FA9F5" />
                <Text style={styles.registerButtonText}>Kayıt Ol</Text>
              </TouchableOpacity>
              
              {/* Şifremi Unuttum */}
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={() => {
                  void tapButtonHaptic();
                  setScreen('forgot-password');
                }}
              >
                <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
              </TouchableOpacity>
              
              {/* Destek Butonu */}
              <TouchableOpacity 
                style={styles.supportButton}
                onPress={() => {
                  void tapButtonHaptic();
                  setShowSupportModal(true);
                }}
              >
                <Ionicons name="headset-outline" size={20} color="#3FA9F5" />
                <Text style={styles.supportButtonText}>Destek</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          
          {/* KVKK Modal */}
          <KVKKConsentModal
            visible={showKVKKModal}
            onAccept={() => {
              setKvkkAccepted(true);
              setShowKVKKModal(false);
            }}
            onDecline={() => {
              setKvkkAccepted(false);
              setShowKVKKModal(false);
            }}
          />
          
          {/* Destek Modal */}
          <SupportModal
            visible={showSupportModal}
            onClose={() => setShowSupportModal(false)}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (screen === 'otp') {
    return (
      <SafeAreaView style={styles.container}>
        <AnimatedClouds />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.verifyIconContainer}>
              <Ionicons name="shield-checkmark" size={50} color="#10B981" />
            </View>
            <Text style={styles.verifyTitle}>Doğrulama</Text>
            <Text style={styles.heroSubtitle}>{phone} numarasına gönderilen kodu girin</Text>
          </View>

          <View style={styles.modernFormContainer}>
            <Text style={styles.modernLabel}>Doğrulama Kodunu Giriniz</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="keypad-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="• • • • • •"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                value={otp}
                onChangeText={(t) => {
                  if (t.length > otp.length) void keyCharHaptic();
                  setOtp(t);
                }}
                maxLength={6}
              />
            </View>
            
            {/* 30 Saniye Geri Sayım */}
            <OTPCountdown phone={phone} onResend={async () => {
              try {
                const response = await fetch(`${API_URL}/auth/send-otp`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone })
                });
                const data = await response.json();
                if (data.success) {
                  Alert.alert('Başarılı', 'Yeni kod gönderildi');
                } else {
                  Alert.alert('Hata', apiErrMsg(data, 'Kod gönderilemedi'));
                }
              } catch (error) {
                Alert.alert('Hata', 'Kod gönderilemedi');
              }
            }} />

            <TouchableOpacity
              style={styles.modernPrimaryButton}
              onPress={() => {
                void tapButtonHaptic();
                handleVerifyOTP();
              }}
            >
              <Text style={styles.modernPrimaryButtonText}>DOĞRULA</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSecondaryButton}
              onPress={() => {
                void tapButtonHaptic();
                setScreen('login');
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'register') {
    // Şehir listesini yükle
    if (cities.length === 0) {
      loadCities();
    }

    return (
      <SafeAreaView style={styles.container}>
        <AnimatedClouds />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.registerIconContainer}>
              <Ionicons name="person-add" size={45} color="#3FA9F5" />
            </View>
            <Text style={styles.registerTitle}>Kayıt Ol</Text>
            <Text style={styles.heroSubtitle}>Hesabınızı oluşturun</Text>
          </View>

          <View style={styles.modernFormContainer}>
            {/* Ad */}
            <Text style={styles.modernLabel}>Adınız</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="person-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="Adınızı girin"
                placeholderTextColor="#A0A0A0"
                value={firstName}
                onChangeText={(t) => {
                  if (t.length > firstName.length) void keyCharHaptic();
                  setFirstName(t);
                }}
              />
            </View>

            {/* Soyad */}
            <Text style={styles.modernLabel}>Soyadınız</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="person-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="Soyadınızı girin"
                placeholderTextColor="#A0A0A0"
                value={lastName}
                onChangeText={(t) => {
                  if (t.length > lastName.length) void keyCharHaptic();
                  setLastName(t);
                }}
              />
            </View>

            {/* Şehir */}
            <Text style={styles.modernLabel}>Şehir</Text>
            <TouchableOpacity
              style={styles.modernInputContainer}
              onPress={() => {
                void tapButtonHaptic();
                setShowCityPicker(true);
              }}
            >
              <Ionicons name="location-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <Text style={selectedCity ? styles.modernInputText : styles.modernPlaceholder}>
                {selectedCity || 'Şehir seçin'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#A0A0A0" />
            </TouchableOpacity>

            {/* Telefon Numarası - Elle Yazılabilir */}
            <Text style={styles.modernLabel}>Telefon Numarası</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="call-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <Text style={styles.phonePrefix}>+90</Text>
              <TextInput
                style={[styles.modernInput, { flex: 1 }]}
                placeholder="5XX XXX XX XX"
                placeholderTextColor="#A0A0A0"
                value={phone}
                onChangeText={(text) => {
                  // Sadece rakam kabul et ve başındaki 0'ı kaldır
                  let cleaned = text.replace(/[^0-9]/g, '');
                  if (cleaned.startsWith('0')) {
                    cleaned = cleaned.substring(1);
                  }
                  // Maksimum 10 karakter
                  if (cleaned.length <= 10) {
                    if (cleaned.length > phone.length) void keyCharHaptic();
                    setPhone(cleaned);
                  }
                }}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <Text style={styles.phoneHint}>Başında 0 olmadan yazın (örn: 532 XXX XX XX)</Text>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, (!firstName || !lastName || !selectedCity || phone.length < 10) && styles.buttonDisabled]} 
              onPress={async () => {
                void tapButtonHaptic();
                if (firstName && lastName && selectedCity && phone.length >= 10) {
                  setName(`${firstName} ${lastName}`);
                  setLoading(true);
                  try {
                    const response = await fetch(`${API_URL}/auth/send-otp`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: phone })
                    });
                    const data = await response.json();
                    if (data.success) {
                      setScreen('otp');
                    } else {
                      const em = apiErrMsg(data, 'OTP gönderilemedi');
                      if (Platform.OS === 'web') {
                        window.alert('Hata: ' + em);
                      } else {
                        Alert.alert('Hata', em);
                      }
                    }
                  } catch (error: any) {
                    if (Platform.OS === 'web') {
                      window.alert('Hata: ' + (error.message || 'Bir hata oluştu'));
                    } else {
                      Alert.alert('Hata', error.message || 'Bir hata oluştu');
                    }
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              disabled={!firstName || !lastName || !selectedCity || phone.length < 10 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Text style={styles.modernPrimaryButtonText}>DEVAM ET</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSecondaryButton}
              onPress={() => {
                void tapButtonHaptic();
                setScreen('login');
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>

          {/* Şehir Seçici Modal */}
          <Modal
            visible={showCityPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCityPicker(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Şehir Seçin</Text>
                <FlatList
                  data={cities}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.cityItem}
                      onPress={() => {
                        setSelectedCity(item);
                        setShowCityPicker(false);
                      }}
                    >
                      <Text style={styles.cityItemText}>{item}</Text>
                      {selectedCity === item && <Ionicons name="checkmark" size={24} color="#3FA9F5" />}
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: '#3FA9F5' }]}
                  onPress={() => setShowCityPicker(false)}
                >
                  <Text style={styles.modalCloseButtonText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Hedef Seçme Modal - ÜSTTEN AÇILAN */}
          {showDestinationPicker && (
            <View style={styles.topSheetFullOverlay}>
              {/* Arka plan - tıklayınca kapat */}
              <TouchableOpacity 
                style={styles.topSheetBackdropFull}
                activeOpacity={1}
                onPress={() => setShowDestinationPicker(false)}
              />
              
              {/* Üstten açılan panel */}
              <View style={styles.topSheetPanelFromTop}>
                {/* Üst Bar - Kapat */}
                <View style={styles.topSheetHeader}>
                  <Text style={styles.topSheetTitle}>Nereye Gidiyorsunuz?</Text>
                  <TouchableOpacity 
                    onPress={() => setShowDestinationPicker(false)}
                    style={styles.topSheetCloseBtn}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <PlacesAutocomplete
                  placeholder="Adres, sokak veya mekan ara..."
                  city={user?.city || ''}
                  onPlaceSelected={(place) => {
                    setDestination({
                      address: place.address,
                      latitude: place.latitude,
                      longitude: place.longitude
                    });
                    setShowDestinationPicker(false);
                  }}
                />
                
                <Text style={styles.topSheetPopularTitle}>
                  {user?.city ? `${user.city} Popüler` : 'Popüler Konumlar'}
                </Text>
                <ScrollView style={styles.topSheetPopularScroll} showsVerticalScrollIndicator={false}>
                  {[
                    { name: 'Taksim Meydanı, İstanbul', lat: 41.0370, lng: 28.9850 },
                    { name: 'Kadıköy İskele, İstanbul', lat: 40.9927, lng: 29.0230 },
                    { name: 'Kızılay, Ankara', lat: 39.9208, lng: 32.8541 },
                    { name: 'Ulus, Ankara', lat: 39.9420, lng: 32.8647 },
                    { name: 'Konak, İzmir', lat: 38.4189, lng: 27.1287 },
                    { name: 'Alsancak, İzmir', lat: 38.4361, lng: 27.1428 },
                  ].filter(place => !user?.city || place.name.includes(user.city)).map((place, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.topSheetPopularItem}
                      onPress={() => {
                        setDestination({
                          address: place.name,
                          latitude: place.lat,
                          longitude: place.lng
                        });
                        setShowDestinationPicker(false);
                      }}
                    >
                      <Ionicons name="location" size={18} color="#3FA9F5" />
                      <Text style={styles.topSheetPopularText}>{place.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                {/* Alt Çizgi */}
                <View style={styles.topSheetHandle} />
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==================== PREMIUM ROLE SELECTION SCREEN ====================
  // PIN Belirleme Ekranı
  if (screen === 'set-pin') {
    const handleSetPin = async () => {
      if (pin.length !== 6) {
        Alert.alert('Hata', 'PIN 6 haneli olmalıdır');
        return;
      }
      if (pin !== confirmPin) {
        Alert.alert('Hata', 'PIN kodları eşleşmiyor');
        return;
      }

      try {
        const currentDeviceId = deviceId || await getOrCreateDeviceId();
        
        if (user?.id) {
          // Kullanıcı zaten var (kayıt sonrası PIN belirleme) -> set-pin API (backend ile aynı format için user.phone kullan)
          const setPinResponse = await fetch(`${API_URL}/auth/set-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: user.phone || phone,
              pin,
              first_name: firstName,
              last_name: lastName,
              city: selectedCity,
              device_id: currentDeviceId
            })
          });
          const setPinData = await setPinResponse.json();
          if (setPinData.success) {
            Alert.alert(
              'Kayıt Başarılı',
              'Hesabınız hazır. PIN kodunuzu kimseyle paylaşmayın.',
              [{ text: 'Tamam', onPress: () => setScreen('role-select') }]
            );
          } else {
            Alert.alert('Hata', setPinData.detail || 'PIN ayarlanamadı');
          }
          return;
        }
        
        // Yeni kullanıcı (doğrudan set-pin ile kayıt) -> register API
        const registerResponse = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            first_name: firstName,
            last_name: lastName,
            city: selectedCity,
            pin,
            device_id: currentDeviceId
          })
        });
        const registerData = await registerResponse.json();
        if (registerData.success && registerData.user) {
          setUser(registerData.user);
          await saveUser(registerData.user);
          Alert.alert(
            'Kayıt Başarılı',
            'Hesabınız oluşturuldu. PIN kodunuzu kimseyle paylaşmayın.',
            [{ text: 'Tamam', onPress: () => setScreen('role-select') }]
          );
        } else {
          Alert.alert('Hata', registerData.detail || 'Kayıt yapılamadı');
        }
      } catch (error) {
        console.error('Set PIN / Register error:', error);
        Alert.alert('Hata', 'Bir sorun oluştu');
      }
    };

    return (
      <SafeAreaView style={styles.container}>
        <AnimatedClouds />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.pinIconContainer}>
              <Ionicons name="lock-closed" size={45} color="#3FA9F5" />
            </View>
            <Text style={styles.pinTitle}>Şifre Belirle</Text>
            <Text style={styles.heroSubtitle}>6 haneli güvenlik şifrenizi oluşturun</Text>
          </View>

          <View style={styles.modernFormContainer}>
            {/* PIN Girişi */}
            <Text style={styles.modernLabel}>Şifreniz (6 Hane)</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="keypad-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="• • • • • •"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                value={pin}
                onChangeText={(t) => {
                  if (t.length > pin.length) void keyCharHaptic();
                  setPin(t);
                }}
                maxLength={6}
              />
              <TouchableOpacity
                onPress={() => {
                  void tapButtonHaptic();
                  setShowPin(!showPin);
                }}
              >
                <Ionicons name={showPin ? "eye-off" : "eye"} size={22} color="#A0A0A0" />
              </TouchableOpacity>
            </View>

            {/* PIN Onay */}
            <Text style={styles.modernLabel}>Şifre Tekrar</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="keypad-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="• • • • • •"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                value={confirmPin}
                onChangeText={(t) => {
                  if (t.length > confirmPin.length) void keyCharHaptic();
                  setConfirmPin(t);
                }}
                maxLength={6}
              />
            </View>

            {/* Uyarı */}
            <View style={styles.pinWarningContainer}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.pinWarningText}>
                Şifrenizi kimseyle paylaşmayın, göstermeyin, söylemeyin!
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, (pin.length !== 6 || confirmPin.length !== 6) && styles.buttonDisabled]} 
              onPress={() => {
                void tapButtonHaptic();
                handleSetPin();
              }}
              disabled={pin.length !== 6 || confirmPin.length !== 6}
            >
              <Text style={styles.modernPrimaryButtonText}>KAYDI TAMAMLA</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSecondaryButton}
              onPress={() => {
                void tapButtonHaptic();
                setScreen('register');
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // PIN Giriş Ekranı (Mevcut kullanıcı için)
  if (screen === 'enter-pin') {
    const handleEnterPin = async () => {
      if (pin.length !== 6) {
        Alert.alert('Hata', 'PIN 6 haneli olmalıdır');
        return;
      }

      try {
        const currentDeviceId = deviceId || await getOrCreateDeviceId();
        const phoneDigits = phone.replace(/\D/g, '');

        const response = await fetch(`${API_URL}/auth/verify-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phoneDigits,
            pin,
            device_id: currentDeviceId,
          }),
        });
        const { data } = await parseApiJson(response);

        if (!response.ok) {
          Alert.alert('Hata', apiErrMsg(data, 'Yanlış şifre veya giriş yapılamadı'));
          setPin('');
          return;
        }

        if (data.success) {
          setUser(data.user as User);
          saveUser(data.user as User);
          
          // Admin kontrolü
          const cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone === '5326497412' || cleanPhone === '05326497412') {
            setIsAdmin(true);
            setShowAdminPanel(true);
          }
          
          setScreen('role-select');
        } else {
          Alert.alert('Hata', data.detail || 'Yanlış şifre');
          setPin('');
        }
      } catch (error) {
        Alert.alert('Hata', 'Bir sorun oluştu');
      }
    };

    return (
      <SafeAreaView style={styles.container}>
        <AnimatedClouds />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.pinIconContainer}>
              <Ionicons name="lock-closed" size={45} color="#3FA9F5" />
            </View>
            <Text style={styles.pinTitle}>Güvenlik Kodu</Text>
            <Text style={styles.heroSubtitle}>6 haneli PIN kodunuzu girin</Text>
          </View>

          <View style={styles.modernFormContainer}>
            <Text style={styles.modernLabel}>Şifreniz</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="keypad-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                placeholder="• • • • • •"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                value={pin}
                onChangeText={(t) => {
                  if (t.length > pin.length) void keyCharHaptic();
                  setPin(t);
                }}
                maxLength={6}
              />
              <TouchableOpacity
                onPress={() => {
                  void tapButtonHaptic();
                  setShowPin(!showPin);
                }}
              >
                <Ionicons name={showPin ? "eye-off" : "eye"} size={22} color="#A0A0A0" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, pin.length !== 6 && styles.buttonDisabled]} 
              onPress={() => {
                void tapButtonHaptic();
                handleEnterPin();
              }}
              disabled={pin.length !== 6}
            >
              <Text style={styles.modernPrimaryButtonText}>GİRİŞ YAP</Text>
              <Ionicons name="log-in" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSecondaryButton}
              onPress={async () => {
                void tapButtonHaptic();
                setPin('');
                setScreen('login');
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==================== ŞİFREMİ UNUTTUM EKRANI ====================
  if (screen === 'forgot-password') {
    return (
      <SafeAreaView style={styles.container}>
        <AnimatedClouds />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.verifyIconContainer}>
              <Ionicons name="key-outline" size={50} color="#F59E0B" />
            </View>
            <Text style={styles.verifyTitle}>Şifremi Unuttum</Text>
            <Text style={styles.heroSubtitle}>Telefon numaranızı girin, size doğrulama kodu göndereceğiz</Text>
          </View>

          <View style={styles.modernFormContainer}>
            <Text style={styles.modernLabel}>Telefon Numarası</Text>
            <View style={styles.modernInputContainer}>
              <Text style={styles.phonePrefix}>+90</Text>
              <TextInput
                style={styles.modernPhoneInput}
                value={phone}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '');
                  if (cleaned.length > phone.length) void keyCharHaptic();
                  setPhone(cleaned);
                }}
                placeholder="5XX XXX XX XX"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, loading && styles.disabledButton]}
              onPress={async () => {
                void tapButtonHaptic();
                if (!phone || phone.length < 10) {
                  Alert.alert('Hata', 'Geçerli bir telefon numarası girin');
                  return;
                }
                
                setLoading(true);
                try {
                  // Önce kullanıcı var mı kontrol et
                  const checkResponse = await fetch(`${API_URL}/auth/check-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone })
                  });
                  const checkData = await checkResponse.json();
                  
                  if (!checkData.user_exists) {
                    Alert.alert('Hata', 'Bu numara ile kayıtlı kullanıcı bulunamadı');
                    setLoading(false);
                    return;
                  }
                  
                  // OTP gönder
                  const response = await fetch(`${API_URL}/auth/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone })
                  });
                  const data = await response.json();
                  
                  if (data.success) {
                    setScreen('reset-pin');
                  } else {
                    Alert.alert('Hata', apiErrMsg(data, 'OTP gönderilemedi'));
                  }
                } catch (error) {
                  Alert.alert('Hata', 'Bir hata oluştu');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.modernPrimaryButtonText}>DOĞRULAMA KODU GÖNDER</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSecondaryButton}
              onPress={() => {
                void tapButtonHaptic();
                setPhone('');
                setScreen('login');
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==================== YENİ ŞİFRE BELİRLEME EKRANI ====================
  if (screen === 'reset-pin') {
    return (
      <SafeAreaView style={styles.container}>
        <AnimatedClouds />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <View style={styles.verifyIconContainer}>
              <Ionicons name="lock-open-outline" size={50} color="#10B981" />
            </View>
            <Text style={styles.verifyTitle}>Yeni Şifre Belirle</Text>
            <Text style={styles.heroSubtitle}>{phone} numarasına gönderilen kodu girin ve yeni şifrenizi belirleyin</Text>
          </View>

          <View style={styles.modernFormContainer}>
            <Text style={styles.modernLabel}>Doğrulama Kodu</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="keypad-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                value={otp}
                onChangeText={(t) => {
                  if (t.length > otp.length) void keyCharHaptic();
                  setOtp(t);
                }}
                placeholder="6 haneli kod"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <Text style={[styles.modernLabel, { marginTop: 16 }]}>Yeni Şifre (6 Haneli PIN)</Text>
            <View style={styles.modernInputContainer}>
              <Ionicons name="lock-closed-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <TextInput
                style={styles.modernInput}
                value={pin}
                onChangeText={(t) => {
                  if (t.length > pin.length) void keyCharHaptic();
                  setPin(t);
                }}
                placeholder="6 haneli yeni şifre"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, loading && styles.disabledButton]}
              onPress={async () => {
                void tapButtonHaptic();
                if (!otp || otp.length !== 6) {
                  Alert.alert('Hata', 'Geçerli bir doğrulama kodu girin');
                  return;
                }
                if (!pin || pin.length !== 6) {
                  Alert.alert('Hata', 'Şifre 6 haneli olmalıdır');
                  return;
                }
                
                setLoading(true);
                try {
                  // Önce OTP doğrula
                  const verifyResponse = await fetch(`${API_URL}/auth/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, otp })
                  });
                  const verifyData = await verifyResponse.json();
                  
                  if (!verifyData.success) {
                    Alert.alert('Hata', verifyData.detail || 'Doğrulama kodu yanlış');
                    setLoading(false);
                    return;
                  }
                  
                  // Şifreyi güncelle
                  const resetResponse = await fetch(`${API_URL}/auth/reset-pin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, new_pin: pin })
                  });
                  const resetData = await resetResponse.json();
                  
                  if (resetData.success) {
                    Alert.alert('Başarılı', 'Şifreniz güncellendi. Giriş yapabilirsiniz.', [
                      { text: 'Tamam', onPress: () => {
                        setOtp('');
                        setPin('');
                        setScreen('login');
                      }}
                    ]);
                  } else {
                    Alert.alert('Hata', resetData.detail || 'Şifre güncellenemedi');
                  }
                } catch (error) {
                  Alert.alert('Hata', 'Bir hata oluştu');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.modernPrimaryButtonText}>ŞİFREYİ GÜNCELLE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modernSecondaryButton}
              onPress={async () => {
                void tapButtonHaptic();
                setOtp('');
                setPin('');
                setScreen('forgot-password');
              }}
            >
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'role-select') {
    const mergeVehicleIntoUser = (u: NonNullable<typeof user>) => {
      if (!rideVehicleKind || !selectedRole) return { ...u, role: selectedRole || u.role };
      const prev =
        u.driver_details && typeof u.driver_details === 'object' ? { ...u.driver_details } : {};
      if (selectedRole === 'driver') (prev as Record<string, unknown>).vehicle_kind = rideVehicleKind;
      else (prev as Record<string, unknown>).passenger_preferred_vehicle = rideVehicleKind;
      return { ...u, role: selectedRole, driver_details: prev };
    };

    const handleRoleSelect = (role: 'passenger' | 'driver') => {
      roleScreenHaptic();
      setSelectedRole(role);
      setRideVehicleKind(null);
      
      // Animasyon
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const handleContinue = async () => {
      if (!selectedRole || !rideVehicleKind) return;
      roleScreenHaptic();
      try {
        if (user?.id) {
          await fetch(
            `${API_URL}/user/set-ride-vehicle-kind?user_id=${encodeURIComponent(user.id)}&role=${selectedRole}&vehicle_kind=${rideVehicleKind}`,
            { method: 'POST' }
          ).catch(() => {});
        }
        // Sürücü seçildiyse KYC kontrolü yap
        if (selectedRole === 'driver') {
          const kycResponse = await fetch(`${API_URL}/driver/kyc/status?user_id=${user?.id}`);
          const kycData = await kycResponse.json();
          
          if (kycData.kyc_status === 'none' || kycData.kyc_status === 'rejected') {
            if (user) setUser(mergeVehicleIntoUser(user));
            setScreen('driver-kyc');
            return;
          } else if (kycData.kyc_status === 'pending') {
            // KYC beklemede - Dashboard'a git ama pending ekranı göster
            setKycStatus({
              status: 'pending',
              submitted_at: kycData.submitted_at
            });
            await AsyncStorage.setItem(`last_role_${user?.id}`, selectedRole);
            if (user) setUser(mergeVehicleIntoUser(user));
            setScreen('dashboard');
            return;
          }
          // approved ise KYC durumunu temizle
          setKycStatus(null);
        }
        
        await AsyncStorage.setItem(`last_role_${user?.id}`, selectedRole);
        if (selectedRole && user) {
          const updatedUser = mergeVehicleIntoUser(user);
          setUser(updatedUser);
          
          // 📍 Hemen konum izni iste
          console.log('📍 Rol seçildi, konum izni isteniyor...');
          requestLocationPermission();
          
          setScreen('dashboard');
        }
      } catch (error) {
        console.error('Role kaydedilemedi:', error);
        if (selectedRole && user) {
          const updatedUser = mergeVehicleIntoUser(user);
          setUser(updatedUser);
          
          // 📍 Konum izni iste
          requestLocationPermission();
          
          setScreen('dashboard');
        }
      }
    };

    return (
      <ImageBackground 
        source={require('../assets/images/role-background.png')} 
        style={styles.roleSelectionContainer}
        imageStyle={styles.roleBackgroundImage}
      >
        <SafeAreaView style={styles.roleSelectionSafe}>
          {roleSelectTripExitBanner ? (
            <Animated.View
              style={{
                opacity: roleSelectBannerShimmer,
                backgroundColor: '#B91C1C',
                paddingVertical: 14,
                paddingHorizontal: 14,
                marginHorizontal: 10,
                marginBottom: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#FCA5A5',
              }}
              pointerEvents="none"
            >
              <Text
                style={{
                  color: '#FFF',
                  textAlign: 'center',
                  fontWeight: '800',
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {roleSelectTripExitBanner}
              </Text>
            </Animated.View>
          ) : null}
          {/* Üst Bar */}
          <View style={styles.roleTopBarCompact}>
            <TouchableOpacity 
              style={styles.roleExitBtn}
              onPress={() => {
                roleScreenHaptic();
                Alert.alert('Çıkış', 'Oturumu kapatmak istiyor musunuz?', [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Çıkış', style: 'destructive', onPress: async () => {
                    await AsyncStorage.removeItem('user');
                    setUser(null);
                    setScreen('login');
                  }}
                ]);
              }}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
            
            <View style={{ flex: 1, marginHorizontal: 6 }}>
              <Text style={styles.roleTopTitle}>Bugün nasıl ilerlemek{'\n'}istersiniz?</Text>
              <Text style={styles.roleTopSubtitle}>Yolcu veya sürücü — araç ya da motor</Text>
            </View>
            
            {isAdmin ? (
              <TouchableOpacity style={styles.roleAdminBtn} onPress={async () => { roleScreenHaptic(); setShowAdminPanel(true); }}>
                <Ionicons name="settings-outline" size={22} color="#3FA9F5" />
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          {/* Ana İçerik - Flex ile tam ekran */}
          <View style={styles.roleMainContent}>
            {/* Rol Kartları - Yan yana */}
            <View style={styles.roleCardsRow}>
              {/* Yolcu */}
              <TouchableOpacity
                style={[styles.roleCardCompact, selectedRole === 'passenger' && styles.roleCardSelected]}
                onPress={async () => { handleRoleSelect('passenger'); }}
                activeOpacity={0.88}
              >
                <View style={[styles.roleIconCircle, selectedRole === 'passenger' && styles.roleIconCircleActive]}>
                  <MaterialCommunityIcons name="account-supervisor-circle" size={40} color={selectedRole === 'passenger' ? '#FFF' : '#0EA5E9'} />
                </View>
                <Text style={[styles.roleCardLabel, selectedRole === 'passenger' && styles.roleCardLabelActive]}>Yolcu</Text>
                <Text style={styles.roleCardDesc}>Teklif gönder</Text>
                {selectedRole === 'passenger' && (
                  <View style={styles.roleCheckBadge}>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Sürücü */}
              <TouchableOpacity
                style={[styles.roleCardCompact, selectedRole === 'driver' && styles.roleCardSelected]}
                onPress={async () => { handleRoleSelect('driver'); }}
                activeOpacity={0.88}
              >
                <View style={[styles.roleIconCircle, selectedRole === 'driver' && styles.roleIconCircleActive]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialCommunityIcons name="car-side" size={34} color={selectedRole === 'driver' ? '#FFF' : '#2563EB'} />
                    <MaterialCommunityIcons name="motorbike" size={30} color={selectedRole === 'driver' ? '#E9D5FF' : '#7C3AED'} />
                  </View>
                </View>
                <Text style={[styles.roleCardLabel, selectedRole === 'driver' && styles.roleCardLabelActive]}>Sürücü</Text>
                <Text style={styles.roleCardDesc}>Teklif al</Text>
                {selectedRole === 'driver' && (
                  <View style={styles.roleCheckBadge}>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {selectedRole && (
              <View style={styles.roleVehicleSection}>
                <Text style={styles.roleVehiclePrompt}>
                  {selectedRole === 'passenger'
                    ? 'Nasıl bir araç çağırmak istersiniz?'
                    : 'Ne ile yolculuk yapıyorsunuz?'}
                </Text>
                <View style={styles.roleVehicleRow}>
                  <TouchableOpacity
                    style={[styles.roleVehicleChip, rideVehicleKind === 'car' && styles.roleVehicleChipActive]}
                    onPress={() => {
                      roleScreenHaptic();
                      setRideVehicleKind('car');
                    }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name="car-side"
                      size={26}
                      color={rideVehicleKind === 'car' ? '#FFF' : '#1D4ED8'}
                    />
                    <Text
                      style={[
                        styles.roleVehicleChipText,
                        rideVehicleKind === 'car' && styles.roleVehicleChipTextActive,
                      ]}
                    >
                      Araba
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleVehicleChip, rideVehicleKind === 'motorcycle' && styles.roleVehicleChipActiveMotor]}
                    onPress={() => {
                      roleScreenHaptic();
                      setRideVehicleKind('motorcycle');
                    }}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name="motorbike"
                      size={26}
                      color={rideVehicleKind === 'motorcycle' ? '#FFF' : '#6D28D9'}
                    />
                    <Text
                      style={[
                        styles.roleVehicleChipText,
                        rideVehicleKind === 'motorcycle' && styles.roleVehicleChipTextActive,
                      ]}
                    >
                      Motor
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Devam Et + Leylek Muhabbeti — altta, arka plandaki görsel daha görünür kalsın */}
          <View style={styles.roleBottomFooterColumn}>
            <TouchableOpacity
              style={[
                styles.roleContinueBtnLarge,
                (!selectedRole || !rideVehicleKind) && styles.roleContinueBtnDisabled,
              ]}
              onPress={handleContinue}
              disabled={!selectedRole || !rideVehicleKind}
              activeOpacity={0.9}
            >
              <Text style={styles.roleContinueTextLarge}>Devam Et</Text>
              <Ionicons name="arrow-forward" size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.roleSeparatorCompact}>
              <View style={styles.roleSeparatorLine} />
              <Text style={styles.roleSeparatorText}>veya</Text>
              <View style={styles.roleSeparatorLine} />
            </View>

            <TouchableOpacity
              style={styles.communityBtnCompact}
              onPress={async () => {
                roleScreenHaptic();
                setScreen('community');
              }}
              activeOpacity={0.88}
            >
              <View style={styles.communityLogoBox}>
                <Ionicons name="chatbubbles" size={28} color="#FFF" />
              </View>
              <View style={styles.communityTextBox}>
                <Text style={styles.communityBtnTitleProminent}>Leylek Muhabbeti</Text>
                <Text style={styles.communityBtnSubProminent}>Şehir topluluğuna katıl</Text>
              </View>
              <View style={styles.communityArrow}>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        
        {/* Admin Panel Modal */}
        {isAdmin && (
          <Modal
            visible={showAdminPanel}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setShowAdminPanel(false)}
          >
            <AdminPanel 
              adminPhone={user?.phone?.replace(/\D/g, '') || ''} 
              onClose={() => setShowAdminPanel(false)} 
            />
          </Modal>
        )}
      </ImageBackground>
    );
  }

  // Dashboard
  if (user && screen === 'dashboard') {
    return user.role === 'passenger' ? (
      <PassengerDashboard 
        user={user} 
        logout={logout}
        destination={destination}
        setDestination={setDestination}
        userLocation={userLocation}
        showDestinationPicker={showDestinationPicker}
        setShowDestinationPicker={setShowDestinationPicker}
        setScreen={setScreen}
        requestLocationPermission={requestLocationPermission}
        onShowTripEndedBanner={setRoleSelectTripExitBanner}
      />
    ) : (
      <RuntimeBoundary name="DriverDashboard">
        <DriverDashboard 
          user={user} 
          logout={logout} 
          setScreen={setScreen} 
          kycStatusProp={kycStatus}
          setKycStatusProp={setKycStatus}
          onShowTripEndedBanner={setRoleSelectTripExitBanner}
        />
      </RuntimeBoundary>
    );
  }

  // Community Screen - Leylek Muhabbeti
  if (user && screen === 'community') {
    return (
      <CommunityScreen
        user={{
          id: user.id,
          name: user.name || 'Kullanıcı',
          role: user.role || 'passenger',
          city: (user as { city?: string }).city,
          rating: (user as { rating?: number }).rating,
        }}
        onBack={() => setScreen('role-select')}
        apiUrl={API_URL}
      />
    );
  }

  // Sürücü KYC Ekranı
  if (user && screen === 'driver-kyc') {
    return (
      <DriverKYCScreen
        userId={user.id}
        userName={user.name || 'Kullanıcı'}
        vehicleKind={
          (user.driver_details as { vehicle_kind?: string } | undefined)?.vehicle_kind === 'motorcycle'
            ? 'motorcycle'
            : 'car'
        }
        onBack={() => setScreen('role-select')}
        onSuccess={() => {
          Alert.alert(
            '✅ Başvuru Alındı',
            'Başvurunuz inceleniyor. Onaylandığında sürücü olarak giriş yapabilirsiniz.',
            [{ text: 'Tamam', onPress: () => setScreen('role-select') }]
          );
        }}
        apiUrl={API_URL}
      />
    );
  }

  // 🔒 FALLBACK - Beklenmeyen durumlarda login ekranına yönlendir
  // Bu beyaz ekran sorununu önler
  console.log('⚠️ Unexpected screen state:', { screen, hasUser: !!user });
  
  // Eğer user yoksa login'e, user varsa role-select'e yönlendir
  if (!user && screen !== 'login' && screen !== 'register' && screen !== 'otp' && screen !== 'forgot-password' && screen !== 'reset-pin') {
    setTimeout(() => setScreen('login'), 100);
  } else if (user && screen !== 'dashboard' && screen !== 'role-select' && screen !== 'community' && screen !== 'driver-kyc') {
    setTimeout(() => setScreen('role-select'), 100);
  }
  
  // Loading göster (beyaz ekran yerine)
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#3FA9F5" />
      <Text style={{ color: '#fff', marginTop: 12 }}>Yükleniyor...</Text>
    </View>
  );
}

/** Büyük sistem yazı ölçeğinde teklif UI şişmesini sınırlar (özellikle Android). */
const OFFER_CARD_MAX_FONT_SCALE = 1.28;

// ==================== YANIP SÖNEN TEKLİF GÖNDER BUTONU ====================
function AnimatedOfferButton({ onPress }: { onPress: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Pulse animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.animatedOfferButton, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={['#3FA9F5', '#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.offerButtonGradient}
        >
          <Animated.View style={[styles.offerButtonGlow, { opacity: glowAnim }]} />
          <Ionicons name="send" size={22} color="#FFF" />
          <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={styles.animatedOfferButtonText}>Teklif Gönder</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ==================== MODERN BASİT TEKLİF KARTI ====================
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 UBER/INDRIVE TARZI TEKLİF KARTI - V2.0
// ═══════════════════════════════════════════════════════════════════════════

// Ana Renk Paleti - Gök Mavisi
const SKY_BLUE = {
  primary: '#4FA3FF',      // Ana mavi (daha canlı)
  dark: '#2563EB',         // Koyu mavi
  light: '#EFF6FF',        // Açık mavi arka plan
  accent: '#60A5FA',       // Vurgu mavi
};

// Yardımcı: En iyi teklifi belirle (en düşük fiyat + en yakın mesafe)
const isBestOffer = (offer: any, index: number, total: number) => {
  // İlk teklif veya tek teklif ise "önerilen" olarak işaretle
  return index === 0 && total > 0;
};

function TikTokOfferCard({ 
  offer, 
  index, 
  total, 
  onAccept,
  onDismiss,
  isPassenger = true,
  driverArrivalMin = 0,
  tripDurationMin = 0,
  onSendOffer
}: { 
  offer: any; 
  index: number; 
  total: number; 
  onAccept: () => void;
  onDismiss?: () => void;
  isPassenger?: boolean;
  driverArrivalMin?: number;
  tripDurationMin?: number;
  onSendOffer?: (price: number) => Promise<boolean>;
}) {
  // Şoför fiyat girişi için state
  const [priceInput, setPriceInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [accepting, setAccepting] = useState(false);
  
  // Teklif süresi (90 saniye countdown)
  const [timeLeft, setTimeLeft] = useState(90);
  
  // Animasyonlar
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Giriş animasyonu
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Countdown timer
  useEffect(() => {
    if (!isPassenger) return; // Sadece yolcu tarafında göster
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPassenger]);
  
  // Pulse animasyonu (yeni teklif için)
  useEffect(() => {
    if (index === 0 && isPassenger) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [index, isPassenger]);
  
  // Hesaplamalar
  const arrivalTime = driverArrivalMin || offer.estimated_arrival_min || Math.round((offer.distance_to_passenger_km || 5) / 40 * 60);
  const distanceToPassengerKm = offer.distance_to_passenger_km?.toFixed(1) || offer.distance_km?.toFixed(1) || '?';
  const tripDistanceKm = offer.trip_distance_km?.toFixed(1) || '?';
  const tripDuration = tripDurationMin || offer.trip_duration_min || Math.round((offer.trip_distance_km || 10) / 50 * 60);
  // Sadece isim göster (soyad yok)
  const fullName = isPassenger ? offer.driver_name : offer.passenger_name;
  const personName = fullName?.split(' ')[0] || 'Kullanıcı';
  const personRating = isPassenger ? (offer.driver_rating ?? 4.0) : 4.0;
  const tripCount = Math.floor(personRating * 100) + 50;
  const isBest = isBestOffer(offer, index, total);

  // Fiyat +/- butonları için
  const adjustPrice = (delta: number) => {
    const current = Number(priceInput) || 0;
    const newPrice = Math.max(10, current + delta);
    setPriceInput(String(newPrice));
  };

  // Şoför için anında teklif gönder
  const handleQuickSend = async () => {
    if (!priceInput || sending || sent) return;
    const price = Number(priceInput);
    if (price < 10) {
      Alert.alert('Hata', 'Minimum 10₺ giriniz');
      return;
    }
    
    setSending(true);
    
    if (onSendOffer) {
      const success = await onSendOffer(price);
      setSending(false);
      if (success) {
        setSent(true);
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.05, duration: 150, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setTimeout(() => {
          setSent(false);
          setPriceInput('');
        }, 2000);
      }
    } else {
      onAccept();
      setSending(false);
    }
  };

  // Kabul et
  const handleAccept = async () => {
    setAccepting(true);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onAccept();
    });
  };

  // Süre formatla
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Animated.View style={[
      uberCardStyles.container,
      {
        transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
        opacity: fadeAnim,
      }
    ]}>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 👤 YOLCU GÖRÜNÜMÜ - Şoför Teklifini Görüyor */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isPassenger && (
        <>
          {/* Üst Bar - Teklif Sayısı ve Süre */}
          <View style={uberCardStyles.topBar}>
            <View style={uberCardStyles.offerCountBadge}>
              <Ionicons name="car" size={16} color={SKY_BLUE.primary} />
              <Text style={uberCardStyles.offerCountText}>{total} sürücü teklif verdi</Text>
              <View style={uberCardStyles.liveDot} />
            </View>
            <View style={[uberCardStyles.timerBadge, timeLeft <= 30 && uberCardStyles.timerWarning]}>
              <Ionicons name="time-outline" size={14} color={timeLeft <= 30 ? '#EF4444' : '#64748B'} />
              <Text style={[uberCardStyles.timerText, timeLeft <= 30 && uberCardStyles.timerTextWarning]}>
                {formatTime(timeLeft)}
              </Text>
            </View>
          </View>
          
          {/* Canlı Güncelleme Göstergesi */}
          <View style={uberCardStyles.liveUpdateBar}>
            <ActivityIndicator size="small" color={SKY_BLUE.primary} />
            <Text style={uberCardStyles.liveUpdateText}>Yeni teklifler geliyor...</Text>
          </View>

          {/* ÖNERİLEN TEKLİF Etiketi */}
          {isBest && (
            <View style={uberCardStyles.recommendedBadge}>
              <Ionicons name="trophy" size={16} color="#F59E0B" />
              <Text style={uberCardStyles.recommendedText}>ÖNERİLEN TEKLİF</Text>
              <View style={uberCardStyles.recommendedGlow} />
            </View>
          )}

          {/* Ana Kart */}
          <View style={[uberCardStyles.mainCard, isBest && uberCardStyles.mainCardBest]}>
            {/* Şoför Profili */}
            <View style={uberCardStyles.driverRow}>
              <View style={uberCardStyles.avatarContainer}>
                {offer.driver_photo ? (
                  <Image source={{ uri: offer.driver_photo }} style={uberCardStyles.avatar} />
                ) : (
                  <View style={uberCardStyles.avatarPlaceholder}>
                    <Text style={uberCardStyles.avatarLetter}>{personName?.charAt(0) || '?'}</Text>
                  </View>
                )}
                <View style={uberCardStyles.onlineDot} />
              </View>
              
              <View style={uberCardStyles.driverInfo}>
                <Text style={uberCardStyles.driverName}>{personName}</Text>
                <View style={uberCardStyles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={uberCardStyles.ratingText}>{personRating.toFixed(1)}</Text>
                  <Text style={uberCardStyles.tripCount}>• {tripCount} yolculuk</Text>
                </View>
                {offer.vehicle_model && (
                  <Text style={uberCardStyles.vehicleText}>
                    {offer.vehicle_model} {offer.vehicle_color ? `• ${offer.vehicle_color}` : ''}
                  </Text>
                )}
              </View>

              {/* Fiyat - Sağda */}
              <View style={uberCardStyles.priceContainer}>
                <Text style={uberCardStyles.priceLabel}>Teklif</Text>
                <Text style={uberCardStyles.priceAmount}>₺{offer.price || '?'}</Text>
              </View>
            </View>

            {/* Mesafe ve Süre Bilgileri */}
            <View style={uberCardStyles.statsRow}>
              <View style={uberCardStyles.statItem}>
                <Ionicons name="navigate-circle" size={20} color={SKY_BLUE.primary} />
                <Text style={uberCardStyles.statValue}>{distanceToPassengerKm} km</Text>
                <Text style={uberCardStyles.statLabel}>uzaklık</Text>
              </View>
              <View style={uberCardStyles.statDivider} />
              <View style={uberCardStyles.statItem}>
                <Ionicons name="time" size={20} color={SKY_BLUE.primary} />
                <Text style={uberCardStyles.statValue}>{arrivalTime} dk</Text>
                <Text style={uberCardStyles.statLabel}>varış</Text>
              </View>
              <View style={uberCardStyles.statDivider} />
              <View style={uberCardStyles.statItem}>
                <Ionicons name="car" size={20} color="#F59E0B" />
                <Text style={uberCardStyles.statValue}>{tripDistanceKm} km</Text>
                <Text style={uberCardStyles.statLabel}>yolculuk</Text>
              </View>
            </View>

            {/* Aksiyon Butonları */}
            <View style={uberCardStyles.actionRow}>
              <TouchableOpacity 
                style={uberCardStyles.rejectBtn} 
                onPress={onDismiss} 
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[uberCardStyles.acceptBtn, isBest && uberCardStyles.acceptBtnBest]} 
                onPress={handleAccept} 
                activeOpacity={0.85}
                disabled={accepting}
              >
                {accepting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={22} color="#FFF" />
                    <Text style={uberCardStyles.acceptBtnText}>Kabul Et</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sayfa Göstergesi */}
          {total > 1 && (
            <View style={uberCardStyles.pagination}>
              {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    uberCardStyles.paginationDot,
                    i === index % 5 && uberCardStyles.paginationDotActive
                  ]} 
                />
              ))}
              <Text style={uberCardStyles.paginationText}>
                Kaydırarak diğer teklifleri gör ({index + 1}/{total})
              </Text>
            </View>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🚖 ŞOFÖR GÖRÜNÜMÜ - Yolcu Talebi + Teklif Gönder */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!isPassenger && (
        <>
          {/* Başlık - Premium Tasarım */}
          <View style={driverViewStyles.header}>
            <Animated.View style={[driverViewStyles.headerIconPulse, { transform: [{ scale: pulseAnim }] }]}>
              <View style={driverViewStyles.headerIcon}>
                <Ionicons name="person-add" size={26} color="#FFF" />
              </View>
            </Animated.View>
            <View style={driverViewStyles.headerContent}>
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.headerTitle}>🚨 Yeni Yolcu Talebi!</Text>
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.headerSubtitle}>Hızlı teklif ver, yolcuyu kazan</Text>
            </View>
          </View>

          {/* Yolcu İsmi Badge */}
          {personName && (
            <View style={driverViewStyles.passengerBadge}>
              <Ionicons name="person" size={16} color={SKY_BLUE.primary} />
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.passengerName}>{personName}</Text>
              <View style={driverViewStyles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
              </View>
            </View>
          )}

          {/* Adres Kartı */}
          <View style={driverViewStyles.addressCard}>
            {/* Alış Noktası */}
            <View style={driverViewStyles.addressRow}>
              <View style={[driverViewStyles.addressDot, { backgroundColor: SKY_BLUE.primary }]} />
              <View style={driverViewStyles.addressContent}>
                <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.addressLabel}>ALIŞ NOKTASI</Text>
                <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.addressText} numberOfLines={2}>
                  {offer.pickup_location || offer.pickup_address || 'Konum alınıyor...'}
                </Text>
              </View>
            </View>
            
            <View style={driverViewStyles.addressLine}>
              <View style={driverViewStyles.addressLineDashed} />
            </View>
            
            {/* Varış Noktası */}
            <View style={driverViewStyles.addressRow}>
              <View style={[driverViewStyles.addressDot, { backgroundColor: '#22C55E' }]} />
              <View style={driverViewStyles.addressContent}>
                <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.addressLabel}>VARIŞ NOKTASI</Text>
                <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.addressText} numberOfLines={2}>
                  {offer.dropoff_location || offer.dropoff_address || 'Hedef alınıyor...'}
                </Text>
              </View>
            </View>
          </View>

          {/* Mesafe ve Kazanç Bilgileri */}
          <View style={driverViewStyles.statsRow}>
            <View style={driverViewStyles.statBox}>
              <Ionicons name="location" size={22} color={SKY_BLUE.primary} />
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.statValue}>{distanceToPassengerKm} km</Text>
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.statLabel}>Yolcuya</Text>
            </View>
            <View style={driverViewStyles.statBox}>
              <Ionicons name="time" size={22} color={SKY_BLUE.primary} />
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.statValue}>{arrivalTime} dk</Text>
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.statLabel}>Varış</Text>
            </View>
            <View style={driverViewStyles.statBox}>
              <Ionicons name="navigate" size={22} color="#F59E0B" />
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.statValue}>{tripDistanceKm} km</Text>
              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.statLabel}>Yolculuk</Text>
            </View>
          </View>

          {/* Fiyat Girişi - +/- Butonları ile */}
          <View style={driverViewStyles.priceSection}>
            <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.priceSectionTitle}>💰 Teklif Tutarını Belirle</Text>
            
            <View style={driverViewStyles.priceInputRow}>
              {/* Eksi Butonu */}
              <TouchableOpacity 
                style={driverViewStyles.adjustBtn}
                onPress={() => adjustPrice(-10)}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={28} color={SKY_BLUE.primary} />
              </TouchableOpacity>
              
              {/* Fiyat Input */}
              <View style={driverViewStyles.priceInputContainer}>
                <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.priceCurrency}>₺</Text>
                <TextInput
                  style={driverViewStyles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={priceInput}
                  onChangeText={setPriceInput}
                  editable={!sending && !sent}
                  maxLength={5}
                  maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE}
                />
              </View>
              
              {/* Artı Butonu */}
              <TouchableOpacity 
                style={driverViewStyles.adjustBtn}
                onPress={() => adjustPrice(10)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={28} color={SKY_BLUE.primary} />
              </TouchableOpacity>
            </View>
            
            {/* Hızlı Fiyat Seçenekleri */}
            <View style={driverViewStyles.quickPrices}>
              {[50, 100, 150, 200].map(price => (
                <TouchableOpacity 
                  key={price}
                  style={[
                    driverViewStyles.quickPriceBtn,
                    priceInput === String(price) && driverViewStyles.quickPriceBtnActive
                  ]}
                  onPress={() => setPriceInput(String(price))}
                >
                  <Text
                    maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE}
                    style={[
                    driverViewStyles.quickPriceText,
                    priceInput === String(price) && driverViewStyles.quickPriceTextActive
                  ]}>₺{price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Gönder Butonu */}
          <TouchableOpacity 
            style={[
              driverViewStyles.sendBtn,
              sent && driverViewStyles.sendBtnSuccess,
              (!priceInput || sending) && driverViewStyles.sendBtnDisabled
            ]} 
            onPress={handleQuickSend} 
            activeOpacity={0.85}
            disabled={!priceInput || sending || sent}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name={sent ? "checkmark-done" : "send"} size={24} color="#FFF" />
            )}
            <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.sendBtnText}>
              {sent ? 'Teklif Gönderildi!' : sending ? 'Gönderiliyor...' : 'Teklif Gönder'}
            </Text>
          </TouchableOpacity>

          {/* İptal/Kapat Butonu */}
          <TouchableOpacity 
            style={driverViewStyles.cancelBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={driverViewStyles.cancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 UBER/INDRIVE TARZI STİLLER - YOLCU
// ═══════════════════════════════════════════════════════════════════════════
const uberCardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
  },
  // Üst Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  offerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SKY_BLUE.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  offerCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: SKY_BLUE.dark,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginLeft: 4,
  },
  liveUpdateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  liveUpdateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#16A34A',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  timerWarning: {
    backgroundColor: '#FEF2F2',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  timerTextWarning: {
    color: '#EF4444',
  },
  // Önerilen Badge
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 10,
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  recommendedGlow: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  // Ana Kart
  mainCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mainCardBest: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  // Şoför Satırı
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: SKY_BLUE.light,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SKY_BLUE.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 3,
  },
  tripCount: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 6,
  },
  vehicleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  // Fiyat Container
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  priceAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: SKY_BLUE.dark,
  },
  // Stats Satırı
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  // Aksiyon Satırı
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rejectBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SKY_BLUE.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  acceptBtnBest: {
    backgroundColor: '#22C55E',
  },
  acceptBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  paginationDotActive: {
    backgroundColor: SKY_BLUE.primary,
    width: 20,
  },
  paginationText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 ŞOFÖR GÖRÜNÜMÜ STİLLERİ
// ═══════════════════════════════════════════════════════════════════════════
const driverViewStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerIconPulse: {
    // Animasyonlu wrapper
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 3,
  },
  // Yolcu Badge
  passengerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(63, 169, 245, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.4)',
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  // Adres Kartı - Koyu Lacivert
  addressCard: {
    backgroundColor: 'rgba(30, 58, 95, 0.9)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
  },
  addressContent: {
    flex: 1,
    marginLeft: 14,
  },
  addressLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  addressLine: {
    marginLeft: 6,
    marginVertical: 8,
    height: 28,
    justifyContent: 'center',
  },
  addressLineDashed: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(63, 169, 245, 0.4)',
    borderStyle: 'dashed',
  },
  // Stats - Premium Lacivert Tema
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(30, 58, 95, 0.9)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(63, 169, 245, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  // Fiyat Section - Koyu Lacivert Tema
  priceSection: {
    backgroundColor: 'rgba(30, 58, 95, 0.95)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.4)',
  },
  priceSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  adjustBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: SKY_BLUE.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: SKY_BLUE.primary,
    shadowColor: SKY_BLUE.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SKY_BLUE.dark,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 20,
    minWidth: 180,
    justifyContent: 'center',
    shadowColor: SKY_BLUE.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  priceCurrency: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
  },
  priceInput: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFF',
    minWidth: 100,
    textAlign: 'center',
    paddingVertical: 0,
  },
  // Hızlı Fiyatlar
  quickPrices: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  quickPriceBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPriceBtnActive: {
    backgroundColor: SKY_BLUE.light,
    borderWidth: 2,
    borderColor: SKY_BLUE.primary,
  },
  quickPriceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  quickPriceTextActive: {
    color: SKY_BLUE.dark,
  },
  // Gönder Butonu
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SKY_BLUE.primary,
    paddingVertical: 20,
    borderRadius: 18,
    gap: 12,
    shadowColor: SKY_BLUE.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  sendBtnSuccess: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  // İptal Butonu
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 YOLCU TEKLİF KARTI - SEARCHING PHASE
// ═══════════════════════════════════════════════════════════════════════════
function PassengerOfferCard({ 
  offer, 
  index, 
  total, 
  onAccept, 
  onDismiss,
  isBest = false
}: { 
  offer: any; 
  index: number; 
  total: number; 
  onAccept: () => void;
  onDismiss?: () => void;
  isBest?: boolean;
}) {
  const [accepting, setAccepting] = useState(false);
  
  const personName = displayFirstName(offer.driver_name, 'Sürücü');
  const personRating = offer.driver_rating ?? 4.0;
  const tripCount = Math.floor(personRating * 100) + 50;
  const distanceToPassengerKm = offer.distance_to_passenger_km?.toFixed(1) || offer.distance_km?.toFixed(1) || '?';
  const arrivalTime = offer.estimated_arrival_min || Math.round((offer.distance_to_passenger_km || 5) / 40 * 60);

  const handleAccept = async () => {
    setAccepting(true);
    onAccept();
  };

  return (
    <View style={[passengerCardStyles.card, isBest && passengerCardStyles.cardBest]}>
      {/* ÖNERİLEN Etiketi */}
      {isBest && (
        <View style={passengerCardStyles.bestBadge}>
          <Ionicons name="trophy" size={14} color="#F59E0B" />
          <Text style={passengerCardStyles.bestText}>ÖNERİLEN</Text>
        </View>
      )}
      
      {/* Üst Kısım - Sürücü Bilgisi + Fiyat */}
      <View style={passengerCardStyles.topRow}>
        {/* Avatar */}
        <View style={passengerCardStyles.avatarContainer}>
          {offer.driver_photo ? (
            <Image source={{ uri: offer.driver_photo }} style={passengerCardStyles.avatar} />
          ) : (
            <View style={passengerCardStyles.avatarPlaceholder}>
              <Text style={passengerCardStyles.avatarLetter}>{personName.charAt(0)}</Text>
            </View>
          )}
          <View style={passengerCardStyles.onlineDot} />
        </View>
        
        {/* Sürücü Bilgileri */}
        <View style={passengerCardStyles.driverInfo}>
          <Text style={passengerCardStyles.driverName}>{personName}</Text>
          <View style={passengerCardStyles.ratingRow}>
            <Ionicons name="star" size={12} color="#FBBF24" />
            <Text style={passengerCardStyles.ratingText}>{personRating.toFixed(1)}</Text>
            <Text style={passengerCardStyles.tripCount}>• {tripCount} yolculuk</Text>
          </View>
          {offer.vehicle_model && (
            <Text style={passengerCardStyles.vehicleText}>{offer.vehicle_model}</Text>
          )}
        </View>
        
        {/* Fiyat */}
        <View style={passengerCardStyles.priceBox}>
          <Text style={passengerCardStyles.priceAmount}>₺{offer.price || '?'}</Text>
        </View>
      </View>
      
      {/* Alt Kısım - Mesafe + Süre + Butonlar */}
      <View style={passengerCardStyles.bottomRow}>
        <View style={passengerCardStyles.statsRow}>
          <View style={passengerCardStyles.statItem}>
            <Ionicons name="navigate-circle-outline" size={16} color="#64748B" />
            <Text style={passengerCardStyles.statText}>{distanceToPassengerKm} km</Text>
          </View>
          <View style={passengerCardStyles.statItem}>
            <Ionicons name="time-outline" size={16} color="#64748B" />
            <Text style={passengerCardStyles.statText}>{arrivalTime} dk</Text>
          </View>
        </View>
        
        <View style={passengerCardStyles.actionRow}>
          {onDismiss && (
            <TouchableOpacity style={passengerCardStyles.dismissBtn} onPress={onDismiss}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[passengerCardStyles.acceptBtn, isBest && passengerCardStyles.acceptBtnBest]}
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={passengerCardStyles.acceptText}>Kabul Et</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// 🎨 YOLCU TEKLİF KARTI STİLLERİ
const passengerCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardBest: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
    gap: 4,
  },
  bestText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 3,
  },
  tripCount: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  vehicleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  priceBox: {
    backgroundColor: '#3FA9F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dismissBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3FA9F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  acceptBtnBest: {
    backgroundColor: '#22C55E',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

// 🎨 SEARCHING PHASE STİLLERİ
const searchingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  cancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  routeCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  // 📤 PAYLAŞ BUTONU
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3FA9F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
    alignSelf: 'center',
    gap: 6,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  offersContainer: {
    flex: 1,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  offersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  offersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  emptyOffersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PREMIUM KART STİLLERİ - YOLCU
// ═══════════════════════════════════════════════════════════════════════════
const premiumCardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
  },
  // Üst Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: SKY_BLUE.primary,
    width: 20,
  },
  pageNum: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  // Profil
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: SKY_BLUE.light,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: SKY_BLUE.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: SKY_BLUE.light,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 4,
  },
  tripCountText: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 8,
  },
  // Yolculuk Bilgisi
  tripInfoSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tripInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  tripInfoText: {
    marginLeft: 10,
  },
  tripInfoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  tripInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  // Araç
  vehicleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginBottom: 16,
  },
  vehicleText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 10,
    fontWeight: '500',
  },
  // Fiyat
  priceSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SKY_BLUE.light,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: SKY_BLUE.primary,
  },
  priceCurrency: {
    fontSize: 24,
    fontWeight: '600',
    color: SKY_BLUE.primary,
    marginTop: 8,
  },
  priceAmount: {
    fontSize: 52,
    fontWeight: '800',
    color: SKY_BLUE.dark,
    letterSpacing: -2,
  },
  // Aksiyon
  actionSection: {
    gap: 12,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SKY_BLUE.primary,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: SKY_BLUE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  acceptBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 10,
  },
  rejectBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  rejectBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  // Swipe Hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  swipeHintText: {
    fontSize: 13,
    color: '#94A3B8',
    marginLeft: 6,
  },
  // Yolcu Header (Şoför görünümünde)
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  passengerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: SKY_BLUE.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 14,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 ŞOFÖR KART STİLLERİ
// ═══════════════════════════════════════════════════════════════════════════
const driverCardStyles = StyleSheet.create({
  // Adres Bölümü
  addressSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressDot: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  addressLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginLeft: 11,
    marginVertical: 4,
  },
  addressContent: {
    flex: 1,
    marginLeft: 10,
  },
  addressLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  addressText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
    lineHeight: 22,
  },
  // Mesafe
  distanceSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  distanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    fontWeight: '500',
  },
  // Fiyat Girişi
  priceInputSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceInputLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '500',
  },
  priceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SKY_BLUE.dark,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 180,
    justifyContent: 'center',
  },
  priceInputCurrency: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    marginRight: 4,
  },
  priceInput: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFF',
    minWidth: 100,
    textAlign: 'center',
    paddingVertical: 0,
  },
  // Gönder Butonu
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SKY_BLUE.primary,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: SKY_BLUE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  sendBtnSuccess: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 10,
  },
});

// Eski stilleri kaldır (artık kullanılmıyor)
// Şoför Hedef Adresi Stilleri
const destinationStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  container: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 8,
  },
  address: {
    fontSize: 15,
    fontWeight: '500',
    color: '#064E3B',
    lineHeight: 22,
  },
});

// Şoför Fiyat Girişi Stilleri - Modern Mavi (Legacy)
const driverPriceStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1E40AF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#BFDBFE',
    marginBottom: 8,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currency: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginRight: 4,
  },
  input: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 0,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sendBtnSuccess: {
    backgroundColor: '#22C55E',
  },
  sendBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 10,
  },
});

// Modern Kart Stilleri (Legacy)
const modernCardStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  info: {
    marginLeft: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rating: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  priceBox: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  price: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3FA9F5',
  },
  infoCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 20,
  },
  vehicleText: {
    fontSize: 15,
    color: '#4B5563',
    marginLeft: 10,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3FA9F5',
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 16,
  },
  acceptText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 10,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeText: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },
});

// ==================== TRAFIK LAMBASI ANIMASYONU ====================
function TrafficLightBorder({ children }: { children: React.ReactNode }) {
  // Basitleştirildi - Android hatası düzeltildi
  return (
    <View style={styles.trafficLightBorder}>
      {children}
    </View>
  );
}

// ==================== TAM EKRAN OFFER KART ====================
function FullScreenOfferCard({ 
  offer, 
  onSwipeUp, 
  onSwipeDown,
  onAccept, 
  isFirst,
  isLast,
  currentIndex,
  totalOffers
}: { 
  offer: any; 
  onSwipeUp: () => void;
  onSwipeDown: () => void; 
  onAccept: () => void;
  isFirst: boolean;
  isLast: boolean;
  currentIndex: number;
  totalOffers: number;
}) {
  // Araç animasyonu
  const carBounce = useRef(new Animated.Value(0)).current;
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const carAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const buttonAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Araç yukarı aşağı hareket
    carAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(carBounce, {
          toValue: -10,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(carBounce, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    carAnimRef.current.start();

    // Buton nefes alma
    buttonAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulse, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    buttonAnimRef.current.start();

    return () => {
      carAnimRef.current?.stop();
      buttonAnimRef.current?.stop();
    };
  }, []);

  // Araç rengi emoji
  const getCarEmoji = (color: string) => {
    const colorMap: any = {
      'kırmızı': '🚗', 'red': '🚗',
      'mavi': '🚙', 'blue': '🚙',
      'siyah': '🚐', 'black': '🚐',
      'beyaz': '🚕', 'white': '🚕',
      'gri': '🚖', 'gray': '🚖',
      'gümüş': '🚘', 'silver': '🚘',
    };
    return colorMap[color?.toLowerCase()] || '🚗';
  };

  return (
      <View style={styles.fullScreenCard}>
        <View style={styles.fullScreenGradient}>
          {/* Sol Üst: Sadece Rakam */}
          <View style={styles.offerNumberCircle}>
            <Text style={styles.offerNumberText}>{currentIndex + 1}</Text>
          </View>

          {/* Sağ Üst: Şoför Profili + 10 Yıldız */}
          <View style={styles.driverProfileRight}>
            <View style={styles.driverAvatarSmall}>
              <Text style={styles.driverAvatarSmallText}>
                {displayFirstName(offer.driver_name, 'S').charAt(0) || '?'}
              </Text>
            </View>
            <Text style={styles.driverNameSmall}>{displayFirstName(offer.driver_name, 'Sürücü')}</Text>
            <Text style={styles.ratingLabel}>Puanlama</Text>
            <View style={styles.starsContainer}>
              {[...Array(10)].map((_, i) => (
                <Text key={i} style={styles.starIcon}>
                  {i < Math.round((offer.driver_rating ?? 4) * 2) ? '⭐' : '☆'}
                </Text>
              ))}
            </View>
          </View>

          {/* Tüm İçerik - Kaydırmasız, Tam Sığıyor */}
          <View style={styles.offerContentFlex}>
            {/* Araç - Hareketli */}
            <Animated.View style={[styles.vehicleSection, { transform: [{ translateY: carBounce }] }]}>
              {offer.is_premium && offer.vehicle_photo ? (
                <View style={styles.premiumBadgeContainer}>
                  <Text style={styles.premiumBadge}>⭐ PREMIUM</Text>
                </View>
              ) : null}
              
              <View style={styles.vehicleImageContainer}>
                <Text style={styles.vehicleEmoji}>
                  {getCarEmoji(offer.vehicle_color || '')}
                </Text>
                <Text style={styles.vehicleBrand}>
                  {offer.vehicle_model || 'BMW'}
                </Text>
              </View>
            </Animated.View>

            {/* Mesaj - BÜYÜK VE EFEKTLİ */}
            <View style={styles.messageSection}>
              <TrafficLightBorder>
                <View style={styles.timeInfoContainer}>
                  <View style={styles.timeInfoRow}>
                    <Text style={styles.timeEmoji}>📍</Text>
                    <View style={styles.timeTextContainer}>
                      <Text style={styles.timeTextLarge}>
                        {offer.estimated_time || offer.distance_to_passenger_km ? Math.ceil((offer.distance_to_passenger_km || 5) / 0.7) : 5} dakikada
                      </Text>
                      <Text style={styles.timeTextSubLarge}>gelirim</Text>
                    </View>
                  </View>
                  
                  <View style={styles.timeDivider} />
                  
                  <View style={styles.timeInfoRow}>
                    <Text style={styles.timeEmoji}>🚗</Text>
                    <View style={styles.timeTextContainer}>
                      <Text style={styles.timeTextLarge}>
                        {offer.trip_duration_min || Math.ceil((offer.trip_distance_km || 10) * 2)} dakikada
                      </Text>
                      <Text style={styles.timeTextSubLarge}>
                        {offer.trip_distance_km ? `(${offer.trip_distance_km} km)` : ''} gideriz
                      </Text>
                    </View>
                  </View>
                </View>
              </TrafficLightBorder>
            </View>

            {/* Fiyat */}
            <View style={styles.priceSection}>
              <View style={styles.priceBox}>
                <Text style={styles.priceLabelLarge}>Teklif Fiyatım</Text>
                <Text style={styles.priceLarge}>₺{offer.price}</Text>
              </View>
            </View>
          </View>

          {/* HEMEN GEL Butonu - SABİT EN ALTTA */}
          <View style={styles.fixedBottomButton}>
            <Animated.View style={[styles.acceptButtonContainer, { transform: [{ scale: buttonPulse }] }]}>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.acceptButtonGradient}
                >
                  <Text style={styles.acceptButtonText}>HEMEN GEL</Text>
                  <Ionicons name="checkmark-circle" size={36} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Alt: Navigation Butonları */}
          <View style={styles.navigationButtons}>
            {!isFirst && (
              <TouchableOpacity style={styles.navButton} onPress={onSwipeDown}>
                <Ionicons name="chevron-up" size={28} color="#FFF" />
                <Text style={styles.navButtonText}>Önceki</Text>
              </TouchableOpacity>
            )}
            {!isLast && (
              <TouchableOpacity style={styles.navButton} onPress={onSwipeUp}>
                <Text style={styles.navButtonText}>Sonraki</Text>
                <Ionicons name="chevron-down" size={28} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
  );
}

// ==================== SIMPLE PULSE BUTTON ====================
function AnimatedPulseButton({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const opacityAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Basit scale animasyonu
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animationRef.current.start();

    // Opacity animasyonu
    opacityAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    opacityAnimRef.current.start();

    return () => {
      animationRef.current?.stop();
      opacityAnimRef.current?.stop();
    };
  }, []);

  const handlePress = () => {
    if (disabled || loading) return;
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      disabled={loading || disabled}
      activeOpacity={disabled ? 1 : 0.8}
      style={[styles.callButtonContainer, disabled && { opacity: 0.48 }]}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientButton}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#FFF" />
          ) : (
            <>
              <Ionicons name="location" size={60} color="#FFF" />
              <Text style={styles.callButtonText}>TEKLİF GÖNDER</Text>
            </>
          )}
        </LinearGradient>
      </Animated.View>
      
      {/* Glow/Pulse efekti için dış halka */}
      <Animated.View style={[styles.pulseRing, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]} />
    </TouchableOpacity>
  );
}

// ==================== PASSENGER DASHBOARD ====================
function PassengerDashboard({ 
  user, 
  logout,
  destination,
  setDestination,
  userLocation,
  showDestinationPicker,
  setShowDestinationPicker,
  setScreen,
  requestLocationPermission,
  onShowTripEndedBanner,
}: { 
  user: User; 
  logout: () => void;
  destination: any;
  setDestination: any;
  userLocation: any;
  showDestinationPicker: boolean;
  setShowDestinationPicker: (show: boolean) => void;
  setScreen: (screen: 'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard' | 'forgot-password' | 'reset-pin') => void;
  requestLocationPermission: () => Promise<boolean>;
  onShowTripEndedBanner?: (message: string) => void;
}) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [showArrowHint, setShowArrowHint] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string | null>(null);
  
  // 🆕 request_id - Teklif sistemi için unique ID
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  
  // 🆕 Teklif veren sürücülerin konumları (SEARCHING phase için)
  const [offerDriverLocations, setOfferDriverLocations] = useState<DriverLocation[]>([]);
  
  // 🆕 20 km çevredeki sürücü sayısı
  const [nearbyDriverCount, setNearbyDriverCount] = useState(0);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  /** Rol ekranındaki kayıtlı tercih — teklif kartı açılınca buna çekilir, kartta değiştirilebilir */
  const passengerVehicleFromRole = useMemo((): 'car' | 'motorcycle' => {
    const d = user?.driver_details as { passenger_preferred_vehicle?: string } | undefined;
    return d?.passenger_preferred_vehicle === 'motorcycle' ? 'motorcycle' : 'car';
  }, [user?.driver_details]);

  const [rideVehiclePreference, setRideVehiclePreference] = useState<'car' | 'motorcycle'>(() =>
    passengerVehicleFromRole,
  );

  useEffect(() => {
    setRideVehiclePreference(passengerVehicleFromRole);
  }, [passengerVehicleFromRole]);

  // 🆕 Yolcu için yakındaki sürücü sayısını çek (SEARCHING phase)
  useEffect(() => {
    if (!activeTag || activeTag.status === 'matched' || activeTag.status === 'in_progress') {
      return;
    }
    
    const fetchNearbyDrivers = async () => {
      if (!userLocation) return;
      
      try {
        const vk = encodeURIComponent(rideVehiclePreference);
        const response = await fetch(
          `${API_URL}/driver/nearby-activity?lat=${userLocation.latitude}&lng=${userLocation.longitude}&radius_km=20&passenger_vehicle_kind=${vk}`
        );
        const data = await response.json();
        if (data.success && typeof data.nearby_driver_count === 'number') {
          setNearbyDriverCount(data.nearby_driver_count);
        }
      } catch (e) {
        console.log('Nearby drivers fetch error:', e);
      }
    };
    
    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, 10000); // Her 10 saniyede güncelle
    
    return () => clearInterval(interval);
  }, [activeTag, userLocation, rideVehiclePreference]);
  
  // 🆕 Eşleşme sağlanıyor state'i
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  
  // 🔥 Cancelled Alert'in bir kez gösterilmesi için flag
  const [cancelledAlertShown, setCancelledAlertShown] = useState(false);
  const lastCancelledTagId = useRef<string | null>(null);
  
  // 🔥 MERKEZİ GELEN ARAMA STATE - SocketContext (Agora incoming_call)
  const {
    incomingCallData,
    clearIncomingCall,
    getIncomingCallData,
    incomingCallPresentToken,
  } = useSocketContext();
  
  // 🆕 Chat State'leri (Yolcu)
  const [passengerChatVisible, setPassengerChatVisible] = useState(false);
  const [passengerIncomingMessage, setPassengerIncomingMessage] = useState<{ text: string; senderId: string; timestamp: number } | null>(null);
  const [firstChatTapBanner, setFirstChatTapBanner] = useState<{ title: string; subtitle: string } | null>(null);
  const {
    lastTappedNotificationData: paxChatNotifData,
    clearLastTappedNotification: paxClearChatNotif,
  } = useNotifications();
  
  // 🆕 End Trip Modal State'leri (Yolcu)
  const [passengerEndTripModalVisible, setPassengerEndTripModalVisible] = useState(false);
  const [passengerForceEndConfirmVisible, setPassengerForceEndConfirmVisible] = useState(false);
  
  // 🆕 MARTI TAG - Fiyat Teklifi State'leri
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceInfo, setPriceInfo] = useState<{
    distance_km: number;
    estimated_minutes: number;
    min_price: number;
    max_price: number;
    suggested_price: number;
    is_peak_hour: boolean;
  } | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [priceLoading, setPriceLoading] = useState(false);
  const [passengerPaymentPreference, setPassengerPaymentPreference] = useState<'cash' | 'card' | null>(
    null,
  );

  useEffect(() => {
    if (showPriceModal) {
      setRideVehiclePreference(passengerVehicleFromRole);
      setPassengerPaymentPreference(null);
    }
  }, [showPriceModal, passengerVehicleFromRole]);
  
  // 🆕 Karşı taraf (Sürücü) detay bilgileri - Harita Bilgi Kartı için
  const [otherUserDetails, setOtherUserDetails] = useState<{
    rating?: number;
    totalTrips?: number;
    profilePhoto?: string;
    vehiclePhoto?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleYear?: string;
    vehicleColor?: string;
    plateNumber?: string;
  } | null>(null);
  
  // 🆕 QR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
  
  // 🆕 Rating Modal State - QR tarama sonrası puanlama
  const [ratingModalData, setRatingModalData] = useState<{
    visible: boolean;
    tagId: string;
    rateUserId: string;
    rateUserName: string;
  } | null>(null);
  
  // Ses efekti için
  const soundRef = useRef<Audio.Sound | null>(null);
  const tapSoundRef = useRef<Audio.Sound | null>(null);
  const priceSendPulse = useRef(new Animated.Value(1)).current;

  /** Hedef seçim modalı — haritada dokunulan nokta + ters geokod */
  const [destinationPickerPin, setDestinationPickerPin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [destinationPickerGeocoding, setDestinationPickerGeocoding] = useState(false);
  const destinationPickerMapRef = useRef<any>(null);
  const destinationSnapshotOnPickerOpenRef = useRef<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  /** Arama ile bölge seçildi; hedef ancak haritada dokununca / işaretçi sürüklenince kesinleşir */
  const [destinationAwaitingMapTap, setDestinationAwaitingMapTap] = useState(false);
  /** search: başlık + arama kartı | map: yalnızca harita (mahalle seçilince) */
  const [destinationPickerPhase, setDestinationPickerPhase] = useState<'search' | 'map'>('search');
  const destinationHeroPulse = useRef(new Animated.Value(1)).current;
  const destPinPulse1 = useRef(new Animated.Value(1)).current;
  const destPinOpacity1 = useRef(new Animated.Value(0.5)).current;
  const destPinPulse2 = useRef(new Animated.Value(1)).current;
  const destPinOpacity2 = useRef(new Animated.Value(0.35)).current;

  // 🔊 Tek tip tuş sesi (1109) - Harita ve eşleşme ekranındaki her tuşa basıldığında
  const playTapSound = async () => {};
  
  // Eşleşme: yumuşak ding-dong (socket onTagMatched / onRideAccepted + yerel kabul; debounce tek çalma)
  const playMatchSound = () => {
    void playMatchChimeSound();
  };
  const playStartSound = async () => {};
  const playOfferSound = async () => {};

  useEffect(() => {
    if (!destinationPickerPin || destinationPickerPhase !== 'map') return;
    const ring1 = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(destPinPulse1, {
            toValue: 2.15,
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(destPinOpacity1, {
            toValue: 0,
            duration: 1700,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(destPinPulse1, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(destPinOpacity1, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    const ring2 = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(destPinPulse2, {
            toValue: 1.95,
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(destPinOpacity2, {
            toValue: 0,
            duration: 1700,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(destPinPulse2, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(destPinOpacity2, { toValue: 0.35, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    ring1.start();
    ring2.start();
    return () => {
      ring1.stop();
      ring2.stop();
    };
  }, [
    destinationPickerPin,
    destinationPickerPhase,
    destPinPulse1,
    destPinOpacity1,
    destPinPulse2,
    destPinOpacity2,
  ]);

  useEffect(() => {
    if (!showDestinationPicker) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(destinationHeroPulse, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(destinationHeroPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      destinationHeroPulse.setValue(1);
    };
  }, [showDestinationPicker, destinationHeroPulse]);

  useEffect(() => {
    if (!showDestinationPicker) return;
    destinationSnapshotOnPickerOpenRef.current = destination;
    setDestinationAwaitingMapTap(false);
    setDestinationPickerPhase('search');
  }, [showDestinationPicker]);

  useEffect(() => {
    if (!showPriceModal) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(priceSendPulse, {
          toValue: 1.04,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(priceSendPulse, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showPriceModal, priceSendPulse]);
  
  // 🆕 Sürücü detaylarını çek (Harita Bilgi Kartı için)
  useEffect(() => {
    const fetchDriverDetails = async () => {
      if (!activeTag?.driver_id || (activeTag.status !== 'matched' && activeTag.status !== 'in_progress')) {
        setOtherUserDetails(null);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/user/${activeTag.driver_id}`);
        const data = await response.json();
        
        if (data.success && data.user) {
          const driverDetails = data.user.driver_details || {};
          setOtherUserDetails({
            rating: data.user.rating != null ? Number(data.user.rating) : 4.0,
            totalTrips: data.user.total_trips || 0,
            profilePhoto: data.user.profile_photo,
            vehiclePhoto: driverDetails.vehicle_photo_url,
            vehicleBrand: driverDetails.vehicle_brand,
            vehicleModel: driverDetails.vehicle_model,
            vehicleYear: driverDetails.vehicle_year,
            vehicleColor: driverDetails.vehicle_color,
            plateNumber: driverDetails.plate_number,
          });
          console.log('📋 Sürücü detayları yüklendi:', data.user.name);
        }
      } catch (error) {
        console.error('Sürücü detayları alınamadı:', error);
      }
    };
    
    fetchDriverDetails();
  }, [activeTag?.driver_id, activeTag?.status]);
  
  // ========== TEKLİF YÖNETİMİ (STATE ONLY) ==========
  // useOffers hook'u - SIMPLIFIED v3
  // Socket listener'lar KALDIRILDI - Sadece state management
  // Teklifler useSocket'teki onNewOffer callback'ından addOffer ile ekleniyor
  const { 
    offers: realtimeOffers, 
    isLoading: offersLoading,
    acceptOffer: acceptOfferAPI,
    rejectOffer: rejectOfferAPI,
    clearOffers,
    addOffer: addOfferFromSocket,
    removeOffer,
    updateOfferStatus
  } = useOffers({
    userId: user?.id || '',
    tagId: activeTag?.id,
    requestId: currentRequestId || undefined,
    isDriver: false,
    enabled: !!(user?.id)
  });
  
  // Teklifleri fiyata göre sırala (ucuzdan pahalıya)
  const offers = [...realtimeOffers].sort((a, b) => (a.price || 0) - (b.price || 0));
  
  // 🆕 Teklif veren sürücülerin konumlarını offers'tan güncelle
  useEffect(() => {
    if (offers.length === 0) {
      setOfferDriverLocations([]);
      return;
    }
    
    // Her teklif için sürücü konumu oluştur
    const newDriverLocations: DriverLocation[] = offers
      .filter(offer => offer.driver_id)
      .map(offer => ({
        driver_id: offer.driver_id,
        driver_name: offer.driver_name || 'Sürücü',
        // Offer'daki konum bilgisi veya varsayılan
        latitude: (offer as any).driver_latitude || (offer as any).latitude || userLocation?.latitude || 0,
        longitude: (offer as any).driver_longitude || (offer as any).longitude || userLocation?.longitude || 0,
        vehicle_model: offer.vehicle_model,
        price: offer.price,
      }));
    
    setOfferDriverLocations(newDriverLocations);
  }, [offers.length, offers.map(o => o.driver_id).join(',')]);
  
  // Mesafe ve süre state'leri
  const [realDistance, setRealDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // ==================== BASİT ARAMA SİSTEMİ - YOLCU ====================
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [callScreenData, setCallScreenData] = useState<{
    mode: 'caller' | 'receiver';
    callId: string;
    channelName: string;
    agoraToken: string;
    remoteName: string;
    remoteUserId: string;
    callType: 'audio' | 'video';
  } | null>(null);
  
  // Arama durumları
  const [callAccepted, setCallAccepted] = useState(false);
  const [callRejected, setCallRejected] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [receiverOffline, setReceiverOffline] = useState(false);
  
  const isCallActiveRef = useRef(false);
  
  // ==================== SOCKET.IO HOOK - YOLCU ====================
  const {
    socket: passengerSocket,
    isConnected: socketConnected,
    isRegistered: socketRegistered,
    acceptCall: socketAcceptCall,
    rejectCall: socketRejectCall,
    endCall: socketEndCall,
    // TAG & Teklif için yeni fonksiyonlar
    emitNewTag,
    emitCreateTagRequest,      // 🆕 YENİ: 20km radius TAG
    emitCancelTagRequest,      // 🆕 YENİ: request_id ile iptal
    emitCancelTag,
    emitAcceptOffer: socketAcceptOffer,
    emitRejectOffer: socketRejectOffer,
    forceEndTrip: passengerForceEndTrip,
    // 🆕 Mesajlaşma
    emitSendMessage: passengerEmitSendMessage,
  } = useSocket({
    userId: user?.id || null,
    userRole: 'passenger',
    onCallCancelled: (data) => {
      console.log('🚫 YOLCU - ARAMA İPTAL EDİLDİ:', data);
      clearIncomingCall();
    },
    onCallEndedNew: (data) => {
      console.log('📴 YOLCU - CALL_ENDED (Backend-driven):', data);
      clearIncomingCall();
    },
    onIncomingCall: (data) => {
      console.log('📞 YOLCU - GELEN ARAMA (socket):', data);
    },
    onCallAccepted: (data) => {
      console.log('✅ YOLCU - ARAMA KABUL EDİLDİ:', data);
      setCallAccepted(true);
    },
    onCallRejected: (data) => {
      console.log('❌ YOLCU - ARAMA REDDEDİLDİ:', data);
      setCallRejected(true);
    },
    onCallEnded: (data) => {
      console.log('📴 YOLCU - ARAMA SONLANDIRILDI:', data);
      setCallEnded(true);
    },
    onCallRinging: (data) => {
      console.log('🔔 YOLCU - ARAMA DURUMU:', data);
      if (!data.success && !data.receiver_online) {
        setReceiverOffline(true);
      }
    },
    // Yeni teklif eventi - Şoförden gelen teklifler
    onNewOffer: (data) => {
      console.log('💰 YOLCU - YENİ TEKLİF GELDİ (Socket):', data);
      // 🚀 TEKLİF KARTINI ANINDA EKLE - Supabase bekleme!
      addOfferFromSocket({
        id: data.offer_id || `socket_${Date.now()}`,
        tag_id: data.tag_id,
        driver_id: data.driver_id,
        driver_name: data.driver_name,
        price: data.price,
        status: 'pending'
      });
      // Ses çal ve toast göster
      playOfferSound();
      setToastMessage(`${displayFirstName(data.driver_name, 'Sürücü')} teklifinize ${data.price}₺ önerdi!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    // 🆕 TAG EŞLEŞTİ - Yolcu teklifi kabul ettiğinde
    onTagMatched: (data) => {
      console.log('🤝 YOLCU - TAG EŞLEŞTİ (Socket):', data);
      // 🔊 EŞLEŞME SESİ - Ding ding ding
      playMatchSound();
      // 🔥 TÜM TEKLİFLERİ TEMİZLE - Artık yeni teklif alamaz
      clearOffers();
      
      // 🚀 ANLIK GÜNCELLEME - Socket'ten gelen veriyi kullan
      if (data && data.tag_id) {
        const matchedTag = {
          id: data.tag_id,
          tag_id: data.tag_id,
          passenger_id: data.passenger_id,
          passenger_name: data.passenger_name,
          driver_id: data.driver_id,
          driver_name: data.driver_name,
          pickup_location: data.pickup_location,
          dropoff_location: data.dropoff_location,
          pickup_lat: data.pickup_lat,
          pickup_lng: data.pickup_lng,
          dropoff_lat: data.dropoff_lat,
          dropoff_lng: data.dropoff_lng,
          offered_price: data.offered_price,
          distance_km: data.distance_km,
          estimated_minutes: data.estimated_minutes,
          status: 'matched',
          matched_at: new Date().toISOString(),
          passenger_payment_method: normalizePassengerPaymentMethod(
            (data as { passenger_payment_method?: unknown }).passenger_payment_method,
          ) ?? undefined,
        };
        console.log('🔥 YOLCU - ActiveTag ANINDA güncelleniyor:', matchedTag);
        setActiveTag(matchedTag);
      }
      
      // Backend'den de çek (ekstra bilgiler için)
      setTimeout(() => loadActiveTag(), 1000);
    },
    // Backend accept_ride: doğrudan eşleşme socket’i (yolcu)
    onRideAccepted: (data) => {
      console.log('✅ YOLCU - ride_accepted (Socket):', data);
      playMatchSound();
      clearOffers();
      if (data?.tag_id) {
        const matchedTag = {
          id: data.tag_id,
          tag_id: data.tag_id,
          passenger_id: data.passenger_id,
          passenger_name: data.passenger_name,
          driver_id: data.driver_id,
          driver_name: data.driver_name,
          pickup_location: data.pickup_location,
          dropoff_location: data.dropoff_location,
          pickup_lat: data.pickup_lat,
          pickup_lng: data.pickup_lng,
          dropoff_lat: data.dropoff_lat,
          dropoff_lng: data.dropoff_lng,
          offered_price: data.final_price,
          final_price: data.final_price,
          distance_km: (data as { distance_km?: number }).distance_km,
          estimated_minutes: (data as { estimated_minutes?: number }).estimated_minutes,
          status: 'matched',
          matched_at: data.matched_at || new Date().toISOString(),
          passenger_payment_method: normalizePassengerPaymentMethod(
            (data as { passenger_payment_method?: unknown }).passenger_payment_method,
          ) ?? undefined,
        };
        setActiveTag(matchedTag as Tag);
      }
      setScreen('dashboard');
      setTimeout(() => loadActiveTag(), 1000);
    },
    // 🆕 TEKLİF KABUL EDİLDİ - Ack (backend confirmation)
    onOfferAccepted: (data) => {
      console.log('✅ YOLCU - TEKLİF KABUL EDILDI (Socket Ack):', data);
      // Backend'den onay geldi - tag'i yenile
      loadActiveTag();
    },
    onFirstChatMessage: (data) => {
      if (!data?.tag_id) return;
      if (activeTag?.id && data.tag_id !== activeTag.id) return;
      if (passengerChatVisible) return;
      setFirstChatTapBanner({
        title: data.from_driver ? 'Sürücü size yazdı' : 'Yolcu size yazdı',
        subtitle:
          (data.message_preview || data.message || '').trim() ||
          'Mesajı görmek için tıklayın',
      });
    },
    // 🆕 ZORLA BİTİRME - Karşı taraf bitirdi
    onTripForceEnded: (data) => {
      console.log('🛑 YOLCU - YOLCULUK ZORLA BİTİRİLDİ:', data);
      
      // 🔥 ANINDA TÜM STATE'LERİ TEMİZLE - Her halükarda bitirilecek
      setActiveTag(null);
      setDestination(null);
      clearIncomingCall();
      setShowCallScreen(false);
      setCallScreenData(null);
      setPassengerChatVisible(false);
      setPassengerEndTripModalVisible(false);
      
      // ROL SEÇİM EKRANINA GİT
      setScreen('role-select');
      
      // 🔥 ONAY SİSTEMİ: Karşı taraf onaylarsa 0 puan, onaylamazsa -5 puan
      const enderType = data.ender_type;
      const enderId = data.ender_id;
      const tagId = data.tag_id;
      
      if (enderType === 'driver') {
        // Sürücü bitirdi - Yolcuya onay sor
        Alert.alert(
          '⚠️ Sürücü Eşleşmeyi Bitirdi',
          'Sürücü yolculuğu sonlandırdı.\nBu işlemi onaylıyor musunuz?',
          [
            { 
              text: 'Onaylıyorum (0 puan)', 
              style: 'default',
              onPress: async () => {
                // Onay - Sürücüye 0 puan
                try {
                  await fetch(`${API_URL}/trip/force-end-confirm?tag_id=${tagId}&ender_id=${enderId}&approved=true`, { method: 'POST' });
                } catch (e) { console.log('Onay gönderilemedi:', e); }
              }
            },
            { 
              text: 'Onaylamıyorum (-5 puan)', 
              style: 'destructive',
              onPress: async () => {
                // Red - Sürücüye -5 puan
                try {
                  await fetch(`${API_URL}/trip/force-end-confirm?tag_id=${tagId}&ender_id=${enderId}&approved=false`, { method: 'POST' });
                } catch (e) { console.log('Red gönderilemedi:', e); }
              }
            }
          ],
          { cancelable: false }
        );
      } else {
        // Yolcu bitirdi - Bu yolcu tarafı, sadece bilgi
        Alert.alert('⚠️ Yolculuk Bitirildi', 'Eşleşme sonlandırıldı.');
      }
    },
    // 🆕 QR ile yolculuk bitirme - Puanlama modalı (SOCKET'TEN)
    onShowRatingModal: (data) => {
      console.log('⭐ YOLCU - PUANLAMA MODALI AÇ (Socket):', data);
      // QR modal'ı kapat
      setShowQRModal(false);
      // Puanlama modalını aç
      setRatingModalData({
        visible: true,
        tagId: data.tag_id,
        rateUserId: data.rate_user_id,
        rateUserName: data.rate_user_name
      });
      // 🆕 Trip bitti olarak işaretle - Puanlama sonrası activeTag=null olacak
    },
  });
  
  // Karşılıklı iptal sistemi state'leri
  const [showTripEndModal, setShowTripEndModal] = useState(false);
  const [tripEndRequesterType, setTripEndRequesterType] = useState<'passenger' | 'driver' | null>(null);
  
  // Ara butonu animasyonu
  const buttonPulse = useRef(new Animated.Value(1)).current;
  const destinationButtonScale = useRef(new Animated.Value(1)).current;
  const arrowPosition = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Ara butonu pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(buttonPulse, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Hedef seçin butonu pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(destinationButtonScale, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(destinationButtonScale, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // CANLI KONUM GÜNCELLEME - Eşleşince başla (1 saniyede bir)
  useEffect(() => {
    if (activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress')) {
      console.log('🔄 Yolcu: Şoför konum takibi başlatıldı');
      
      // İlk yükleme
      const fetchDriverLocation = async () => {
        try {
          const response = await fetch(`${API_URL}/passenger/driver-location/${activeTag.driver_id}`);
          const data = await response.json();
          if (data.location) {
            setDriverLocation(data.location);
            if (userLocation) {
              const distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                data.location.latitude,
                data.location.longitude
              );
              setRealDistance(distance);
              const time = Math.round((distance / 40) * 60);
              setEstimatedTime(time);
            }
          }
        } catch (error) {
          console.log('Şoför konumu alınamadı:', error);
        }
      };
      
      fetchDriverLocation();
      const interval = setInterval(fetchDriverLocation, 1000); // 1 saniyede bir güncelle - CANLI

      return () => clearInterval(interval);
    }
  }, [activeTag?.id, activeTag?.status, activeTag?.driver_id]);

  // ❌ ESKİ POLLING KALDIRILDI - Supabase Realtime ile değiştirildi (yukarıda)

  // Karşılıklı iptal isteği polling - YOLCU için
  useEffect(() => {
    if (!user?.id || !activeTag) return;
    if (activeTag.status !== 'matched' && activeTag.status !== 'in_progress') return;
    
    const checkTripEndRequest = async () => {
      try {
        const response = await fetch(`${API_URL}/trip/check-end-request?tag_id=${activeTag.id}&user_id=${user.id}`);
        const data = await response.json();
        
        console.log('🔚 YOLCU - Trip end request check:', JSON.stringify(data));
        
        if (data.success && data.has_request && !showTripEndModal) {
          console.log('🔚 YOLCU - Bitirme isteği VAR! Requester:', data.requester_type);
          setTripEndRequesterType(data.requester_type || 'unknown');
          setShowTripEndModal(true);
        }
      } catch (error) {
        console.log('Check trip end error:', error);
      }
    };
    
    checkTripEndRequest();
    const interval = setInterval(checkTripEndRequest, 1000); // 1 saniyede bir kontrol - HIZLI
    return () => clearInterval(interval);
  }, [user?.id, activeTag?.id, activeTag?.status, showTripEndModal]);

  // 🔥 Polling interval ref - temizleme için
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef<boolean>(true);

  useEffect(() => {
    console.log('🔄 Yolcu polling başlatıldı');
    isPollingActiveRef.current = true;
    loadActiveTag();
    
    pollingIntervalRef.current = setInterval(() => {
      // 🔥 Polling aktif değilse çalıştırma
      if (!isPollingActiveRef.current) {
        console.log('🔄 Polling durdurulmuş, skip...');
        return;
      }
      console.log('🔄 Yolcu TAG ve teklifler yükleniyor...');
      loadActiveTag();
    }, 2000); // Her 2 saniyede bir kontrol et
    
    return () => {
      console.log('🔄 Yolcu polling durduruldu');
      isPollingActiveRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [user?.id]);

  const loadActiveTag = async () => {
    try {
      const response = await fetch(`${API_URL}/passenger/active-tag?user_id=${user.id}`);
      const data = await response.json();
      
      if (data.success && data.tag) {
        // 🔥 Eğer tag cancelled veya completed ise - ÇIKIŞ YAP
        if (data.tag.status === 'cancelled' || data.tag.status === 'completed') {
          console.log('🛑 loadActiveTag: Tag bitirilmiş, çıkış yapılıyor...', data.tag.status);
          
          // 🔥 POLLING'İ DURDUR - sonsuz döngüyü engelle
          isPollingActiveRef.current = false;
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // 🔥 Alert'i sadece bir kez göster - aynı tag için tekrar gösterme
          const shouldShowAlert = data.tag.status === 'cancelled' && 
                                   lastCancelledTagId.current !== data.tag.id;
          
          // State'leri temizle
          setActiveTag(null);
          setDestination(null);
          setPassengerChatVisible(false);
          clearIncomingCall();
          setShowCallScreen(false);
          setCallScreenData(null);
          setCancelledAlertShown(true);
          lastCancelledTagId.current = data.tag.id;
          
          // Rol seçim ekranına yönlendir
          setScreen('role-select');
          
          // Alert'i sadece bir kez göster
          if (shouldShowAlert) {
            Alert.alert('⚠️ Eşleşme Bitirildi', 'Karşı taraf eşleşmeyi sonlandırdı.');
          }
          return;
        }
        
        // Aktif tag varsa, cancelled flag'i sıfırla
        setCancelledAlertShown(false);
        setActiveTag(data.tag);
      } else {
        // API'den tag gelmedi - cancelled değil, gerçekten tag yok
        // 🔥 Sadece mevcut tag varsa ve artık yoksa temizle
        if (activeTag) {
          setActiveTag(null);
        }
      }
    } catch (error) {
      console.error('TAG yüklenemedi:', error);
    }
  };

  useEffect(() => {
    const d = paxChatNotifData;
    if (!d || d.type !== 'first_chat_message' || !d.tag_id) return;
    paxClearChatNotif();
    if (!activeTag?.id || String(d.tag_id) !== String(activeTag.id)) {
      void loadActiveTag();
    }
    setPassengerChatVisible(true);
    setFirstChatTapBanner(null);
  }, [paxChatNotifData, paxClearChatNotif, activeTag?.id]);

  useEffect(() => {
    if (passengerChatVisible) setFirstChatTapBanner(null);
  }, [passengerChatVisible]);

  const buildLocalPriceEstimate = (
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    vehicleKind: 'car' | 'motorcycle'
  ) => {
    // Backend geçici hata verirse kullanıcı akışını kırmamak için istemci fallback'i
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(dropoffLat - pickupLat);
    const dLng = toRad(dropoffLng - pickupLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(pickupLat)) * Math.cos(toRad(dropoffLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const crowKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const tripDistanceKm = Math.max(1, Number((crowKm * 1.3).toFixed(1)));
    const estimatedMinutes = Math.max(5, Math.round((tripDistanceKm / 30) * 60));

    const hour = (new Date().getUTCHours() + 3) % 24; // TR UTC+3
    const isPeak = (hour >= 8 && hour < 10) || (hour >= 17 && hour < 20);
    const multiplier = isPeak ? 1.15 : 1.0;

    const base = vehicleKind === 'motorcycle' ? 25 : 40;
    const perKm = vehicleKind === 'motorcycle' ? 12 : 20;
    const minimum = vehicleKind === 'motorcycle' ? 80 : 120;

    let price = base + tripDistanceKm * perKm;
    if (price < minimum) price = minimum;
    price *= multiplier;

    const suggested = Math.round(price);
    return {
      success: true,
      distance_km: tripDistanceKm,
      trip_distance_km: tripDistanceKm,
      estimated_minutes: estimatedMinutes,
      min_price: Math.round(suggested * 0.9),
      max_price: Math.round(suggested * 1.1),
      suggested_price: suggested,
      is_peak_hour: isPeak,
      currency: 'TL',
      vehicle_kind: vehicleKind,
      base_price: base,
      per_km: perKm,
      minimum_price: minimum,
      multiplier,
      source: 'local_fallback',
    };
  };

  // ÇAĞRI BUTONU - MARTI TAG: Fiyat hesapla ve modal aç
  const handleCallButton = async () => {
    playTapSound();
    console.log('🔵 FİYAT TEKLİF BUTONU TIKLANDI!');
    
    // Hedef kontrolü (arama tek başına yetmez; haritadan nokta şart)
    if (!destination) {
      Alert.alert(
        '⚠️ Hedef gerekli',
        destinationAwaitingMapTap
          ? 'Listeden bölgeyi seçtikten sonra haritadan tam durağa dokunun veya yeşil işaretçiyi sürükleyin.'
          : 'Önce hedef seçin: arama veya harita ile tam konumu belirleyin.',
      );
      return;
    }

    setPriceLoading(true);
    
    // GPS konumu yoksa önce konum izni iste
    if (!userLocation) {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Konum İzni Gerekli',
          'Fiyat hesaplamak için konum izninize ihtiyacımız var. Lütfen ayarlardan konum iznini açın.',
          [{ text: 'Tamam' }]
        );
        setPriceLoading(false);
        return;
      }
      // Konum izni alındı, userLocation güncellenene kadar bekle
      setPriceLoading(false);
      return;
    }
    
    const pickupLat = userLocation.latitude;
    const pickupLng = userLocation.longitude;
    
    try {
      // Fiyat hesaplama API'sini çağır
      const response = await fetch(`${API_URL}/price/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_lat: destination.latitude,
          dropoff_lng: destination.longitude,
          passenger_vehicle_kind: rideVehiclePreference,
        })
      });
      
      if (!response.ok) {
        throw new Error(`Price API HTTP ${response.status}`);
      }
      const data = await response.json();
      
      if (data.success) {
        setPriceInfo(data);
        setSelectedPrice(data.suggested_price);
        setShowPriceModal(true);
      } else {
        throw new Error(data?.error || 'Price API success=false');
      }
    } catch (error) {
      console.error('Fiyat hesaplama hatası:', error);
      const fallback = buildLocalPriceEstimate(
        pickupLat,
        pickupLng,
        destination.latitude,
        destination.longitude,
        rideVehiclePreference
      );
      setPriceInfo(fallback as any);
      setSelectedPrice(fallback.suggested_price);
      setShowPriceModal(true);
      Alert.alert('Bilgi', 'Sunucuya ulaşılamadı, yaklaşık fiyat gösteriliyor.');
    } finally {
      setPriceLoading(false);
    }
  };

  // 🆕 Araç/Motor seçimi değişince fiyatı tekrar hesapla
  const recalcPrice = async (nextVehicleKind: 'car' | 'motorcycle') => {
    if (!destination || !userLocation) return;
    try {
      setPriceLoading(true);
      const response = await fetch(`${API_URL}/price/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_lat: userLocation.latitude,
          pickup_lng: userLocation.longitude,
          dropoff_lat: destination.latitude,
          dropoff_lng: destination.longitude,
          passenger_vehicle_kind: nextVehicleKind,
        }),
      });
      if (!response.ok) {
        throw new Error(`Price API HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data?.success) {
        setPriceInfo(data);
        setSelectedPrice(data.suggested_price);
      } else {
        throw new Error(data?.error || 'Price API success=false');
      }
    } catch (e) {
      console.log('Price recalc error:', e);
      const fallback = buildLocalPriceEstimate(
        userLocation.latitude,
        userLocation.longitude,
        destination.latitude,
        destination.longitude,
        nextVehicleKind
      );
      setPriceInfo(fallback as any);
      setSelectedPrice(fallback.suggested_price);
    } finally {
      setPriceLoading(false);
    }
  };
  
  // MARTI TAG: Fiyat teklifi gönder — önce backend tag oluşturur, rolling dispatch tetiklenir; sonra bekleme UI
  const handleSendPriceOffer = async () => {
    playTapSound();
    if (!destination || !priceInfo || !selectedPrice || !user?.id) {
      if (!destination) {
        Alert.alert('Hedef gerekli', 'Önce gideceğiniz konumu seçin (haritadan onaylayın).');
      }
      return;
    }
    if (!passengerPaymentPreference) {
      Alert.alert('Ödeme seçimi', 'Lütfen nakit veya sanal kart ile ödeyeceğinizi seçin.');
      return;
    }

    setShowPriceModal(false);
    setLoading(true);

    if (!userLocation) {
      Alert.alert('Hata', 'Konum bilgisi alınamadı. Lütfen konum iznini kontrol edin.');
      setLoading(false);
      return;
    }

    const pickupLat = userLocation.latitude;
    const pickupLng = userLocation.longitude;

    let pickupAddress = 'Mevcut Konumunuz';
    try {
      const geocodeResult = await Location.reverseGeocodeAsync({
        latitude: pickupLat,
        longitude: pickupLng,
      });
      if (geocodeResult && geocodeResult.length > 0) {
        const addr = geocodeResult[0];
        const parts = [];
        if (addr.street) parts.push(addr.street);
        if (addr.district) parts.push(addr.district);
        if (addr.city) parts.push(addr.city);
        pickupAddress = parts.length > 0 ? parts.join(', ') : 'Mevcut Konumunuz';
      }
    } catch (err) {
      console.log('Reverse geocoding hatası:', err);
    }

    const generateUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

    const tagId = generateUUID();
    const requestId = generateUUID();

    try {
      console.log('CREATE RIDE REQUEST SENT');
      // API_URL = {BACKEND}/api → yol /api/ride/create (çift /api olmaması için /ride/create)
      const res = await fetch(`${API_URL}/ride/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: tagId,
          passenger_id: String(user.id),
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          pickup_location: pickupAddress || 'Mevcut konum',
          passenger_vehicle_kind: rideVehiclePreference,
          dropoff_lat: destination.latitude,
          dropoff_lng: destination.longitude,
          dropoff_location: (destination.address && String(destination.address).trim()) || 'Seçilen hedef',
          offered_price: selectedPrice,
          distance_km: priceInfo.distance_km ?? 0,
          estimated_minutes: priceInfo.estimated_minutes ?? 0,
          passenger_preferred_vehicle: rideVehiclePreference,
          passenger_payment_method: passengerPaymentPreference,
        }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        throw new Error(`Sunucu yanıtı okunamadı (${res.status})`);
      }
      console.log('CREATE RIDE RESPONSE', data);

      const detailRaw = data.detail;
      const detailStr = Array.isArray(detailRaw)
        ? (detailRaw as { msg?: string }[])
            .map((x) => (typeof x?.msg === 'string' ? x.msg : ''))
            .filter(Boolean)
            .join('; ')
        : typeof detailRaw === 'string'
          ? detailRaw
          : '';

      if (!res.ok) {
        const apiErr =
          (typeof data.error === 'string' && data.error) ||
          detailStr ||
          `Sunucu yanıtı ${res.status}`;
        throw new Error(apiErr);
      }
      if (!data.tag) {
        const apiErr =
          (typeof data.error === 'string' && data.error) ||
          detailStr ||
          'Teklif kaydı oluşturulamadı';
        throw new Error(apiErr);
      }

      const serverTag = data.tag as Record<string, unknown>;
      const mergedTag = {
        ...serverTag,
        offered_price: selectedPrice,
        distance_km: priceInfo.distance_km,
        estimated_minutes: priceInfo.estimated_minutes,
        status: serverTag.status || 'waiting',
        passenger_payment_method:
          normalizePassengerPaymentMethod(serverTag.passenger_payment_method) ??
          passengerPaymentPreference,
      };
      setActiveTag(mergedTag);
      setCurrentRequestId(requestId);

      if (emitCreateTagRequest) {
        emitCreateTagRequest({
          request_id: requestId,
          tag_id: mergedTag.id,
          passenger_id: user.id,
          passenger_name: user.name || user.phone,
          pickup_location: pickupAddress,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_location: destination.address,
          dropoff_lat: destination.latitude,
          dropoff_lng: destination.longitude,
          offered_price: selectedPrice,
          distance_km: priceInfo.distance_km,
          estimated_minutes: priceInfo.estimated_minutes,
          passenger_preferred_vehicle: rideVehiclePreference,
          passenger_vehicle_kind: rideVehiclePreference,
          passenger_payment_method: passengerPaymentPreference,
        });
      }
      console.log('🚀 MARTI TAG: Tag oluşturuldu, rolling dispatch sunucuda tetiklendi', mergedTag.id);
    } catch (err) {
      console.log('Backend kayıt hatası:', err);
      const raw = err instanceof Error ? err.message : String(err);
      const message =
        raw === 'Failed to fetch' || raw.includes('Network request failed')
          ? 'Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.'
          : raw.length > 0
            ? raw
            : 'Teklif oluşturulamadı';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  // 📤 TEKLİF PAYLAŞMA - Cross-platform (Web, Android, iOS)
  const handleShareRideRequest = async () => {
    playTapSound();
    if (!activeTag) return;
    
    const message = `🚗 Leylek TAG - Yolculuk Teklifi\n\n📍 Nereden: ${activeTag.pickup_location || 'Mevcut konum'}\n📍 Nereye: ${activeTag.dropoff_location}\n💰 Teklif: ${activeTag.offered_price} TL\n⏱️ Tahmini süre: ${activeTag.estimated_minutes || '?'} dk\n\n👉 Sürücü olarak kabul etmek için uygulamayı açın!`;
    
    const webAppUrl = 'https://leylektag-debug.preview.emergentagent.com';
    const deepLink = `leylektag://ride/${activeTag.id}`;
    
    try {
      if (Platform.OS === 'web') {
        // Web için kopyalama veya navigator.share
        if (navigator.share) {
          await navigator.share({
            title: 'Leylek TAG - Yolculuk Teklifi',
            text: message,
            url: webAppUrl,
          });
        } else {
          // Fallback: Clipboard'a kopyala
          await navigator.clipboard.writeText(`${message}\n\n${webAppUrl}`);
          window.alert('Teklif bilgisi kopyalandı!\n\nWhatsApp veya başka bir uygulamada paylaşabilirsiniz.');
        }
      } else {
        // Android/iOS için native Share
        await Share.share({
          message: `${message}\n\nUygulama linki: ${webAppUrl}`,
          title: 'Leylek TAG - Yolculuk Teklifi',
        });
      }
    } catch (error) {
      console.log('Paylaşım hatası:', error);
    }
  };

  /** Eşleşmiş yolculukta Agora araması — POST /voice/start-call + CallScreenV2 */
  const startTripCallAsPassenger = async (callType: 'audio' | 'video') => {
    if (!user?.id || !activeTag?.id) {
      Alert.alert('Hata', 'Yolculuk bilgisi bulunamadı');
      return;
    }
    const receiverId = String(activeTag.driver_id ?? '').trim();
    if (!receiverId) {
      Alert.alert('Hata', 'Sürücü bilgisi bulunamadı');
      return;
    }
    if (receiverId === String(user.id).trim()) {
      Alert.alert('Hata', 'Kendinizi arayamazsınız');
      return;
    }
    if (showCallScreen || incomingCallData) {
      Alert.alert('Uyarı', 'Zaten bir arama devam ediyor');
      return;
    }
    clearIncomingCall();
    setCalling(true);
    try {
      const response = await fetch(`${API_URL}/voice/start-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: user.id,
          receiver_id: receiverId,
          call_type: callType === 'video' ? 'video' : 'voice',
          tag_id: activeTag.id,
          caller_name: user.name,
        }),
      });
      const data = await response.json();
      setCalling(false);
      if (!data.success) {
        Alert.alert('Hata', (data.detail as string) || 'Arama başlatılamadı');
        return;
      }
      const agoraOk = await joinTripCallAgoraAsCaller(
        data.channel_name,
        data.agora_token || '',
        String(user.id)
      );
      if (!agoraOk) return;
      setCallAccepted(false);
      setCallRejected(false);
      setCallEnded(false);
      setReceiverOffline(false);
      setCallScreenData({
        mode: 'caller',
        callId: data.call_id,
        channelName: data.channel_name,
        agoraToken: data.agora_token || '',
        remoteUserId: receiverId,
        remoteName: displayFirstName(activeTag.driver_name, 'Sürücü'),
        callType,
      });
      setShowCallScreen(true);
    } catch (e) {
      console.error('Agora arama (yolcu):', e);
      setCalling(false);
      Alert.alert('Hata', 'Arama başlatılamadı');
    }
  };

  const handleVoiceCall = () => {
    void startTripCallAsPassenger('audio');
  };

  const handleVideoCall = () => {
    void startTripCallAsPassenger('video');
  };

  useEffect(() => {
    if (!user?.id || !incomingCallData?.callId || !incomingCallData.channelName) return;
    if (String(incomingCallData.callerId) === String(user.id)) return;
    if (
      showCallScreen &&
      callScreenData?.callId &&
      String(callScreenData.callId) === String(incomingCallData.callId)
    ) {
      return;
    }
    setCallAccepted(false);
    setCallRejected(false);
    setCallEnded(false);
    setReceiverOffline(false);
    setCallScreenData({
      mode: 'receiver',
      callId: incomingCallData.callId,
      channelName: incomingCallData.channelName,
      agoraToken: incomingCallData.agoraToken || '',
      remoteUserId: incomingCallData.callerId,
      remoteName: displayFirstName(incomingCallData.callerName, 'Arayan'),
      callType: incomingCallData.callType,
    });
    setShowCallScreen(true);
  }, [incomingCallData, incomingCallPresentToken, user?.id, showCallScreen, callScreenData?.callId]);

  // Teklifi 10 dakikalığına gizle (çarpı butonu)
  const handleDismissOffer = async (offerId: string) => {
    playTapSound();
    try {
      // Teklifin driver_id'sini bul
      const offer = offers.find(o => o.id === offerId || o.offer_id === offerId);
      const driverId = offer?.driver_id || '';
      
      // useOffers hook'undan gelen rejectOffer kullan
      const success = await rejectOfferAPI(offerId, driverId);
      if (success) {
        // Socket üzerinden de bildir
        if (socketRejectOffer) {
          socketRejectOffer({
            request_id: currentRequestId,
            offer_id: offerId,
            driver_id: driverId
          });
        }
        // Toast göster
        setToastMessage('Teklif 10 dakika boyunca gizlendi');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (error) {
      console.log('Dismiss error:', error);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    playTapSound();
    if (!activeTag) return;

    const selectedOffer = offers.find(o => o.id === offerId);
    if (!selectedOffer) return;

    // 🆕 "Eşleşme sağlanıyor..." göster
    setMatchingInProgress(true);

    try {
      // 🚀 ÖNCE Socket ile anında bildir (hızlı feedback)
      if (socketAcceptOffer) {
        socketAcceptOffer({
          request_id: currentRequestId,
          offer_id: offerId,
          driver_id: selectedOffer.driver_id,
          tag_id: activeTag.id,
          passenger_id: user?.id
        });
      }
      
      // Backend API'yi çağır (arka planda)
      const success = await acceptOfferAPI(offerId, selectedOffer.driver_id, activeTag.id, currentRequestId || undefined);
      
      if (success) {
        // Sadece sürücü adını kaydet
        setSelectedDriverName(selectedOffer.driver_name);
        
        // 🚀 ANINDA state'i güncelle - gecikme YOK
        setActiveTag(prev => prev ? {
          ...prev,
          status: 'matched',
          driver_id: selectedOffer.driver_id,
          driver_name: selectedOffer.driver_name,
          final_price: selectedOffer.price,
          matched_at: new Date().toISOString()
        } : null);
        
        // Teklifleri temizle
        clearOffers();
        
        // "Eşleşme sağlanıyor..." kapat
        setMatchingInProgress(false);

        void playMatchChimeSound();
        
        // API'den tam veriyi çek (arka planda)
        loadActiveTag();
      } else {
        setMatchingInProgress(false);
        Alert.alert('Hata', 'Teklif kabul edilemedi');
      }
    } catch (error) {
      setMatchingInProgress(false);
      Alert.alert('Hata', 'Teklif kabul edilemedi');
    }
  };

  const handleCancelTag = async () => {
    console.log("MANUAL_CANCEL_CLICK");
    playTapSound();
    if (!activeTag) return;

    Alert.alert(
      'İptal Et',
      'İsteğinizi iptal etmek istediğinizden emin misiniz? Sürücülere bildirim gönderilecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal Et',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/passenger/cancel-tag?user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: activeTag.id })
              });

              const data = await response.json();
              if (data.success) {
                setActiveTag(null);
                // offers artık useOffers hook'u tarafından yönetiliyor - otomatik temizlenecek
              } else {
                Alert.alert('Hata', data.detail || 'İptal edilemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'İptal edilemedi');
            }
          }
        }
      ]
    );
  };

  /** Haritadan kesin nokta — hedef geçerli; modal kapanır */
  const commitDestinationFromMap = async (address: string, lat: number, lng: number) => {
    const newDestination = { address, latitude: lat, longitude: lng };
    setDestination(newDestination);
    setDestinationAwaitingMapTap(false);
    setShowDestinationPicker(false);

    if (activeTag) {
      try {
        const response = await fetch(`${API_URL}/passenger/update-destination?user_id=${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tag_id: activeTag.id,
            dropoff_location: address,
            dropoff_lat: lat,
            dropoff_lng: lng,
          }),
        });

        const data = await response.json();
        if (data.success) {
          loadActiveTag();
        } else {
          Alert.alert('Hata', data.detail || 'Hedef güncellenemedi');
        }
      } catch (error) {
        Alert.alert('Hata', 'Hedef güncellenemedi');
      }
    }
  };

  /** Arama: yalnızca bölge — haritaya odaklanır; hedef geçerli sayılmaz */
  const handleDestinationAreaFromSearch = (place: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    void tapButtonHaptic();
    setDestination(null);
    setDestinationAwaitingMapTap(true);
    setDestinationPickerPhase('map');
    const { latitude: lat, longitude: lng } = place;
    setDestinationPickerPin({ latitude: lat, longitude: lng });
    requestAnimationFrame(() => {
      try {
        destinationPickerMapRef.current?.animateToRegion?.(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.026,
            longitudeDelta: 0.026,
          },
          420,
        );
      } catch (_) {}
    });
  };

  const closeDestinationPickerModal = () => {
    void tapButtonHaptic();
    if (destinationAwaitingMapTap) {
      setDestination(destinationSnapshotOnPickerOpenRef.current);
    }
    setDestinationAwaitingMapTap(false);
    setDestinationPickerPhase('search');
    setShowDestinationPicker(false);
  };

  useEffect(() => {
    if (showDestinationPicker) {
      setDestinationPickerGeocoding(false);
      const lat =
        userLocation?.latitude ?? destination?.latitude ?? 41.0082;
      const lng =
        userLocation?.longitude ?? destination?.longitude ?? 28.9784;
      setDestinationPickerPin({ latitude: lat, longitude: lng });
    } else {
      setDestinationPickerPin(null);
    }
  }, [showDestinationPicker]);

  const applyDestinationFromCoordinate = async (
    latitude: number,
    longitude: number,
  ) => {
    setDestinationPickerPin({ latitude, longitude });
    setDestinationPickerGeocoding(true);
    try {
      await tapButtonHaptic();
    } catch (_) {}
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=tr`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'LeylekTAG-App/1.0' },
      });
      const data = await response.json();
      const address =
        data?.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      await commitDestinationFromMap(address, latitude, longitude);
    } catch {
      Alert.alert('Hata', 'Adres okunamadı. İşareti sürükleyip tekrar deneyin.');
    } finally {
      setDestinationPickerGeocoding(false);
    }
  };

  const handleDestinationMapPress = async (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    await applyDestinationFromCoordinate(latitude, longitude);
  };

  const handleDestinationMarkerDragEnd = async (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    await applyDestinationFromCoordinate(latitude, longitude);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 SEARCHING PHASE - HARİTA + TEKLİF LİSTESİ (YENİ UI)
  // Üstte harita (tüm sürücüler) + Altta scrollable teklif listesi
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeTag && activeTag.status !== 'matched' && activeTag.status !== 'in_progress') {
    const isSearching = activeTag.status === 'pending' || activeTag.status === 'offers_received';
    
    // Teklif yoksa premium bekleme ekranını göster
    if (offers.length === 0) {
      return (
        <PassengerWaitingScreen
          userLocation={userLocation}
          destinationLocation={destination ? { latitude: destination.latitude, longitude: destination.longitude } : null}
          pickupAddress={activeTag.pickup_location || ''}
          dropoffAddress={activeTag.dropoff_location || ''}
          tagId={activeTag.id}
          offeredPrice={activeTag.final_price || activeTag.offered_price || 0}
          passengerVehicleKind={rideVehiclePreference}
          onCancel={handleCancelTag}
          onMatch={(driverData) => {
            // Eşleşme olduğunda
            console.log('Match received:', driverData);
          }}
        />
      );
    }
    
    // Teklif varsa mevcut listeyi göster
    return (
      <SafeAreaView style={searchingStyles.container}>
        {/* Üst Bar - Geri + Durum + İptal */}
        <View style={searchingStyles.topBar}>
          <TouchableOpacity onPress={() => { playTapSound(); setScreen('role-select'); }} style={searchingStyles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#3FA9F5" />
          </TouchableOpacity>
          <View style={searchingStyles.statusCenter}>
            <Text style={searchingStyles.statusText}>
              {offers.length > 0 ? `${offers.length} teklif geldi` : 'Teklifler bekleniyor...'}
            </Text>
            {offers.length === 0 && <ActivityIndicator size="small" color="#3FA9F5" style={{ marginLeft: 8 }} />}
          </View>
          <TouchableOpacity onPress={handleCancelTag} style={searchingStyles.cancelBtn}>
            <Ionicons name="close" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* HARİTA - Üstte Sabit */}
        <View style={searchingStyles.mapContainer}>
          <SearchingMapView
            userLocation={userLocation}
            destinationLocation={destination ? { latitude: destination.latitude, longitude: destination.longitude } : null}
            driverLocations={offerDriverLocations}
            height={SCREEN_HEIGHT * 0.32}
            nearbyDriverCount={nearbyDriverCount}
          />
        </View>

        {/* Rota Bilgisi - Küçük Kart */}
        <View style={searchingStyles.routeCard}>
          <View style={searchingStyles.routeRow}>
            <View style={[searchingStyles.routeDot, { backgroundColor: '#3FA9F5' }]} />
            <Text style={searchingStyles.routeText} numberOfLines={1}>{activeTag.pickup_location}</Text>
          </View>
          <Ionicons name="arrow-down" size={14} color="#94A3B8" style={{ marginLeft: 5 }} />
          <View style={searchingStyles.routeRow}>
            <View style={[searchingStyles.routeDot, { backgroundColor: '#EF4444' }]} />
            <Text style={searchingStyles.routeText} numberOfLines={1}>{activeTag.dropoff_location}</Text>
          </View>
          
          {/* 📤 PAYLAŞ BUTONU - Arkadaşlarına gönder */}
          <TouchableOpacity 
            style={searchingStyles.shareButton}
            onPress={handleShareRideRequest}
          >
            <Ionicons name="share-social" size={18} color="#FFF" />
            <Text style={searchingStyles.shareButtonText}>Paylaş</Text>
          </TouchableOpacity>
        </View>

        {/* TEKLİF LİSTESİ - Scrollable */}
        <View style={searchingStyles.offersContainer}>
          <View style={searchingStyles.offersHeader}>
            <Text style={searchingStyles.offersTitle}>Teklifler</Text>
            <View style={searchingStyles.liveIndicator}>
              <View style={searchingStyles.liveDot} />
              <Text style={searchingStyles.liveText}>Canlı</Text>
            </View>
          </View>
          
          <FlatList
            data={offers}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={({ item, index }) => (
              <PassengerOfferCard
                offer={item}
                index={index}
                total={offers.length}
                onAccept={() => handleAcceptOffer(item.id)}
                onDismiss={() => handleDismissOffer(item.id)}
                isBest={index === 0}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // 🚫 SESLİ ARAMA KALDIRILDI - Sadece mesajlaşma aktif
  // IncomingCallScreen, OutgoingCallScreen, DailyCallScreen kaldırıldı

  // YOLCU EKRANI - AKTİF TAG VAR (matched veya in_progress)
  return (
    <ImageBackground 
      source={require('../assets/images/passenger-background.png')} 
      style={styles.passengerBackgroundContainer}
      imageStyle={styles.passengerBackgroundImage}
    >
    <SafeAreaView style={styles.containerTransparent}>
      {/* 🆕 Eşleşme Sağlanıyor Modal */}
      {matchingInProgress && (
        <View style={styles.matchingOverlay}>
          <View style={styles.matchingBox}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={styles.matchingTitle}>🎉 Eşleşme Sağlanıyor...</Text>
            <Text style={styles.matchingSubtitle}>Lütfen bekleyin</Text>
          </View>
        </View>
      )}
      
      {/* Toast Notification - Otomatik Kaybolan */}
      {showToast && (
        <Animated.View style={styles.toastContainer}>
          <LinearGradient
            colors={['#3FA9F5', '#2196F3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.toastGradient}
          >
            <Ionicons name="checkmark-circle" size={24} color="#FFF" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </LinearGradient>
        </Animated.View>
      )}
      
      {/* Üst Header - KALDIRILDI - TAM EKRAN */}
      
      <ScrollView 
        style={styles.contentFullScreen}
        keyboardShouldPersistTaps="handled"
      >
        {!activeTag ? (
          <View style={styles.emptyStateContainerFull}>
            {/* Geri ve Çıkış Butonları */}
            <View style={styles.fullScreenTopBar}>
              <TouchableOpacity onPress={() => { playTapSound(); setScreen('role-select'); }} style={styles.fullScreenBackBtn}>
                <Ionicons name="chevron-back" size={26} color="#3FA9F5" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { playTapSound(); logout(); }} style={styles.fullScreenLogoutBtn}>
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
            
            {/* Nereye Gitmek İstiyorsunuz - EN ÜSTTE, leyleklerin üstünde */}
            <Text style={styles.welcomeQuestionVeryTop}>Nereye Gitmek İstiyorsunuz?</Text>
            
            {/* Kişi Adı - Leyleklerin arasında */}
            <Text style={styles.welcomeNameBetweenStorks}>{user.name?.split(' ')[0] || 'Kullanıcı'}</Text>
            
            {/* Hedef Seçme Alanı - DAHA BÜYÜK VE EFEKTLİ */}
            <TouchableOpacity
              style={styles.destinationBoxBig}
              onPress={() => {
                playTapSound();
                setShowDestinationPicker(true);
                setShowArrowHint(false);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.destinationIconBig}>
                <Ionicons name="navigate" size={32} color="#FFF" />
              </View>
              <Text style={styles.destinationTextBig}>
                {destination ? destination.address : 'Hedef Seçin'}
              </Text>
              <View style={styles.destinationArrowBig}>
                <Ionicons name="arrow-forward" size={24} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* OK HİNT - Hedef seçilmeden çağrı yapılırsa */}
            {showArrowHint && (
              <View style={styles.arrowHintSky}>
                <Text style={styles.arrowTextSky}>☝️ Önce hedef seçin!</Text>
              </View>
            )}
            
            {destination && (
              <View style={styles.destinationInfo}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.destinationConfirm}>Hedef: {destination.address.substring(0, 30)}...</Text>
              </View>
            )}
            
            <AnimatedPulseButton 
              onPress={handleCallButton} 
              loading={loading || priceLoading}
              disabled={!destination}
            />
            
            {/* 🆕 MARTI TAG - Fiyat Teklif Modal */}
            <Modal
              visible={showPriceModal}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowPriceModal(false)}
            >
              <View style={styles.priceModalOverlay}>
                <View style={styles.priceModalContent}>
                  <Text style={styles.priceModalTitle}>Fiyat teklifiniz</Text>
                  
                  {priceInfo && (
                    <>
                      <Text style={styles.priceModalVehicleSectionTitle}>Bu teklif için araç türü</Text>
                      <Text style={styles.priceModalVehicleHint}>
                        Rol ekranındaki seçiminiz burada seçili gelir; göndermeden önce isteğe göre değiştirebilirsiniz.
                      </Text>
                      <View style={styles.priceModalVehicleChipsRow}>
                        <TouchableOpacity
                          onPress={() => {
                            void tapButtonHaptic();
                            setRideVehiclePreference('car');
                            void recalcPrice('car');
                          }}
                          style={[
                            styles.priceModalVehicleChip,
                            rideVehiclePreference === 'car' && styles.priceModalVehicleChipCarActive,
                          ]}
                          activeOpacity={0.88}
                        >
                          <MaterialCommunityIcons
                            name="car-side"
                            size={22}
                            color={rideVehiclePreference === 'car' ? '#FFF' : '#1D4ED8'}
                          />
                          <Text
                            style={[
                              styles.priceModalVehicleChipText,
                              rideVehiclePreference === 'car' && styles.priceModalVehicleChipTextActive,
                            ]}
                          >
                            Araç
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            void tapButtonHaptic();
                            setRideVehiclePreference('motorcycle');
                            void recalcPrice('motorcycle');
                          }}
                          style={[
                            styles.priceModalVehicleChip,
                            rideVehiclePreference === 'motorcycle' && styles.priceModalVehicleChipMotorActive,
                          ]}
                          activeOpacity={0.88}
                        >
                          <MaterialCommunityIcons
                            name="motorbike"
                            size={22}
                            color={rideVehiclePreference === 'motorcycle' ? '#FFF' : '#6D28D9'}
                          />
                          <Text
                            style={[
                              styles.priceModalVehicleChipText,
                              rideVehiclePreference === 'motorcycle' && styles.priceModalVehicleChipTextActive,
                            ]}
                          >
                            Motor
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.priceInfoRow}>
                        <Text style={styles.priceInfoLabel}>Mesafe:</Text>
                        <Text style={styles.priceInfoValue}>{priceInfo.distance_km} km</Text>
                      </View>
                      <View style={styles.priceInfoRow}>
                        <Text style={styles.priceInfoLabel}>Tahmini Süre:</Text>
                        <Text style={styles.priceInfoValue}>{priceInfo.estimated_minutes} dk</Text>
                      </View>
                      {priceInfo.is_peak_hour && (
                        <View style={styles.peakHourBadge}>
                          <Text style={styles.peakHourText}>🔥 Yoğun Saat</Text>
                        </View>
                      )}
                      
                      <View style={styles.priceRangeContainer}>
                        <Text style={styles.priceRangeLabel}>Fiyat Aralığı:</Text>
                        <Text style={styles.priceRangeValue}>{priceInfo.min_price} - {priceInfo.max_price} TL</Text>
                      </View>
                      
                      <View style={styles.selectedPriceContainer}>
                        <Text style={styles.selectedPriceLabel}>Teklifiniz:</Text>
                        <Text style={styles.selectedPriceValue}>{selectedPrice} TL</Text>
                      </View>
                      
                      {/* Slider */}
                      <View style={styles.sliderContainer}>
                        <TouchableOpacity 
                          style={styles.sliderButton}
                          onPress={() => { void tapButtonHaptic(); setSelectedPrice(Math.max(priceInfo.min_price, selectedPrice - 5)); }}
                        >
                          <Text style={styles.sliderButtonText}>-5</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.sliderTrack}>
                          <View 
                            style={[
                              styles.sliderFill, 
                              { width: `${((selectedPrice - priceInfo.min_price) / (priceInfo.max_price - priceInfo.min_price)) * 100}%` }
                            ]} 
                          />
                        </View>
                        
                        <TouchableOpacity 
                          style={styles.sliderButton}
                          onPress={() => { void tapButtonHaptic(); setSelectedPrice(Math.min(priceInfo.max_price, selectedPrice + 5)); }}
                        >
                          <Text style={styles.sliderButtonText}>+5</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.priceModalPaySectionTitle}>Yol paylaşımını nasıl ödeyeceksiniz?</Text>
                      <Text style={styles.priceModalPayHint}>
                        Sürücü teklif ve eşleşme ekranında bu seçimi görecek.
                      </Text>
                      <View style={styles.priceModalPayChipsRow}>
                        <TouchableOpacity
                          onPress={() => {
                            void tapButtonHaptic();
                            setPassengerPaymentPreference('cash');
                          }}
                          style={[
                            styles.priceModalPayChip,
                            passengerPaymentPreference === 'cash' && styles.priceModalPayChipCashActive,
                          ]}
                          activeOpacity={0.88}
                        >
                          <Ionicons
                            name="cash-outline"
                            size={22}
                            color={passengerPaymentPreference === 'cash' ? '#FFF' : '#047857'}
                          />
                          <Text
                            style={[
                              styles.priceModalPayChipText,
                              passengerPaymentPreference === 'cash' && styles.priceModalVehicleChipTextActive,
                            ]}
                          >
                            Nakit
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            void tapButtonHaptic();
                            setPassengerPaymentPreference('card');
                          }}
                          style={[
                            styles.priceModalPayChip,
                            passengerPaymentPreference === 'card' && styles.priceModalPayChipCardActive,
                          ]}
                          activeOpacity={0.88}
                        >
                          <Ionicons
                            name="card-outline"
                            size={22}
                            color={passengerPaymentPreference === 'card' ? '#FFF' : '#1D4ED8'}
                          />
                          <Text
                            style={[
                              styles.priceModalPayChipText,
                              passengerPaymentPreference === 'card' && styles.priceModalVehicleChipTextActive,
                            ]}
                          >
                            Sanal kart
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.priceModalButtons}>
                        <TouchableOpacity 
                          style={styles.priceModalCancelButton}
                          onPress={() => { void tapButtonHaptic(); setShowPriceModal(false); }}
                        >
                          <Text style={styles.priceModalCancelText}>İptal</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[
                            styles.priceModalSendWrap,
                            !passengerPaymentPreference && styles.priceModalSendWrapDisabled,
                          ]}
                          activeOpacity={passengerPaymentPreference ? 0.88 : 1}
                          disabled={!passengerPaymentPreference}
                          onPress={() => {
                            if (!passengerPaymentPreference) return;
                            void tapButtonHaptic();
                            handleSendPriceOffer();
                          }}
                        >
                          <Animated.View style={{ transform: [{ scale: priceSendPulse }] }}>
                            <LinearGradient
                              colors={
                                passengerPaymentPreference
                                  ? ['#0EA5E9', '#2563EB', '#1D4ED8']
                                  : ['#94A3B8', '#64748B']
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.priceModalSendGradient}
                            >
                              <MaterialCommunityIcons name="rocket-launch-outline" size={28} color="#FFF" />
                              <Text maxFontSizeMultiplier={OFFER_CARD_MAX_FONT_SCALE} style={styles.priceModalSendTextLarge}>Teklif Gönder</Text>
                            </LinearGradient>
                          </Animated.View>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </Modal>
          </View>
        ) : null}

            {/* CANLI HARİTA - Tam Ekran (Yolcu) - SADECE MATCHED/IN_PROGRESS'DE */}
            {activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
              <View style={styles.fullScreenMapContainer}>
                {firstChatTapBanner ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setPassengerChatVisible(true);
                      setFirstChatTapBanner(null);
                    }}
                    style={{
                      backgroundColor: '#B91C1C',
                      marginHorizontal: 12,
                      marginTop: 8,
                      marginBottom: 6,
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#FCA5A5',
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
                      {firstChatTapBanner.title}
                    </Text>
                    <Text style={{ color: '#FEE2E2', fontWeight: '600', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                      {firstChatTapBanner.subtitle}
                    </Text>
                    <Text style={{ color: '#FECACA', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                      Mesajı görmek için tıklayın
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <LiveMapView
                  userLocation={userLocation}
                  otherLocation={driverLocation || activeTag?.driver_location || null}
                  destinationLocation={destination ? { latitude: destination.latitude, longitude: destination.longitude } : (activeTag?.dropoff_lat && activeTag?.dropoff_lng ? { latitude: activeTag.dropoff_lat, longitude: activeTag.dropoff_lng } : null)}
                  isDriver={false}
                  userName={user.name}
                  otherUserName={displayFirstName(activeTag?.driver_name, 'Şoför')}
                  otherUserId={activeTag?.driver_id}
                  userId={user.id}
                  tagId={activeTag?.id}
                  price={activeTag?.final_price}
                  offeredPrice={activeTag?.offered_price}
                  routeInfo={{
                    ...(activeTag?.route_info || {}),
                    meeting_distance_km: activeTag?.distance_to_passenger_km ?? null,
                    meeting_duration_min: activeTag?.time_to_passenger_min ?? null,
                    trip_distance_km: activeTag?.trip_distance_km ?? activeTag?.distance_km ?? null,
                    trip_duration_min: activeTag?.trip_duration_min ?? activeTag?.estimated_minutes ?? null,
                  }}
                  otherUserDetails={otherUserDetails || undefined}
                  onShowQRModal={() => setShowQRModal(true)}
                  onCall={async (type) => {
                    await startTripCallAsPassenger(type);
                  }}
                  onChat={() => {
                    // 🆕 Chat aç - Yolcu → Sürücüye Yaz
                    setPassengerChatVisible(true);
                  }}
                  onRequestTripEnd={async () => {
                    // Karşılıklı iptal isteği gönder - YOLCU
                    try {
                      const response = await fetch(
                        `${API_URL}/trip/request-end?tag_id=${activeTag.id}&user_id=${user.id}&user_type=passenger`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        Alert.alert('✅ İstek Gönderildi', 'Şoförün onayı bekleniyor...');
                      } else {
                        Alert.alert('Hata', data.detail || 'İstek gönderilemedi');
                      }
                    } catch (error) {
                      Alert.alert('Hata', 'İstek gönderilemedi');
                    }
                  }}
                  onAutoComplete={async () => {
                    // Hedefe yaklaşınca otomatik tamamlama - YOLCU
                    try {
                      const response = await fetch(
                        `${API_URL}/driver/complete-tag/${activeTag.id}?user_id=${user.id}&approved=true`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        Alert.alert('🎉 Yolculuk Tamamlandı!', 'Hedefe ulaştınız. İyi yolculuklar!');
                        setActiveTag(null);
                        loadActiveTag();
                      }
                    } catch (error) {
                      Alert.alert('Hata', 'İşlem başarısız');
                    }
                  }}
                  onComplete={() => {
                    Alert.alert(
                      'Yolculuğu Tamamla',
                      'Sürücü ile buluştunuz mu?',
                      [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'Evet, Tamamla',
                          onPress: async () => {
                            try {
                              const response = await fetch(
                                `${API_URL}/driver/complete-tag/${activeTag.id}?user_id=${user.id}&approved=true`,
                                { method: 'POST' }
                              );
                              const data = await response.json();
                              if (data.success) {
                                Alert.alert('🎉 Yolculuk Tamamlandı!', 'İyi yolculuklar dileriz!');
                                setActiveTag(null);
                                setDestination(null);
                                setScreen('role-select');
                              }
                            } catch (error) {
                              Alert.alert('Hata', 'İşlem başarısız');
                            }
                          }
                        }
                      ]
                    );
                  }}
                  onBlock={async () => {
                    try {
                      const response = await fetch(
                        `${API_URL}/user/block?user_id=${user.id}&blocked_user_id=${activeTag?.driver_id}`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      Alert.alert(data.success ? '✅ Engellendi' : '❌ Hata', data.message);
                    } catch (error) {
                      Alert.alert('Hata', 'Engelleme başarısız');
                    }
                  }}
                  onReport={() => {
                    Alert.alert(
                      '⚠️ Şikayet Et',
                      'Şikayet sebebinizi seçin:',
                      [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Kötü Davranış', onPress: () => reportUser('bad_behavior') },
                        { text: 'Güvensiz Sürüş', onPress: () => reportUser('unsafe_driving') },
                        { 
                          text: 'Diğer (Açıklama Yaz)', 
                          onPress: () => {
                            Alert.prompt(
                              'Şikayet Açıklaması',
                              'Lütfen şikayet sebebinizi açıklayın:',
                              [
                                { text: 'İptal', style: 'cancel' },
                                { 
                                  text: 'Gönder', 
                                  onPress: (text: string | undefined) => {
                                    if (text && text.trim()) {
                                      reportUser('other', text.trim());
                                    } else {
                                      Alert.alert('Hata', 'Lütfen açıklama yazın');
                                    }
                                  }
                                },
                              ],
                              'plain-text',
                              '',
                              'default'
                            );
                          }
                        },
                      ]
                    );
                    
                    async function reportUser(reason: string, description?: string) {
                      try {
                        const url = description 
                          ? `${API_URL}/user/report?user_id=${user.id}&reported_user_id=${activeTag?.driver_id}&reason=${reason}&description=${encodeURIComponent(description)}`
                          : `${API_URL}/user/report?user_id=${user.id}&reported_user_id=${activeTag?.driver_id}&reason=${reason}`;
                        const response = await fetch(url, { method: 'POST' });
                        const data = await response.json();
                        Alert.alert('📩 Şikayet Alındı', data.message || 'Şikayetiniz admin\'e iletildi.');
                      } catch (error) {
                        Alert.alert('Hata', 'Şikayet gönderilemedi');
                      }
                    }
                  }}
                  onForceEnd={async () => {
                    // 🔥 SOCKET İLE ANINDA BİTİR - Her iki tarafa bildirim gider
                    console.log('⚡ YOLCU - ZORLA BİTİR başlatılıyor...');
                    
                    if (!activeTag?.id) {
                      Alert.alert('Hata', 'Eşleşme bilgisi bulunamadı');
                      return;
                    }
                    
                    // 🔥 ÖNCELİKLE API'YE ZORLA BİTİR GÖNDERİYORUZ
                    try {
                      const response = await fetch(
                        `${API_URL}/trip/force-end?tag_id=${activeTag.id}&user_id=${user.id}&ender_type=passenger`, 
                        { method: 'POST' }
                      );
                      const result = await response.json();
                      console.log('🔥 Force end API yanıtı:', result);
                    } catch (err) {
                      console.log('Force end API hatası:', err);
                    }
                    
                    // Socket ile de bildir (opsiyonel - bağlıysa)
                    try {
                      passengerForceEndTrip({
                        tag_id: activeTag.id,
                        ender_id: user.id,
                        ender_type: 'passenger',
                        passenger_id: user.id,
                        driver_id: activeTag.driver_id || '',
                      });
                    } catch (socketErr) {
                      console.log('Socket force end hatası:', socketErr);
                    }
                    
                    onShowTripEndedBanner?.(
                      'Teklifi sonlandırdınız tekrar teklif göndermek için lütfen birazcık bekleyin...',
                    );
                    // Anında local state temizle
                    setActiveTag(null);
                    setDestination(null);
                    setPassengerChatVisible(false);
                    clearIncomingCall();
                    setShowCallScreen(false);
                    setCallScreenData(null);
                    setScreen('role-select');
                  }}
                  onShowEndTripModal={() => setPassengerEndTripModalVisible(true)}
                />
                
                {/* 🆕 Chat Bubble - Yolcu → Sürücüye Yaz (PURE SOCKET - ANLIK) */}
                <ChatBubble
                  visible={passengerChatVisible}
                  onClose={() => setPassengerChatVisible(false)}
                  isDriver={false}
                  otherUserName={displayFirstName(activeTag?.driver_name, 'Sürücü')}
                  currentUserName={user?.name || ''}
                  userId={user?.id || ''}
                  otherUserId={activeTag?.driver_id || ''}
                  tagId={activeTag?.id || ''}
                  incomingMessage={passengerIncomingMessage}
                  onSendMessage={(text, receiverId) => {
                    // Socket ile ANLIK gönder
                    console.log('📤 [YOLCU] onSendMessage callback:', { 
                      text, 
                      receiverId, 
                      activeTagDriverId: activeTag?.driver_id,
                      passengerEmitSendMessage: !!passengerEmitSendMessage 
                    });
                    const finalReceiverId = receiverId || activeTag?.driver_id;
                    if (!finalReceiverId) {
                      console.error('❌ [YOLCU] finalReceiverId BOŞ!');
                      return;
                    }
                    if (passengerEmitSendMessage) {
                      console.log('📤 [YOLCU] passengerEmitSendMessage çağrılıyor...');
                      passengerEmitSendMessage({
                        sender_id: user?.id || '',
                        sender_name: user?.name || 'Yolcu',
                        receiver_id: finalReceiverId,
                        message: text,
                        tag_id: activeTag?.id,
                      });
                      console.log('✅ [YOLCU] passengerEmitSendMessage çağrıldı!');
                    } else {
                      console.error('❌ [YOLCU] passengerEmitSendMessage TANIMLI DEĞİL!');
                    }
                  }}
                />
                
                {/* 🆕 End Trip Modal - Yolcu */}
                <EndTripModal
                  visible={passengerEndTripModalVisible}
                  onClose={() => setPassengerEndTripModalVisible(false)}
                  isDriver={false}
                  otherUserName={displayFirstName(activeTag?.driver_name, 'Sürücü')}
                  onComplete={async () => {
                    try {
                      const response = await fetch(
                        `${API_URL}/driver/complete-tag/${activeTag?.id}?user_id=${user?.id}&approved=true`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        setActiveTag(null);
                        setDestination(null);
                        setScreen('role-select');
                      } else {
                        Alert.alert('Hata', data.detail);
                      }
                    } catch (error) {
                      Alert.alert('Hata', 'İşlem başarısız');
                    }
                  }}
                  onRequestApproval={async () => {
                    try {
                      const response = await fetch(
                        `${API_URL}/trip/request-end?tag_id=${activeTag?.id}&user_id=${user?.id}&user_type=passenger`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        Alert.alert('✅ İstek Gönderildi', 'Sürücünün onayı bekleniyor...');
                      } else {
                        Alert.alert('Hata', data.detail || 'İstek gönderilemedi');
                      }
                    } catch (error) {
                      Alert.alert('Hata', 'İstek gönderilemedi');
                    }
                  }}
                  onForceEnd={async () => {
                    try {
                      const response = await fetch(
                        `${API_URL}/trip/force-end?tag_id=${activeTag?.id}&user_id=${user?.id}`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        onShowTripEndedBanner?.(
                          'Teklifi sonlandırdınız tekrar teklif göndermek için lütfen birazcık bekleyin...',
                        );
                        setActiveTag(null);
                        setDestination(null);
                        setScreen('role-select');
                      } else {
                        Alert.alert('Hata', data.detail);
                      }
                    } catch (error) {
                      Alert.alert('Hata', 'İşlem başarısız');
                    }
                  }}
                />
              </View>
            ) : null}
      </ScrollView>

      {/* Hedef Seçme — Google haritası + üstte arama paneli (akış: handleDestinationSelect aynı) */}
      <Modal
        visible={showDestinationPicker}
        animationType="slide"
        onRequestClose={closeDestinationPickerModal}
      >
        <View style={styles.destinationModalRoot}>
          {DestinationPickerMapView ? (
            <DestinationPickerMapView
              ref={destinationPickerMapRef}
              style={StyleSheet.absoluteFillObject}
              provider={DestinationPickerMapProvider}
              mapType="standard"
              showsUserLocation={!!userLocation}
              showsMyLocationButton={false}
              scrollEnabled
              zoomEnabled
              pitchEnabled
              rotateEnabled
              initialRegion={{
                latitude:
                  destinationPickerPin?.latitude ??
                  userLocation?.latitude ??
                  destination?.latitude ??
                  41.0082,
                longitude:
                  destinationPickerPin?.longitude ??
                  userLocation?.longitude ??
                  destination?.longitude ??
                  28.9784,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              }}
              onPress={
                destinationPickerPhase === 'map' ? handleDestinationMapPress : undefined
              }
            >
              {destinationPickerPin &&
              DestinationPickerMarker &&
              destinationPickerPhase === 'map' ? (
                <DestinationPickerMarker
                  coordinate={destinationPickerPin}
                  draggable
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onDragEnd={handleDestinationMarkerDragEnd}
                >
                  <View style={styles.destinationPinMarkerWrap} pointerEvents="none" collapsable={false}>
                    <Animated.View
                      style={[
                        styles.destinationPinRing,
                        {
                          transform: [{ scale: destPinPulse1 }],
                          opacity: destPinOpacity1,
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.destinationPinRing,
                        styles.destinationPinRingOuter,
                        {
                          transform: [{ scale: destPinPulse2 }],
                          opacity: destPinOpacity2,
                        },
                      ]}
                    />
                    <View style={styles.destinationPinCore}>
                      <Ionicons name="location" size={28} color="#FFF" />
                    </View>
                  </View>
                </DestinationPickerMarker>
              ) : null}
            </DestinationPickerMapView>
          ) : null}
          {DestinationPickerMapView && destinationPickerPhase === 'map' ? (
            <View style={styles.destinationMapCalloutWrap} pointerEvents="none">
              <View style={styles.destinationMapCalloutBubble}>
                <Text style={styles.destinationMapCalloutText}>
                  Haritayı kaydırın · yakınlaştırın · dokunun veya yeşil işaretçiyi sürükleyin
                </Text>
              </View>
            </View>
          ) : null}
          {!DestinationPickerMapView ? (
            <LinearGradient
              colors={['#0c4a6e', '#075985', '#0369a1', '#0284c7']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}

          {destinationPickerPhase === 'search' ? (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(6, 32, 58, 0.82)', 'rgba(6, 32, 58, 0.38)', 'transparent']}
              locations={[0, 0.38, 1]}
              style={styles.destinationModalTopFade}
            />
          ) : (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(15, 23, 42, 0.45)', 'rgba(15, 23, 42, 0.12)', 'transparent']}
              locations={[0, 0.25, 1]}
              style={styles.destinationModalTopFadeLight}
            />
          )}

          <View style={styles.destinationModalTouchLayer} pointerEvents="box-none">
            <SafeAreaView style={styles.destinationModalSafeOverlay} pointerEvents="box-none">
              <View
                style={[
                  styles.destinationModalHeaderBlue,
                  destinationPickerPhase === 'map' && styles.destinationModalHeaderBlueDim,
                ]}
                pointerEvents="auto"
              >
                <TouchableOpacity
                  onPress={closeDestinationPickerModal}
                  style={styles.destinationModalBackBtn}
                >
                  <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.destinationModalHeaderCenter}>
                  {destinationPickerPhase === 'map' ? (
                    <TouchableOpacity
                      onPress={() => {
                        void tapButtonHaptic();
                        setDestinationPickerPhase('search');
                        setDestinationAwaitingMapTap(false);
                        setDestination(null);
                      }}
                      style={styles.destinationChangeAreaBtn}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.destinationChangeAreaBtnText} numberOfLines={1}>
                        Mahalle / sokak değiştir
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={{ width: 40 }} />
              </View>

              {destinationPickerPhase === 'search' ? (
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.destinationKeyboardAvoid}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
                >
                  <View style={styles.destinationFloatingPanel} pointerEvents="auto">
                    <Animated.View
                      style={{ transform: [{ scale: destinationHeroPulse }], marginBottom: 8 }}
                    >
                      <Text style={[styles.destinationHeroTitle, styles.destinationHeroTitleAnimated]}>
                        Nereye gitmek istiyorsunuz?
                      </Text>
                    </Animated.View>

                    <View style={styles.destinationSearchShellModern}>
                      <PlacesAutocomplete
                        placeholder="Mahalle, sokak, mekan ara…"
                        city={user?.city || ''}
                        hidePopularChips
                        visualVariant="tech"
                        suggestionsFirst={false}
                        widerSearch
                        inputSize="large"
                        predictionMaxHeightBonus={56}
                        onPlaceSelected={(place) => handleDestinationAreaFromSearch(place)}
                      />
                    </View>
                  </View>
                </KeyboardAvoidingView>
              ) : null}
            </SafeAreaView>
          </View>

          {destinationPickerGeocoding ? (
            <View style={styles.destinationGeocodeOverlay}>
              <ActivityIndicator size="large" color="#E0F2FE" />
              <Text style={styles.destinationGeocodeText}>Adres alınıyor…</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* ✅ CallScreenV2 - Socket.IO Arama Ekranı - YOLCU */}
      {showCallScreen && callScreenData && (
        <CallScreenV2
          visible={showCallScreen}
          mode={callScreenData.mode}
          callId={callScreenData.callId}
          channelName={callScreenData.channelName}
          agoraToken={callScreenData.agoraToken}
          userId={user.id}
          remoteUserId={callScreenData.remoteUserId}
          remoteName={callScreenData.remoteName}
          callType={callScreenData.callType}
          callAccepted={callAccepted}
          callRejected={callRejected}
          callEnded={callEnded}
          receiverOffline={receiverOffline}
          onAccept={() => {
            if (callScreenData) {
              socketAcceptCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.remoteUserId,
                receiver_id: user.id
              });
              clearIncomingCall();
            }
          }}
          onReject={() => {
            if (callScreenData) {
              void fetch(
                `${API_URL}/voice/reject-call?user_id=${encodeURIComponent(user.id)}&call_id=${encodeURIComponent(callScreenData.callId)}`,
                { method: 'POST' }
              );
              socketRejectCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.remoteUserId,
                receiver_id: user.id
              });
            }
            clearIncomingCall();
          }}
          onEnd={() => {
            if (callScreenData) {
              void fetch(
                `${API_URL}/voice/end-call?user_id=${encodeURIComponent(user.id)}&call_id=${encodeURIComponent(callScreenData.callId)}`,
                { method: 'POST' }
              );
              socketEndCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.mode === 'caller' ? user.id : callScreenData.remoteUserId,
                receiver_id: callScreenData.mode === 'caller' ? callScreenData.remoteUserId : user.id,
                ended_by: user.id
              });
            }
            clearIncomingCall();
          }}
          onClose={() => {
            console.log('📞 YOLCU - Arama ekranı kapandı');
            setShowCallScreen(false);
            setCallScreenData(null);
            isCallActiveRef.current = false;
            setCallAccepted(false);
            setCallRejected(false);
            setCallEnded(false);
            setReceiverOffline(false);
            clearIncomingCall();
          }}
        />
      )}

      {/* Karşılıklı İptal Onay Modalı - YOLCU */}
      <Modal
        visible={showTripEndModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTripEndModal(false)}
      >
        <View style={styles.tripEndModalOverlay}>
          <View style={styles.tripEndModalContainer}>
            <View style={styles.tripEndModalHeader}>
              <Ionicons name="alert-circle" size={50} color="#3FA9F5" />
              <Text style={styles.tripEndModalTitle}>Yolculuk Sonlandırma</Text>
            </View>
            
            <Text style={styles.tripEndModalMessage}>
              {tripEndRequesterType === 'driver' 
                ? 'Şoför yolculuğu bitirmek istiyor. Onaylıyor musunuz?'
                : 'Yolcu yolculuğu bitirmek istiyor. Onaylıyor musunuz?'
              }
            </Text>
            
            <View style={styles.tripEndModalButtons}>
              <TouchableOpacity
                style={styles.tripEndApproveButton}
                onPress={async () => {
                  try {
                    const response = await fetch(
                      `${API_URL}/trip/respond-end-request?tag_id=${activeTag?.id}&user_id=${user.id}&approved=true`,
                      { method: 'POST' }
                    );
                    const data = await response.json();
                    if (data.success && data.approved) {
                      Alert.alert('✅ Yolculuk Tamamlandı', 'Yolculuk karşılıklı onay ile sonlandırıldı.');
                      setActiveTag(null);
                      setDestination(null);
                      setScreen('role-select');
                    }
                  } catch (error) {
                    Alert.alert('Hata', 'İşlem başarısız');
                  }
                  setShowTripEndModal(false);
                }}
              >
                <Text style={styles.tripEndApproveButtonText}>Onaylıyorum</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.tripEndRejectButton}
                onPress={async () => {
                  try {
                    await fetch(
                      `${API_URL}/trip/respond-end-request?tag_id=${activeTag?.id}&user_id=${user.id}&approved=false`,
                      { method: 'POST' }
                    );
                  } catch (error) {}
                  setShowTripEndModal(false);
                }}
              >
                <Text style={styles.tripEndRejectButtonText}>Onaylamıyorum</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* 🆕 QR İLE YOLCULUK BİTİRME MODALI */}
      <QRTripEndModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        userId={user.id}
        tagId={activeTag?.id || ''}
        isDriver={false}
        otherUserName={displayFirstName(activeTag?.driver_name, 'Sürücü')}
        bookingPaymentMethod={normalizePassengerPaymentMethod(activeTag?.passenger_payment_method)}
        myLatitude={userLocation?.latitude}
        myLongitude={userLocation?.longitude}
        otherLatitude={activeTag?.driver_latitude}
        otherLongitude={activeTag?.driver_longitude}
        onComplete={(showRating, rateUserId, rateUserName) => {
          // Yolculuk tamamlandı
          setShowQRModal(false);
          if (showRating) {
            // Puanlama modalını aç
            setRatingModalData({
              visible: true,
              tagId: activeTag?.id || '',
              rateUserId: activeTag?.driver_id || '',
              rateUserName: rateUserName || displayFirstName(activeTag?.driver_name, 'Sürücü')
            });
          }
          // Sayfayı yenile
          setActiveTag(null);
        }}
      />
      
      {/* Rating Modal - QR tarama sonrası */}
      {ratingModalData && (
        <RatingModal
          visible={ratingModalData.visible}
          onClose={() => setRatingModalData(null)}
          onRatingComplete={() => {
            // 🆕 Puanlama tamamlandı - tüm state'leri temizle
            setRatingModalData(null);
            setActiveTag(null);
          }}
          userId={user.id}
          tagId={ratingModalData.tagId}
          rateUserId={ratingModalData.rateUserId}
          rateUserName={ratingModalData.rateUserName}
        />
      )}
    </SafeAreaView>
    </ImageBackground>
  );
}

// ==================== DRIVER DASHBOARD ====================
interface DriverDashboardProps {
  user: User;
  logout: () => void;
  setScreen: (screen: 'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard' | 'forgot-password' | 'reset-pin') => void;
  kycStatusProp?: { status: string; submitted_at: string | null } | null;
  setKycStatusProp?: (status: { status: string; submitted_at: string | null } | null) => void;
  onShowTripEndedBanner?: (message: string) => void;
}

function DriverDashboard({ user, logout, setScreen, kycStatusProp, setKycStatusProp, onShowTripEndedBanner }: DriverDashboardProps) {
  const rawVk = (user?.driver_details as { vehicle_kind?: string } | undefined)?.vehicle_kind;
  const driverVehicleKind: 'car' | 'motorcycle' =
    rawVk === 'motor' || rawVk === 'motorcycle' ? 'motorcycle' : 'car';
  const isMotorDriverUi = driverVehicleKind === 'motorcycle';

  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  
  // KYC Status - prop'tan al veya null
  const kycStatus = kycStatusProp;
  const setKycStatus = setKycStatusProp || (() => {});
  
  // GPS & Map states
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{latitude: number; longitude: number} | null>(null);
  
  // Mesafe ve süre state'leri
  const [realDistance, setRealDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // 🔥 MERKEZİ GELEN ARAMA STATE + GLOBAL SOCKET (backend aynı bağlantıyı dinler)
  const {
    socket,
    connect: socketConnect,
    emitWithLog,
    incomingCallData: driverIncomingCallData,
    clearIncomingCall: driverClearIncomingCall,
    getIncomingCallData: driverGetIncomingCallData,
    incomingCallPresentToken: driverIncomingCallPresentToken,
  } = useSocketContext();

  // Sürücü ekranına girince socket room'a tekrar yazılır (teklif kaçmasın)
  useEffect(() => {
    if (!user?.id) return;
    const t = setTimeout(() => {
      socketConnect(user.id, 'driver');
    }, 400);
    return () => clearTimeout(t);
  }, [user?.id, socketConnect]);

  // Bildirim: tıklanınca veya ön planda gelince teklif listesine (new_offer)
  const {
    lastTappedNotificationData,
    clearLastTappedNotification,
    notification: driverForegroundOfferNotification,
  } = useNotifications();
  const lastOfferPushNotificationIdRef = useRef<string | null>(null);

  const fetchAndAppendOfferFromTagId = useCallback(async (tagId: string) => {
    try {
      const res = await fetch(`${API_URL}/trip/${tagId}`);
      const json = await res.json();
      if (!json.success || !json.tag || json.tag.status !== 'waiting') return;
      const tag = json.tag;
      const tagPvk = tag.passenger_preferred_vehicle;
      if (tagPvk !== undefined && tagPvk !== null && String(tagPvk).trim() !== '') {
        const ts = String(tagPvk).trim().toLowerCase();
        const tripVk: 'car' | 'motorcycle' =
          ts === 'motorcycle' || ts === 'motor' ? 'motorcycle' : 'car';
        if (tripVk !== driverVehicleKind) return;
      }
      setRequests(prev => {
        if (prev.some(r => r.id === tag.id)) return prev;
        const pvkNorm: 'car' | 'motorcycle' =
          String(tagPvk || '')
            .trim()
            .toLowerCase() === 'motorcycle' ||
          String(tagPvk || '')
            .trim()
            .toLowerCase() === 'motor'
            ? 'motorcycle'
            : 'car';
        return [...prev, {
          id: tag.id,
          tag_id: tag.id,
          request_id: tag.id,
          passenger_id: tag.passenger_id,
          passenger_name: tag.passenger_name || 'Yolcu',
          passenger_vehicle_kind: pvkNorm,
          pickup_lat: tag.pickup_lat,
          pickup_lng: tag.pickup_lng,
          pickup_address: tag.pickup_location,
          pickup_location: tag.pickup_location,
          dropoff_lat: tag.dropoff_lat,
          dropoff_lng: tag.dropoff_lng,
          dropoff_address: tag.dropoff_location,
          dropoff_location: tag.dropoff_location,
          offered_price: tag.final_price ?? tag.offered_price ?? 0,
          distance_km: tag.distance_km ?? 0,
          estimated_minutes: tag.estimated_minutes ?? 0,
          distance_to_pickup: null,
          status: 'pending',
          created_at: tag.created_at || new Date().toISOString(),
          distance_to_passenger_km: null,
          time_to_passenger_min: null,
          trip_distance_km: tag.distance_km ?? null,
          trip_duration_min: tag.estimated_minutes ?? null,
          passenger_payment_method: normalizePassengerPaymentMethod(tag.passenger_payment_method) ?? undefined,
        }];
      });
    } catch (e) {
      console.warn('Teklif trip yüklenemedi:', e);
    }
  }, [driverVehicleKind]);
  
  const playMatchSound = () => {
    void playMatchChimeSound();
  };
  const playTapSound = async () => {};
  
  // 🆕 Chat State'leri (Sürücü)
  const [driverChatVisible, setDriverChatVisible] = useState(false);
  const [driverIncomingMessage, setDriverIncomingMessage] = useState<{ text: string; senderId: string; timestamp: number } | null>(null);
  const [driverFirstChatTapBanner, setDriverFirstChatTapBanner] = useState<{ title: string; subtitle: string } | null>(null);
  
  // 🆕 End Trip Modal State'leri (Sürücü)
  const [driverEndTripModalVisible, setDriverEndTripModalVisible] = useState(false);
  const [driverForceEndConfirmVisible, setDriverForceEndConfirmVisible] = useState(false);
  
  // 🔥 Cancelled Alert'in bir kez gösterilmesi için flag
  const [cancelledAlertShown, setCancelledAlertShown] = useState(false);
  const lastCancelledTagId = useRef<string | null>(null);
  
  // 🆕 Karşı taraf (Yolcu) detay bilgileri - Harita Bilgi Kartı için
  const [otherUserDetails, setOtherUserDetails] = useState<{
    rating?: number;
    totalTrips?: number;
    profilePhoto?: string;
    vehiclePhoto?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleYear?: string;
    vehicleColor?: string;
    plateNumber?: string;
  } | null>(null);
  
  // 🆕 QR Modal State (Sürücü)
  const [showQRModal, setShowQRModal] = useState(false);
  
  // 🆕 Rating Modal State - QR tarama sonrası puanlama (Sürücü)
  const [ratingModalData, setRatingModalData] = useState<{
    visible: boolean;
    tagId: string;
    rateUserId: string;
    rateUserName: string;
  } | null>(null);
  
  // 🆕 Sürücü Dashboard Panel State'leri
  const [showDriverPackagesModal, setShowDriverPackagesModal] = useState(false);
  const [driverDashboardExpanded, setDriverDashboardExpanded] = useState(false);
  
  // Harita: index.tsx ile aynı backend kullanıldığında panel + teklif + harita birlikte çalışır.
  // Bilinen native crash yaşayan çok yeni API seviyesinde istenirse true yapılabilir.
  const shouldDisableActivityMap = false;
  
  // Eski Agora state'leri (artik kullanilmiyor ama kaldirilmadi)
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [callScreenData, setCallScreenData] = useState<{
    mode: 'caller' | 'receiver';
    callId: string;
    channelName: string;
    agoraToken: string;
    remoteName: string;
    remoteUserId: string;
    callType: 'audio' | 'video';
  } | null>(null);
  
  // Socket.IO arama durumlari
  const [callAccepted, setCallAccepted] = useState(false);
  const [callRejected, setCallRejected] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [receiverOffline, setReceiverOffline] = useState(false);
  
  // Arama kilidi
  const isCallActiveRef = useRef(false);
  
  // ==================== SOCKET.IO HOOK - ŞOFÖR ====================
  const {
    isConnected: socketConnected,
    isRegistered: socketRegistered,
    acceptCall: socketAcceptCall,
    rejectCall: socketRejectCall,
    endCall: socketEndCall,
    // TAG & Teklif için yeni fonksiyonlar
    emitSendOffer: socketSendOffer,
    emitDriverLocationUpdate,  // 🆕 YENİ: Şoför konum güncelleme (RAM)
    forceEndTrip: driverForceEndTrip,
    // 🆕 Mesajlaşma
    emitSendMessage: driverEmitSendMessage,
  } = useSocket({
    userId: user?.id || null,
    userRole: 'driver',
    onCallCancelled: (data) => {
      console.log('🚫 ŞOFÖR - ARAMA İPTAL EDİLDİ:', data);
      driverClearIncomingCall();
    },
    onCallEndedNew: (data) => {
      console.log('📴 ŞOFÖR - CALL_ENDED:', data);
      driverClearIncomingCall();
    },
    onIncomingCall: (data) => {
      console.log('📞 ŞOFÖR - GELEN ARAMA (socket):', data);
    },
    onCallAccepted: (data) => {
      console.log('✅ ŞOFÖR - ARAMA KABUL:', data);
      setCallAccepted(true);
    },
    onCallRejected: (data) => {
      console.log('❌ ŞOFÖR - ESKİ ARAMA RED:', data);
      setCallRejected(true);
    },
    onCallEnded: (data) => {
      console.log('📴 ŞOFÖR - ESKİ ARAMA BİTTİ:', data);
      setCallEnded(true);
    },
    onCallRinging: (data) => {
      console.log('🔔 ŞOFÖR - ARAMA DURUMU:', data);
      if (!data.success && !data.receiver_online) {
        setReceiverOffline(true);
      }
    },
    // Yeni TAG eventi - Yolcudan gelen TAG'ler
    onTagCreated: async (data) => {
      console.log('🏷️ ŞOFÖR - YENİ TAG GELDİ (Socket):', data);
      const pid = String(data?.passenger_id ?? '').toLowerCase();
      const uid = String(user?.id ?? '').toLowerCase();
      if (pid && uid && pid === uid) {
        console.log('⚠️ ŞOFÖR: Kendi yolcu teklifim — listeye eklenmedi');
        return;
      }

      const pvkSocket = data?.passenger_vehicle_kind ?? data?.passenger_preferred_vehicle;
      if (pvkSocket !== undefined && pvkSocket !== null && String(pvkSocket).trim() !== '') {
        const pvkS = String(pvkSocket).trim().toLowerCase();
        const tripVk: 'car' | 'motorcycle' =
          pvkS === 'motorcycle' || pvkS === 'motor' ? 'motorcycle' : 'car';
        if (tripVk !== driverVehicleKind) {
          console.log(
            '⚠️ ŞOFÖR: Yolcu araç tercihi bu sürücü tipiyle eşleşmiyor — listeye eklenmedi',
            tripVk,
            driverVehicleKind
          );
          return;
        }
      }

      // TAG'i ANINDA ekle (adresler ile)
      // 🔥 GÜÇLÜ DE-DUPLICATION - Aynı yolcudan çoklu istek engellenir
      setRequests(prev => {
        // 1. Aynı tag_id varsa EKLEME
        if (prev.some(r => r.id === data.tag_id)) {
          console.log('⚠️ DUPLICATE TAG_ID, skipping:', data.tag_id);
          return prev;
        }
        
        // 2. Aynı request_id varsa EKLEME
        if (data.request_id && prev.some(r => r.request_id === data.request_id)) {
          console.log('⚠️ DUPLICATE REQUEST_ID, skipping:', data.request_id);
          return prev;
        }
        
        // 3. Aynı yolcudan son 10 saniye içinde istek varsa GÜNCELLE (yeni ile değiştir)
        const filtered = prev.filter(r => {
          if (r.passenger_id !== data.passenger_id) return true;
          // Aynı yolcudan eski TAG'ı sil
          console.log('🔄 REPLACING old request from same passenger:', r.id, '->', data.tag_id);
          return false;
        });
        
        const pvkRaw = data.passenger_vehicle_kind ?? data.passenger_preferred_vehicle;
        const pvkStr = String(pvkRaw || '').trim().toLowerCase();
        const pvkNorm = pvkStr === 'motorcycle' || pvkStr === 'motor' ? 'motorcycle' : 'car';
        return [...filtered, {
          id: data.tag_id,
          tag_id: data.tag_id,
          request_id: data.request_id,  // 🔥 KRİTİK - ZORUNLU
          passenger_id: data.passenger_id,
          passenger_name: data.passenger_name,
          passenger_vehicle_kind: pvkNorm,
          pickup_lat: data.pickup_lat,
          pickup_lng: data.pickup_lng,
          pickup_address: data.pickup_address || data.pickup_location,
          pickup_location: data.pickup_location || data.pickup_address,
          dropoff_lat: data.dropoff_lat,
          dropoff_lng: data.dropoff_lng,
          dropoff_address: data.dropoff_address || data.dropoff_location,
          dropoff_location: data.dropoff_location || data.dropoff_address,
          // 🆕 MARTI TAG - Yolcu fiyat teklifi
          offered_price: data.offered_price || 0,
          distance_km: data.distance_km || 0,
          estimated_minutes: data.estimated_minutes || 0,
          distance_to_pickup: data.distance_to_pickup || 0,
          status: 'pending',
          created_at: new Date().toISOString(),
          // Mesafeler hesaplanıyor işareti
          distance_to_passenger_km: data.distance_to_pickup || null,
          time_to_passenger_min: null,
          trip_distance_km: data.distance_km || null,
          trip_duration_min: data.estimated_minutes || null,
          passenger_payment_method: normalizePassengerPaymentMethod(
            (data as { passenger_payment_method?: unknown }).passenger_payment_method,
          ) ?? undefined,
        }];
      });
      
      // Frontend rota hesaplaması yok: yalnızca backend'in gönderdiği mesafe/süre kullanılır.
    },
    onTagCancelled: (data) => {
      console.log('🚫 ŞOFÖR - TAG İPTAL (Socket):', data);
      // TAG'i listeden ANINDA kaldır
      setRequests(prev => prev.filter(r => r.id !== data.tag_id && r.request_id !== data.request_id));
    },
    onTagMatched: (data) => {
      console.log('🤝 ŞOFÖR - TAG EŞLEŞTİ (Socket):', data);
      // 🔊 EŞLEŞME SESİ - Ding ding ding
      playMatchSound();
      // 🔥 EŞLEŞTİĞİNDE TÜM LİSTEYİ TEMİZLE - Artık yeni teklif kabul edemez
      setRequests([]);
      
      // 🔥 ANINDA activeTag'ı güncelle - API bekleme!
      if (data && data.tag_id) {
        const matchedTag = {
          id: data.tag_id,
          tag_id: data.tag_id,
          passenger_id: data.passenger_id,
          passenger_name: data.passenger_name,
          driver_id: data.driver_id,
          driver_name: data.driver_name,
          pickup_location: data.pickup_location,
          dropoff_location: data.dropoff_location,
          pickup_lat: data.pickup_lat,
          pickup_lng: data.pickup_lng,
          dropoff_lat: data.dropoff_lat,
          dropoff_lng: data.dropoff_lng,
          offered_price: data.offered_price,
          distance_km: data.distance_km,
          estimated_minutes: data.estimated_minutes,
          status: 'matched',
          matched_at: new Date().toISOString(),
          passenger_payment_method: normalizePassengerPaymentMethod(
            (data as { passenger_payment_method?: unknown }).passenger_payment_method,
          ) ?? undefined,
        };
        console.log('🔥 ŞOFÖR - ActiveTag ANINDA güncelleniyor:', matchedTag);
        setActiveTag(matchedTag);
      }
      
      // Backend'den de çek (ekstra bilgiler için)
      setTimeout(() => loadData(), 1000);
    },
    // Backend accept_ride: doğrudan eşleşme socket’i (sürücü)
    onRideMatched: (data) => {
      console.log('✅ ŞOFÖR - ride_matched (Socket):', data);
      playMatchSound();
      setRequests([]);
      if (data?.tag_id) {
        const matchedTag = {
          id: data.tag_id,
          tag_id: data.tag_id,
          passenger_id: data.passenger_id,
          passenger_name: data.passenger_name,
          driver_id: data.driver_id,
          driver_name: data.driver_name,
          pickup_location: data.pickup_location,
          dropoff_location: data.dropoff_location,
          pickup_lat: data.pickup_lat,
          pickup_lng: data.pickup_lng,
          dropoff_lat: data.dropoff_lat,
          dropoff_lng: data.dropoff_lng,
          offered_price: data.final_price,
          final_price: data.final_price,
          distance_km: (data as { distance_km?: number }).distance_km,
          estimated_minutes: (data as { estimated_minutes?: number }).estimated_minutes,
          status: 'matched',
          matched_at: data.matched_at || new Date().toISOString(),
          passenger_payment_method: normalizePassengerPaymentMethod(
            (data as { passenger_payment_method?: unknown }).passenger_payment_method,
          ) ?? undefined,
        };
        setActiveTag(matchedTag as Tag);
      }
      setScreen('dashboard');
      setTimeout(() => loadData(), 1000);
    },
    // Teklif kabul/red
    onOfferAccepted: (data) => {
      console.log('✅ ŞOFÖR - TEKLİF KABUL EDİLDİ (Socket):', data);
      loadData();
      Alert.alert('🎉 Teklif Kabul Edildi!', 'Yolcu teklifinizi kabul etti.');
    },
    onOfferRejected: (data) => {
      console.log('❌ ŞOFÖR - TEKLİF REDDEDİLDİ (Socket):', data);
      loadData();
    },
    onOfferAlreadyTaken: () => {
      loadData();
      Alert.alert(
        'Teklif müsait değil',
        'Bu çağrı başka bir sürücü tarafından alındı veya süresi doldu. Liste güncellendi.',
      );
    },
    onFirstChatMessage: (data) => {
      if (!data?.tag_id) return;
      if (activeTag?.id && data.tag_id !== activeTag.id) return;
      if (driverChatVisible) return;
      setDriverFirstChatTapBanner({
        title: data.from_driver ? 'Sürücü size yazdı' : 'Yolcu size yazdı',
        subtitle:
          (data.message_preview || data.message || '').trim() ||
          'Mesajı görmek için tıklayın',
      });
    },
    // 🆕 ZORLA BİTİRME - Karşı taraf bitirdi
    onTripForceEnded: (data) => {
      console.log('🛑 ŞOFÖR - YOLCULUK ZORLA BİTİRİLDİ:', data);
      
      // 🔥 ANINDA TÜM STATE'LERİ TEMİZLE - Her halükarda bitirilecek
      setActiveTag(null);
      setRequests([]);
      driverClearIncomingCall();
      setShowCallScreen(false);
      setCallScreenData(null);
      setDriverChatVisible(false);
      setDriverEndTripModalVisible(false);
      
      // ROL SEÇİM EKRANINA GİT
      setScreen('role-select');
      
      // 🔥 ONAY SİSTEMİ: Karşı taraf onaylarsa 0 puan, onaylamazsa -5 puan
      const enderType = data.ender_type;
      const enderId = data.ender_id;
      const tagId = data.tag_id;
      
      if (enderType === 'passenger') {
        // Yolcu bitirdi - Sürücüye onay sor
        Alert.alert(
          '⚠️ Yolcu Eşleşmeyi Bitirdi',
          'Yolcu yolculuğu sonlandırdı.\nBu işlemi onaylıyor musunuz?',
          [
            { 
              text: 'Onaylıyorum (0 puan)', 
              style: 'default',
              onPress: async () => {
                // Onay - Yolcuya 0 puan
                try {
                  await fetch(`${API_URL}/trip/force-end-confirm?tag_id=${tagId}&ender_id=${enderId}&approved=true`, { method: 'POST' });
                } catch (e) { console.log('Onay gönderilemedi:', e); }
              }
            },
            { 
              text: 'Onaylamıyorum (-5 puan)', 
              style: 'destructive',
              onPress: async () => {
                // Red - Yolcuya -5 puan
                try {
                  await fetch(`${API_URL}/trip/force-end-confirm?tag_id=${tagId}&ender_id=${enderId}&approved=false`, { method: 'POST' });
                } catch (e) { console.log('Red gönderilemedi:', e); }
              }
            }
          ],
          { cancelable: false }
        );
      } else {
        // Sürücü bitirdi - Bu sürücü tarafı, sadece bilgi
        Alert.alert('⚠️ Yolculuk Bitirildi', 'Eşleşme sonlandırıldı.');
      }
    },
    // 🆕 QR ile yolculuk bitirme - Puanlama modalı (SOCKET'TEN)
    onShowRatingModal: (data) => {
      console.log('⭐ ŞOFÖR - PUANLAMA MODALI AÇ (Socket):', data);
      // QR modal'ı kapat
      setShowQRModal(false);
      // Puanlama modalını aç
      setRatingModalData({
        visible: true,
        tagId: data.tag_id,
        rateUserId: data.rate_user_id,
        rateUserName: data.rate_user_name
      });
      // 🆕 Trip bitti olarak işaretle - Puanlama sonrası activeTag=null olacak
    },
  });

  const startTripCallAsDriver = async (callType: 'audio' | 'video') => {
    if (!user?.id || !activeTag?.id) {
      Alert.alert('Hata', 'Yolculuk bilgisi bulunamadı');
      return;
    }
    const receiverId = String(activeTag.passenger_id ?? '').trim();
    if (!receiverId) {
      Alert.alert('Hata', 'Yolcu bilgisi bulunamadı');
      return;
    }
    if (receiverId === String(user.id).trim()) {
      Alert.alert('Hata', 'Kendinizi arayamazsınız');
      return;
    }
    if (showCallScreen || driverIncomingCallData) {
      Alert.alert('Uyarı', 'Zaten bir arama devam ediyor');
      return;
    }
    driverClearIncomingCall();
    setCalling(true);
    try {
      const response = await fetch(`${API_URL}/voice/start-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: user.id,
          receiver_id: receiverId,
          call_type: callType === 'video' ? 'video' : 'voice',
          tag_id: activeTag.id,
          caller_name: user.name,
        }),
      });
      const data = await response.json();
      setCalling(false);
      if (!data.success) {
        Alert.alert('Hata', (data.detail as string) || 'Arama başlatılamadı');
        return;
      }
      const agoraOk = await joinTripCallAgoraAsCaller(
        data.channel_name,
        data.agora_token || '',
        String(user.id)
      );
      if (!agoraOk) return;
      setCallAccepted(false);
      setCallRejected(false);
      setCallEnded(false);
      setReceiverOffline(false);
      setCallScreenData({
        mode: 'caller',
        callId: data.call_id,
        channelName: data.channel_name,
        agoraToken: data.agora_token || '',
        remoteUserId: receiverId,
        remoteName: displayFirstName(activeTag.passenger_name, 'Yolcu'),
        callType,
      });
      setShowCallScreen(true);
    } catch (e) {
      console.error('Agora arama (sürücü):', e);
      setCalling(false);
      Alert.alert('Hata', 'Arama başlatılamadı');
    }
  };

  useEffect(() => {
    if (!user?.id || !driverIncomingCallData?.callId || !driverIncomingCallData.channelName) return;
    if (String(driverIncomingCallData.callerId) === String(user.id)) return;
    if (
      showCallScreen &&
      callScreenData?.callId &&
      String(callScreenData.callId) === String(driverIncomingCallData.callId)
    ) {
      return;
    }
    setCallAccepted(false);
    setCallRejected(false);
    setCallEnded(false);
    setReceiverOffline(false);
    setCallScreenData({
      mode: 'receiver',
      callId: driverIncomingCallData.callId,
      channelName: driverIncomingCallData.channelName,
      agoraToken: driverIncomingCallData.agoraToken || '',
      remoteUserId: driverIncomingCallData.callerId,
      remoteName: displayFirstName(driverIncomingCallData.callerName, 'Arayan'),
      callType: driverIncomingCallData.callType,
    });
    setShowCallScreen(true);
  }, [
    driverIncomingCallData,
    driverIncomingCallPresentToken,
    user?.id,
    showCallScreen,
    callScreenData?.callId,
  ]);

  // 🔔 Bildirime tıklanınca (teklif / ilk sohbet mesajı)
  useEffect(() => {
    const data = lastTappedNotificationData;
    if (!data) return;
    if (data.type === 'first_chat_message' && data.tag_id) {
      clearLastTappedNotification();
      if (!activeTag?.id || String(data.tag_id) !== String(activeTag.id)) {
        void loadData();
      }
      setDriverChatVisible(true);
      setDriverFirstChatTapBanner(null);
      return;
    }
    if (data.type !== 'new_offer' || !data.tag_id) return;
    clearLastTappedNotification();
    fetchAndAppendOfferFromTagId(String(data.tag_id));
  }, [
    lastTappedNotificationData,
    clearLastTappedNotification,
    fetchAndAppendOfferFromTagId,
    activeTag?.id,
  ]);

  useEffect(() => {
    if (driverChatVisible) setDriverFirstChatTapBanner(null);
  }, [driverChatVisible]);

  // 🔔 Ön planda push geldiğinde (tıklamadan) aynı teklifi listeye ekle
  useEffect(() => {
    const n = driverForegroundOfferNotification;
    if (!n?.request) return;
    const raw = n.request.content?.data as Record<string, unknown> | undefined;
    if (!raw || raw.type !== 'new_offer' || !raw.tag_id) return;
    const nid = n.request.identifier;
    if (lastOfferPushNotificationIdRef.current === nid) return;
    lastOfferPushNotificationIdRef.current = nid;
    fetchAndAppendOfferFromTagId(String(raw.tag_id));
  }, [driverForegroundOfferNotification, fetchAndAppendOfferFromTagId]);

  // Karşılıklı iptal sistemi state'leri - ŞOFÖR
  const [showTripEndModal, setShowTripEndModal] = useState(false);
  const [tripEndRequesterType, setTripEndRequesterType] = useState<'passenger' | 'driver' | null>(null);
  
  // Animation
  const buttonPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    console.log('🔄 Sürücü polling başlatıldı');
    // Android 16 gibi cihazlarda aşırı istek ANR/çökme yaratabileceği için polling frekansını düşürüyoruz.
    loadData().catch((e) => console.log('loadData polling error:', e));
    const interval = setInterval(() => {
      loadData().catch((e) => console.log('loadData polling error:', e));
    }, 2500); // Socket kaçırırsa dispatch-pending-offer ile yakala
    return () => {
      console.log('🔄 Sürücü polling durduruldu');
      clearInterval(interval);
    };
  }, [user?.id]);

  // 🆕 SÜRÜCÜ PUANLAMA - Trip "completed" olduğunda puanlama modalını aç
  // Socket event gelmezse polling ile kontrol et
  const lastCheckedStatus = useRef<string | null>(null);
  const ratingModalShownForTag = useRef<string | null>(null);
  
  useEffect(() => {
    if (!activeTag || !user?.id) return;
    
    // Her 2 saniyede trip durumunu kontrol et
    const checkTripStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/trip/${activeTag.id}`);
        const data = await response.json();
        
        // Trip completed olduysa ve daha önce bu tag için modal gösterilmediyse
        if (data.success && data.tag?.status === 'completed' && 
            lastCheckedStatus.current !== 'completed' &&
            ratingModalShownForTag.current !== activeTag.id) {
          
          console.log('✅ SÜRÜCÜ - Trip completed detected via polling!');
          lastCheckedStatus.current = 'completed';
          ratingModalShownForTag.current = activeTag.id;
          
          // QR modal açıksa kapat
          setShowQRModal(false);
          
          // Puanlama modalını aç
          setRatingModalData({
            visible: true,
            tagId: activeTag.id,
            rateUserId: activeTag.passenger_id || '',
            rateUserName: displayFirstName(activeTag.passenger_name, 'Yolcu')
          });
        } else if (data.tag?.status) {
          lastCheckedStatus.current = data.tag.status;
        }
      } catch (error) {
        // Sessizce geç
      }
    };
    
    // İlk kontrol
    checkTripStatus();
    
    // Polling
    const interval = setInterval(checkTripStatus, 2000);
    return () => clearInterval(interval);
  }, [activeTag?.id, user?.id]);

  // CANLI YOLCU KONUM GÜNCELLEME - Eşleşince başla
  useEffect(() => {
    if (activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress')) {
      const interval = setInterval(async () => {
        try {
          // Yolcu konumunu backend'den al
          const response = await fetch(`${API_URL}/driver/passenger-location/${activeTag.passenger_id}`);
          const data = await response.json();
          if (data.location) {
            setPassengerLocation(data.location);
            // Mesafeyi hesapla
            if (userLocation) {
              const distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                data.location.latitude,
                data.location.longitude
              );
              setRealDistance(distance);
              // Tahmini süreyi hesapla (ortalama 40 km/h)
              const time = Math.round((distance / 40) * 60);
              setEstimatedTime(time);
            }
          }
        } catch (error) {
          console.log('Yolcu konumu alınamadı:', error);
        }
      }, 5000); // 5 saniyede bir güncelle

      return () => clearInterval(interval);
    }
  }, [activeTag, userLocation]);

  // Karşılıklı iptal isteği polling - ŞOFÖR için
  useEffect(() => {
    if (!user?.id || !activeTag) return;
    if (activeTag.status !== 'matched' && activeTag.status !== 'in_progress') return;
    
    const checkTripEndRequest = async () => {
      try {
        const response = await fetch(`${API_URL}/trip/check-end-request?tag_id=${activeTag.id}&user_id=${user.id}`);
        const data = await response.json();
        
        console.log('🔚 ŞOFÖR - Trip end request check:', JSON.stringify(data));
        
        if (data.success && data.has_request && !showTripEndModal) {
          console.log('🔚 ŞOFÖR - Bitirme isteği VAR! Requester:', data.requester_type);
          setTripEndRequesterType(data.requester_type || 'unknown');
          setShowTripEndModal(true);
        }
      } catch (error) {
        console.log('Check trip end error:', error);
      }
    };
    
    checkTripEndRequest();
    const interval = setInterval(checkTripEndRequest, 1000); // 1 saniyede bir kontrol - HIZLI
    return () => clearInterval(interval);
  }, [user?.id, activeTag?.id, activeTag?.status, showTripEndModal]);

  // 🆕 Yolcu detaylarını çek (Harita Bilgi Kartı için)
  useEffect(() => {
    const fetchPassengerDetails = async () => {
      if (!activeTag?.passenger_id || (activeTag.status !== 'matched' && activeTag.status !== 'in_progress')) {
        setOtherUserDetails(null);
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/user/${activeTag.passenger_id}`);
        const data = await response.json();
        
        if (data.success && data.user) {
          setOtherUserDetails({
            rating: data.user.rating != null ? Number(data.user.rating) : 4.0,
            totalTrips: data.user.total_trips || 0,
            profilePhoto: data.user.profile_photo,
          });
          console.log('📋 Yolcu detayları yüklendi:', data.user.name);
        }
      } catch (error) {
        console.error('Yolcu detayları alınamadı:', error);
      }
    };
    
    fetchPassengerDetails();
  }, [activeTag?.passenger_id, activeTag?.status]);

  // Sürücü ekranına girer girmez konum izni (beklemede sessiz kalmasın)
  const driverLocationAlertShown = useRef(false);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const cur = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (cur.status === 'granted') return;
        const req = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (req.status !== 'granted' && !driverLocationAlertShown.current) {
          driverLocationAlertShown.current = true;
          Alert.alert(
            'Konum izni gerekli',
            'Haritayı görmek, teklif almak ve çevrimiçi olmak için konum izni vermelisiniz.',
            [
              { text: 'Ayarlar', onPress: () => Linking.openSettings() },
              { text: 'Tamam', style: 'cancel' },
            ]
          );
        }
      } catch (e) {
        console.warn('Sürücü konum izni:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // GPS konum güncellemesi + Socket.IO location update
  useEffect(() => {
    const updateLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High
          });
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
          setUserLocation(coords);
          
          // 🆕 Socket.IO ile konum güncelle (RAM'de tutulur - 20km radius için)
          if (emitDriverLocationUpdate && user?.id) {
            emitDriverLocationUpdate({
              driver_id: user.id,
              lat: coords.latitude,
              lng: coords.longitude
            });
          }
          
          // Backend'e gönder (DB için)
          await fetch(`${API_URL}/user/update-location?user_id=${user.id}&latitude=${coords.latitude}&longitude=${coords.longitude}`, {
            method: 'POST'
          });
        }
      } catch (error) {
        console.error('Konum alınamadı:', error);
      }
    };

    updateLocation();
    const locationInterval = setInterval(updateLocation, 10000); // 10 saniyede bir
    return () => clearInterval(locationInterval);
  }, [user.id, emitDriverLocationUpdate]);

  const loadData = async () => {
    const trip = await loadActiveTag();
    const busy = trip && ['matched', 'in_progress'].includes(String(trip.status || ''));
    if (!busy) {
      await loadDispatchPendingOffer();
    }
    await loadRequests();
  };

  /** Sıralı dispatch: uygulama resume / polling ile DB'deki aktif teklifi listeye ekle */
  const loadDispatchPendingOffer = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        `${API_URL}/driver/dispatch-pending-offer?user_id=${encodeURIComponent(user.id)}`
      );
      const dj = await res.json();
      if (!dj.success || !dj.offer?.tag_id) return;
      const data = dj.offer;
      const pendingPvk = data.passenger_vehicle_kind;
      if (pendingPvk !== undefined && pendingPvk !== null && String(pendingPvk).trim() !== '') {
        const ps = String(pendingPvk).trim().toLowerCase();
        const tripVk: 'car' | 'motorcycle' =
          ps === 'motorcycle' || ps === 'motor' ? 'motorcycle' : 'car';
        if (tripVk !== driverVehicleKind) return;
      }
      setRequests((prev) => {
        if (prev.some((r) => r.id === data.tag_id)) return prev;
        return [
          ...prev,
          {
            id: data.tag_id,
            tag_id: data.tag_id,
            request_id: data.tag_id,
            passenger_id: data.passenger_id,
            passenger_name: data.passenger_name || 'Yolcu',
            pickup_lat: data.pickup_lat,
            pickup_lng: data.pickup_lng,
            pickup_address: data.pickup_location,
            pickup_location: data.pickup_location,
            dropoff_lat: data.dropoff_lat,
            dropoff_lng: data.dropoff_lng,
            dropoff_address: data.dropoff_location,
            dropoff_location: data.dropoff_location,
            offered_price: data.offered_price ?? 0,
            distance_km: data.distance_km ?? 0,
            estimated_minutes: data.estimated_minutes ?? 0,
            distance_to_pickup: data.distance_to_pickup,
            status: 'pending',
            created_at: new Date().toISOString(),
            distance_to_passenger_km: data.distance_to_pickup ?? null,
            time_to_passenger_min: null,
            trip_distance_km: data.distance_km ?? null,
            trip_duration_min: data.estimated_minutes ?? null,
            passenger_vehicle_kind: (() => {
              const v = data.passenger_vehicle_kind;
              const s = String(v || '').toLowerCase();
              return s === 'motorcycle' || s === 'motor' ? 'motorcycle' : 'car';
            })(),
          },
        ];
      });
    } catch (e) {
      console.warn('dispatch-pending-offer:', e);
    }
  };

  const loadActiveTag = async (): Promise<Record<string, unknown> | null> => {
    try {
      const response = await fetch(`${API_URL}/driver/active-tag?user_id=${user.id}`);
      const data = await response.json();
      
      if (data.success && data.tag) {
        // 🔥 Eğer tag cancelled veya completed ise - ÇIKIŞ YAP
        if (data.tag.status === 'cancelled' || data.tag.status === 'completed') {
          console.log('🛑 ŞOFÖR loadActiveTag: Tag bitirilmiş, çıkış yapılıyor...', data.tag.status);
          
          // 🔥 Alert'i sadece bir kez göster - aynı tag için tekrar gösterme
          const shouldShowAlert = data.tag.status === 'cancelled' && 
                                   lastCancelledTagId.current !== data.tag.id;
          
          // State'leri temizle
          setActiveTag(null);
          setRequests([]);
          setDriverChatVisible(false);
          driverClearIncomingCall();
          setCancelledAlertShown(true);
          lastCancelledTagId.current = data.tag.id;
          
          // Rol seçim ekranına yönlendir
          setScreen('role-select');
          
          // Alert'i sadece bir kez göster
          if (shouldShowAlert) {
            Alert.alert('⚠️ Eşleşme Bitirildi', 'Karşı taraf eşleşmeyi sonlandırdı.');
          }
          return null;
        }
        
        // Aktif tag varsa, cancelled flag'i sıfırla
        setCancelledAlertShown(false);
        setActiveTag(data.tag);
        return data.tag;
      } else {
        // API'den tag gelmedi - artık cancelled tag dönüyor, bu kısım çok çalışmaz
        setActiveTag(null);
        return null;
      }
    } catch (error) {
      console.error('TAG yüklenemedi:', error);
      return null;
    }
  };

  const loadRequests = async () => {
    // 🆕 MARTI TAG: API'den yükleme devre dışı - sadece socket'ten alıyoruz
    // Socket'ten gelen tekliflerin ezilmesini önlemek için API çağrısı kaldırıldı
    // Teklifler onNewTag callback'i ile geliyor
    console.log('📡 MARTI TAG: Teklifler socket üzerinden alınıyor');
  };

  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerSending, setOfferSending] = useState(false); // Loading state
  const [selectedTagForOffer, setSelectedTagForOffer] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerSent, setOfferSent] = useState(false); // Teklif gönderildi mi?

  // ANINDA TEKLİF GÖNDER - Backend API
  const sendOfferInstant = async (tagId: string, price: number): Promise<boolean> => {
    if (!user?.id || !tagId || price < 10) return false;
    
    // 🔥 TAG'den bilgileri al
    const tag = requests.find(r => r.id === tagId || r.tag_id === tagId);
    const requestId = tag?.request_id || tagId; // Fallback to tagId
    const passengerId = tag?.passenger_id;
    
    console.log('🚀 TEKLİF GÖNDERİLİYOR (HIZLI):', {
      price, tagId, requestId, passengerId,
      socketSendOffer: !!socketSendOffer
    });
    
    // 🔥 ÖNCE SOCKET - ANINDA YOLCUYA ULAŞSIN
    if (socketSendOffer) {
      const offerPayload = {
        request_id: requestId,
        tag_id: tagId,
        driver_id: user.id,
        driver_name: user.name || user.phone,
        driver_rating: user.rating ?? 4.0,
        passenger_id: passengerId || '',
        price: price,
        vehicle_model: user.vehicle_model,
        vehicle_color: user.vehicle_color,
      };
      console.log('🔥 [DRIVER] Socket emit YAPILIYOR:', JSON.stringify(offerPayload));
      socketSendOffer(offerPayload);
      console.log('✅ [DRIVER] Socket emit TAMAMLANDI!');
    } else {
      console.error('❌ socketSendOffer TANIMLANMAMIŞ!');
    }
    
    // 🔥 PARALEL BACKEND KAYDI
    fetch(`${API_URL}/driver/send-offer?user_id=${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_id: tagId,
        price: price,
        latitude: userLocation?.latitude || 0,
        longitude: userLocation?.longitude || 0
      })
    }).then(res => res.json()).then(data => {
      console.log('📥 BACKEND KAYIT:', data.success ? '✅' : '❌', data.offer_id || data.detail);
    }).catch(err => {
      console.error('❌ BACKEND KAYIT HATASI:', err.message);
    });
    
    // Kartı listeden kaldır
    setRequests(prev => prev.filter(r => r.id !== tagId));
    return true;
  };

  const handleSendOffer = (tagId: string) => {
    playTapSound();
    setSelectedTagForOffer(tagId);
    setOfferPrice('');
    setOfferSent(false); // Reset
    setOfferSending(false); // Reset loading state
    setOfferModalVisible(true);
  };

  // Şoför için talebi 10 dakikalığına gizle (çarpı butonu)
  const handleDismissRequest = async (tagId: string) => {
    playTapSound();
    try {
      const response = await fetch(`${API_URL}/driver/dismiss-request?user_id=${user.id}&tag_id=${tagId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        // Talebi listeden kaldır
        setRequests(prev => prev.filter(r => r.id !== tagId));
        // Toast göster
        Alert.alert('Gizlendi', 'Bu talep 10 dakika boyunca görünmeyecek');
      }
    } catch (error) {
      console.log('Dismiss error:', error);
    }
  };

  const submitOffer = async () => {
    if (!offerPrice || !selectedTagForOffer || offerSending) return;
    
    const tagId = selectedTagForOffer;
    const price = Number(offerPrice);
    const tag = requests.find(r => r.id === tagId);
    
    // UI'ı güncelle
    setOfferSending(true);
    setOfferModalVisible(false);
    setOfferPrice('');
    
    // 🔥 Socket ile yolcuya bildir
    if (socketSendOffer && tag) {
      console.log('🔥 [SÜRÜCÜ] Socket teklif gönderiliyor...', { tagId, price, socketConnected });
      socketSendOffer({
        tag_id: tagId,
        driver_id: user.id,
        driver_name: user.name || user.phone,
        passenger_id: tag.passenger_id,
        price: price,
      });
      console.log('🔥 [SÜRÜCÜ] Socket teklif ÇAĞRILDI!');
      
      // Kartı 1 saniye sonra kaldır (socket gönderim için zaman ver)
      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== tagId));
      }, 1000);
    } else {
      console.error('❌ [SÜRÜCÜ] socketSendOffer YOK veya tag bulunamadı!', { socketSendOffer: !!socketSendOffer, tag: !!tag });
    }
    
    // 📝 REST API arka planda kaydet
    fetch(`${API_URL}/driver/send-offer?user_id=${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_id: tagId,
        price: price,
        latitude: userLocation?.latitude || 0,
        longitude: userLocation?.longitude || 0
      })
    })
    .then(r => r.json())
    .then(data => {
      setOfferSending(false);
      if (data.success || data.offer_id) {
        console.log('✅ Teklif Supabase\'e kaydedildi');
      } else {
        console.log('⚠️ Supabase kayıt hatası:', data.detail);
        // Hata olursa geri ekle (opsiyonel)
      }
    })
    .catch((err) => {
      setOfferSending(false);
      console.log('⚠️ REST API hatası (socket zaten gönderdi):', err);
    });
  };

  const handleStartTag = async () => {
    if (!activeTag) return;

    try {
      const response = await fetch(`${API_URL}/driver/start-tag/${activeTag.id}?user_id=${user.id}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        
        loadActiveTag();
      }
    } catch (error) {
      Alert.alert('Hata', 'Yolculuk başlatılamadı');
    }
  };

  const handleCompleteTag = async () => {
    if (!activeTag) return;

    Alert.alert(
      'Yolculuğu Tamamla',
      'Yolculuk tamamlandı olarak işaretlenecek',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tamamla',
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_URL}/driver/complete-tag/${activeTag.id}?user_id=${user.id}`,
                { method: 'POST' }
              );

              const data = await response.json();
              if (data.success) {
                
                setActiveTag(null);
                loadRequests();
              }
            } catch (error) {
              Alert.alert('Hata', 'İşlem başarısız');
            }
          }
        }
      ]
    );
  };
  // SESLİ ARAMA - Driver için mock fonksiyon
  const handleDriverVoiceCall = () => {
    setCalling(true);
    Alert.alert(
      '📞 Sesli Arama',
      'Yolcunuzla bağlantı kuruluyor...\n\n🔒 Uçtan uca şifreli arama\n📱 Gerçek numaralar gizli',
      [
        {
          text: 'Aramayı Sonlandır',
          onPress: () => {
            setCalling(false);
            
          }
        }
      ]
    );
  };

  // 🚫 SESLİ ARAMA KALDIRILDI - ŞOFÖR
  // IncomingCallScreen, OutgoingCallScreen, DailyCallScreen kaldırıldı

  // 📋 KYC PENDING EKRANI - Başvuru inceleniyor
  if (kycStatus?.status === 'pending') {
    // Kalan süreyi hesapla (30 dakika)
    const submittedAt = kycStatus.submitted_at ? new Date(kycStatus.submitted_at) : new Date();
    const now = new Date();
    const elapsedMs = now.getTime() - submittedAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
    const remainingMinutes = Math.max(0, 30 - elapsedMinutes);
    
    return (
      <SafeAreaView style={styles.kycPendingContainer}>
        <View style={styles.kycPendingHeader}>
          <TouchableOpacity onPress={() => { setKycStatus(null); setScreen('role-select'); }} style={styles.backButtonHeader}>
            <Ionicons name="chevron-back" size={24} color="#3FA9F5" />
          </TouchableOpacity>
          <Text style={styles.kycPendingHeaderTitle}>Sürücü Başvurusu</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.kycPendingContent}>
          <View style={styles.kycPendingIconCircle}>
            <Ionicons name="hourglass-outline" size={80} color="#F59E0B" />
          </View>
          
          <Text style={styles.kycPendingTitle}>Başvurunuz İnceleniyor</Text>
          
          <Text style={styles.kycPendingDescription}>
            Teklifleri alabilmeniz için başvurunuzun onaylanması gerekiyor.{'\n'}Lütfen bekleyin.
          </Text>
          
          <View style={styles.kycPendingTimerBox}>
            <Ionicons name="time-outline" size={28} color="#3FA9F5" />
            <View>
              <Text style={styles.kycPendingTimerLabel}>Tahmini Kalan Süre</Text>
              <Text style={styles.kycPendingTimerValue}>
                {remainingMinutes > 0 ? `${remainingMinutes} dakika` : 'Çok yakında...'}
              </Text>
            </View>
          </View>
          
          <View style={styles.kycPendingInfoBox}>
            <Ionicons name="information-circle" size={24} color="#3FA9F5" />
            <Text style={styles.kycPendingInfoText}>
              Admin başvurunuzu en kısa sürede inceleyecek.{'\n'}Onaylandığında bildirim alacaksınız.
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.kycPendingRefreshBtn}
            onPress={async () => {
              try {
                const response = await fetch(`${API_URL}/driver/kyc/status?user_id=${user?.id}`);
                const data = await response.json();
                if (data.kyc_status === 'approved') {
                  setKycStatus(null);
                  if (Platform.OS === 'web') {
                    window.alert('✅ Tebrikler! Başvurunuz onaylandı. Artık teklifleri alabilirsiniz.');
                  } else {
                    Alert.alert('✅ Onaylandı', 'Tebrikler! Başvurunuz onaylandı. Artık teklifleri alabilirsiniz.');
                  }
                } else if (data.kyc_status === 'rejected') {
                  setKycStatus(null);
                  setScreen('driver-kyc');
                  if (Platform.OS === 'web') {
                    window.alert('❌ Başvurunuz reddedildi: ' + (data.rejection_reason || 'Belgeler uygun değil'));
                  } else {
                    Alert.alert('❌ Reddedildi', 'Başvurunuz reddedildi: ' + (data.rejection_reason || 'Belgeler uygun değil'));
                  }
                } else {
                  // Hala pending
                  setKycStatus({
                    status: data.kyc_status,
                    submitted_at: data.submitted_at
                  });
                }
              } catch (error) {
                console.error('KYC status check error:', error);
              }
            }}
          >
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.kycPendingRefreshText}>Durumu Kontrol Et</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /** Yolculuk yokken: teklif gelse de gelmese de aynı düzen (panel + harita + puan) */
  const driverInActiveTrip =
    !!(activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress'));

  if (!driverInActiveTrip) {
    return (
      <>
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: '#0f172a' }}>
            <View style={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 }}>
              <DriverDashboardPanel
                userId={user.id}
                onPackagePress={() => setShowDriverPackagesModal(true)}
                onToggleOnline={(isOnline) => {
                  console.log('Sürücü online durumu değişti:', isOnline);
                }}
                expanded={driverDashboardExpanded}
                onExpandToggle={() => setDriverDashboardExpanded(!driverDashboardExpanded)}
              />
            </View>
          </SafeAreaView>
          <View style={{ flex: 1, minHeight: 0 }}>
            <DriverOfferScreen
              embedded
              vehicleKind={driverVehicleKind}
              driverId={user.id}
              playTapSound={playTapSound}
              driverLocation={userLocation}
              requests={requests.map((req) => ({
                id: req.id,
                request_id: req.request_id || req.id,
                tag_id: req.tag_id,
                passenger_id: req.passenger_id,
                passenger_name: req.passenger_name || 'Yolcu',
                pickup_location: req.pickup_location || req.passenger_address || 'Bilinmiyor',
                pickup_lat: req.pickup_lat || req.passenger_lat,
                pickup_lng: req.pickup_lng || req.passenger_lng,
                dropoff_location: req.dropoff_location || req.destination || 'Belirtilmedi',
                dropoff_lat: req.dropoff_lat,
                dropoff_lng: req.dropoff_lng,
                distance_to_passenger_km: req.distance_to_passenger_km || req.distance_to_pickup,
                trip_distance_km: req.trip_distance_km || req.distance_km,
                time_to_passenger_min: req.time_to_passenger_min,
                trip_duration_min: req.trip_duration_min || req.estimated_minutes,
                offered_price: req.offered_price || 0,
                passenger_vehicle_kind: (req as any).passenger_vehicle_kind || 'car',
                notes: req.notes,
                created_at: req.created_at,
              }))}
              driverName={user.name}
              driverRating={user.rating ?? 4.0}
              onSendOffer={sendOfferInstant}
              onDismissRequest={handleDismissRequest}
              onBack={() => {
                playTapSound();
                setScreen('role-select');
              }}
              onLogout={() => {
                playTapSound();
                logout();
              }}
            />
          </View>
        </View>
        <DriverPackagesModal
          visible={showDriverPackagesModal}
          onClose={() => setShowDriverPackagesModal(false)}
          userId={user.id}
          onPackagePurchased={() => {
            setShowDriverPackagesModal(false);
          }}
        />
      </>
    );
  }

  return (
    <ImageBackground 
      source={require('../assets/images/driver-background.png')} 
      style={styles.driverBackgroundContainer}
      imageStyle={styles.driverBackgroundImage}
    >
    {isMotorDriverUi ? (
      <LinearGradient
        colors={['rgba(21, 128, 61, 0.45)', 'rgba(15, 23, 42, 0.72)']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    ) : null}
    <SafeAreaView style={styles.containerTransparent}>

      {/* CANLI HARİTA - Tam Ekran (Şoför)
          Android'de (stabilite için) haritayı kapatıyoruz. */}
      {activeTag && !shouldDisableActivityMap && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
        <View style={styles.fullScreenMapContainer}>
          {driverFirstChatTapBanner ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setDriverChatVisible(true);
                setDriverFirstChatTapBanner(null);
              }}
              style={{
                backgroundColor: '#B91C1C',
                marginHorizontal: 12,
                marginTop: 8,
                marginBottom: 6,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#FCA5A5',
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15, textAlign: 'center' }}>
                {driverFirstChatTapBanner.title}
              </Text>
              <Text style={{ color: '#FEE2E2', fontWeight: '600', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                {driverFirstChatTapBanner.subtitle}
              </Text>
              <Text style={{ color: '#FECACA', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                Mesajı görmek için tıklayın
              </Text>
            </TouchableOpacity>
          ) : null}
          <LiveMapView
            userLocation={userLocation}
            otherLocation={passengerLocation || activeTag?.passenger_location || null}
            destinationLocation={activeTag?.dropoff_lat && activeTag?.dropoff_lng ? { latitude: activeTag.dropoff_lat, longitude: activeTag.dropoff_lng } : null}
            otherTripVehicleKind={
              activeTag?.passenger_vehicle_kind === 'motorcycle' ||
              activeTag?.passenger_preferred_vehicle === 'motorcycle'
                ? 'motorcycle'
                : 'car'
            }
            passengerPaymentMethod={normalizePassengerPaymentMethod(activeTag?.passenger_payment_method) ?? undefined}
            isDriver={true}
            userName={user.name}
            otherUserName={displayFirstName(activeTag?.passenger_name, 'Yolcu')}
            otherUserId={activeTag?.passenger_id}
            userId={user.id}
            tagId={activeTag?.id}
            price={activeTag?.final_price}
            offeredPrice={activeTag?.offered_price}
            routeInfo={{
              ...(activeTag?.route_info || {}),
              meeting_distance_km: activeTag?.distance_to_passenger_km ?? null,
              meeting_duration_min: activeTag?.time_to_passenger_min ?? null,
              trip_distance_km: activeTag?.trip_distance_km ?? activeTag?.distance_km ?? null,
              trip_duration_min: activeTag?.trip_duration_min ?? activeTag?.estimated_minutes ?? null,
            }}
            otherUserDetails={otherUserDetails || undefined}
            onShowQRModal={() => setShowQRModal(true)}
            onCall={async (type) => {
              await startTripCallAsDriver(type);
            }}
            onChat={() => {
              // 🆕 Chat aç - Sürücü → Yolcuya Yaz
              setDriverChatVisible(true);
            }}
            onForceEnd={async () => {
              // 🔥 API İLE ANINDA BİTİR - Önce veritabanı güncellenir
              console.log('⚡ ŞOFÖR - ZORLA BİTİR başlatılıyor...');
              
              if (!activeTag?.id) {
                Alert.alert('Hata', 'Eşleşme bilgisi bulunamadı');
                return;
              }
              
              // 🔥 ÖNCELİKLE API'YE ZORLA BİTİR GÖNDERİYORUZ
              try {
                const response = await fetch(
                  `${API_URL}/trip/force-end?tag_id=${activeTag.id}&user_id=${user.id}&ender_type=driver`, 
                  { method: 'POST' }
                );
                const result = await response.json();
                console.log('🔥 Force end API yanıtı:', result);
              } catch (err) {
                console.log('Force end API hatası:', err);
              }
              
              // Socket ile de bildir (opsiyonel - bağlıysa)
              try {
                driverForceEndTrip({
                  tag_id: activeTag.id,
                  ender_id: user.id,
                  ender_type: 'driver',
                  passenger_id: activeTag.passenger_id || '',
                  driver_id: user.id,
                });
              } catch (socketErr) {
                console.log('Socket force end hatası:', socketErr);
              }
              
              onShowTripEndedBanner?.(
                'Teklifi sonlandırdınız tekrar teklif göndermek için lütfen birazcık bekleyin...',
              );
              // Anında local state temizle
              setActiveTag(null);
              setRequests([]);
              setDriverChatVisible(false);
              driverClearIncomingCall();
              setScreen('role-select');
            }}
            onRequestTripEnd={async () => {
              // Karşılıklı iptal isteği gönder - ŞOFÖR
              try {
                const response = await fetch(
                  `${API_URL}/trip/request-end?tag_id=${activeTag.id}&user_id=${user.id}&user_type=driver`,
                  { method: 'POST' }
                );
                const data = await response.json();
                if (data.success) {
                  Alert.alert('✅ İstek Gönderildi', 'Yolcunun onayı bekleniyor...');
                } else {
                  Alert.alert('Hata', data.detail || 'İstek gönderilemedi');
                }
              } catch (error) {
                Alert.alert('Hata', 'İstek gönderilemedi');
              }
            }}
            onComplete={() => {
              Alert.alert(
                'Yolculuğu Tamamla',
                'Yolcuyu hedefe ulaştırdınız mı?',
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Evet, Tamamla',
                    onPress: async () => {
                      try {
                        const response = await fetch(
                          `${API_URL}/driver/complete-tag/${activeTag.id}?user_id=${user.id}`,
                          { method: 'POST' }
                        );
                        const data = await response.json();
                        if (data.success) {
                          Alert.alert('🎉 Yolculuk Tamamlandı!', 'İyi yolculuklar dileriz!');
                          setActiveTag(null);
                          setScreen('role-select');
                        }
                      } catch (error) {
                        Alert.alert('Hata', 'İşlem başarısız');
                      }
                    }
                  }
                ]
              );
            }}
            onAutoComplete={async () => {
              // Hedefe yaklaşınca otomatik tamamlama - ŞOFÖR
              try {
                const response = await fetch(
                  `${API_URL}/driver/complete-tag/${activeTag.id}?user_id=${user.id}`,
                  { method: 'POST' }
                );
                const data = await response.json();
                if (data.success) {
                  Alert.alert('🎉 Yolculuk Tamamlandı!', 'Hedefe ulaştınız. İyi yolculuklar!');
                  setActiveTag(null);
                  setScreen('role-select');
                }
              } catch (error) {
                Alert.alert('Hata', 'İşlem başarısız');
              }
            }}
            onBlock={async () => {
              try {
                const response = await fetch(
                  `${API_URL}/user/block?user_id=${user.id}&blocked_user_id=${activeTag?.passenger_id}`,
                  { method: 'POST' }
                );
                const data = await response.json();
                Alert.alert(data.success ? '✅ Engellendi' : '❌ Hata', data.message);
              } catch (error) {
                Alert.alert('Hata', 'Engelleme başarısız');
              }
            }}
            onReport={() => {
              Alert.alert(
                '⚠️ Şikayet Et',
                'Şikayet sebebinizi seçin:',
                [
                  { text: 'İptal', style: 'cancel' },
                  { text: 'Kötü Davranış', onPress: () => reportPassenger('bad_behavior') },
                  { text: 'Sahte Talep', onPress: () => reportPassenger('fake_request') },
                  { 
                    text: 'Diğer (Açıklama Yaz)', 
                    onPress: () => {
                      Alert.prompt(
                        'Şikayet Açıklaması',
                        'Lütfen şikayet sebebinizi açıklayın:',
                        [
                          { text: 'İptal', style: 'cancel' },
                          { 
                            text: 'Gönder', 
                            onPress: (text: string | undefined) => {
                              if (text && text.trim()) {
                                reportPassenger('other', text.trim());
                              } else {
                                Alert.alert('Hata', 'Lütfen açıklama yazın');
                              }
                            }
                          },
                        ],
                        'plain-text',
                        '',
                        'default'
                      );
                    }
                  },
                ]
              );
              
              async function reportPassenger(reason: string, description?: string) {
                try {
                  const url = description 
                    ? `${API_URL}/user/report?user_id=${user.id}&reported_user_id=${activeTag?.passenger_id}&reason=${reason}&description=${encodeURIComponent(description)}`
                    : `${API_URL}/user/report?user_id=${user.id}&reported_user_id=${activeTag?.passenger_id}&reason=${reason}`;
                  const response = await fetch(url, { method: 'POST' });
                  const data = await response.json();
                  Alert.alert('📩 Şikayet Alındı', data.message || 'Şikayetiniz admin\'e iletildi.');
                } catch (error) {
                  Alert.alert('Hata', 'Şikayet gönderilemedi');
                }
              }
            }}
            onShowEndTripModal={() => setDriverEndTripModalVisible(true)}
          />
          
          {/* 🆕 Chat Bubble - Sürücü → Yolcuya Yaz (PURE SOCKET - ANLIK) */}
          <ChatBubble
            visible={driverChatVisible}
            onClose={() => setDriverChatVisible(false)}
            isDriver={true}
            otherUserName={displayFirstName(activeTag?.passenger_name, 'Yolcu')}
            currentUserName={user?.name || ''}
            userId={user?.id || ''}
            otherUserId={activeTag?.passenger_id || ''}
            tagId={activeTag?.id || ''}
            incomingMessage={driverIncomingMessage}
            onSendMessage={(text, receiverId) => {
              // Socket ile ANLIK gönder
              console.log('📤 [SÜRÜCÜ] onSendMessage callback:', { 
                text, 
                receiverId, 
                activeTagPassengerId: activeTag?.passenger_id,
                driverEmitSendMessage: !!driverEmitSendMessage 
              });
              const finalReceiverId = receiverId || activeTag?.passenger_id;
              if (!finalReceiverId) {
                console.error('❌ [SÜRÜCÜ] finalReceiverId BOŞ!');
                return;
              }
              if (driverEmitSendMessage) {
                console.log('📤 [SÜRÜCÜ] driverEmitSendMessage çağrılıyor...');
                driverEmitSendMessage({
                  sender_id: user?.id || '',
                  sender_name: user?.name || 'Sürücü',
                  receiver_id: finalReceiverId,
                  message: text,
                  tag_id: activeTag?.id,
                });
                console.log('✅ [SÜRÜCÜ] driverEmitSendMessage çağrıldı!');
              } else {
                console.error('❌ [SÜRÜCÜ] driverEmitSendMessage TANIMLI DEĞİL!');
              }
            }}
          />
          
          {/* 🆕 End Trip Modal - Sürücü */}
          <EndTripModal
            visible={driverEndTripModalVisible}
            onClose={() => setDriverEndTripModalVisible(false)}
            isDriver={true}
            otherUserName={displayFirstName(activeTag?.passenger_name, 'Yolcu')}
            onComplete={async () => {
              try {
                const response = await fetch(
                  `${API_URL}/driver/complete-tag/${activeTag?.id}?user_id=${user?.id}`,
                  { method: 'POST' }
                );
                const data = await response.json();
                if (data.success) {
                  setActiveTag(null);
                  setScreen('role-select');
                } else {
                  Alert.alert('Hata', data.detail);
                }
              } catch (error) {
                Alert.alert('Hata', 'İşlem başarısız');
              }
            }}
            onRequestApproval={async () => {
              try {
                const response = await fetch(
                  `${API_URL}/trip/request-end?tag_id=${activeTag?.id}&user_id=${user?.id}&user_type=driver`,
                  { method: 'POST' }
                );
                const data = await response.json();
                if (data.success) {
                  Alert.alert('✅ İstek Gönderildi', 'Yolcunun onayı bekleniyor...');
                } else {
                  Alert.alert('Hata', data.detail || 'İstek gönderilemedi');
                }
              } catch (error) {
                Alert.alert('Hata', 'İstek gönderilemedi');
              }
            }}
            onForceEnd={async () => {
              try {
                const response = await fetch(
                  `${API_URL}/trip/force-end?tag_id=${activeTag?.id}&user_id=${user?.id}`,
                  { method: 'POST' }
                );
                const data = await response.json();
                if (data.success) {
                  onShowTripEndedBanner?.(
                    'Teklifi sonlandırdınız tekrar teklif göndermek için lütfen birazcık bekleyin...',
                  );
                  setActiveTag(null);
                  setScreen('role-select');
                } else {
                  Alert.alert('Hata', data.detail);
                }
              } catch (error) {
                Alert.alert('Hata', 'İşlem başarısız');
              }
            }}
          />
        </View>
      ) : null}

      {/* Modern Teklif Modal */}
      <Modal
        visible={offerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modernModalOverlay}>
          <View style={styles.modernModalContent}>
            {/* Modal Header */}
            <View style={styles.modernModalHeader}>
              <LinearGradient
                colors={['#3FA9F5', '#2563EB']}
                style={styles.modalIconCircle}
              >
                <Ionicons name="cash" size={32} color="#FFF" />
              </LinearGradient>
              <Text style={styles.modernModalTitle}>Teklif Gönder</Text>
              <Text style={styles.modernModalSubtitle}>Fiyat teklifinizi belirleyin</Text>
            </View>
            
            {/* Price Input */}
            <View style={styles.modernPriceInputContainer}>
              <Text style={styles.currencySymbol}>₺</Text>
              <TextInput
                style={styles.modernPriceInput}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={offerPrice}
                onChangeText={setOfferPrice}
                autoFocus={true}
              />
            </View>
            
            {/* Quick Price Buttons */}
            <View style={styles.quickPriceContainer}>
              {[50, 100, 150, 200].map((price) => (
                <TouchableOpacity
                  key={price}
                  style={[
                    styles.quickPriceButton,
                    offerPrice === String(price) && styles.quickPriceButtonActive
                  ]}
                  onPress={() => setOfferPrice(String(price))}
                >
                  <Text style={[
                    styles.quickPriceText,
                    offerPrice === String(price) && styles.quickPriceTextActive
                  ]}>₺{price}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Action Buttons */}
            <View style={styles.modernModalButtons}>
              <TouchableOpacity
                style={styles.modernCancelButton}
                onPress={() => setOfferModalVisible(false)}
              >
                <Text style={styles.modernCancelButtonText}>Vazgeç</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modernSubmitButton, offerSent && styles.modernSubmitButtonSuccess]}
                onPress={submitOffer}
                disabled={offerSent || offerSending}
              >
                <LinearGradient
                  colors={offerSent ? ['#22C55E', '#16A34A'] : ['#3FA9F5', '#2563EB']}
                  style={styles.submitButtonGradient}
                >
                  {offerSending && !offerSent ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name={offerSent ? "checkmark-circle" : "send"} size={20} color="#FFF" />
                  )}
                  <Text style={styles.modernSubmitButtonText}>
                    {offerSent ? 'Gönderildi!' : offerSending ? 'Gönderiliyor...' : 'Gönder'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ CallScreenV2 - Socket.IO Arama Ekranı - ŞOFÖR */}
      {showCallScreen && callScreenData && (
        <CallScreenV2
          visible={showCallScreen}
          mode={callScreenData.mode}
          callId={callScreenData.callId}
          channelName={callScreenData.channelName}
          agoraToken={callScreenData.agoraToken}
          userId={user.id}
          remoteUserId={callScreenData.remoteUserId}
          remoteName={callScreenData.remoteName}
          callType={callScreenData.callType}
          callAccepted={callAccepted}
          callRejected={callRejected}
          callEnded={callEnded}
          receiverOffline={receiverOffline}
          onAccept={() => {
            if (callScreenData) {
              socketAcceptCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.remoteUserId,
                receiver_id: user.id
              });
              driverClearIncomingCall();
            }
          }}
          onReject={() => {
            if (callScreenData) {
              void fetch(
                `${API_URL}/voice/reject-call?user_id=${encodeURIComponent(user.id)}&call_id=${encodeURIComponent(callScreenData.callId)}`,
                { method: 'POST' }
              );
              socketRejectCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.remoteUserId,
                receiver_id: user.id
              });
            }
            driverClearIncomingCall();
          }}
          onEnd={() => {
            if (callScreenData) {
              void fetch(
                `${API_URL}/voice/end-call?user_id=${encodeURIComponent(user.id)}&call_id=${encodeURIComponent(callScreenData.callId)}`,
                { method: 'POST' }
              );
              socketEndCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.mode === 'caller' ? user.id : callScreenData.remoteUserId,
                receiver_id: callScreenData.mode === 'caller' ? callScreenData.remoteUserId : user.id,
                ended_by: user.id
              });
            }
            driverClearIncomingCall();
          }}
          onClose={() => {
            console.log('📞 ŞOFÖR - Arama ekranı kapandı');
            setShowCallScreen(false);
            setCallScreenData(null);
            isCallActiveRef.current = false;
            setCallAccepted(false);
            setCallRejected(false);
            setCallEnded(false);
            setReceiverOffline(false);
            driverClearIncomingCall();
          }}
        />
      )}

      {/* Karşılıklı İptal Onay Modalı - ŞOFÖR */}
      <Modal
        visible={showTripEndModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTripEndModal(false)}
      >
        <View style={styles.tripEndModalOverlay}>
          <View style={styles.tripEndModalContainer}>
            <View style={styles.tripEndModalHeader}>
              <Ionicons name="alert-circle" size={50} color="#3FA9F5" />
              <Text style={styles.tripEndModalTitle}>Yolculuk Sonlandırma</Text>
            </View>
            
            <Text style={styles.tripEndModalMessage}>
              {tripEndRequesterType === 'passenger' 
                ? 'Yolcu yolculuğu bitirmek istiyor. Onaylıyor musunuz?'
                : 'Şoför yolculuğu bitirmek istiyor. Onaylıyor musunuz?'
              }
            </Text>
            
            <View style={styles.tripEndModalButtons}>
              <TouchableOpacity
                style={styles.tripEndApproveButton}
                onPress={async () => {
                  try {
                    const response = await fetch(
                      `${API_URL}/trip/respond-end-request?tag_id=${activeTag?.id}&user_id=${user.id}&approved=true`,
                      { method: 'POST' }
                    );
                    const data = await response.json();
                    if (data.success && data.approved) {
                      Alert.alert('✅ Yolculuk Tamamlandı', 'Yolculuk karşılıklı onay ile sonlandırıldı.');
                      setActiveTag(null);
                      setScreen('role-select');
                    }
                  } catch (error) {
                    Alert.alert('Hata', 'İşlem başarısız');
                  }
                  setShowTripEndModal(false);
                }}
              >
                <Text style={styles.tripEndApproveButtonText}>Onaylıyorum</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.tripEndRejectButton}
                onPress={async () => {
                  try {
                    await fetch(
                      `${API_URL}/trip/respond-end-request?tag_id=${activeTag?.id}&user_id=${user.id}&approved=false`,
                      { method: 'POST' }
                    );
                  } catch (error) {}
                  setShowTripEndModal(false);
                }}
              >
                <Text style={styles.tripEndRejectButtonText}>Onaylamıyorum</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* 🆕 QR İLE YOLCULUK BİTİRME MODALI (SÜRÜCÜ) */}
      <QRTripEndModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        userId={user.id}
        tagId={activeTag?.id || ''}
        isDriver={true}
        otherUserName={displayFirstName(activeTag?.passenger_name, 'Yolcu')}
        myLatitude={userLocation?.latitude}
        myLongitude={userLocation?.longitude}
        otherLatitude={activeTag?.passenger_latitude}
        otherLongitude={activeTag?.passenger_longitude}
        onComplete={(showRating, rateUserId, rateUserName) => {
          // Yolculuk tamamlandı
          setShowQRModal(false);
          if (showRating) {
            // Puanlama modalını aç
            setRatingModalData({
              visible: true,
              tagId: activeTag?.id || '',
              rateUserId: activeTag?.passenger_id || '',
              rateUserName: rateUserName || displayFirstName(activeTag?.passenger_name, 'Yolcu')
            });
          }
          // Sayfayı yenile
          setActiveTag(null);
        }}
      />
      
      {/* Rating Modal - QR tarama sonrası (SÜRÜCÜ) */}
      {ratingModalData && (
        <RatingModal
          visible={ratingModalData.visible}
          onClose={() => setRatingModalData(null)}
          onRatingComplete={() => {
            // 🆕 Puanlama tamamlandı - tüm state'leri temizle
            setRatingModalData(null);
            setActiveTag(null);
          }}
          userId={user.id}
          tagId={ratingModalData.tagId}
          rateUserId={ratingModalData.rateUserId}
          rateUserName={ratingModalData.rateUserName}
        />
      )}
      
      {/* 🆕 Sürücü Paketleri Modal */}
      <DriverPackagesModal
        visible={showDriverPackagesModal}
        onClose={() => setShowDriverPackagesModal(false)}
        userId={user.id}
        onPackagePurchased={() => {
          // Paket satın alındı - dashboard'u güncelle
          setShowDriverPackagesModal(false);
        }}
      />
    </SafeAreaView>
    </ImageBackground>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  // 🆕 Sürücü Üst Bölüm
  driverTopSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  activityMapContainer: {
    marginTop: 12,
  },
  // 📋 KYC PENDING SCREEN STYLES
  kycPendingContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  kycPendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  kycPendingHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1B1E',
  },
  kycPendingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  kycPendingIconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  kycPendingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1B1B1E',
    marginBottom: 16,
    textAlign: 'center',
  },
  kycPendingDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  kycPendingTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 16,
    marginBottom: 20,
  },
  kycPendingTimerLabel: {
    fontSize: 13,
    color: '#666',
  },
  kycPendingTimerValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3FA9F5',
  },
  kycPendingInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  kycPendingInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  kycPendingRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 10,
  },
  kycPendingRefreshText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // 🆕 Yolcu Arka Plan Stilleri
  passengerBackgroundContainer: {
    flex: 1,
  },
  passengerBackgroundImage: {
    resizeMode: 'stretch',
    width: '100%',
    height: '100%',
  },
  // 🆕 Sürücü Arka Plan Stilleri
  driverBackgroundContainer: {
    flex: 1,
  },
  driverBackgroundImage: {
    resizeMode: 'stretch',
    width: '100%',
    height: '100%',
  },
  containerTransparent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  // Login Ekran Container - Arka plan resmi için
  loginScreenContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Login için şeffaf scroll content
  loginScrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  // Yeni Yolcu Sayfa Stilleri
  welcomeQuestionVeryTop: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 80,
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  welcomeNameBetweenStorks: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1B1B1E',
    textAlign: 'center',
    marginBottom: 30,
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  destinationBoxBig: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 30,
    padding: 18,
    marginVertical: 20,
    marginHorizontal: 10,
    borderWidth: 3,
    borderColor: '#3FA9F5',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    gap: 15,
  },
  destinationIconBig: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  destinationTextBig: {
    flex: 1,
    fontSize: 18,
    color: '#1B1B1E',
    fontWeight: '700',
  },
  destinationArrowBig: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  welcomeQuestionTop: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 5,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  welcomeNameSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 25,
  },
  destinationBoxEffective: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    padding: 15,
    marginVertical: 15,
    borderWidth: 2,
    borderColor: '#3FA9F5',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  destinationIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationTextEffective: {
    flex: 1,
    fontSize: 17,
    color: '#1B1B1E',
    fontWeight: '600',
  },
  destinationArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 🆕 MARTI TAG - Fiyat Modal Stilleri
  priceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  priceModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  priceModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  priceModalVehicleSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  priceModalVehicleChipsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  priceModalVehicleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priceModalVehicleChipCarActive: {
    backgroundColor: '#3FA9F5',
    borderColor: '#0EA5E9',
  },
  priceModalVehicleChipMotorActive: {
    backgroundColor: '#16A34A',
    borderColor: '#15803D',
  },
  priceModalVehicleChipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  priceModalVehicleChipTextActive: {
    color: '#FFF',
  },
  priceModalVehicleHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 17,
  },
  priceModalPaySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    marginTop: 4,
  },
  priceModalPayHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 17,
  },
  priceModalPayChipsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  priceModalPayChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priceModalPayChipCashActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  priceModalPayChipCardActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  priceModalPayChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  priceModalSendWrapDisabled: {
    opacity: 0.72,
  },
  priceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  priceInfoLabel: {
    fontSize: 16,
    color: '#666',
  },
  priceInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1E',
  },
  peakHourBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'center',
    marginVertical: 10,
  },
  peakHourText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  priceRangeContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  priceRangeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  priceRangeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B1B1E',
  },
  selectedPriceContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  selectedPriceLabel: {
    fontSize: 14,
    color: '#666',
  },
  selectedPriceValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#87CEEB',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  sliderButton: {
    width: 50,
    height: 50,
    backgroundColor: '#87CEEB',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#87CEEB',
    borderRadius: 4,
  },
  priceModalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
    alignItems: 'center',
  },
  priceModalCancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  priceModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  priceModalSendWrap: {
    flex: 2,
  },
  priceModalSendGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  priceModalSendTextLarge: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  // 🆕 Eşleşme Sağlanıyor Stili
  matchingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  matchingBox: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  matchingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B1B1E',
    marginTop: 20,
  },
  matchingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    zIndex: 1,
  },
  roundLogoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundLogo: {
    width: 140,
    height: 140,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B1B1E',
    marginTop: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#495057',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  // KVKK Checkbox stilleri
  kvkkContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3FA9F5',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#3FA9F5',
    borderColor: '#3FA9F5',
  },
  kvkkText: {
    flex: 1,
    fontSize: 13,
    color: '#495057',
    lineHeight: 20,
    fontWeight: '500',
  },
  kvkkLink: {
    color: '#3FA9F5',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3FA9F5',
    gap: 8,
  },
  registerButtonText: {
    fontSize: 16,
    color: '#3FA9F5',
    fontWeight: '700',
    letterSpacing: 1,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 8,
  },
  supportButtonText: {
    fontSize: 15,
    color: '#3FA9F5',
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#A0C4E8',
    shadowOpacity: 0.15,
  },
  // Doğrulama ekranı stilleri
  verifyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 8,
    letterSpacing: 1,
  },
  // Modern secondary button
  modernSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  modernSecondaryButtonText: {
    color: '#3FA9F5',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Toast Notification
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  // Kayıt Ol ekranı
  registerIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(63, 169, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3FA9F5',
    marginBottom: 8,
    letterSpacing: 1,
  },
  modernInputText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1E',
    paddingVertical: 14,
  },
  modernPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#A0A0A0',
    paddingVertical: 14,
  },
  // Telefon Prefix ve Hint
  phonePrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1B1E',
    marginRight: 8,
    paddingVertical: 14,
  },
  phoneHint: {
    fontSize: 12,
    color: '#666',
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
  },
  // PIN ekranı
  pinIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(63, 169, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pinTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3FA9F5',
    marginBottom: 8,
    letterSpacing: 1,
  },
  pinWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pinWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    marginLeft: 10,
    fontWeight: '600',
    lineHeight: 18,
  },
  // Modern Header Stilleri
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(13, 27, 42, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(63, 169, 245, 0.3)',
  },
  backButtonHeader: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modernHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modernHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  logoutButtonHeader: {
    padding: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#3FA9F5',
    marginTop: 10
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center'
  },
  formContainer: {
    width: '100%'
  },
  // Modern Form Stilleri
  modernFormContainer: {
    width: '100%',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  modernLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B1B1E',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#3FA9F5',
    marginBottom: 24,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  modernInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1B1B1E',
    paddingVertical: 14,
    letterSpacing: 1,
  },
  modernPhoneInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1B1B1E',
    paddingVertical: 14,
    letterSpacing: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modernPrimaryButton: {
    backgroundColor: '#3FA9F5',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  modernPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    marginRight: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16
  },
  primaryButton: {
    backgroundColor: '#3FA9F5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3FA9F5'
  },
  secondaryButtonText: {
    color: '#3FA9F5',
    fontSize: 16,
    fontWeight: 'bold'
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0'
  },
  roleButtonActive: {
    backgroundColor: '#3FA9F5',
    borderColor: '#3FA9F5'
  },
  roleButtonText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#3FA9F5'
  },
  roleButtonTextActive: {
    color: '#FFF'
  },
  roleDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center'
  },
  header: {
    backgroundColor: '#3FA9F5',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4
  },
  content: {
    flex: 1,
    padding: 16
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16
  },
  tagStatusBadge: {
    backgroundColor: '#E8F8F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center'
  },
  tagStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3FA9F5'
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    flex: 1
  },
  // Removed duplicate driverInfo - keeping the later version
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  driverPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3FA9F5',
    marginTop: 4
  },
  offerCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  offerDriverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  offerRating: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  offerPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3FA9F5'
  },
  offerTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  offerNotes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  // Modern "Teklifler Bekleniyor" Styles
  waitingOffersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  waitingIconContainer: {
    marginBottom: 24,
  },
  waitingIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B1B1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  waitingRouteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  waitingRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingRouteDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FA9F5',
    marginRight: 12,
  },
  waitingRouteTextContainer: {
    flex: 1,
  },
  waitingRouteLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  waitingRouteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B1B1E',
  },
  waitingRouteLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 4,
  },
  waitingActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  waitingEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  waitingEditButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3FA9F5',
  },
  waitingCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  waitingCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  // Removed duplicate acceptButton and acceptButtonText - keeping the full-screen versions
  callButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  // Removed duplicate callButtonText - keeping the animated version
  // Removed duplicate callNote - keeping the later version
  requestCard: {
    backgroundColor: '#0D1B2A',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  requestCardGradient: {
    padding: 20,
    borderRadius: 16,
  },
  requestCardSky: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#87CEEB', // Gök mavisi
  },
  premiumPassengerPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  passengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  passengerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Removed duplicate passengerName - keeping the later version
  premiumBadgeSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  passengerRating: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  // ==================== MODERN ŞOFÖR TEKLİF EKRANI STİLLERİ ====================
  modernPassengerAvatar: {
    marginRight: 12,
  },
  avatarGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBadgeModern: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  modernDistanceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modernDistanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distanceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceTextContainer: {
    flex: 1,
  },
  distanceLabelModern: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  distanceValueModern: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
  },
  modernDistanceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  modernLocationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modernLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  locationDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginTop: 4,
  },
  locationTextWrapper: {
    flex: 1,
  },
  locationLabelSmall: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  locationTextModern: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  locationConnectorLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 4,
  },
  modernOfferedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  modernOfferedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  // Animated Offer Button
  animatedOfferButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  offerButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  offerButtonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
  },
  animatedOfferButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Modern Modal Styles
  modernModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modernModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modernModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modernModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  modernPriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3FA9F5',
    marginRight: 8,
  },
  modernPriceInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    paddingVertical: 8,
  },
  quickPriceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  quickPriceButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  quickPriceButtonActive: {
    backgroundColor: '#EBF5FF',
    borderColor: '#3FA9F5',
  },
  quickPriceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  quickPriceTextActive: {
    color: '#3FA9F5',
  },
  modernModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modernCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modernCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modernSubmitButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modernSubmitButtonSuccess: {
    backgroundColor: '#10B981',
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modernSubmitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // ==================== ESKİ STİLLER (YEDEK) ====================
  distanceContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  distanceBox: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  distanceDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  distanceLabel: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
    opacity: 0.9,
  },
  distanceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#60A5FA', // Gök mavisi - BELİRGİN!
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#60A5FA', // Gök mavisi - BELİRGİN!
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  requestPassenger: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  requestLocation: {
    fontSize: 14,
    color: '#FFF',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  sendOfferButton: {
    backgroundColor: '#FFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#4682B4',
  },
  sendOfferButtonText: {
    color: '#4682B4',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  offeredBadge: {
    backgroundColor: '#E8F8F5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12
  },
  offeredText: {
    color: '#3FA9F5',
    fontSize: 14,
    fontWeight: '600'
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  priceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3FA9F5',
    marginTop: 12,
    marginBottom: 12
  },
  completeButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 20
  },
  // Yeni stiller - Çağrı Butonu & Mavi Balonlar
  callButtonLarge: {
    backgroundColor: COLORS.secondary,
    borderRadius: 80,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  callButtonLargeText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
    letterSpacing: 1,
  },
  callNote: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 8,
  },
  offersContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  offersTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  balloonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  offerBalloon: {
    width: '45%',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
  },
  balloonContent: {
    alignItems: 'center',
  },
  balloonDriverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  balloonRating: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  balloonPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  balloonTime: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  balloonNotes: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 8,
  },
  balloonTail: {
    position: 'absolute',
    bottom: -10,
    left: '40%',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderLeftColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'transparent',
    borderTopWidth: 10,
    borderTopColor: COLORS.primary,
  },
  balloonHint: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Animated Pulse Button Styles
  callButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 60,
  },
  gradientButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  callButtonText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
    letterSpacing: 2,
    textAlign: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: COLORS.primary,
    opacity: 0.3,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  // TAM EKRAN STİLLER
  contentFullScreen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  emptyStateContainerFull: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  fullScreenTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fullScreenBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(63, 169, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenLogoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeNameBig: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeQuestion: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3FA9F5',
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: 20,
  },
  callHintText: {
    fontSize: 16,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 30,
  },
  // Modal & Şehir Seçici Stilleri
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cityItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  modalCloseButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputText: {
    fontSize: 16,
    color: COLORS.text,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  // Hedef Seçme Stilleri
  destinationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  destinationText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  destinationPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: COLORS.gray500,
  },
  destinationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  destinationConfirm: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  popularTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  popularList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  popularItemText: {
    fontSize: 15,
    color: COLORS.text,
  },
  // TikTok Swipeable Card Stilleri
  swipeContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  swipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  swipeSubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: 20,
  },
  swipeCardsWrapper: {
    height: 500,
    position: 'relative',
  },
  swipeCard: {
    position: 'absolute',
    width: '100%',
    height: 450,
    top: 0,
    left: 0,
  },
  swipeCardInner: {
    width: '100%',
    height: '100%',
  },
  swipeCardGradient: {
    flex: 1,
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  swipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  driverInfo: {
    flex: 1,
  },
  swipeDriverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  swipeDriverRating: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  swipePriceContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  swipePriceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  swipePrice: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#FFF',
  },
  swipeNotesContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
  },
  swipeNotes: {
    fontSize: 15,
    color: '#FFF',
    lineHeight: 22,
  },
  swipeHint: {
    alignItems: 'center',
    gap: 8,
  },
  swipeHintText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  // Harita Stilleri
  mapContainer: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  // Yolcu TAG İşlemleri (Düzenleme ve İptal)
  tagActionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  editDestinationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  editDestinationButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelTagButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF5A5F',
    gap: 6,
  },
  cancelTagButtonText: {
    color: '#FF5A5F',
    fontSize: 14,
    fontWeight: '600',
  },
  // Sürücü Teklif Modal Stilleri
  priceInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: COLORS.gray400,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSubmitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: 20,
  },
  // TAM EKRAN OFFER KART STİLLERİ
  fullScreenContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  fullScreenOffersContainer: {
    position: 'relative',
    height: SCREEN_HEIGHT - 100,
    marginTop: 20,
  },
  fullScreenCard: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullScreenGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    backgroundColor: '#3b82f6', // Düz mavi (Android için)
  },
  vehicleSection: {
    alignItems: 'center',
    marginVertical: 10,
  },
  premiumBadgeContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    color: '#000',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    fontWeight: 'bold',
    fontSize: 12,
  },
  vehicleImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  vehicleEmoji: {
    fontSize: 100,
    marginBottom: 12,
  },
  vehicleModel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  vehicleColor: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  driverSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  driverAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  driverAvatarLargeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
  },
  driverNameLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  driverRatingLarge: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
  },
  messageSection: {
    marginBottom: 20,
    marginHorizontal: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  // Trafik Lambası Bordür (Basitleştirildi - Android fix)
  trafficLightBorder: {
    borderWidth: 3,
    borderColor: '#10B981',
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    elevation: 8,
  },
  // Zaman Bilgisi Container
  timeInfoContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  timeEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  timeTextContainer: {
    alignItems: 'center',
  },
  timeTextLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 10,
    letterSpacing: 1,
  },
  timeTextSubLarge: {
    fontSize: 24,
    fontWeight: '600',
    color: '#E0F2FE',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
    marginTop: 4,
  },
  timeDivider: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 12,
    marginHorizontal: 20,
  },
  offerContentFlex: {
    flex: 1,
    justifyContent: 'space-evenly', // Tüm elemanlar eşit dağılım
    paddingTop: 80,
    paddingBottom: 100, // HEMEN GEL butonu için alan
  },
  priceSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  priceBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  priceLabelLarge: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  priceLarge: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
  },
  fixedBottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: 'transparent', // Zemin ile aynı, belli olmasın
  },
  acceptButtonContainer: {
    width: '100%',
  },
  acceptButton: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 16,
  },
  acceptButtonText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 20,
    gap: 16,
  },
  navButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  navButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  offerIndicator: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  offerIndicatorText: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 'bold',
  },
  // New styles for updated FullScreenOfferCard
  offerNumberCircle: {
    position: 'absolute',
    top: 60,
    left: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    zIndex: 1000,
  },
  offerNumberText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  driverProfileRight: {
    position: 'absolute',
    top: 60,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  driverAvatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  driverAvatarSmallText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  driverNameSmall: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  driverRatingSmall: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 60,
    gap: 2,
  },
  starIcon: {
    fontSize: 10,
  },
  vehicleBrand: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  // CANLI HARİTA STİLLERİ
  liveMapContainer: {
    flex: 1,
    width: '100%',
    height: SCREEN_HEIGHT * 0.8,
    position: 'relative',
  },
  liveMap: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  mapPlaceholderIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  mapPlaceholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  mapPlaceholderText: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 10,
  },
  mapPlaceholderNote: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 20,
    fontStyle: 'italic',
  },
  // TAM EKRAN HARİTA STİLLERİ
  fullScreenMapContainer: {
    flex: 1,
    width: '100%',
    height: SCREEN_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
  },
  mapView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapPlaceholderFull: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  mapIconText: {
    fontSize: 32,
    marginVertical: 10,
  },
  mapTopInfo: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  meetingTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  meetingTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  mapStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mapStatBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  mapStatBoxMain: {
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mapStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  mapStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 2,
  },
  mapStatTimeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  mapStatSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  // Matched Bottom Buttons (Sol: Tamamla, Sağ: Ara)
  matchedBottomButtons: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  completeButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  callButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonLabelRed: {
    marginTop: 6,
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonLabelGreen: {
    marginTop: 6,
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonLabelBlue: {
    marginTop: 6,
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  nameOverlay: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nameOverlayText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(13, 27, 42, 0.7)',
    marginHorizontal: 20,
    marginVertical: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(63, 169, 245, 0.3)',
  },
  emptyStateText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  floatingCallButton: {
    position: 'absolute',
    bottom: 50,
    right: 30,
    width: 90,
    height: 90,
    borderRadius: 45,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 10,
  },
  floatingCallGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  floatingActionContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 100,
    zIndex: 10,
  },
  startTripButtonFloat: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  completeTripButtonFloat: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // GÖK MAVİSİ TEMA
  welcomeTitleSky: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#87CEEB',
    marginBottom: 12,
    textAlign: 'center',
  },
  destinationBoxSky: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 248, 255, 0.92)',
    borderRadius: 20,
    padding: 20,
    marginVertical: 20,
    borderWidth: 3,
    borderColor: '#87CEEB',
    shadowColor: '#87CEEB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 15,
  },
  destinationTextSky: {
    flex: 1,
    fontSize: 18,
    color: '#4682B4',
    fontWeight: '600',
    textAlign: 'center',
  },
  arrowHintSky: {
    backgroundColor: '#87CEEB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: 'center',
  },
  arrowTextSky: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  webMapPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webMapText: {
    fontSize: 32,
    marginBottom: 8,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: {
    fontSize: 40,
  },
  mapInfoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  driverInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatarMap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverAvatarMapText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  driverDetailsMap: {
    flex: 1,
  },
  driverNameMap: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverStatusMap: {
    fontSize: 14,
    color: '#6B7280',
  },
  callButtonMap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tripInfoMap: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  tripInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripInfoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  tripActions: {
    gap: 12,
  },
  startTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  startTripButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  completeTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  completeTripButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Duplicate styles removed - keeping the first definitions
  // ==================== PREMIUM ROLE SELECTION STYLES ====================
  roleSelectionContainer: {
    flex: 1,
  },
  roleBackgroundImage: {
    resizeMode: 'stretch',
    width: '100%',
    height: '100%',
  },
  roleSelectionSafe: {
    flex: 1,
  },
  // Yeni kompakt stiller
  roleTopBarCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 0,
  },
  roleExitBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleTopTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  roleTopSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  roleAdminBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleMainContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
    minHeight: 0,
  },
  roleBottomFooterColumn: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 26 : 20,
  },
  roleCardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  roleCardCompact: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  roleCardSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: 'rgba(224, 242, 254, 0.98)',
    shadowOpacity: 0.28,
  },
  roleIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  roleIconCircleActive: {
    backgroundColor: '#0284C7',
  },
  roleVehicleSection: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  roleVehiclePrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
  },
  roleVehicleRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  roleVehicleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  roleVehicleChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  roleVehicleChipActiveMotor: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
  },
  roleVehicleChipText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  roleVehicleChipTextActive: {
    color: '#FFF',
  },
  roleCardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  roleCardLabelActive: {
    color: '#3FA9F5',
  },
  roleCardDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  roleCheckBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Rol ekranı — ~%30 daha büyük, yatayda biraz daha geniş (footer padding) */
  roleContinueBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0EA5E9',
    borderRadius: 18,
    paddingVertical: 21,
    paddingHorizontal: 20,
    minHeight: 58,
    gap: 12,
    marginBottom: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  roleContinueTextLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  roleSeparatorCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  roleContinueBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    borderColor: 'transparent',
  },
  roleSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  roleSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  roleSeparatorText: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#9CA3AF',
  },
  communityBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 95, 0.94)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#5BC0F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  communityLogoBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  communityTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  communityBtnTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  communityBtnTitleProminent: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  communityBtnSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  communityBtnSubProminent: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  communityArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Eski stiller (uyumluluk için)
  roleTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 5,
  },
  roleBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 20,
    gap: 6,
  },
  roleBackText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  roleAdminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(63, 169, 245, 0.1)',
    borderRadius: 20,
    gap: 6,
  },
  roleAdminText: {
    fontSize: 14,
    color: '#3FA9F5',
    fontWeight: '600',
  },
  roleHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  roleHeaderIcon: {
    marginBottom: 16,
  },
  roleHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  roleHeaderSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  roleCardsContainer: {
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  roleScrollView: {
    flex: 1,
  },
  roleScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  roleCardPremium: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ scale: 1 }],
  },
  roleCardPremiumSelected: {
    borderColor: '#3FA9F5',
    backgroundColor: '#F8FFF9',
    shadowColor: '#3FA9F5',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  roleCardContent: {
    alignItems: 'center',
    position: 'relative',
  },
  roleCardIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  roleCardIconOverlay: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
  },
  roleCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  roleCardTitleSelected: {
    color: '#3FA9F5',
  },
  roleCardDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 20,
  },
  roleCardCheckmark: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 2,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  // Community Button Styles - Büyük ve Efektli
  communityButtonLarge: {
    marginTop: 8,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3FA9F5',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  communityButtonInnerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 100%)',
  },
  communityLeylekLogo: {
    width: 55,
    height: 55,
    marginRight: 14,
  },
  communityTextContainerLarge: {
    flex: 1,
  },
  communityTitleLarge: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E5F8A',
    letterSpacing: 0.5,
  },
  communitySubtitleLarge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3FA9F5',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  communityArrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3FA9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Ayırıcı
  roleDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 40,
  },
  roleDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  roleDividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  roleContinueButton: {
    marginTop: 40,
    marginBottom: 30,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  roleContinueButtonDisabled: {
    shadowColor: '#BDC3C7',
    shadowOpacity: 0.2,
    elevation: 4,
  },
  roleContinueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  roleContinueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  // Admin Button styles
  adminButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  adminButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  adminButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // ==================== KARŞILIKLI İPTAL MODAL STİLLERİ ====================
  tripEndModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tripEndModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  tripEndModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  tripEndModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B1B1E',
    marginTop: 12,
    textAlign: 'center',
  },
  tripEndModalMessage: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  tripEndModalButtons: {
    flexDirection: 'column',
    width: '100%',
    gap: 12,
  },
  tripEndApproveButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tripEndApproveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tripEndRejectButton: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tripEndRejectButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // ==================== TIKTOK TARZI STILLER ====================
  tikTokContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  tikTokContainerFullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 100,
  },
  absoluteFullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A1628',
    zIndex: 9999,
  },
  tikTokCard: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  tikTokGradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  tikTokHeader: {
    alignItems: 'center',
  },
  tikTokPageIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  tikTokPageText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tikTokProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  tikTokAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tikTokAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tikTokProfileInfo: {
    flex: 1,
  },
  tikTokName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  tikTokRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tikTokRatingText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  tikTokPremiumBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  tikTokPremiumText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  tikTokPriceSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  tikTokPriceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  tikTokPrice: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#10B981',
    textShadowColor: 'rgba(16, 185, 129, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  tikTokVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
  },
  tikTokVehicleText: {
    fontSize: 16,
    color: '#60A5FA',
    fontWeight: '600',
  },
  tikTokStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
  },
  tikTokStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tikTokStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 4,
  },
  tikTokStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  tikTokStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  tikTokLocationCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tikTokLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tikTokLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  tikTokLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
  },
  tikTokLocationLine: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginLeft: 5,
    marginVertical: 4,
  },
  tikTokNotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  tikTokNotesText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    flex: 1,
  },
  tikTokActions: {
    marginBottom: 16,
  },
  tikTokAcceptButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  tikTokAcceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  tikTokAcceptText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  tikTokSwipeHint: {
    alignItems: 'center',
    opacity: 0.6,
  },
  tikTokSwipeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  // YENİ: TikTok Time Cards Styles
  tikTokTimeCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  tikTokTimeCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tikTokTimeGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  tikTokTimeValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  tikTokTimeLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  // YENİ UI STİLLERİ
  tikTokBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tikTokProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  tikTokAvatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tikTokAvatarTextLarge: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tikTokNameLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  tikTokRatingTextLarge: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  tikTokPriceSectionNew: {
    alignItems: 'center',
    marginVertical: 16,
  },
  tikTokPriceLabelNew: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
  },
  tikTokPriceNew: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#3FA9F5',
  },
  tikTokTimeCardsNew: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    gap: 12,
  },
  tikTokTimeCardNew: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tikTokTimeGradientNew: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  tikTokTimeValueNew: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 6,
  },
  tikTokTimeLabelNew: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  tikTokVehicleNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
    alignSelf: 'center',
  },
  tikTokVehicleTextNew: {
    fontSize: 14,
    color: '#60A5FA',
    fontWeight: '600',
  },
  tikTokNotesNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  tikTokNotesTextNew: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    flex: 1,
  },
  tikTokActionsNew: {
    marginVertical: 12,
  },
  tikTokAcceptButtonNew: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  tikTokAcceptGradientNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  tikTokAcceptTextNew: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  tikTokSwipeHintNew: {
    alignItems: 'center',
    opacity: 0.5,
  },
  tikTokSwipeTextNew: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  tikTokFooter: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  tikTokFooterEncrypted: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  tikTokFooterCompany: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tikTokFooterCompanyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  // TAM EKRAN TEMİZ STİLLER
  tikTokHeaderClean: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  tikTokBackBtnClean: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tikTokPageIndicatorClean: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tikTokPageTextClean: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  tikTokProfileCardClean: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  tikTokAvatarClean: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tikTokAvatarTextClean: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tikTokProfileInfoClean: {
    flex: 1,
  },
  tikTokNameClean: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 3,
  },
  tikTokRatingClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tikTokRatingTextClean: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  // Teklifi Geç / Başka Yolcu Seç Butonları
  skipOfferBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  skipOfferText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  skipPassengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skipPassengerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(63, 169, 245, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  skipPassengerText: {
    fontSize: 13,
    color: '#3FA9F5',
    fontWeight: '600',
  },
  passengerCountText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  // Araç Kartı Stili (Üstte)
  vehicleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  vehicleIconBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(63, 169, 245, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfoBox: {
    flex: 1,
  },
  vehicleModelText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  vehicleColorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  // ŞOFÖR TAM EKRAN STİLLER
  driverFullScreen: {
    flex: 1,
    paddingTop: 8,
  },
  driverBigDistanceCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  driverBigCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  driverBigCardGradient: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  driverBigCardTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    fontWeight: '500',
  },
  driverBigCardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 4,
  },
  driverBigCardSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  driverAddressCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
  },
  driverAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  driverAddressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  driverAddressInfo: {
    flex: 1,
  },
  driverAddressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  driverAddressText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  driverAddressTextBig: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: 'bold',
  },
  driverAddressLine: {
    paddingLeft: 5,
    marginVertical: 8,
  },
  driverAddressLineDashed: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // ESKİ ŞOFÖR STİLLERİ
  driverInfoCard: {
    flex: 1,
  },
  driverDistanceBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  driverDistanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  driverDistanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  driverDistanceLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  driverDistanceDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 14,
  },
  driverRouteCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  driverRouteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  driverRouteDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
  },
  driverRouteInfo: {
    flex: 1,
  },
  driverRouteLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  driverRouteText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  driverRouteLabelBig: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    fontWeight: '600',
  },
  driverRouteTextBig: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  driverRouteLine: {
    width: 2,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: 6,
    marginVertical: 6,
  },
  driverTripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63, 169, 245, 0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    gap: 8,
  },
  driverTripText: {
    fontSize: 15,
    color: '#3FA9F5',
    fontWeight: '600',
  },
  // TAM EKRAN TİKTOK STİLLERİ
  tikTokCardFull: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tikTokGradientFull: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  tikTokBottomInfo: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  tikTokSecurityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  tikTokSecurityText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  tikTokCompanyNote: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
  },
  // TAM EKRAN MODAL STİLLERİ
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  fullScreenModalContent: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  fullScreenModalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(63,169,245,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  fullScreenModalQuestion: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
    textAlign: 'center',
  },
  // ÜSTTEN AÇILAN YARIM SAYFA MODAL STİLLERİ
  topSheetOverlay: {
    flex: 1,
    flexDirection: 'column',
  },
  topSheetContainer: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '45%',
  },
  topSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: 0.5,
  },
  topSheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDestinationBig: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3FA9F5',
  },
  selectedDestinationTextBox: {
    marginLeft: 12,
    flex: 1,
  },
  selectedDestinationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3FA9F5',
    letterSpacing: 1,
    marginBottom: 2,
  },
  selectedDestinationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: 0.3,
  },
  topSheetPopularTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  topSheetPopularList: {
    flexDirection: 'column',
  },
  topSheetPopularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  topSheetPopularText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 10,
    fontWeight: '500',
  },
  topSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  topSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // ÜSTTEN AÇILAN PANEL - YENİ STİLLER
  topSheetFullOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  topSheetBackdropFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topSheetPanelFromTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    maxHeight: '50%',
  },
  topSheetPopularScroll: {
    maxHeight: 150,
  },
  
  // Hedef Seçme Modal Stilleri
  destinationModalGradient: {
    flex: 1,
  },
  destinationModalRoot: {
    flex: 1,
    backgroundColor: '#041e33',
  },
  destinationModalTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  destinationModalTopFadeLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 130,
  },
  destinationModalTouchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  destinationModalSafeOverlay: {
    flex: 1,
  },
  destinationKeyboardAvoid: {
    flex: 1,
  },
  destinationHeroTitleAnimated: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.35,
    marginTop: 0,
  },
  destinationMapCalloutWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 112,
    alignItems: 'center',
    zIndex: 6,
  },
  destinationMapCalloutBubble: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    maxWidth: 340,
  },
  destinationMapCalloutText: {
    color: 'rgba(240, 253, 244, 0.95)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
  },
  destinationSearchShellModern: {
    marginTop: 2,
  },
  destinationModalHeaderBlueDim: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  destinationModalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  destinationChangeAreaBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  destinationChangeAreaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.94)',
  },
  destinationFloatingPanel: {
    marginHorizontal: 14,
    marginTop: 2,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.32)',
    maxHeight: '58%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  destinationMapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 2,
    gap: 8,
  },
  destinationMapHintText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(224, 242, 254, 0.96)',
    lineHeight: 18,
  },
  destinationPinMarkerWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  destinationPinRing: {
    position: 'absolute',
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.92)',
    backgroundColor: 'transparent',
  },
  destinationPinRingOuter: {
    borderColor: 'rgba(74, 222, 128, 0.45)',
    borderWidth: 1.5,
  },
  destinationPinCore: {
    backgroundColor: '#16A34A',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 8,
  },
  destinationSearchShellTech: {
    marginTop: 10,
  },
  destinationModalMapTouchPassthrough: {
    flex: 1,
    minHeight: 56,
  },
  destinationGeocodeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  destinationGeocodeText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#E0F2FE',
  },
  destinationModalSafe: {
    flex: 1,
  },
  destinationRoadDecor: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-around',
    opacity: 0.07,
    paddingTop: 120,
  },
  destinationRoadLine: {
    width: 8,
    flex: 1,
    marginHorizontal: 18,
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  destinationRoadLineMid: {
    width: 6,
    flex: 0.6,
    marginHorizontal: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 3,
  },
  destinationModalHeaderBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  destinationModalBackBtn: {
    padding: 8,
  },
  destinationModalTitleBlue: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.5,
  },
  destinationModalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  destinationHeroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 40,
    marginTop: 0,
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  destinationHeroSub: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  selectedDestinationBoxBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  selectedDestinationTextBlue: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#ECFEFF',
    fontWeight: '600',
  },
  destinationSearchContainerBlue: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  destinationPoiSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 22,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  destinationPoiWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  destinationPoiChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  destinationPoiChipText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
