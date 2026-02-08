import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, FlatList, Platform, Dimensions, Animated, Image, Linking, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import Logo from '../components/Logo';
import LiveMapView from '../components/LiveMapView';
import SearchingMapView, { DriverLocation } from '../components/SearchingMapView';
import VideoCall from '../components/VideoCall';
import IncomingCall from '../components/IncomingCall';
import CallScreenV2 from '../components/CallScreenV2';
import DailyCallScreen from '../components/DailyCallScreen'; // Backend-driven termination
import IncomingCallScreen from '../components/IncomingCallScreen'; // 🆕 Gelen Arama Ekrani
import OutgoingCallScreen from '../components/OutgoingCallScreen'; // 🆕 Araniyor Ekrani
import ChatBubble from '../components/ChatBubble'; // 🆕 Bulutlu Chat
import EndTripModal from '../components/EndTripModal'; // 🆕 Modern Yolculuk Bitirme Modalı
import ForceEndConfirmModal from '../components/ForceEndConfirmModal'; // 🆕 Zorla Bitir Onay Modalı
import DriverOfferScreen from '../components/DriverOfferScreen'; // Sürücü Teklif Ekranı (Eski)
import OfferMapScreen from '../components/OfferMapScreen'; // 🆕 YENİ Modern Teklif Ekranı
import useSocket from '../hooks/useSocket';
// NOT: useAgoraEngine kaldırıldı - CallScreenV2 kendi singleton Agora'sını yönetiyor
import PlacesAutocomplete from '../components/PlacesAutocomplete';
import AdminPanel from '../components/AdminPanel';
import { LegalConsentModal, LegalPage, LocationWarningModal } from '../components/LegalPages';
import RatingModal from '../components/RatingModal';
import SplashScreen from '../components/SplashScreen';
import { KVKKConsentModal, SupportModal } from '../components/KVKKComponents';
// Push notifications - Expo Push ile (Firebase olmadan)
import { usePushNotifications } from '../hooks/usePushNotifications';
// Supabase Realtime hooks - Anlık teklif ve arama güncellemeleri
import { useOffers } from '../hooks/useOffers';
import { useCall } from '../hooks/useCall';

import Constants from 'expo-constants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Backend URL - önce extra'dan, sonra env'den, en son hardcoded
const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
                    process.env.EXPO_PUBLIC_BACKEND_URL || 
                    'https://driverhub-27.preview.emergentagent.com';
const API_URL = `${BACKEND_URL}/api`;

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard' | 'forgot-password' | 'reset-pin'>('login');

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSION GATE - All permissions requested ONCE at app start
  // ═══════════════════════════════════════════════════════════════════════════
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionChecking, setPermissionChecking] = useState(true);
  const [microphonePermission, setMicrophonePermission] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);

  // Splash Screen
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
  
  // Animation for role selection
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
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

  // Push notification geldiğinde işle
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
    if (Platform.OS !== 'android') {
      console.log('🔐 iOS - izinler otomatik isteniyor');
      setMicrophonePermission(true);
      setCameraPermission(true);
      setPermissionsGranted(true);
      setPermissionChecking(false);
      return true;
    }

    console.log('🔐 Android - Tüm izinler isteniyor...');
    
    try {
      // Core permissions
      const permissions: any[] = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ];

      console.log('🔐 İstenen izinler:', permissions);

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      console.log('🔐 İzin sonuçları:', JSON.stringify(results, null, 2));

      const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted';
      const cameraGranted = results[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted';

      setMicrophonePermission(audioGranted);
      setCameraPermission(cameraGranted);

      // En önemli izin: RECORD_AUDIO - bu olmadan arama yapılamaz
      if (!audioGranted) {
        console.log('❌ RECORD_AUDIO izni REDDEDİLDİ - Arama yapılamaz!');
        Alert.alert(
          'Mikrofon İzni Gerekli',
          'Sesli ve görüntülü arama yapabilmek için mikrofon izni vermeniz gerekiyor. Lütfen ayarlardan izin verin.',
          [
            { text: 'Tamam', onPress: () => Linking.openSettings() }
          ]
        );
        setPermissionsGranted(false);
        setPermissionChecking(false);
        return false;
      }

      console.log('✅ RECORD_AUDIO izni verildi');
      console.log(cameraGranted ? '✅ CAMERA izni verildi' : '⚠️ CAMERA izni reddedildi (opsiyonel)');

      setPermissionsGranted(true);
      setPermissionChecking(false);
      return true;
    } catch (error) {
      console.error('🔐 İzin hatası:', error);
      setPermissionChecking(false);
      return false;
    }
  };

  // Uygulama başlangıcında izinleri iste - HEMEN
  useEffect(() => {
    const checkPermissions = async () => {
      console.log('🔐 Uygulama başladı - İzin kontrolü başlıyor...');
      await requestAllPermissions();
    };
    
    // Splash screen beklemeden hemen izin iste
    checkPermissions();
  }, []);

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

  const initializeApp = async () => {
    // Önce cihaz ID'yi al
    const dId = await getOrCreateDeviceId();
    setDeviceId(dId);
    
    // KVKK onayı kontrolü (telefon numarasına göre)
    const storedKVKKPhone = await AsyncStorage.getItem('kvkk_accepted_phone');
    // Onay varsa set et
    if (storedKVKKPhone) {
      setKvkkAccepted(true);
    }
    
    // Sonra kullanıcıyı yükle
    await loadUser();
  };
  
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
    if (user && screen === 'dashboard') {
      requestLocationPermission().then(granted => {
        if (granted) {
          updateUserLocation();
          // Her 0.5 saniyede bir konum güncelle - CANLI TAKİP
          const interval = setInterval(updateUserLocation, 500);
          return () => clearInterval(interval);
        }
      });
    }
  }, [user, screen]);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const legalAcceptedStorage = await AsyncStorage.getItem('legal_accepted');
      
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Admin kontrolü - 5326497412 ana admin
        const cleanPhone = parsedUser.phone?.replace(/\D/g, '');
        const isMainAdmin = cleanPhone === '5326497412' || cleanPhone === '05326497412';
        
        if (isMainAdmin) {
          setIsAdmin(true);
          // Admin direkt admin paneline gitsin
          setShowAdminPanel(true);
          setScreen('role-select');
        } else {
          // API'den admin kontrolü
          try {
            const res = await fetch(`${API_URL}/admin/check?phone=${cleanPhone}`);
            const data = await res.json();
            if (data.success && data.is_admin) {
              setIsAdmin(true);
              setShowAdminPanel(true); // Diğer adminler de direkt panele
            }
          } catch (e) {}
          setScreen('role-select');
        }
        
        // Legal consent kontrolü
        if (legalAcceptedStorage !== 'true') {
          setShowLegalConsent(true);
        } else {
          setLegalAccepted(true);
        }
      }
    } catch (error) {
      console.error('Kullanıcı yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Legal consent kabul
  const handleLegalAccept = async () => {
    await AsyncStorage.setItem('legal_accepted', 'true');
    setLegalAccepted(true);
    setShowLegalConsent(false);
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
    if (!phone || phone.length < 10) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin');
      return;
    }

    try {
      // Cihaz ID'yi al
      const currentDeviceId = deviceId || await getOrCreateDeviceId();
      
      // Kullanıcı kontrolü yap
      const checkResponse = await fetch(`${API_URL}/auth/check-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, device_id: currentDeviceId })
      });

      const checkData = await checkResponse.json();
      console.log('🔍 Check user response:', checkData);
      
      if (checkData.success && checkData.user_exists && checkData.has_pin) {
        // ✅ KAYITLI KULLANICI VE PIN'İ VAR - DİREKT PIN EKRANINA GİT (OTP YOK!)
        setHasPin(true);
        setUserExists(true);
        setIsDeviceVerified(true);
        Alert.alert('Hoş Geldiniz! 👋', `${checkData.user_name || 'Kullanıcı'}, 6 haneli şifrenizi girin`);
        setScreen('enter-pin');
      } else if (checkData.success && checkData.user_exists && !checkData.has_pin) {
        // Kayıtlı ama PIN yok - OTP gönder ve PIN oluştur
        setUserExists(true);
        setHasPin(false);
        const response = await fetch(`${API_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await response.json();
        if (data.success) {
          Alert.alert('Şifre Oluşturma 🔐', 'Hesabınız için 6 haneli şifre belirlemeniz gerekiyor. SMS kodunu girin.\n\nTest: 123456');
          setScreen('otp');
        }
      } else {
        // 🆕 YENİ KULLANICI - OTP ile kayıt
        setUserExists(false);
        setHasPin(false);
        const response = await fetch(`${API_URL}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await response.json();
        if (data.success) {
          Alert.alert('Kayıt 📝', 'Telefon doğrulaması için SMS kodu gönderildi.\n\nTest: 123456');
          setScreen('otp');
        }
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

      const data = await response.json();
      console.log('🔐 Verify OTP response:', data);
      
      if (data.success) {
        if (data.user_exists && data.user) {
          // Kayıtlı kullanıcı
          await saveUser(data.user);
          
          if (data.has_pin) {
            // PIN var - PIN girişi
            setScreen('enter-pin');
          } else {
            // PIN yok - PIN oluşturması lazım
            setScreen('set-pin');
          }
        } else {
          // Yeni kullanıcı - Kayıt ekranı
          setScreen('register');
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        return true;
      } else {
        Alert.alert('İzin Gerekli', 'Konum izni olmadan uygulama çalışamaz');
        return false;
      }
    } catch (error) {
      console.error('Konum izni hatası:', error);
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
        
        setScreen('role-select'); // Kayıttan sonra rol seçimi
      } else {
        Alert.alert('Hata', data.detail || 'Kayıt oluşturulamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Kayıt oluşturulamadı');
    }
  };

  // ==================== RENDER SCREENS ====================
  
  // SPLASH SCREEN - 3 saniye göster - daha güvenilir timeout ile
  useEffect(() => {
    if (showSplash) {
      const splashTimer = setTimeout(() => {
        console.log('🎬 Splash timeout - login ekranına geçiliyor');
        setShowSplash(false);
        if (!user) {
          setScreen('login');
        }
      }, 3000);
      
      return () => clearTimeout(splashTimer);
    }
  }, [showSplash, user]);
  
  if (showSplash) {
    return (
      <SplashScreen onFinish={() => {
        console.log('🎬 SplashScreen onFinish çağrıldı');
        setShowSplash(false);
        if (!user) {
          setScreen('login');
        }
      }} />
    );
  }
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3FA9F5" />
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        {/* Hareketli Bulutlar Arka Plan */}
        <AnimatedClouds />
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                onChangeText={setPhone}
                maxLength={11}
              />
            </View>

            {/* KVKK Checkbox - Tıklanabilir Metin */}
            <TouchableOpacity 
              style={styles.kvkkContainer} 
              onPress={() => setKvkkAccepted(!kvkkAccepted)}
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
                <Text>'nı okudum, anladım ve kabul ediyorum.</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, !kvkkAccepted && styles.buttonDisabled]} 
              onPress={() => {
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
            
            {/* Şifremi Unuttum */}
            <TouchableOpacity 
              style={styles.forgotPasswordButton}
              onPress={() => setScreen('forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
            </TouchableOpacity>
            
            {/* Destek Butonu */}
            <TouchableOpacity 
              style={styles.supportButton}
              onPress={() => setShowSupportModal(true)}
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
                onChangeText={setOtp}
                maxLength={6}
              />
            </View>

            <TouchableOpacity style={styles.modernPrimaryButton} onPress={handleVerifyOTP}>
              <Text style={styles.modernPrimaryButtonText}>DOĞRULA</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modernSecondaryButton} onPress={() => setScreen('login')}>
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
                onChangeText={setFirstName}
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
                onChangeText={setLastName}
              />
            </View>

            {/* Şehir */}
            <Text style={styles.modernLabel}>Şehir</Text>
            <TouchableOpacity
              style={styles.modernInputContainer}
              onPress={() => setShowCityPicker(true)}
            >
              <Ionicons name="location-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <Text style={selectedCity ? styles.modernInputText : styles.modernPlaceholder}>
                {selectedCity || 'Şehir seçin'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#A0A0A0" />
            </TouchableOpacity>

            {/* Telefon Numarası (Readonly) */}
            <Text style={styles.modernLabel}>Telefon Numarası</Text>
            <View style={[styles.modernInputContainer, { backgroundColor: '#F5F5F5' }]}>
              <Ionicons name="call-outline" size={22} color="#3FA9F5" style={styles.inputIcon} />
              <Text style={styles.modernInputText}>{phone}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            </View>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, (!firstName || !lastName || !selectedCity) && styles.buttonDisabled]} 
              onPress={() => {
                if (firstName && lastName && selectedCity) {
                  setName(`${firstName} ${lastName}`);
                  setScreen('set-pin');
                }
              }}
              disabled={!firstName || !lastName || !selectedCity}
            >
              <Text style={styles.modernPrimaryButtonText}>DEVAM ET</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modernSecondaryButton} onPress={() => setScreen('login')}>
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
        Alert.alert('Hata', 'Şifre 6 haneli olmalıdır');
        return;
      }
      if (pin !== confirmPin) {
        Alert.alert('Hata', 'Şifreler eşleşmiyor');
        return;
      }

      try {
        const currentDeviceId = deviceId || await getOrCreateDeviceId();
        
        // Önce kullanıcıyı kaydet
        const registerResponse = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            first_name: firstName,
            last_name: lastName,
            city: selectedCity,
            pin: pin,
            device_id: currentDeviceId  // Cihaz ID ekle
          })
        });
        const registerData = await registerResponse.json();
        
        if (registerData.success) {
          // Kullanıcıyı kaydet ve rol seçimine git
          setUser(registerData.user);
          await saveUser(registerData.user);
          Alert.alert(
            '✅ Kayıt Başarılı',
            'Şifrenizi kimseyle paylaşmayın, göstermeyin, söylemeyin!',
            [{ text: 'Tamam', onPress: () => {
              setScreen('role-select');
            }}]
          );
        } else {
          Alert.alert('Hata', registerData.detail || 'Kayıt yapılamadı');
        }
      } catch (error) {
        console.error('Register error:', error);
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
                onChangeText={setPin}
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)}>
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
                onChangeText={setConfirmPin}
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
              onPress={handleSetPin}
              disabled={pin.length !== 6 || confirmPin.length !== 6}
            >
              <Text style={styles.modernPrimaryButtonText}>KAYDI TAMAMLA</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modernSecondaryButton} onPress={() => setScreen('register')}>
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
        Alert.alert('Hata', 'Şifre 6 haneli olmalıdır');
        return;
      }

      try {
        const currentDeviceId = deviceId || await getOrCreateDeviceId();
        
        const response = await fetch(`${API_URL}/auth/verify-pin?phone=${encodeURIComponent(phone)}&pin=${encodeURIComponent(pin)}&device_id=${encodeURIComponent(currentDeviceId)}`, {
          method: 'POST',
        });
        const data = await response.json();
        
        if (data.success) {
          setUser(data.user);
          saveUser(data.user);
          
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
            <Text style={styles.pinTitle}>Şifre Giriş</Text>
            <Text style={styles.heroSubtitle}>6 haneli güvenlik şifrenizi girin</Text>
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
                onChangeText={setPin}
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                <Ionicons name={showPin ? "eye-off" : "eye"} size={22} color="#A0A0A0" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, pin.length !== 6 && styles.buttonDisabled]} 
              onPress={handleEnterPin}
              disabled={pin.length !== 6}
            >
              <Text style={styles.modernPrimaryButtonText}>GİRİŞ YAP</Text>
              <Ionicons name="log-in" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modernSecondaryButton} onPress={() => {
              setPin('');
              setScreen('login');
            }}>
              <Ionicons name="arrow-back" size={18} color="#3FA9F5" />
              <Text style={styles.modernSecondaryButtonText}>Geri Dön</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'role-select') {
    const handleRoleSelect = (role: 'passenger' | 'driver') => {
      setSelectedRole(role);
      
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
      if (!selectedRole) return;
      
      try {
        await AsyncStorage.setItem(`last_role_${user?.id}`, selectedRole);
        if (selectedRole && user) {
          // Kullanıcının rolünü güncelle
          const updatedUser = { ...user, role: selectedRole };
          setUser(updatedUser);
          setScreen('dashboard');
          
          // Push token'ı backend'e kaydet
          registerPushToken(user.id);
        }
      } catch (error) {
        console.error('Role kaydedilemedi:', error);
        if (selectedRole && user) {
          const updatedUser = { ...user, role: selectedRole };
          setUser(updatedUser);
          setScreen('dashboard');
          
          // Push token'ı backend'e kaydet
          registerPushToken(user.id);
        }
      }
    };

    return (
      <View style={styles.roleSelectionContainer}>
        <SafeAreaView style={styles.roleSelectionSafe}>
          {/* Üst Bar - Geri ve Çıkış */}
          <View style={styles.roleTopBar}>
            <TouchableOpacity 
              style={styles.roleBackButton}
              onPress={() => {
                Alert.alert(
                  'Çıkış',
                  'Oturumu kapatmak istiyor musunuz?',
                  [
                    { text: 'İptal', style: 'cancel' },
                    { 
                      text: 'Çıkış Yap', 
                      style: 'destructive',
                      onPress: async () => {
                        await AsyncStorage.removeItem('user');
                        setUser(null);
                        setScreen('login');
                        setPhone('');
                        setPin('');
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              <Text style={styles.roleBackText}>Çıkış</Text>
            </TouchableOpacity>
            
            {/* Admin Panel Butonu */}
            {isAdmin && (
              <TouchableOpacity 
                style={styles.roleAdminButton}
                onPress={() => setShowAdminPanel(true)}
              >
                <Ionicons name="settings" size={24} color="#3FA9F5" />
                <Text style={styles.roleAdminText}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Başlık Alanı */}
          <View style={styles.roleHeader}>
            <View style={styles.roleHeaderIcon}>
              <Ionicons name="people-circle" size={48} color="#3FA9F5" />
            </View>
            <Text style={styles.roleHeaderTitle}>Rol Seçimi</Text>
            <Text style={styles.roleHeaderSubtitle}>Bugün nasıl kullanmak istiyorsunuz?</Text>
          </View>

          {/* Rol Kartları */}
          <View style={styles.roleCardsContainer}>
            {/* Yolcu Kartı */}
            <TouchableOpacity
              style={[
                styles.roleCardPremium,
                selectedRole === 'passenger' && styles.roleCardPremiumSelected
              ]}
              onPress={() => handleRoleSelect('passenger')}
              activeOpacity={0.7}
            >
              <View style={styles.roleCardContent}>
                <View style={styles.roleCardIconContainer}>
                  <Ionicons 
                    name="person-outline" 
                    size={40} 
                    color={selectedRole === 'passenger' ? '#3FA9F5' : '#7F8C8D'} 
                  />
                  <Ionicons 
                    name="location" 
                    size={24} 
                    color={selectedRole === 'passenger' ? '#3FA9F5' : '#7F8C8D'}
                    style={styles.roleCardIconOverlay}
                  />
                </View>
                <Text style={[
                  styles.roleCardTitle,
                  selectedRole === 'passenger' && styles.roleCardTitleSelected
                ]}>
                  Yolcu
                </Text>
                <Text style={styles.roleCardDescription}>
                  Yakın sürücülerden teklif al
                </Text>
                {selectedRole === 'passenger' && (
                  <View style={styles.roleCardCheckmark}>
                    <Ionicons name="checkmark-circle" size={28} color="#3FA9F5" />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Sürücü Kartı */}
            <TouchableOpacity
              style={[
                styles.roleCardPremium,
                selectedRole === 'driver' && styles.roleCardPremiumSelected
              ]}
              onPress={() => handleRoleSelect('driver')}
              activeOpacity={0.7}
            >
              <View style={styles.roleCardContent}>
                <View style={styles.roleCardIconContainer}>
                  <Ionicons 
                    name="car-sport-outline" 
                    size={40} 
                    color={selectedRole === 'driver' ? '#3FA9F5' : '#7F8C8D'} 
                  />
                  <Ionicons 
                    name="options" 
                    size={24} 
                    color={selectedRole === 'driver' ? '#3FA9F5' : '#7F8C8D'}
                    style={styles.roleCardIconOverlay}
                  />
                </View>
                <Text style={[
                  styles.roleCardTitle,
                  selectedRole === 'driver' && styles.roleCardTitleSelected
                ]}>
                  Sürücü
                </Text>
                <Text style={styles.roleCardDescription}>
                  Yolculuk teklifleri ver
                </Text>
                {selectedRole === 'driver' && (
                  <View style={styles.roleCardCheckmark}>
                    <Ionicons name="checkmark-circle" size={28} color="#3FA9F5" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Devam Et Butonu */}
          <TouchableOpacity
            style={[
              styles.roleContinueButton,
              !selectedRole && styles.roleContinueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={!selectedRole}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={selectedRole ? ['#3FA9F5', '#3FA9F5'] : ['#BDC3C7', '#95A5A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.roleContinueGradient}
            >
              <Text style={styles.roleContinueText}>Devam Et</Text>
              <Ionicons name="arrow-forward" size={24} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Admin Butonu - Sadece adminler için */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => setShowAdminPanel(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.adminButtonGradient}
              >
                <Ionicons name="shield-checkmark" size={22} color="#FFF" />
                <Text style={styles.adminButtonText}>Admin Paneli</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </SafeAreaView>
        
        {/* Admin Panel Modal - TAM EKRAN */}
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
      </View>
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
      />
    ) : (
      <DriverDashboard user={user} logout={logout} setScreen={setScreen} />
    );
  }

  return null;
}

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
          <Text style={styles.animatedOfferButtonText}>Teklif Gönder</Text>
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
  const personName = isPassenger ? offer.driver_name : offer.passenger_name;
  const personRating = isPassenger ? (offer.driver_rating || 5.0) : 5.0;
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
              <Text style={driverViewStyles.headerTitle}>🚨 Yeni Yolcu Talebi!</Text>
              <Text style={driverViewStyles.headerSubtitle}>Hızlı teklif ver, yolcuyu kazan</Text>
            </View>
          </View>

          {/* Yolcu İsmi Badge */}
          {personName && (
            <View style={driverViewStyles.passengerBadge}>
              <Ionicons name="person" size={16} color={SKY_BLUE.primary} />
              <Text style={driverViewStyles.passengerName}>{personName}</Text>
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
                <Text style={driverViewStyles.addressLabel}>ALIŞ NOKTASI</Text>
                <Text style={driverViewStyles.addressText} numberOfLines={2}>
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
                <Text style={driverViewStyles.addressLabel}>VARIŞ NOKTASI</Text>
                <Text style={driverViewStyles.addressText} numberOfLines={2}>
                  {offer.dropoff_location || offer.dropoff_address || 'Hedef alınıyor...'}
                </Text>
              </View>
            </View>
          </View>

          {/* Mesafe ve Kazanç Bilgileri */}
          <View style={driverViewStyles.statsRow}>
            <View style={driverViewStyles.statBox}>
              <Ionicons name="location" size={22} color={SKY_BLUE.primary} />
              <Text style={driverViewStyles.statValue}>{distanceToPassengerKm} km</Text>
              <Text style={driverViewStyles.statLabel}>Yolcuya</Text>
            </View>
            <View style={driverViewStyles.statBox}>
              <Ionicons name="time" size={22} color={SKY_BLUE.primary} />
              <Text style={driverViewStyles.statValue}>{arrivalTime} dk</Text>
              <Text style={driverViewStyles.statLabel}>Varış</Text>
            </View>
            <View style={driverViewStyles.statBox}>
              <Ionicons name="navigate" size={22} color="#F59E0B" />
              <Text style={driverViewStyles.statValue}>{tripDistanceKm} km</Text>
              <Text style={driverViewStyles.statLabel}>Yolculuk</Text>
            </View>
          </View>

          {/* Fiyat Girişi - +/- Butonları ile */}
          <View style={driverViewStyles.priceSection}>
            <Text style={driverViewStyles.priceSectionTitle}>💰 Teklif Tutarını Belirle</Text>
            
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
                <Text style={driverViewStyles.priceCurrency}>₺</Text>
                <TextInput
                  style={driverViewStyles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={priceInput}
                  onChangeText={setPriceInput}
                  editable={!sending && !sent}
                  maxLength={5}
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
                  <Text style={[
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
            <Text style={driverViewStyles.sendBtnText}>
              {sent ? 'Teklif Gönderildi!' : sending ? 'Gönderiliyor...' : 'Teklif Gönder'}
            </Text>
          </TouchableOpacity>

          {/* İptal/Kapat Butonu */}
          <TouchableOpacity 
            style={driverViewStyles.cancelBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={driverViewStyles.cancelBtnText}>Vazgeç</Text>
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
    backgroundColor: SKY_BLUE.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SKY_BLUE.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  // Yolcu Badge
  passengerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: SKY_BLUE.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 14,
    gap: 6,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: SKY_BLUE.dark,
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  // Adres Kartı
  addressCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  addressContent: {
    flex: 1,
    marginLeft: 12,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
    lineHeight: 22,
  },
  addressLine: {
    marginLeft: 5,
    marginVertical: 6,
    height: 24,
    justifyContent: 'center',
  },
  addressLineDashed: {
    width: 2,
    height: '100%',
    backgroundColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  // Fiyat Section
  priceSection: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
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
  
  const personName = offer.driver_name || 'Sürücü';
  const personRating = offer.driver_rating || 5.0;
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
                {offer.driver_name?.charAt(0) || '?'}
              </Text>
            </View>
            <Text style={styles.driverNameSmall}>{offer.driver_name}</Text>
            <Text style={styles.ratingLabel}>Puanlama</Text>
            <View style={styles.starsContainer}>
              {[...Array(10)].map((_, i) => (
                <Text key={i} style={styles.starIcon}>
                  {i < Math.round(offer.driver_rating * 2) ? '⭐' : '☆'}
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
function AnimatedPulseButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
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
      disabled={loading}
      activeOpacity={0.8}
      style={styles.callButtonContainer}
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
              <Ionicons name="call" size={60} color="#FFF" />
              <Text style={styles.callButtonText}>TEKLİF İSTE</Text>
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
  setScreen
}: { 
  user: User; 
  logout: () => void;
  destination: any;
  setDestination: any;
  userLocation: any;
  showDestinationPicker: boolean;
  setShowDestinationPicker: (show: boolean) => void;
  setScreen: (screen: 'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard' | 'forgot-password' | 'reset-pin') => void;
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
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 🆕 Eşleşme sağlanıyor state'i
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  
  // 🆕 Daily.co Video/Audio Call State'leri
  const [dailyCallActive, setDailyCallActive] = useState(false);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);
  const [dailyCallType, setDailyCallType] = useState<'video' | 'audio'>('video');
  const [dailyCallerName, setDailyCallerName] = useState<string>('');
  const [incomingDailyCall, setIncomingDailyCall] = useState(false);
  const [dailyRoomName, setDailyRoomName] = useState<string>('');
  
  // 🆕 Chat State'leri (Yolcu)
  const [passengerChatVisible, setPassengerChatVisible] = useState(false);
  const [passengerIncomingMessage, setPassengerIncomingMessage] = useState<{ text: string; senderId: string; timestamp: number } | null>(null);
  
  // 🆕 End Trip Modal State'leri (Yolcu)
  const [passengerEndTripModalVisible, setPassengerEndTripModalVisible] = useState(false);
  const [passengerForceEndConfirmVisible, setPassengerForceEndConfirmVisible] = useState(false);
  
  // Ses efekti için
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // 🔊 EŞLEŞME SESİ - Modern ding-dong
  const playMatchSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' }, // Ding-dong notification
        { shouldPlay: true, volume: 0.8 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Eşleşme sesi hatası:', error);
    }
  };

  // 🔊 HARİTA AÇILMA SESİ - Başlama düdüğü
  const playStartSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' }, // Start chime
        { shouldPlay: true, volume: 0.7 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Başlama sesi hatası:', error);
    }
  };
  
  // Teklif geldiğinde ses çal
  const playOfferSound = async () => {
    try {
      // Önceki sesi durdur
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      // Yeni ses yükle ve çal - casino/slot machine tarzı ses
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3' },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      
      // Ses bitince temizle
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Ses çalma hatası:', error);
    }
  };
  
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
  
  // 🆕 Daily Call IDs (for proper termination) - PASSENGER
  const [passengerDailyCallerId, setPassengerDailyCallerId] = useState<string>('');
  const [passengerDailyReceiverId, setPassengerDailyReceiverId] = useState<string>('');
  
  // 🆕 Gelen Arama State'leri
  const [incomingCall, setIncomingCall] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState<{
    callerName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    callerId: string;
    tagId: string;
  } | null>(null);
  
  // 🆕 Giden Arama State'leri (Aranıyor...)
  const [outgoingCall, setOutgoingCall] = useState(false);
  const [outgoingCallData, setOutgoingCallData] = useState<{
    receiverName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    receiverId: string;
  } | null>(null);
  
  // Arama kilidi
  const isCallActiveRef = useRef(false);
  
  // ==================== SOCKET.IO HOOK - YOLCU ====================
  const {
    socket: passengerSocket,
    isConnected: socketConnected,
    isRegistered: socketRegistered,
    startCall: socketStartCall,
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
    // 🆕 Daily.co Call Signaling
    emitCallInvite,
    emitCallAccepted,
    emitCallRejected,
    // 🆕 YENİ: Sync Call Events
    emitCallAccept,
    emitCallReject,
    emitCallCancel,
    emitCallEnd,
    acceptDailyCall,
    rejectDailyCall,
    endDailyCall,
    // 🆕 Mesajlaşma
    emitSendMessage: passengerEmitSendMessage,
  } = useSocket({
    userId: user?.id || null,
    userRole: 'passenger',
    // 🆕 Gelen Daily.co Arama - VİBRASYON + IncomingCallScreen
    onIncomingDailyCall: (data) => {
      console.log('📞 YOLCU - GELEN DAILY.CO ARAMA:', data);
      console.log('   room_url:', data.room_url);
      console.log('   room_name:', data.room_name);
      if (dailyCallActive || incomingCall) return;
      
      // Room URL ve name'i kaydet (arayan zaten oluşturdu)
      if (data.room_url) {
        setDailyRoomUrl(data.room_url);
        setDailyRoomName(data.room_name || '');
      }
      setPassengerDailyCallerId(data.caller_id);
      
      setIncomingCallData({
        callerName: data.caller_name || 'Şoför',
        callType: data.call_type || 'audio',
        roomUrl: data.room_url || '',
        roomName: data.room_name || '',
        callerId: data.caller_id,
        tagId: data.tag_id || '',
      });
      setIncomingCall(true);
    },
    // 🆕 YENİ: call_accepted - HER İKİ TARAFA aynı anda geliyor!
    onCallAcceptedNew: (data) => {
      console.log('✅ YOLCU - CALL_ACCEPTED (SYNC) - Daily odası hazır:', data);
      // Her iki taraf da bu eventi alıyor - Daily.co'ya gir
      setDailyRoomUrl(data.room_url);
      setDailyRoomName(data.room_name);
      setDailyCallType(data.call_type as 'audio' | 'video');
      // CRITICAL: Store caller/receiver IDs for proper termination
      setPassengerDailyCallerId(data.caller_id);
      setPassengerDailyReceiverId(data.receiver_id);
      // Arayan mı aranan mı?
      const isCaller = user?.id === data.caller_id;
      setDailyCallerName(isCaller ? (activeTag?.driver_name || 'Şoför') : (incomingCallData?.callerName || 'Yolcu'));
      setDailyCallActive(true);
      // Reset states - navigation YOK
      setOutgoingCall(false);
      setOutgoingCallData(null);
      setIncomingCall(false);
      setIncomingCallData(null);
    },
    onDailyCallAccepted: (data) => {
      console.log('YOLCU - ARAMA KABUL EDILDI (ESKİ):', data);
      // Eski event - artık onCallAcceptedNew kullanılıyor
    },
    onDailyCallRejected: (data) => {
      console.log('YOLCU - ARAMA REDDEDILDI:', data);
      setOutgoingCall(false);
      setOutgoingCallData(null);
      setIncomingCall(false);
      setIncomingCallData(null);
      setDailyCallActive(false);
      setDailyRoomUrl(null);
      setPassengerDailyCallerId('');
      setPassengerDailyReceiverId('');
      Alert.alert('Bilgi', 'Arama reddedildi');
    },
    // 🆕 YENİ: call_cancelled - Arayan iptal etti
    onCallCancelled: (data) => {
      console.log('🚫 YOLCU - ARAMA İPTAL EDİLDİ:', data);
      setIncomingCall(false);
      setIncomingCallData(null);
    },
    // 🆕 CRITICAL: call_ended - Görüşme bitti (Backend'den)
    // Bu event karşı taraf aramayı sonlandırdığında gelir
    onCallEndedNew: (data) => {
      console.log('📴 YOLCU - CALL_ENDED (Backend-driven):', data);
      // Clear ALL call state
      setDailyCallActive(false);
      setDailyRoomUrl(null);
      setDailyRoomName('');
      setPassengerDailyCallerId('');
      setPassengerDailyReceiverId('');
      setOutgoingCall(false);
      setOutgoingCallData(null);
      setIncomingCall(false);
      setIncomingCallData(null);
    },
    onIncomingCall: (data) => {
      console.log('📞 YOLCU - ESKİ GELEN ARAMA (Agora - devre dışı):', data);
      // Artık Daily.co kullanılıyor
    },
    onDailyCallEnded: (data) => {
      console.log('YOLCU - DAILY.CO ARAMA BITTI:', data);
      // Clear ALL call state
      setDailyCallActive(false);
      setIncomingDailyCall(false);
      setDailyRoomUrl(null);
      setDailyRoomName('');
      setPassengerDailyCallerId('');
      setPassengerDailyReceiverId('');
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
      setToastMessage(`${data.driver_name} teklifinize ${data.price}₺ önerdi!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    },
    // 🆕 TAG EŞLEŞTİ - Yolcu teklifi kabul ettiğinde
    onTagMatched: (data) => {
      console.log('🤝 YOLCU - TAG EŞLEŞTİ (Socket):', data);
      // 🔥 TÜM TEKLİFLERİ TEMİZLE - Artık yeni teklif alamaz
      clearOffers();
      
      // 🚀 ANLIK GÜNCELLEMEActiveTag'i direkt güncelle - API bekleme!
      if (activeTag) {
        setActiveTag(prev => prev ? {
          ...prev,
          status: 'matched',
          driver_id: data.driver_id,
          matched_at: new Date().toISOString()
        } : null);
      }
      
      // Ayrıca API'den de çek (sürücü adı vb. için)
      loadActiveTag();
    },
    // 🆕 TEKLİF KABUL EDİLDİ - Ack (backend confirmation)
    onOfferAccepted: (data) => {
      console.log('✅ YOLCU - TEKLİF KABUL EDILDI (Socket Ack):', data);
      // Backend'den onay geldi - tag'i yenile
      loadActiveTag();
    },
    // 🆕 Mesajlaşma - PURE SOCKET (ANLIK)
    onNewMessage: (data) => {
      console.log('💬 YOLCU - YENİ MESAJ GELDİ (ANLIK):', data);
      // Gelen mesajı ChatBubble'a ilet
      setPassengerIncomingMessage({
        text: data.message,
        senderId: data.sender_id,
        timestamp: data.timestamp || Date.now(),
      });
      // Bildirim göster
      if (!passengerChatVisible) {
        setToastMessage(`💬 ${data.sender_name}: ${data.message.substring(0, 30)}...`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
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

  useEffect(() => {
    console.log('🔄 Yolcu polling başlatıldı');
    loadActiveTag();
    const interval = setInterval(() => {
      console.log('🔄 Yolcu TAG ve teklifler yükleniyor...');
      loadActiveTag();
    }, 1000); // Her 1 saniyede bir kontrol et - ANINDA
    return () => {
      console.log('🔄 Yolcu polling durduruldu');
      clearInterval(interval);
    };
  }, [user?.id]);

  const loadActiveTag = async () => {
    try {
      const response = await fetch(`${API_URL}/passenger/active-tag?user_id=${user.id}`);
      const data = await response.json();
      if (data.success && data.tag) {
        setActiveTag(data.tag);
        // useOffers hook'u otomatik olarak teklifleri yükleyecek (Supabase Realtime)
      } else {
        setActiveTag(null);
      }
    } catch (error) {
      console.error('TAG yüklenemedi:', error);
    }
  };

  // ÇAĞRI BUTONU - Hedef kontrolü + koordinat gönderimi
  const handleCallButton = async () => {
    console.log('🔵 ÇAĞRI BUTONU TIKLANDI!');
    console.log('Destination:', destination);
    console.log('User:', user);
    
    // Hedef kontrolü
    if (!destination) {
      console.log('⚠️ Hedef yok!');
      Alert.alert('⚠️ Hedef Gerekli', 'Lütfen önce nereye gitmek istediğinizi seçin');
      return;
    }

    console.log('✅ Hedef var, loading başlıyor...');
    setLoading(true);
    
    // GPS konumu varsa kullan, yoksa mock konum
    const pickupLat = userLocation?.latitude || 41.0082;
    const pickupLng = userLocation?.longitude || 28.9784;
    
    // 📍 Yolcunun bulunduğu adresi reverse geocoding ile al
    let pickupAddress = 'Mevcut Konumunuz';
    try {
      const geocodeResult = await Location.reverseGeocodeAsync({
        latitude: pickupLat,
        longitude: pickupLng
      });
      if (geocodeResult && geocodeResult.length > 0) {
        const addr = geocodeResult[0];
        const parts = [];
        if (addr.street) parts.push(addr.street);
        if (addr.streetNumber) parts.push(`No: ${addr.streetNumber}`);
        if (addr.district) parts.push(addr.district);
        if (addr.subregion) parts.push(addr.subregion);
        if (addr.city) parts.push(addr.city);
        pickupAddress = parts.length > 0 ? parts.join(', ') : 'Mevcut Konumunuz';
      }
    } catch (err) {
      console.log('Reverse geocoding hatası:', err);
    }
    
    // 🚀 OPTIMISTIC UI - Geçici TAG ve request_id oluştur
    // UUID v4 formatında geçici ID oluştur (backend uyumlu)
    const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    const tempTagId = generateUUID();
    const newRequestId = generateUUID();  // 🆕 Her TAG için unique request_id
    
    const tempTag = {
      id: tempTagId,
      user_id: user.id,
      pickup_location: pickupAddress,
      dropoff_location: destination.address,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: destination.latitude,
      dropoff_lng: destination.longitude,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    // 1️⃣ ANINDA UI'ı güncelle
    setActiveTag(tempTag as any);
    setCurrentRequestId(newRequestId);  // 🆕 request_id kaydet
    setLoading(false);
    
    // 2️⃣ 🆕 YENİ: Socket ile 20km içindeki şoförlere yayınla
    if (emitCreateTagRequest) {
      emitCreateTagRequest({
        request_id: newRequestId,
        tag_id: tempTagId,
        passenger_id: user.id,
        passenger_name: user.name || user.phone,
        pickup_location: pickupAddress,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_location: destination.address,
        dropoff_lat: destination.latitude,
        dropoff_lng: destination.longitude,
        notes: 'Hedef belirlendi'
      });
      console.log('🔥 TAG REQUEST Socket ile 20km şoförlere yayınlandı! request_id:', newRequestId);
    } else if (emitNewTag) {
      // Fallback: Eski yöntem (tüm şoförlere)
      emitNewTag({
        tag_id: tempTagId,
        passenger_id: user.id,
        passenger_name: user.name || user.phone,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        pickup_address: pickupAddress,
        dropoff_lat: destination.latitude,
        dropoff_lng: destination.longitude,
        dropoff_address: destination.address,
        status: 'pending'
      });
      console.log('🔥 TAG Socket ile ANINDA yayınlandı!');
    }
    
    // Toast ANINDA göster
    setToastMessage('Teklif isteği gönderildi ✓');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
    
    // 3️⃣ REST API'yi ARKA PLANDA çağır (bekleme yok!)
    fetch(`${API_URL}/passenger/create-request?user_id=${user.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_location: 'Mevcut Konumunuz',
        dropoff_location: destination.address,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: destination.latitude,
        dropoff_lng: destination.longitude,
        notes: 'Hedef belirlendi'
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.tag) {
        // Gerçek TAG ID ile güncelle
        setActiveTag(data.tag);
        // Socket'e de gerçek ID'yi gönder
        if (emitNewTag) {
          emitNewTag({
            tag_id: data.tag.id,
            passenger_id: user.id,
            passenger_name: user.name || user.phone,
            pickup_lat: pickupLat,
            pickup_lng: pickupLng,
            pickup_address: 'Mevcut Konumunuz',
            dropoff_lat: destination.latitude,
            dropoff_lng: destination.longitude,
            dropoff_address: destination.address,
            status: 'pending'
          });
        }
        console.log('✅ TAG veritabanına kaydedildi:', data.tag.id);
      }
    })
    .catch(err => {
      console.error('❌ TAG kayıt hatası (arka plan):', err);
      // Hata olsa bile UI'da TAG gösterilmeye devam eder
    });
  };

  // SESLİ ARAMA - Mock fonksiyon
  // 🆕 Daily.co ile Sesli/Görüntülü Arama Başlat
  const startDailyCall = async (callType: 'audio' | 'video') => {
    if (!activeTag?.driver_id || !user?.id) {
      Alert.alert('Hata', 'Sürücü bilgisi bulunamadı');
      return;
    }
    
    setCalling(true);
    
    try {
      const response = await fetch(`${API_URL}/daily/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller_id: user.id,
          receiver_id: activeTag.driver_id,
          call_type: callType,
          tag_id: activeTag.id
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.room_url) {
        // Daily.co arama ekranını aç
        setDailyRoomUrl(data.room_url);
        setDailyRoomName(data.room_name);
        setDailyCallType(callType);
        setDailyCallerName(activeTag.driver_name || 'Sürücü');
        setDailyCallActive(true);
        setCalling(false);
        
        if (!data.receiver_online) {
          Alert.alert('Bilgi', 'Sürücü şu an çevrimdışı görünüyor. Arama başlatıldı.');
        }
      } else {
        setCalling(false);
        Alert.alert('Hata', 'Arama başlatılamadı');
      }
    } catch (error) {
      console.error('Daily.co arama hatası:', error);
      setCalling(false);
      Alert.alert('Hata', 'Arama başlatılırken bir sorun oluştu');
    }
  };

  const handleVoiceCall = () => {
    startDailyCall('audio');
  };

  const handleVideoCall = () => {
    startDailyCall('video');
  };

  // Daily.co arama bittiğinde
  const handleDailyCallEnd = () => {
    if (dailyRoomName && activeTag?.driver_id) {
      endDailyCall({
        other_user_id: activeTag.driver_id,
        room_name: dailyRoomName
      });
    }
    setDailyCallActive(false);
    setIncomingDailyCall(false);
    setDailyRoomUrl(null);
    setDailyRoomName('');
  };

  // Daily.co gelen arama kabul
  const handleAcceptDailyCall = () => {
    console.log('✅ YOLCU - Arama kabul ediliyor');
    console.log('   dailyRoomUrl:', dailyRoomUrl);
    console.log('   passengerDailyCallerId:', passengerDailyCallerId);
    
    if (!dailyRoomUrl) {
      Alert.alert('Hata', 'Room bilgisi bulunamadı');
      return;
    }
    
    // Arayan'a kabul edildiğini bildir
    acceptDailyCall({
      caller_id: passengerDailyCallerId,
      receiver_id: user?.id || '',
      room_url: dailyRoomUrl,
      room_name: dailyRoomName || '',
      call_type: incomingCallData?.callType || 'audio'
    });
    
    // Gelen arama ekranını kapat, Daily.co'ya gir
    setIncomingCall(false);
    setDailyCallActive(true);
    setDailyCallerName(incomingCallData?.callerName || 'Şoför');
  };

  // Daily.co gelen arama reddet
  const handleRejectDailyCall = () => {
    if (passengerDailyCallerId) {
      rejectDailyCall({
        caller_id: passengerDailyCallerId
      });
    }
    setIncomingDailyCall(false);
    setDailyRoomUrl(null);
  };

  // Teklifi 10 dakikalığına gizle (çarpı butonu)
  const handleDismissOffer = async (offerId: string) => {
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

  const handleDestinationSelect = async (address: string, lat: number, lng: number) => {
    const newDestination = { address, latitude: lat, longitude: lng };
    setDestination(newDestination);
    setShowDestinationPicker(false);

    // Eğer aktif TAG varsa, hedefi güncelle
    if (activeTag) {
      try {
        const response = await fetch(`${API_URL}/passenger/update-destination?user_id=${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tag_id: activeTag.id,
            dropoff_location: address,
            dropoff_lat: lat,
            dropoff_lng: lng
          })
        });

        const data = await response.json();
        if (data.success) {
          
          loadActiveTag(); // TAG'i yeniden yükle
        } else {
          Alert.alert('Hata', data.detail || 'Hedef güncellenemedi');
        }
      } catch (error) {
        Alert.alert('Hata', 'Hedef güncellenemedi');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 SEARCHING PHASE - HARİTA + TEKLİF LİSTESİ (YENİ UI)
  // Üstte harita (tüm sürücüler) + Altta scrollable teklif listesi
  // ═══════════════════════════════════════════════════════════════════════════
  if (activeTag && activeTag.status !== 'matched' && activeTag.status !== 'in_progress') {
    const isSearching = activeTag.status === 'pending' || activeTag.status === 'offers_received';
    
    return (
      <SafeAreaView style={searchingStyles.container}>
        {/* Üst Bar - Geri + Durum + İptal */}
        <View style={searchingStyles.topBar}>
          <TouchableOpacity onPress={() => setScreen('role-select')} style={searchingStyles.backBtn}>
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
        </View>

        {/* TEKLİF LİSTESİ - Scrollable */}
        {offers.length > 0 ? (
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
        ) : (
          <View style={searchingStyles.emptyOffersContainer}>
            <ActivityIndicator size="large" color="#3FA9F5" />
            <Text style={searchingStyles.emptyTitle}>Yakındaki sürücüler bilgilendiriliyor...</Text>
            <Text style={searchingStyles.emptySubtitle}>Teklifler birkaç saniye içinde gelecek</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // 🆕 GELEN ARAMA EKRANI - YOLCU (Vibration + Accept/Reject)
  if (incomingCall && incomingCallData) {
    return (
      <IncomingCallScreen
        callerName={incomingCallData.callerName}
        callType={incomingCallData.callType}
        onAccept={() => {
          // 🆕 YENİ: Socket ile call_accept gönder - Backend Daily room oluşturacak
          // Sonra HER İKİ TARAFA call_accepted gelecek
          console.log('📞 YOLCU - ARAMAYI KABUL EDİYOR, call_accept gönderiliyor...');
          emitCallAccept({
            caller_id: incomingCallData.callerId,
            receiver_id: user.id,
            call_type: incomingCallData.callType,
            tag_id: incomingCallData.tagId || activeTag?.id || '',
          });
          // NOT: Daily.co'ya giriş onCallAcceptedNew event'i ile yapılacak
          // Navigation YOK - sadece bekle
        }}
        onReject={() => {
          // 🆕 YENİ: call_reject kullan
          console.log('📞 YOLCU - ARAMAYI REDDEDİYOR');
          emitCallReject({
            caller_id: incomingCallData.callerId,
            receiver_id: user.id,
          });
          // Reset
          setIncomingCall(false);
          setIncomingCallData(null);
        }}
      />
    );
  }

  // ARANIYOR EKRANI - YOLCU (Aranan kabul edene kadar bekle)
  if (outgoingCall && outgoingCallData) {
    return (
      <OutgoingCallScreen
        receiverName={outgoingCallData.receiverName}
        callType={outgoingCallData.callType}
        onCancel={() => {
          // 🆕 YENİ: call_cancel kullan
          console.log('📞 YOLCU - ARAMAYI İPTAL EDİYOR');
          emitCallCancel({
            caller_id: user.id,
            receiver_id: outgoingCallData.receiverId,
          });
          setOutgoingCall(false);
          setOutgoingCallData(null);
        }}
      />
    );
  }

  // DAILY CALL SCREEN - YOLCU (Backend-driven termination)
  if (dailyCallActive && dailyRoomUrl && dailyRoomName) {
    return (
      <DailyCallScreen
        roomUrl={dailyRoomUrl}
        roomName={dailyRoomName}
        callType={dailyCallType}
        otherUserName={dailyCallerName}
        callerId={passengerDailyCallerId}
        receiverId={passengerDailyReceiverId}
        currentUserId={user?.id || ''}
        onCallEnd={(roomName) => {
          // Clear all local call state
          setDailyCallActive(false);
          setDailyRoomUrl(null);
          setDailyRoomName('');
          setPassengerDailyCallerId('');
          setPassengerDailyReceiverId('');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
              <TouchableOpacity onPress={() => setScreen('role-select')} style={styles.fullScreenBackBtn}>
                <Ionicons name="chevron-back" size={26} color="#3FA9F5" />
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} style={styles.fullScreenLogoutBtn}>
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
            
            {/* Kişi Adı */}
            <Text style={styles.welcomeNameBig}>{user.name}</Text>
            <Text style={styles.welcomeQuestion}>Nereye Gitmek İstiyorsunuz?</Text>
            
            {/* Hedef Seçme Alanı - GÖK MAVİSİ, BÜYÜK */}
            <TouchableOpacity
              style={styles.destinationBoxSky}
              onPress={() => {
                setShowDestinationPicker(true);
                setShowArrowHint(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="location-sharp" size={36} color="#87CEEB" />
              <Text style={styles.destinationTextSky}>
                {destination ? destination.address : 'Hedef Seçin'}
              </Text>
              <Ionicons name="chevron-forward" size={24} color="#87CEEB" />
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
              loading={loading}
            />
          </View>
        ) : null}

            {/* CANLI HARİTA - Tam Ekran (Yolcu) - SADECE MATCHED/IN_PROGRESS'DE */}
            {activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
              <View style={styles.fullScreenMapContainer}>
                <LiveMapView
                  userLocation={userLocation}
                  otherLocation={driverLocation || activeTag?.driver_location || null}
                  destinationLocation={destination ? { latitude: destination.latitude, longitude: destination.longitude } : (activeTag?.dropoff_lat && activeTag?.dropoff_lng ? { latitude: activeTag.dropoff_lat, longitude: activeTag.dropoff_lng } : null)}
                  isDriver={false}
                  userName={user.name}
                  otherUserName={activeTag?.driver_name || 'Şoför'}
                  otherUserId={activeTag?.driver_id}
                  price={activeTag?.final_price}
                  routeInfo={activeTag?.route_info}
                  onCall={async (type) => {
                    // ════════════════════════════════════════════════════════════
                    // FIXED CALL FLOW - Room ÖNCE oluştur, SONRA davet gönder
                    // ════════════════════════════════════════════════════════════
                    
                    if (dailyCallActive || incomingCall || outgoingCall) {
                      Alert.alert('Uyari', 'Zaten bir arama devam ediyor');
                      return;
                    }
                    
                    const driverId = activeTag?.driver_id || '';
                    const driverName = activeTag?.driver_name || 'Sofor';
                    
                    if (!driverId) {
                      Alert.alert('Hata', 'Sofor bilgisi bulunamadi');
                      return;
                    }
                    
                    // "Aranıyor..." ekranını göster
                    setOutgoingCallData({
                      receiverName: driverName,
                      callType: type,
                      roomUrl: '',
                      roomName: '',
                      receiverId: driverId,
                    });
                    setOutgoingCall(true);
                    
                    try {
                      // 1. Daily.co room oluştur
                      console.log('📞 YOLCU - Daily.co room oluşturuluyor...');
                      const response = await fetch(`${API_URL}/calls/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          caller_id: user.id,
                          receiver_id: driverId,
                          call_type: type,
                          tag_id: activeTag?.id || ''
                        })
                      });
                      
                      const data = await response.json();
                      
                      if (!data.success || !data.room_url) {
                        setOutgoingCall(false);
                        setOutgoingCallData(null);
                        Alert.alert('Hata', 'Arama başlatılamadı');
                        return;
                      }
                      
                      console.log('📞 YOLCU - Room hazır:', data.room_url);
                      
                      // 2. Socket ile karşı tarafa call_invite gönder (room_url ile birlikte!)
                      emitCallInvite({
                        caller_id: user.id,
                        caller_name: user.name || 'Yolcu',
                        receiver_id: driverId,
                        room_url: data.room_url,
                        room_name: data.room_name,
                        call_type: type,
                        tag_id: activeTag?.id || '',
                      });
                      
                      // 3. Outgoing call verilerini güncelle
                      setOutgoingCallData({
                        receiverName: driverName,
                        callType: type,
                        roomUrl: data.room_url,
                        roomName: data.room_name,
                        receiverId: driverId,
                      });
                      
                      // 4. Arayan'ın room bilgilerini kaydet (kabul edilince girecek)
                      setDailyRoomUrl(data.room_url);
                      setDailyRoomName(data.room_name);
                      setDailyCallType(type);
                      setPassengerDailyCallerId(user.id);
                      setPassengerDailyReceiverId(driverId);
                      setDailyCallerName(driverName);
                      
                    } catch (error) {
                      console.error('Arama başlatma hatası:', error);
                      setOutgoingCall(false);
                      setOutgoingCallData(null);
                      Alert.alert('Hata', 'Arama başlatılamadı');
                    }
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
                    try {
                      const response = await fetch(
                        `${API_URL}/trip/force-end?tag_id=${activeTag.id}&user_id=${user.id}`,
                        { method: 'POST' }
                      );
                      const data = await response.json();
                      if (data.success) {
                        Alert.alert('⚠️ Yolculuk Bitirildi', data.message);
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
                  onShowEndTripModal={() => setPassengerEndTripModalVisible(true)}
                />
                
                {/* 🆕 Chat Bubble - Yolcu → Sürücüye Yaz (PURE SOCKET - ANLIK) */}
                <ChatBubble
                  visible={passengerChatVisible}
                  onClose={() => setPassengerChatVisible(false)}
                  isDriver={false}
                  otherUserName={activeTag?.driver_name || 'Sürücü'}
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
                  otherUserName={activeTag?.driver_name || 'Sürücü'}
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

      {/* Hedef Seçme - TAM EKRAN MODAL */}
      <Modal
        visible={showDestinationPicker}
        animationType="slide"
        onRequestClose={() => setShowDestinationPicker(false)}
      >
        <SafeAreaView style={styles.destinationModalContainer}>
          {/* Üst Bar */}
          <View style={styles.destinationModalHeader}>
            <TouchableOpacity 
              onPress={() => setShowDestinationPicker(false)}
              style={styles.destinationModalBackBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.destinationModalTitle}>Nereye Gidiyorsunuz?</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {/* Seçilen Hedef Gösterimi */}
          {destination && (
            <View style={styles.selectedDestinationBox}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text style={styles.selectedDestinationText} numberOfLines={2}>
                {destination.address}
              </Text>
            </View>
          )}
          
          {/* Arama Bileşeni */}
          <View style={styles.destinationSearchContainer}>
            <PlacesAutocomplete
              placeholder="Mahalle, sokak veya mekan ara..."
              city={user?.city || ''}
              onPlaceSelected={(place) => {
                handleDestinationSelect(place.address, place.latitude, place.longitude);
              }}
            />
          </View>
          
          {/* Hızlı Seçim - Popüler Yerler */}
          <View style={styles.quickSelectContainer}>
            <Text style={styles.quickSelectTitle}>
              📍 {user?.city || 'Türkiye'} - Hızlı Seçim
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Şehre göre popüler yerler */}
              {(user?.city === 'Ankara' ? [
                { name: 'Kızılay Meydanı', lat: 39.9208, lng: 32.8541 },
                { name: 'Ulus', lat: 39.9420, lng: 32.8647 },
                { name: 'Çankaya', lat: 39.9032, lng: 32.8644 },
                { name: 'Keçiören', lat: 39.9981, lng: 32.8619 },
                { name: 'Yenimahalle', lat: 39.9647, lng: 32.8097 },
                { name: 'Mamak', lat: 39.9303, lng: 32.9122 },
                { name: 'Etimesgut', lat: 39.9456, lng: 32.6786 },
                { name: 'Batıkent', lat: 39.9684, lng: 32.7268 },
                { name: 'Eryaman', lat: 39.9647, lng: 32.6497 },
                { name: 'Dikmen', lat: 39.8889, lng: 32.8467 },
              ] : user?.city === 'İstanbul' ? [
                { name: 'Taksim Meydanı', lat: 41.0370, lng: 28.9850 },
                { name: 'Kadıköy', lat: 40.9927, lng: 29.0230 },
                { name: 'Beşiktaş', lat: 41.0422, lng: 29.0047 },
                { name: 'Şişli', lat: 41.0602, lng: 28.9877 },
                { name: 'Bakırköy', lat: 40.9819, lng: 28.8772 },
                { name: 'Ümraniye', lat: 41.0167, lng: 29.1167 },
                { name: 'Üsküdar', lat: 41.0250, lng: 29.0156 },
                { name: 'Fatih', lat: 41.0186, lng: 28.9397 },
                { name: 'Ataşehir', lat: 40.9833, lng: 29.1167 },
                { name: 'Maltepe', lat: 40.9333, lng: 29.1500 },
              ] : user?.city === 'İzmir' ? [
                { name: 'Konak', lat: 38.4189, lng: 27.1287 },
                { name: 'Alsancak', lat: 38.4361, lng: 27.1428 },
                { name: 'Karşıyaka', lat: 38.4561, lng: 27.1103 },
                { name: 'Bornova', lat: 38.4697, lng: 27.2172 },
                { name: 'Buca', lat: 38.3883, lng: 27.1756 },
                { name: 'Bayraklı', lat: 38.4639, lng: 27.1644 },
              ] : [
                { name: 'Merkez', lat: 39.9334, lng: 32.8597 },
              ]).map((place, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickSelectItem}
                  onPress={() => {
                    const fullAddress = `${place.name}, ${user?.city || 'Türkiye'}`;
                    handleDestinationSelect(fullAddress, place.lat, place.lng);
                  }}
                >
                  <View style={styles.quickSelectIcon}>
                    <Ionicons name="location" size={20} color="#3FA9F5" />
                  </View>
                  <Text style={styles.quickSelectText}>{place.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
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
            }
          }}
          onReject={() => {
            if (callScreenData) {
              socketRejectCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.remoteUserId,
                receiver_id: user.id
              });
            }
          }}
          onEnd={() => {
            if (callScreenData) {
              socketEndCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.mode === 'caller' ? user.id : callScreenData.remoteUserId,
                receiver_id: callScreenData.mode === 'caller' ? callScreenData.remoteUserId : user.id,
                ended_by: user.id
              });
            }
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
    </SafeAreaView>
  );
}

// ==================== DRIVER DASHBOARD ====================
interface DriverDashboardProps {
  user: User;
  logout: () => void;
  setScreen: (screen: 'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard' | 'forgot-password' | 'reset-pin') => void;
}

function DriverDashboard({ user, logout, setScreen }: DriverDashboardProps) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  
  // GPS & Map states
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{latitude: number; longitude: number} | null>(null);
  
  // Mesafe ve süre state'leri
  const [realDistance, setRealDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // ==================== DAILY.CO ARAMA SISTEMI - SOFOR ====================
  const [dailyCallActive, setDailyCallActive] = useState(false);
  const [dailyRoomUrl, setDailyRoomUrl] = useState<string | null>(null);
  const [dailyCallType, setDailyCallType] = useState<'video' | 'audio'>('audio');
  const [dailyCallerName, setDailyCallerName] = useState<string>('');
  const [dailyCallerId, setDailyCallerId] = useState<string>('');
  const [dailyReceiverId, setDailyReceiverId] = useState<string>('');  // 🆕 Added for proper termination
  const [incomingDailyCall, setIncomingDailyCall] = useState(false);
  const [dailyRoomName, setDailyRoomName] = useState<string>('');
  const [incomingCallTagId, setIncomingCallTagId] = useState<string>('');  // 🆕 Gelen arama tag_id
  
  // Giden Arama State (Araniyor...) - SOFOR
  const [outgoingCall, setOutgoingCall] = useState(false);
  const [outgoingCallData, setOutgoingCallData] = useState<{
    receiverName: string;
    callType: 'audio' | 'video';
    roomUrl: string;
    roomName: string;
    receiverId: string;
  } | null>(null);
  
  // 🆕 Chat State'leri (Sürücü)
  const [driverChatVisible, setDriverChatVisible] = useState(false);
  const [driverIncomingMessage, setDriverIncomingMessage] = useState<{ text: string; senderId: string; timestamp: number } | null>(null);
  
  // 🆕 End Trip Modal State'leri (Sürücü)
  const [driverEndTripModalVisible, setDriverEndTripModalVisible] = useState(false);
  const [driverForceEndConfirmVisible, setDriverForceEndConfirmVisible] = useState(false);
  
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
    socket: driverSocket,  // 🆕 Socket instance
    isConnected: socketConnected,
    isRegistered: socketRegistered,
    startCall: socketStartCall,
    acceptCall: socketAcceptCall,
    rejectCall: socketRejectCall,
    endCall: socketEndCall,
    // TAG & Teklif için yeni fonksiyonlar
    emitSendOffer: socketSendOffer,
    emitDriverLocationUpdate,  // 🆕 YENİ: Şoför konum güncelleme (RAM)
    // 🆕 Daily.co Call Signaling
    emitCallInvite,
    emitCallAccepted,
    emitCallRejected,
    // 🆕 YENİ: Sync Call Events
    emitCallAccept,
    emitCallReject,
    emitCallCancel,
    emitCallEnd,
    acceptDailyCall,
    rejectDailyCall,
    endDailyCall,
    // 🆕 Mesajlaşma
    emitSendMessage: driverEmitSendMessage,
  } = useSocket({
    userId: user?.id || null,
    userRole: 'driver',
    // 🆕 Daily.co Gelen Arama - ŞOFÖR (VİBRASYON + Accept/Reject)
    onIncomingDailyCall: (data) => {
      console.log('📹 ŞOFÖR - DAILY.CO GELEN ARAMA:', data);
      console.log('   room_url:', data.room_url);
      console.log('   room_name:', data.room_name);
      
      // Room URL ve name'i kaydet (arayan zaten oluşturdu)
      if (data.room_url) {
        setDailyRoomUrl(data.room_url);
        setDailyRoomName(data.room_name || '');
      }
      
      setDailyCallerId(data.caller_id);
      setDailyCallerName(data.caller_name || 'Yolcu');
      setDailyCallType(data.call_type || 'audio');
      setIncomingDailyCall(true);
      // tagId'yi de sakla
      setIncomingCallTagId(data.tag_id || '');
    },
    // 🆕 YENİ: call_accepted - HER İKİ TARAFA aynı anda geliyor!
    onCallAcceptedNew: (data) => {
      console.log('✅ ŞOFÖR - CALL_ACCEPTED (SYNC) - Daily odası hazır:', data);
      // Her iki taraf da bu eventi alıyor - Daily.co'ya gir
      setDailyRoomUrl(data.room_url);
      setDailyRoomName(data.room_name);
      setDailyCallType(data.call_type as 'audio' | 'video');
      // CRITICAL: Store caller/receiver IDs for proper termination
      setDailyCallerId(data.caller_id);
      setDailyReceiverId(data.receiver_id);
      // Arayan mı aranan mı?
      const isCaller = user?.id === data.caller_id;
      setDailyCallerName(isCaller ? 'Yolcu' : (dailyCallerName || 'Yolcu'));
      setDailyCallActive(true);
      // Reset states - navigation YOK
      setOutgoingCall(false);
      setOutgoingCallData(null);
      setIncomingDailyCall(false);
    },
    onDailyCallAccepted: (data) => {
      console.log('SOFOR - DAILY.CO ARAMA KABUL EDILDI (ESKİ):', data);
      // Eski event - artık onCallAcceptedNew kullanılıyor
    },
    onDailyCallRejected: (data) => {
      console.log('SOFOR - DAILY.CO ARAMA REDDEDILDI:', data);
      setOutgoingCall(false);
      setOutgoingCallData(null);
      setDailyCallActive(false);
      setIncomingDailyCall(false);
      setDailyRoomUrl(null);
      setDailyCallerId('');
      setDailyReceiverId('');
      Alert.alert('Bilgi', 'Arama reddedildi');
    },
    // 🆕 YENİ: call_cancelled - Arayan iptal etti
    onCallCancelled: (data) => {
      console.log('🚫 ŞOFÖR - ARAMA İPTAL EDİLDİ:', data);
      setIncomingDailyCall(false);
    },
    // 🆕 YENİ: call_ended - Görüşme bitti
    onCallEndedNew: (data) => {
      console.log('📴 ŞOFÖR - CALL_ENDED:', data);
      setDailyCallActive(false);
      setDailyRoomUrl(null);
      setDailyRoomName('');
      setDailyCallerId('');
      setDailyReceiverId('');
    },
    onDailyCallEnded: (data) => {
      console.log('📴 ŞOFÖR - DAILY.CO ARAMA BİTTİ:', data);
      setDailyCallActive(false);
      setIncomingDailyCall(false);
      setDailyRoomUrl(null);
    },
    // Eski Agora eventleri - artık kullanılmıyor
    onIncomingCall: (data) => {
      console.log('📞 ŞOFÖR - ESKİ GELEN ARAMA (Agora - devre dışı):', data);
      // Artık Daily.co kullanılıyor
    },
    onCallAccepted: (data) => {
      console.log('✅ ŞOFÖR - ESKİ ARAMA KABUL:', data);
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
      
      // Mesafe hesaplama fonksiyonu
      const calculateRouteForTag = async (tagData: any) => {
        try {
          // Şoför konumu al
          let driverLat = userLocation?.latitude;
          let driverLng = userLocation?.longitude;
          
          if (!driverLat || !driverLng) {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            driverLat = location.coords.latitude;
            driverLng = location.coords.longitude;
          }
          
          // OSRM ile şoförden yolcuya mesafe
          let distanceToPassenger = null;
          let timeToPassenger = null;
          if (driverLat && driverLng && tagData.pickup_lat && tagData.pickup_lng) {
            const response1 = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${tagData.pickup_lng},${tagData.pickup_lat}?overview=false`
            );
            const route1 = await response1.json();
            if (route1.code === 'Ok' && route1.routes?.[0]) {
              distanceToPassenger = (route1.routes[0].distance / 1000).toFixed(1);
              timeToPassenger = Math.round(route1.routes[0].duration / 60);
            }
          }
          
          // OSRM ile yolculuk mesafesi (pickup -> dropoff)
          let tripDistance = null;
          let tripDuration = null;
          if (tagData.pickup_lat && tagData.pickup_lng && tagData.dropoff_lat && tagData.dropoff_lng) {
            const response2 = await fetch(
              `https://router.project-osrm.org/route/v1/driving/${tagData.pickup_lng},${tagData.pickup_lat};${tagData.dropoff_lng},${tagData.dropoff_lat}?overview=false`
            );
            const route2 = await response2.json();
            if (route2.code === 'Ok' && route2.routes?.[0]) {
              tripDistance = (route2.routes[0].distance / 1000).toFixed(1);
              tripDuration = Math.round(route2.routes[0].duration / 60);
            }
          }
          
          return { distanceToPassenger, timeToPassenger, tripDistance, tripDuration };
        } catch (error) {
          console.log('Route calculation error:', error);
          return { distanceToPassenger: null, timeToPassenger: null, tripDistance: null, tripDuration: null };
        }
      };
      
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
        
        return [...filtered, {
          id: data.tag_id,
          request_id: data.request_id,  // 🔥 KRİTİK - ZORUNLU
          passenger_id: data.passenger_id,
          passenger_name: data.passenger_name,
          pickup_lat: data.pickup_lat,
          pickup_lng: data.pickup_lng,
          pickup_address: data.pickup_address || data.pickup_location,
          pickup_location: data.pickup_location || data.pickup_address,
          dropoff_lat: data.dropoff_lat,
          dropoff_lng: data.dropoff_lng,
          dropoff_address: data.dropoff_address || data.dropoff_location,
          dropoff_location: data.dropoff_location || data.dropoff_address,
          status: 'pending',
          created_at: new Date().toISOString(),
          // Mesafeler hesaplanıyor işareti
          distance_to_passenger_km: null,
          time_to_passenger_min: null,
          trip_distance_km: null,
          trip_duration_min: null,
        }];
      });
      
      // Mesafeleri arka planda hesapla ve güncelle
      const routes = await calculateRouteForTag(data);
      console.log('📍 Rota hesaplandı:', routes);
      
      setRequests(prev => prev.map(r => {
        if (r.id === data.tag_id) {
          return {
            ...r,
            distance_to_passenger_km: routes.distanceToPassenger ? parseFloat(routes.distanceToPassenger) : null,
            time_to_passenger_min: routes.timeToPassenger,
            trip_distance_km: routes.tripDistance ? parseFloat(routes.tripDistance) : null,
            trip_duration_min: routes.tripDuration,
          };
        }
        return r;
      }));
    },
    onTagCancelled: (data) => {
      console.log('🚫 ŞOFÖR - TAG İPTAL (Socket):', data);
      // TAG'i listeden ANINDA kaldır
      setRequests(prev => prev.filter(r => r.id !== data.tag_id && r.request_id !== data.request_id));
    },
    onTagMatched: (data) => {
      console.log('🤝 ŞOFÖR - TAG EŞLEŞTİ (Socket):', data);
      // 🔥 EŞLEŞTİĞİNDE TÜM LİSTEYİ TEMİZLE - Artık yeni teklif kabul edemez
      setRequests([]);
      // Active tag'ı yükle
      loadData();
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
    // 🆕 Mesajlaşma - PURE SOCKET (ANLIK)
    onNewMessage: (data) => {
      console.log('💬 ŞOFÖR - YENİ MESAJ GELDİ (ANLIK):', data);
      // Gelen mesajı ChatBubble'a ilet
      setDriverIncomingMessage({
        text: data.message,
        senderId: data.sender_id,
        timestamp: data.timestamp || Date.now(),
      });
      // Bildirim göster (chat kapalıysa)
      if (!driverChatVisible) {
        Alert.alert('💬 Yeni Mesaj', `${data.sender_name}: ${data.message}`);
      }
    },
  });
  
  // Karşılıklı iptal sistemi state'leri - ŞOFÖR
  const [showTripEndModal, setShowTripEndModal] = useState(false);
  const [tripEndRequesterType, setTripEndRequesterType] = useState<'passenger' | 'driver' | null>(null);
  
  // Animation
  const buttonPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    console.log('🔄 Sürücü polling başlatıldı');
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => {
      console.log('🔄 Sürücü polling durduruldu');
      clearInterval(interval);
    };
  }, [user?.id]);

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
    await Promise.all([loadActiveTag(), loadRequests()]);
  };

  const loadActiveTag = async () => {
    try {
      const response = await fetch(`${API_URL}/driver/active-tag?user_id=${user.id}`);
      const data = await response.json();
      if (data.success && data.tag) {
        setActiveTag(data.tag);
      } else {
        setActiveTag(null);
      }
    } catch (error) {
      console.error('TAG yüklenemedi:', error);
    }
  };

  const loadRequests = async () => {
    try {
      const response = await fetch(`${API_URL}/driver/requests?user_id=${user.id}`);
      const data = await response.json();
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Talepler yüklenemedi:', error);
    }
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
        driver_rating: user.rating || 5.0,
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
    setSelectedTagForOffer(tagId);
    setOfferPrice('');
    setOfferSent(false); // Reset
    setOfferSending(false); // Reset loading state
    setOfferModalVisible(true);
  };

  // Şoför için talebi 10 dakikalığına gizle (çarpı butonu)
  const handleDismissRequest = async (tagId: string) => {
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

  // 🆕 GELEN ARAMA EKRANI - ŞOFÖR (Vibration + Accept/Reject)
  if (incomingDailyCall) {
    return (
      <IncomingCallScreen
        callerName={dailyCallerName}
        callType={dailyCallType}
        onAccept={() => {
          console.log('📞 ŞOFÖR - ARAMAYI KABUL EDİYOR');
          console.log('   dailyRoomUrl:', dailyRoomUrl);
          console.log('   dailyCallerId:', dailyCallerId);
          
          if (!dailyRoomUrl) {
            Alert.alert('Hata', 'Room bilgisi bulunamadı');
            return;
          }
          
          // Arayan'a kabul edildiğini bildir (room_url ile!)
          acceptDailyCall({
            caller_id: dailyCallerId,
            receiver_id: user.id,
            room_url: dailyRoomUrl,
            room_name: dailyRoomName || '',
            call_type: dailyCallType
          });
          
          // Gelen arama ekranını kapat, Daily.co'ya gir
          setIncomingDailyCall(false);
          setDailyCallActive(true);
        }}
        onReject={() => {
          // 🆕 YENİ: call_reject kullan
          console.log('📞 ŞOFÖR - ARAMAYI REDDEDİYOR');
          emitCallReject({
            caller_id: dailyCallerId,
            receiver_id: user.id,
          });
          // Reset
          setIncomingDailyCall(false);
          setDailyRoomUrl(null);
          setDailyRoomName('');
        }}
      />
    );
  }

  // ARANIYOR EKRANI - SOFOR (Aranan kabul edene kadar bekle)
  if (outgoingCall && outgoingCallData) {
    return (
      <OutgoingCallScreen
        receiverName={outgoingCallData.receiverName}
        callType={outgoingCallData.callType}
        onCancel={() => {
          // 🆕 YENİ: call_cancel kullan
          console.log('📞 ŞOFÖR - ARAMAYI İPTAL EDİYOR');
          emitCallCancel({
            caller_id: user.id,
            receiver_id: outgoingCallData.receiverId,
          });
          setOutgoingCall(false);
          setOutgoingCallData(null);
        }}
      />
    );
  }

  // DAILY CALL SCREEN - SOFOR (Backend-driven termination)
  if (dailyCallActive && dailyRoomUrl && dailyRoomName) {
    return (
      <DailyCallScreen
        roomUrl={dailyRoomUrl}
        roomName={dailyRoomName}
        callType={dailyCallType}
        otherUserName={dailyCallerName}
        callerId={dailyCallerId}
        receiverId={dailyReceiverId}
        currentUserId={user?.id || ''}
        onCallEnd={(roomName) => {
          // Clear all local call state
          setDailyCallActive(false);
          setDailyRoomUrl(null);
          setDailyRoomName('');
          setDailyCallerId('');
          setDailyReceiverId('');
        }}
      />
    );
  }

  // 🆕 YENİ SÜRÜCÜ TEKLİF EKRANI - Tam sayfa bileşen, kendi SafeAreaView'ı var
  if (requests.length > 0 && !(activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress'))) {
    return (
      <DriverOfferScreen
        driverLocation={userLocation}
        requests={requests.map(req => ({
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
          distance_to_passenger_km: req.distance_to_passenger_km,
          trip_distance_km: req.trip_distance_km,
          time_to_passenger_min: req.time_to_passenger_min,
          trip_duration_min: req.trip_duration_min,
          notes: req.notes,
          created_at: req.created_at,
        }))}
        driverName={user.name}
        driverRating={user.rating || 5.0}
        onSendOffer={sendOfferInstant}
        onDismissRequest={handleDismissRequest}
        onBack={() => setScreen('role-select')}
        onLogout={logout}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Üst Header - Modern Mavi (Sadece Teklif Listesi Boşsa VE Eşleşme Yoksa Göster) */}
      {!(activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress')) && requests.length === 0 && (
        <View style={styles.modernHeader}>
          <TouchableOpacity onPress={() => setScreen('role-select')} style={styles.backButtonHeader}>
            <Ionicons name="chevron-back" size={24} color="#3FA9F5" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.modernHeaderTitle}>{user.name}</Text>
            <Text style={styles.modernHeaderSubtitle}>⭐ {user.rating || '5.0'}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutButtonHeader}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* CANLI HARİTA - Tam Ekran (Şoför) */}
      {activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
        <View style={styles.fullScreenMapContainer}>
          <LiveMapView
            userLocation={userLocation}
            otherLocation={passengerLocation || activeTag?.passenger_location || null}
            destinationLocation={activeTag?.dropoff_lat && activeTag?.dropoff_lng ? { latitude: activeTag.dropoff_lat, longitude: activeTag.dropoff_lng } : null}
            isDriver={true}
            userName={user.name}
            otherUserName={activeTag?.passenger_name || 'Yolcu'}
            otherUserId={activeTag?.passenger_id}
            price={activeTag?.final_price}
            routeInfo={activeTag?.route_info}
            onCall={async (type) => {
              // ════════════════════════════════════════════════════════════
              // FIXED CALL FLOW - Room ÖNCE oluştur, SONRA davet gönder - SOFOR
              // ════════════════════════════════════════════════════════════
              
              if (dailyCallActive || incomingDailyCall || outgoingCall) {
                Alert.alert('Uyari', 'Zaten bir arama devam ediyor');
                return;
              }
              
              if (!activeTag?.passenger_id || !user?.id) {
                Alert.alert('Hata', 'Yolcu bilgisi bulunamadi');
                return;
              }
              
              const passengerId = activeTag.passenger_id;
              const passengerName = activeTag.passenger_name || 'Yolcu';
              
              // "Aranıyor..." ekranını göster
              setOutgoingCallData({
                receiverName: passengerName,
                callType: type,
                roomUrl: '',
                roomName: '',
                receiverId: passengerId,
              });
              setOutgoingCall(true);
              
              try {
                // 1. Daily.co room oluştur
                console.log('📞 ŞOFÖR - Daily.co room oluşturuluyor...');
                const response = await fetch(`${API_URL}/calls/start`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    caller_id: user.id,
                    receiver_id: passengerId,
                    call_type: type,
                    tag_id: activeTag.id || ''
                  })
                });
                
                const data = await response.json();
                
                if (!data.success || !data.room_url) {
                  setOutgoingCall(false);
                  setOutgoingCallData(null);
                  Alert.alert('Hata', 'Arama başlatılamadı');
                  return;
                }
                
                console.log('📞 ŞOFÖR - Room hazır:', data.room_url);
                
                // 2. Socket ile karşı tarafa call_invite gönder (room_url ile birlikte!)
                emitCallInvite({
                  caller_id: user.id,
                  caller_name: user.name || 'Sofor',
                  receiver_id: passengerId,
                  room_url: data.room_url,
                  room_name: data.room_name,
                  call_type: type,
                  tag_id: activeTag.id || '',
                });
                
                // 3. Outgoing call verilerini güncelle
                setOutgoingCallData({
                  receiverName: passengerName,
                  callType: type,
                  roomUrl: data.room_url,
                  roomName: data.room_name,
                  receiverId: passengerId,
                });
                
                // 4. Arayan'ın room bilgilerini kaydet
                setDailyRoomUrl(data.room_url);
                setDailyRoomName(data.room_name);
                setDailyCallType(type);
                setDailyCallerId(user.id);
                setDailyReceiverId(passengerId);
                setDailyCallerName(passengerName);
                
              } catch (error) {
                console.error('Arama başlatma hatası:', error);
                setOutgoingCall(false);
                setOutgoingCallData(null);
                Alert.alert('Hata', 'Arama başlatılamadı');
              }
            }}
            onChat={() => {
              // 🆕 Chat aç - Sürücü → Yolcuya Yaz
              setDriverChatVisible(true);
            }}
            onForceEnd={async () => {
              try {
                const response = await fetch(
                  `${API_URL}/trip/force-end?tag_id=${activeTag.id}&user_id=${user.id}`,
                  { method: 'POST' }
                );
                const data = await response.json();
                if (data.success) {
                  Alert.alert('⚠️ Yolculuk Bitirildi', data.message);
                  setActiveTag(null);
                  setScreen('role-select');
                } else {
                  Alert.alert('Hata', data.detail);
                }
              } catch (error) {
                Alert.alert('Hata', 'İşlem başarısız');
              }
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
            otherUserName={activeTag?.passenger_name || 'Yolcu'}
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
            otherUserName={activeTag?.passenger_name || 'Yolcu'}
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
      ) : requests.length === 0 ? (
        <ScrollView style={styles.content}>
          <View style={styles.emptyState}>
            <Ionicons name="car-sport" size={80} color={COLORS.primary} />
            <Text style={styles.emptyStateText}>Henüz teklif yok</Text>
            <Text style={styles.emptyStateSubtext}>Yeni teklifler burada görünecek</Text>
          </View>
        </ScrollView>
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
            }
          }}
          onReject={() => {
            if (callScreenData) {
              socketRejectCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.remoteUserId,
                receiver_id: user.id
              });
            }
          }}
          onEnd={() => {
            if (callScreenData) {
              socketEndCall({
                call_id: callScreenData.callId,
                caller_id: callScreenData.mode === 'caller' ? user.id : callScreenData.remoteUserId,
                receiver_id: callScreenData.mode === 'caller' ? callScreenData.remoteUserId : user.id,
                ended_by: user.id
              });
            }
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
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    color: '#3FA9F5',
    letterSpacing: 0.5,
  },
  modernHeaderSubtitle: {
    fontSize: 13,
    color: '#888',
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
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
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
    backgroundColor: '#F7F9FB',
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
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#F0F8FF',
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
    backgroundColor: '#F7F9FB', // Çok açık gri arka plan
  },
  roleSelectionSafe: {
    flex: 1,
    paddingHorizontal: 20,
  },
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  roleHeaderSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  roleCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 20,
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
  destinationModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  destinationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  destinationModalBackBtn: {
    padding: 8,
  },
  destinationModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedDestinationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  selectedDestinationText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#065F46',
    fontWeight: '500',
  },
  destinationSearchContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  quickSelectContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  quickSelectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  quickSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickSelectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  quickSelectText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
});
