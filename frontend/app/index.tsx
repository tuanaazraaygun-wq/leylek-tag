import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, FlatList, Platform, Dimensions, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Logo from '../components/Logo';
import LiveMapView from '../components/LiveMapView';
import VideoCall from '../components/VideoCall';
import IncomingCall from '../components/IncomingCall';
import PlacesAutocomplete from '../components/PlacesAutocomplete';
import AdminPanel from '../components/AdminPanel';
import { LegalConsentModal, LegalPage, LocationWarningModal } from '../components/LegalPages';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

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
}

interface Tag {
  id: string;
  passenger_id: string;
  passenger_name: string;
  pickup_location: string;
  dropoff_location: string;
  notes?: string;
  status: string;
  driver_id?: string;
  driver_name?: string;
  final_price?: number;
  created_at: string;
  matched_at?: string;
  completed_at?: string;
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
  const [screen, setScreen] = useState<'login' | 'otp' | 'register' | 'set-pin' | 'enter-pin' | 'role-select' | 'dashboard'>('login');

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
  
  // KVKK checkbox state
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  
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

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && screen === 'dashboard') {
      requestLocationPermission().then(granted => {
        if (granted) {
          updateUserLocation();
          // Her 10 saniyede bir konum güncelle
          const interval = setInterval(updateUserLocation, 10000);
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
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Başarılı', 'OTP gönderildi. Test için: 123456');
        setScreen('otp');
      }
    } catch (error) {
      Alert.alert('Hata', 'OTP gönderilemedi');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Hata', 'OTP kodunu girin');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });

      const data = await response.json();
      if (data.success) {
        if (data.user_exists && data.user) {
          // Kayıtlı kullanıcı - PIN girişi
          if (data.user.pin_hash || hasPin) {
            await saveUser(data.user);
            setScreen('enter-pin');
          } else {
            // PIN yok - PIN oluşturması lazım
            await saveUser(data.user);
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
        Alert.alert('✅ Kayıt Başarılı', 'Hesabınız oluşturuldu!');
        setScreen('role-select'); // Kayıttan sonra rol seçimi
      } else {
        Alert.alert('Hata', data.detail || 'Kayıt oluşturulamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Kayıt oluşturulamadı');
    }
  };

  // ==================== RENDER SCREENS ====================
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
            <Logo size="large" showSlogan={false} />
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

            {/* KVKK Checkbox */}
            <TouchableOpacity 
              style={styles.kvkkContainer} 
              onPress={() => setKvkkAccepted(!kvkkAccepted)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, kvkkAccepted && styles.checkboxChecked]}>
                {kvkkAccepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>
              <Text style={styles.kvkkText}>
                Aydınlatma Metni ve KVKK'yı okudum, anladım, kabul ediyorum.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modernPrimaryButton, !kvkkAccepted && styles.buttonDisabled]} 
              onPress={handleSendOTP}
              disabled={!kvkkAccepted}
            >
              <Text style={styles.modernPrimaryButtonText}>DEVAM ET</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </ScrollView>
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

          {/* Hedef Seçme Modal */}
          <Modal
            visible={showDestinationPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDestinationPicker(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>🎯 Nereye Gitmek İstiyorsunuz?</Text>
                
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
                
                <Text style={[styles.popularTitle, { marginTop: 20 }]}>
                  {user?.city ? `${user.city} - Popüler Konumlar:` : 'Popüler Konumlar:'}
                </Text>
                <ScrollView style={styles.popularList}>
                  {[
                    { name: 'Taksim Meydanı, İstanbul', lat: 41.0370, lng: 28.9850 },
                    { name: 'Kadıköy İskele, İstanbul', lat: 40.9927, lng: 29.0230 },
                    { name: 'Kızılay, Ankara', lat: 39.9208, lng: 32.8541 },
                    { name: 'Ulus, Ankara', lat: 39.9420, lng: 32.8647 },
                    { name: 'Konak, İzmir', lat: 38.4189, lng: 27.1287 },
                    { name: 'Alsancak, İzmir', lat: 38.4361, lng: 27.1428 },
                  ].map((place, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.popularItem}
                      onPress={() => {
                        setDestination({
                          address: place.name,
                          latitude: place.lat,
                          longitude: place.lng
                        });
                        setShowDestinationPicker(false);
                      }}
                    >
                      <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.popularItemText}>{place.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowDestinationPicker(false)}
                >
                  <Text style={styles.modalCloseButtonText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
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
        // Önce kullanıcıyı kaydet
        const registerResponse = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            first_name: firstName,
            last_name: lastName,
            city: selectedCity,
            pin: pin
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
        const response = await fetch(`${API_URL}/auth/verify-pin?phone=${encodeURIComponent(phone)}&pin=${encodeURIComponent(pin)}`, {
          method: 'POST',
        });
        const data = await response.json();
        
        if (data.success) {
          setUser(data.user);
          saveUser(data.user);
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
        }
      } catch (error) {
        console.error('Role kaydedilemedi:', error);
        if (selectedRole && user) {
          const updatedUser = { ...user, role: selectedRole };
          setUser(updatedUser);
          setScreen('dashboard');
        }
      }
    };

    return (
      <View style={styles.roleSelectionContainer}>
        <SafeAreaView style={styles.roleSelectionSafe}>
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
        </SafeAreaView>
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

// ==================== TIKTOK TARZI TAM EKRAN TEKLİF KARTI ====================
function TikTokOfferCard({ 
  offer, 
  index, 
  total, 
  onAccept,
  isPassenger = true,
  driverArrivalMin = 0,
  tripDurationMin = 0
}: { 
  offer: any; 
  index: number; 
  total: number; 
  onAccept: () => void;
  isPassenger?: boolean;
  driverArrivalMin?: number;
  tripDurationMin?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Pulse animation for accept button
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
  }, []);

  // Hesapla: Şoförün yolcuya varış süresi ve yolculuk süresi
  const arrivalTime = driverArrivalMin || offer.estimated_arrival_min || Math.round((offer.distance_to_passenger_km || 5) / 40 * 60);
  const tripTime = tripDurationMin || offer.estimated_time || offer.trip_duration_min || Math.round((offer.trip_distance_km || 10) / 50 * 60);

  return (
    <View style={styles.tikTokCard}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.tikTokGradient}
      >
        {/* Üst Kısım - Sayfa Göstergesi */}
        <Animated.View style={[styles.tikTokHeader, { opacity: fadeAnim }]}>
          <View style={styles.tikTokPageIndicator}>
            <Text style={styles.tikTokPageText}>{index + 1} / {total}</Text>
          </View>
          
          {/* Profil */}
          <View style={styles.tikTokProfile}>
            <LinearGradient
              colors={['#3FA9F5', '#2563EB']}
              style={styles.tikTokAvatar}
            >
              <Text style={styles.tikTokAvatarText}>
                {isPassenger ? offer.driver_name?.charAt(0) : offer.passenger_name?.charAt(0) || '?'}
              </Text>
            </LinearGradient>
            
            <View style={styles.tikTokProfileInfo}>
              <Text style={styles.tikTokName}>
                {isPassenger ? offer.driver_name : offer.passenger_name}
              </Text>
              <View style={styles.tikTokRating}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.tikTokRatingText}>
                  {isPassenger ? (offer.driver_rating || 5.0).toFixed(1) : '5.0'}
                </Text>
                {offer.is_premium && (
                  <View style={styles.tikTokPremiumBadge}>
                    <Text style={styles.tikTokPremiumText}>⭐ VIP</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* YOLCU İÇİN: Varış ve Yolculuk Süreleri - BÜYÜK YAZILI */}
        {isPassenger && (
          <View style={styles.tikTokTimeCards}>
            {/* Şoför Varış Süresi */}
            <View style={styles.tikTokTimeCard}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.tikTokTimeGradient}
              >
                <Ionicons name="car-sport" size={32} color="#FFF" />
                <Text style={styles.tikTokTimeValue}>{arrivalTime} dk</Text>
                <Text style={styles.tikTokTimeLabel}>içinde geliyorum</Text>
              </LinearGradient>
            </View>
            
            {/* Yolculuk Süresi */}
            <View style={styles.tikTokTimeCard}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.tikTokTimeGradient}
              >
                <Ionicons name="navigate" size={32} color="#FFF" />
                <Text style={styles.tikTokTimeValue}>{tripTime} dk</Text>
                <Text style={styles.tikTokTimeLabel}>da gideriz</Text>
              </LinearGradient>
            </View>
          </View>
        )}

        {/* Orta Kısım - Fiyat */}
        <Animated.View style={[styles.tikTokPriceSection, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.tikTokPriceLabel}>
            {isPassenger ? 'Teklif Fiyatı' : 'Tahmini Ücret'}
          </Text>
          <Text style={styles.tikTokPrice}>₺{offer.price || offer.estimated_price || '?'}</Text>
          
          {/* Araç Bilgisi */}
          {isPassenger && offer.vehicle_model && (
            <View style={styles.tikTokVehicle}>
              <Ionicons name="car-sport" size={20} color="#60A5FA" />
              <Text style={styles.tikTokVehicleText}>
                {offer.vehicle_color} {offer.vehicle_model}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Lokasyon Bilgileri - Sadece Şoför İçin */}
        {!isPassenger && (
          <View style={styles.tikTokLocationCard}>
            <View style={styles.tikTokLocationRow}>
              <View style={styles.tikTokLocationDot} />
              <Text style={styles.tikTokLocationText} numberOfLines={1}>
                {offer.pickup_location}
              </Text>
            </View>
            <View style={styles.tikTokLocationLine} />
            <View style={styles.tikTokLocationRow}>
              <View style={[styles.tikTokLocationDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.tikTokLocationText} numberOfLines={1}>
                {offer.dropoff_location}
              </Text>
            </View>
          </View>
        )}

        {/* Not varsa */}
        {offer.notes && (
          <View style={styles.tikTokNotes}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#94A3B8" />
            <Text style={styles.tikTokNotesText}>"{offer.notes}"</Text>
          </View>
        )}

        {/* Alt Kısım - Aksiyon Butonları */}
        <View style={styles.tikTokActions}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.tikTokAcceptButton} onPress={onAccept}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.tikTokAcceptGradient}
              >
                <Ionicons name="checkmark-circle" size={28} color="#FFF" />
                <Text style={styles.tikTokAcceptText}>
                  {isPassenger ? 'HEMEN GEL!' : 'TEKLİF GÖNDER'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Alt İpucu */}
        <View style={styles.tikTokSwipeHint}>
          <Ionicons name="chevron-up" size={24} color="rgba(255,255,255,0.5)" />
          <Text style={styles.tikTokSwipeText}>
            {isPassenger ? 'Diğer teklifleri görmek için yukarı kaydır' : 'Diğer talepleri görmek için yukarı kaydır'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

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
  setScreen: (screen: string) => void;
}) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [showArrowHint, setShowArrowHint] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{latitude: number; longitude: number} | null>(null);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Mesafe ve süre state'leri
  const [realDistance, setRealDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // Arama state'leri (sesli ve görüntülü)
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [isCallCaller, setIsCallCaller] = useState(false); // BEN Mİ ARIYORUM?
  
  // Gelen arama state'leri
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{callerName: string, callType: 'audio' | 'video', channelName: string} | null>(null);
  
  // Karşılıklı iptal sistemi state'leri
  const [showTripEndModal, setShowTripEndModal] = useState(false);
  const [tripEndRequesterType, setTripEndRequesterType] = useState<'passenger' | 'driver' | null>(null);
  
  // Refs for polling (closure problem fix) - YOLCU
  const passengerCallStateRef = useRef({ showVoiceCall: false, showIncomingCall: false, isCallCaller: false });
  useEffect(() => {
    passengerCallStateRef.current = { showVoiceCall, showIncomingCall, isCallCaller };
  }, [showVoiceCall, showIncomingCall, isCallCaller]);
  
  // Gelen arama polling - YOLCU için
  useEffect(() => {
    // Başlangıç kontrolü
    if (!user?.id || !activeTag) return;
    if (activeTag.status !== 'matched' && activeTag.status !== 'in_progress') return;
    
    let isActive = true;
    
    const checkIncomingCall = async () => {
      // Güncel state'leri ref'ten oku (closure fix)
      const { showVoiceCall: inCall, showIncomingCall: hasIncoming, isCallCaller: isCaller } = passengerCallStateRef.current;
      
      // Aramadaysa veya ben arıyorsam polling yapma
      if (!isActive || inCall || isCaller) return;
      
      try {
        const response = await fetch(`${API_URL}/voice/check-incoming?user_id=${user.id}`);
        
        if (!isActive) return;
        if (!response.ok) return;
        
        const text = await response.text();
        if (!text || text.trim() === '') return;
        
        const data = JSON.parse(text);
        
        // ARAYAN KAPATTI MI KONTROLÜ - IncomingCall açıkken
        if (hasIncoming && data.success && data.call_cancelled) {
          console.log('📞 YOLCU - Arayan aramayı kapattı, modal kapatılıyor');
          setShowIncomingCall(false);
          setIncomingCallInfo(null);
          return;
        }
        
        // Gelen arama yoksa ve modal açıksa kapat (arayan vazgeçti)
        if (hasIncoming && data.success && !data.has_incoming && !data.call_cancelled) {
          console.log('📞 YOLCU - Arama artık yok, modal kapatılıyor');
          setShowIncomingCall(false);
          setIncomingCallInfo(null);
          return;
        }
        
        // Son kontrol - ref'ten güncel değerleri al
        const currentState = passengerCallStateRef.current;
        if (!isActive || currentState.showVoiceCall || currentState.showIncomingCall) return;
        
        if (data.success && data.has_incoming && data.call) {
          console.log('📞 YOLCU - GELEN ARAMA!', data.call.caller_name);
          setIncomingCallInfo({
            callerName: data.call.caller_name,
            callType: data.call.call_type || 'audio',
            channelName: data.call.channel_name
          });
          setShowIncomingCall(true);
        }
      } catch (error) {
        // Sessiz kal
      }
    };
    
    // İlk kontrolü hemen yap
    checkIncomingCall();
    // Sonra her 1.5 saniyede bir kontrol et (daha hızlı senkronizasyon)
    const interval = setInterval(checkIncomingCall, 1500);
    
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [user?.id, activeTag?.id, activeTag?.status]);
  
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

  // CANLI KONUM GÜNCELLEME - Eşleşince başla
  useEffect(() => {
    if (activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress')) {
      const interval = setInterval(async () => {
        try {
          // Sürücü konumunu backend'den al
          const response = await fetch(`${API_URL}/passenger/driver-location/${activeTag.driver_id}`);
          const data = await response.json();
          if (data.location) {
            setDriverLocation(data.location);
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
          console.log('Konum alınamadı:', error);
        }
      }, 5000); // 5 saniyede bir güncelle

      return () => clearInterval(interval);
    }
  }, [activeTag, userLocation]);

  // GELEN ARAMA KONTROLÜ - Polling (Yolcu için)
  useEffect(() => {
    if (activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress') && !showVoiceCall && !showIncomingCall) {
      const checkIncoming = async () => {
        try {
          const response = await fetch(`${API_URL}/voice/check-incoming?user_id=${user.id}`);
          
          if (!response.ok) return;
          
          const text = await response.text();
          if (!text || text.trim() === '') return;
          
          const data = JSON.parse(text);
          
          if (data.success && data.has_incoming && data.call) {
            console.log('📞 YOLCU - GELEN ARAMA!', data.call.caller_name);
            setIncomingCallInfo({
              callerName: data.call.caller_name,
              callType: data.call.call_type || 'audio',
              channelName: data.call.channel_name
            });
            setShowIncomingCall(true);
          }
        } catch (error) {
          if (!(error instanceof SyntaxError)) {
            console.log('Gelen arama kontrolü hatası:', error);
          }
        }
      };

      // İlk kontrolü hemen yap
      checkIncoming();
      // Sonra her 2 saniyede bir kontrol et
      const interval = setInterval(checkIncoming, 2000);
      return () => clearInterval(interval);
    }
  }, [activeTag, user.id, showVoiceCall, showIncomingCall]);

  // Karşılıklı iptal isteği polling - YOLCU için
  useEffect(() => {
    if (!user?.id || !activeTag) return;
    if (activeTag.status !== 'matched' && activeTag.status !== 'in_progress') return;
    
    const checkTripEndRequest = async () => {
      try {
        const response = await fetch(`${API_URL}/trip/check-end-request?tag_id=${activeTag.id}&user_id=${user.id}`);
        const data = await response.json();
        
        if (data.success && data.has_request && !showTripEndModal) {
          setTripEndRequesterType(data.request.requester_type);
          setShowTripEndModal(true);
        }
      } catch (error) {
        // Sessiz kal
      }
    };
    
    checkTripEndRequest();
    const interval = setInterval(checkTripEndRequest, 3000);
    return () => clearInterval(interval);
  }, [user?.id, activeTag?.id, activeTag?.status, showTripEndModal]);

  useEffect(() => {
    loadActiveTag();
    const interval = setInterval(loadActiveTag, 5000); // Her 5 saniyede bir kontrol et
    return () => clearInterval(interval);
  }, []);

  const loadActiveTag = async () => {
    try {
      const response = await fetch(`${API_URL}/passenger/active-tag?user_id=${user.id}`);
      const data = await response.json();
      if (data.success && data.tag) {
        setActiveTag(data.tag);
        if (data.tag.status === 'pending' || data.tag.status === 'offers_received') {
          loadOffers(data.tag.id);
        }
      } else {
        setActiveTag(null);
        setOffers([]);
      }
    } catch (error) {
      console.error('TAG yüklenemedi:', error);
    }
  };

  const loadOffers = async (tagId: string) => {
    try {
      const response = await fetch(`${API_URL}/passenger/offers/${tagId}?user_id=${user.id}`);
      const data = await response.json();
      if (data.success) {
        setOffers(data.offers);
      }
    } catch (error) {
      console.error('Teklifler yüklenemedi:', error);
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
    try {
      // GPS konumu varsa kullan, yoksa mock konum
      const pickupLat = userLocation?.latitude || 41.0082;
      const pickupLng = userLocation?.longitude || 28.9784;

      const response = await fetch(`${API_URL}/passenger/create-request?user_id=${user.id}`, {
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
      });

      const data = await response.json();
      if (data.success) {
        setActiveTag(data.tag);
        // Toast notification göster - otomatik kaybolur
        setToastMessage('Teklif isteği gönderildi ✓');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      } else {
        Alert.alert('Hata', data.detail || 'Teklif isteği gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Teklif isteği gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  // SESLİ ARAMA - Mock fonksiyon
  const handleVoiceCall = () => {
    setCalling(true);
    Alert.alert(
      '📞 Sesli Arama',
      'Sürücünüzle bağlantı kuruluyor...\n\n🔒 Uçtan uca şifreli arama\n📱 Gerçek numaralar gizli',
      [
        {
          text: 'Aramayı Sonlandır',
          onPress: () => {
            setCalling(false);
            Alert.alert('📞 Arama Sonlandırıldı', 'Arama başarıyla sonlandırıldı.');
          }
        }
      ]
    );
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!activeTag) return;

    const selectedOffer = offers.find(o => o.id === offerId);
    if (!selectedOffer) return;

    try {
      const response = await fetch(`${API_URL}/passenger/accept-offer?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: activeTag.id, offer_id: offerId })
      });

      const data = await response.json();
      if (data.success) {
        // Sadece sürücü adını kaydet, arama başlatma
        setSelectedDriverName(selectedOffer.driver_name);
        loadActiveTag();
        Alert.alert('Başarılı', 'Eşleşme sağlandı! Haritada konumları görebilirsiniz.');
      }
    } catch (error) {
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
                Alert.alert('✅ İptal Edildi', 'İsteğiniz başarıyla iptal edildi.');
                setActiveTag(null);
                setOffers([]);
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
          Alert.alert('✅ Güncellendi', 'Hedef adresiniz başarıyla güncellendi.');
          loadActiveTag(); // TAG'i yeniden yükle
        } else {
          Alert.alert('Hata', data.detail || 'Hedef güncellenemedi');
        }
      } catch (error) {
        Alert.alert('Hata', 'Hedef güncellenemedi');
      }
    }
  };

  // TEKLİFLER VARSA TAM EKRAN GÖS TER
  // TikTok tarzı tam ekran teklif listesi - YOLCU
  if (offers.length > 0 && activeTag && activeTag.status !== 'matched' && activeTag.status !== 'in_progress') {
    return (
      <View style={styles.tikTokContainer}>
        <FlatList
          data={offers}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={({ item, index }) => (
            <TikTokOfferCard
              offer={item}
              index={index}
              total={offers.length}
              onAccept={() => handleAcceptOffer(item.id)}
              isPassenger={true}
            />
          )}
          pagingEnabled={true}
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          bounces={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
            setCurrentOfferIndex(index);
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
      
      {/* Üst Header - Modern Mavi */}
      {!(activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress')) && (
        <View style={styles.modernHeader}>
          <TouchableOpacity onPress={() => setScreen('role-select')} style={styles.backButtonHeader}>
            <Ionicons name="chevron-back" size={24} color="#3FA9F5" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.modernHeaderTitle}>{user.name}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutButtonHeader}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        {!activeTag ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.welcomeTitleSky}>Hoş Geldiniz</Text>
            <Text style={styles.welcomeSubtitle}>Nereye gitmek istiyorsunuz?</Text>
            
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
                <Text style={styles.destinationConfirm}>Hedef belirlendi</Text>
              </View>
            )}
            
            <AnimatedPulseButton 
              onPress={handleCallButton} 
              loading={loading}
            />
          </View>
        ) : activeTag.status === 'matched' || activeTag.status === 'in_progress' ? null : (
          <View style={styles.waitingOffersContainer}>
            {/* Animated Waiting Icon */}
            <View style={styles.waitingIconContainer}>
              <Animated.View>
                <LinearGradient
                  colors={['#3FA9F5', '#2196F3', '#1976D2']}
                  style={styles.waitingIconGradient}
                >
                  {activeTag.status === 'pending' ? (
                    <ActivityIndicator size="large" color="#FFF" />
                  ) : (
                    <Ionicons name="mail-open" size={40} color="#FFF" />
                  )}
                </LinearGradient>
              </Animated.View>
            </View>
            
            {/* Status Text */}
            <Text style={styles.waitingTitle}>
              {activeTag.status === 'pending' ? 'Teklifler Bekleniyor' : 'Teklifler Alındı!'}
            </Text>
            <Text style={styles.waitingSubtitle}>
              {activeTag.status === 'pending' 
                ? 'Yakındaki sürücüler tekliflerini hazırlıyor...' 
                : `${offers.length} teklif geldi! Yukarı kaydırarak görüntüleyin.`
              }
            </Text>
            
            {/* Route Info Card */}
            <View style={styles.waitingRouteCard}>
              <View style={styles.waitingRouteRow}>
                <View style={styles.waitingRouteDot} />
                <View style={styles.waitingRouteTextContainer}>
                  <Text style={styles.waitingRouteLabel}>Nereden</Text>
                  <Text style={styles.waitingRouteText} numberOfLines={1}>{activeTag.pickup_location}</Text>
                </View>
              </View>
              
              <View style={styles.waitingRouteLine} />
              
              <View style={styles.waitingRouteRow}>
                <View style={[styles.waitingRouteDot, { backgroundColor: '#EF4444' }]} />
                <View style={styles.waitingRouteTextContainer}>
                  <Text style={styles.waitingRouteLabel}>Nereye</Text>
                  <Text style={styles.waitingRouteText} numberOfLines={1}>{activeTag.dropoff_location}</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            {(activeTag.status === 'pending' || activeTag.status === 'offers_received') && (
              <View style={styles.waitingActionsContainer}>
                <TouchableOpacity
                  style={styles.waitingEditButton}
                  onPress={() => setShowDestinationPicker(true)}
                >
                  <Ionicons name="create-outline" size={20} color="#3FA9F5" />
                  <Text style={styles.waitingEditButtonText}>Hedefi Düzenle</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.waitingCancelButton}
                  onPress={handleCancelTag}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                  <Text style={styles.waitingCancelButtonText}>İptal Et</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

            {/* CANLI HARİTA - Tam Ekran (Yolcu) */}
            {activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
              <View style={styles.fullScreenMapContainer}>
                <LiveMapView
                  userLocation={userLocation}
                  otherLocation={driverLocation || activeTag?.driver_location}
                  isDriver={false}
                  userName={user.name}
                  otherUserName={activeTag?.driver_name || 'Şoför'}
                  otherUserId={activeTag?.driver_id}
                  price={activeTag?.final_price}
                  routeInfo={activeTag?.route_info}
                  onCall={async (type) => {
                    const driverName = activeTag?.driver_name || 'Sürücü';
                    try {
                      const response = await fetch(`${API_URL}/voice/start-call`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          tag_id: activeTag?.id,
                          caller_id: user.id,
                          caller_name: user.name,
                          call_type: type
                        })
                      });
                      const data = await response.json();
                      if (!data.success) {
                        Alert.alert('Arama Başlatılamadı', data.detail || 'Lütfen tekrar deneyin');
                        return;
                      }
                    } catch (error) {
                      console.error('Arama bildirimi hatası:', error);
                      Alert.alert('Hata', 'Arama başlatılamadı');
                      return;
                    }
                    setSelectedDriverName(driverName);
                    setIsVideoCall(type === 'video');
                    setIsCallCaller(true); // BEN ARIYORUM
                    setShowVoiceCall(true);
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
                                Alert.alert('Başarılı', 'Yolculuk tamamlandı!');
                                setActiveTag(null);
                                loadActiveTag();
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
                        { text: 'Diğer', onPress: () => reportUser('other') },
                      ]
                    );
                    
                    async function reportUser(reason: string) {
                      try {
                        const response = await fetch(
                          `${API_URL}/user/report?user_id=${user.id}&reported_user_id=${activeTag?.driver_id}&reason=${reason}`,
                          { method: 'POST' }
                        );
                        const data = await response.json();
                        Alert.alert('📩 Şikayet Alındı', data.message);
                      } catch (error) {
                        Alert.alert('Hata', 'Şikayet gönderilemedi');
                      }
                    }
                  }}
                />
              </View>
            ) : null}
      </ScrollView>

      {/* Hedef Seçme Modal - PassengerDashboard içinde */}
      <Modal
        visible={showDestinationPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDestinationPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎯 Nereye Gitmek İstiyorsunuz?</Text>
            
            <PlacesAutocomplete
              placeholder="Adres, sokak veya mekan ara..."
              city={user?.city || ''}
              onPlaceSelected={(place) => {
                handleDestinationSelect(place.address, place.latitude, place.longitude);
              }}
            />
            
            <Text style={[styles.popularTitle, { marginTop: 20 }]}>
              {user?.city ? `${user.city} - Popüler Konumlar:` : 'Popüler Konumlar:'}
            </Text>
            <ScrollView style={styles.popularList}>
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
                  style={styles.popularItem}
                  onPress={() => {
                    handleDestinationSelect(place.name, place.lat, place.lng);
                  }}
                >
                  <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.popularItemText}>{place.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDestinationPicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Gelen Arama Modal */}
      <IncomingCall
        visible={showIncomingCall && !showVoiceCall}
        callerName={incomingCallInfo?.callerName || 'Arayan'}
        callType={incomingCallInfo?.callType || 'audio'}
        onAccept={async () => {
          setShowIncomingCall(false);
          setSelectedDriverName(incomingCallInfo?.callerName || 'Arayan');
          setIsVideoCall(incomingCallInfo?.callType === 'video');
          setIsCallCaller(false); // GELEN ARAMAYI KABUL ETTİM
          // Backend'e kabul bildirimi gönder
          try {
            await fetch(`${API_URL}/voice/answer-call?tag_id=${activeTag?.id}&user_id=${user.id}`, { method: 'POST' });
          } catch (e) {}
          setShowVoiceCall(true);
        }}
        onReject={async () => {
          setShowIncomingCall(false);
          setIncomingCallInfo(null);
          // Backend'e reddetme bildirimi gönder
          try {
            await fetch(`${API_URL}/voice/reject-call?tag_id=${activeTag?.id}&user_id=${user.id}`, { method: 'POST' });
          } catch (e) {}
        }}
      />

      {/* Sesli/Görüntülü Arama Modal */}
      {activeTag && (
        <VideoCall
          visible={showVoiceCall}
          remoteUserName={selectedDriverName}
          channelName={activeTag.id}
          userId={user.id}
          isVideoCall={isVideoCall}
          isCaller={isCallCaller}
          onEnd={() => {
            setShowVoiceCall(false);
            setIsVideoCall(false);
            setIsCallCaller(false);
          }}
          onRejected={() => {
            setShowVoiceCall(false);
            setIsVideoCall(false);
            setIsCallCaller(false);
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
                      loadActiveTag();
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
  setScreen: (screen: string) => void;
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
  
  // Arama state'leri (sesli ve görüntülü)
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [selectedPassengerName, setSelectedPassengerName] = useState('');
  const [isCallCaller, setIsCallCaller] = useState(false); // BEN Mİ ARIYORUM?
  
  // Gelen arama state'leri
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{callerName: string, callType: 'audio' | 'video', channelName: string} | null>(null);
  
  // Karşılıklı iptal sistemi state'leri - ŞOFÖR
  const [showTripEndModal, setShowTripEndModal] = useState(false);
  const [tripEndRequesterType, setTripEndRequesterType] = useState<'passenger' | 'driver' | null>(null);
  
  // Refs for polling (closure problem fix)
  const callStateRef = useRef({ showVoiceCall: false, showIncomingCall: false, isCallCaller: false });
  useEffect(() => {
    callStateRef.current = { showVoiceCall, showIncomingCall, isCallCaller };
  }, [showVoiceCall, showIncomingCall, isCallCaller]);
  
  // Animation
  const buttonPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Gelen arama polling - Şoför için
  useEffect(() => {
    // Başlangıç kontrolü
    if (!user?.id || !activeTag) return;
    if (activeTag.status !== 'matched' && activeTag.status !== 'in_progress') return;
    
    let isActive = true;
    
    const checkIncomingCall = async () => {
      // Güncel state'leri ref'ten oku (closure fix)
      const { showVoiceCall: inCall, showIncomingCall: hasIncoming, isCallCaller: isCaller } = callStateRef.current;
      
      // Aramadaysa veya ben arıyorsam polling yapma
      if (!isActive || inCall || isCaller) return;
      
      try {
        const response = await fetch(`${API_URL}/voice/check-incoming?user_id=${user.id}`);
        
        if (!isActive) return;
        if (!response.ok) return;
        
        const text = await response.text();
        if (!text || text.trim() === '') return;
        
        const data = JSON.parse(text);
        
        // ARAYAN KAPATTI MI KONTROLÜ - IncomingCall açıkken
        if (hasIncoming && data.success && data.call_cancelled) {
          console.log('📞 ŞOFÖR - Arayan aramayı kapattı, modal kapatılıyor');
          setShowIncomingCall(false);
          setIncomingCallInfo(null);
          return;
        }
        
        // Gelen arama yoksa ve modal açıksa kapat (arayan vazgeçti)
        if (hasIncoming && data.success && !data.has_incoming && !data.call_cancelled) {
          console.log('📞 ŞOFÖR - Arama artık yok, modal kapatılıyor');
          setShowIncomingCall(false);
          setIncomingCallInfo(null);
          return;
        }
        
        // Son kontrol - ref'ten güncel değerleri al
        const currentState = callStateRef.current;
        if (!isActive || currentState.showVoiceCall || currentState.showIncomingCall) return;
        
        if (data.success && data.has_incoming && data.call) {
          console.log('📞 ŞOFÖR - GELEN ARAMA!', data.call.caller_name);
          setIncomingCallInfo({
            callerName: data.call.caller_name,
            callType: data.call.call_type || 'audio',
            channelName: data.call.channel_name
          });
          setShowIncomingCall(true);
        }
      } catch (error) {
        // Sessiz kal
      }
    };
    
    // İlk kontrolü hemen yap
    checkIncomingCall();
    // Sonra her 1.5 saniyede bir kontrol et (daha hızlı senkronizasyon)
    const interval = setInterval(checkIncomingCall, 1500);
    
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [user?.id, activeTag?.id, activeTag?.status]);

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
        
        if (data.success && data.has_request && !showTripEndModal) {
          setTripEndRequesterType(data.request.requester_type);
          setShowTripEndModal(true);
        }
      } catch (error) {
        // Sessiz kal
      }
    };
    
    checkTripEndRequest();
    const interval = setInterval(checkTripEndRequest, 3000);
    return () => clearInterval(interval);
  }, [user?.id, activeTag?.id, activeTag?.status, showTripEndModal]);

  // GPS konum güncellemesi
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
          
          // Backend'e gönder
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
  }, [user.id]);

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
  const [selectedTagForOffer, setSelectedTagForOffer] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState('');

  const handleSendOffer = (tagId: string) => {
    setSelectedTagForOffer(tagId);
    setOfferPrice('');
    setOfferModalVisible(true);
  };

  const submitOffer = async () => {
    if (!offerPrice || isNaN(Number(offerPrice))) {
      Alert.alert('Hata', 'Geçerli bir fiyat girin');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/driver/send-offer?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: selectedTagForOffer,
          price: Number(offerPrice),
          estimated_time: 15,
          notes: 'Hemen geliyorum!'
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Teklifiniz gönderildi');
        setOfferModalVisible(false);
        loadRequests();
      } else {
        Alert.alert('Hata', data.detail || 'Teklif gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Teklif gönderilemedi');
    }
  };

  const handleStartTag = async () => {
    if (!activeTag) return;

    try {
      const response = await fetch(`${API_URL}/driver/start-tag/${activeTag.id}?user_id=${user.id}`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Yolculuk başlatıldı');
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
                Alert.alert('Başarılı', 'Yolculuk tamamlandı');
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
            Alert.alert('📞 Arama Sonlandırıldı', 'Arama başarıyla sonlandırıldı.');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Üst Header - Modern Mavi (Sadece Matched Değilse Göster) */}
      {!(activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress')) && (
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

      <>
      {/* CANLI HARİTA - Tam Ekran (Şoför) */}
      {activeTag && (activeTag.status === 'matched' || activeTag.status === 'in_progress') ? (
        <View style={styles.fullScreenMapContainer}>
          <LiveMapView
            userLocation={userLocation}
            otherLocation={passengerLocation || activeTag?.passenger_location}
            isDriver={true}
            userName={user.name}
            otherUserName={activeTag?.passenger_name || 'Yolcu'}
            otherUserId={activeTag?.passenger_id}
            price={activeTag?.final_price}
            routeInfo={activeTag?.route_info}
            onCall={async (type) => {
              const passengerName = activeTag.passenger_name || 'Yolcu';
              try {
                const response = await fetch(`${API_URL}/voice/start-call`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tag_id: activeTag.id,
                    caller_id: user.id,
                    caller_name: user.name,
                    call_type: type
                  })
                });
                const data = await response.json();
                if (!data.success) {
                  Alert.alert('Arama Başlatılamadı', data.detail || 'Lütfen tekrar deneyin');
                  return;
                }
              } catch (error) {
                console.error('Arama bildirimi hatası:', error);
                Alert.alert('Hata', 'Arama başlatılamadı');
                return;
              }
              setSelectedPassengerName(passengerName);
              setIsVideoCall(type === 'video');
              setIsCallCaller(true); // BEN ARIYORUM
              setShowVoiceCall(true);
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
                          Alert.alert('Başarılı', 'Yolculuk tamamlandı');
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
                  { text: 'Diğer', onPress: () => reportPassenger('other') },
                ]
              );
              
              async function reportPassenger(reason: string) {
                try {
                  const response = await fetch(
                    `${API_URL}/user/report?user_id=${user.id}&reported_user_id=${activeTag?.passenger_id}&reason=${reason}`,
                    { method: 'POST' }
                  );
                  const data = await response.json();
                  Alert.alert('📩 Şikayet Alındı', data.message);
                } catch (error) {
                  Alert.alert('Hata', 'Şikayet gönderilemedi');
                }
              }
            }}
          />
        </View>
      ) : requests.length > 0 ? (
        // TİKTOK TARZI TAM EKRAN TALEP LİSTESİ - ŞOFÖR
        <View style={styles.tikTokContainer}>
          <FlatList
            data={requests}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={({ item, index }) => {
              // Mesafe ve süre hesaplama
              const distanceToPassenger = item.distance_to_passenger_km || 0;
              const timeToPassenger = Math.round((distanceToPassenger / 40) * 60);
              const tripDistance = item.trip_distance_km || 0;
              const tripTime = Math.round((tripDistance / 50) * 60);
              
              return (
                <TikTokOfferCard
                  offer={{
                    ...item,
                    estimated_arrival_min: timeToPassenger,
                    trip_duration_min: tripTime
                  }}
                  index={index}
                  total={requests.length}
                  onAccept={() => handleSendOffer(item.id)}
                  isPassenger={false}
                  driverArrivalMin={timeToPassenger}
                  tripDurationMin={tripTime}
                />
              );
            }}
            pagingEnabled={true}
            showsVerticalScrollIndicator={false}
            snapToInterval={SCREEN_HEIGHT}
            decelerationRate="fast"
            bounces={false}
          />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.emptyState}>
            <Ionicons name="car-sport" size={80} color={COLORS.primary} />
            <Text style={styles.emptyStateText}>Henüz teklif yok</Text>
            <Text style={styles.emptyStateSubtext}>Yeni teklifler burada görünecek</Text>
          </View>
        </ScrollView>
      )}

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
                style={styles.modernSubmitButton}
                onPress={submitOffer}
              >
                <LinearGradient
                  colors={['#3FA9F5', '#2563EB']}
                  style={styles.submitButtonGradient}
                >
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.modernSubmitButtonText}>Gönder</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Gelen Arama Modal - Şoför */}
      <IncomingCall
        visible={showIncomingCall && !showVoiceCall}
        callerName={incomingCallInfo?.callerName || 'Yolcu'}
        callType={incomingCallInfo?.callType || 'audio'}
        onAccept={async () => {
          setShowIncomingCall(false);
          setSelectedPassengerName(incomingCallInfo?.callerName || 'Yolcu');
          setIsVideoCall(incomingCallInfo?.callType === 'video');
          setIsCallCaller(false); // GELEN ARAMAYI KABUL ETTİM
          // Backend'e kabul bildirimi gönder
          try {
            await fetch(`${API_URL}/voice/answer-call?tag_id=${activeTag?.id}&user_id=${user.id}`, { method: 'POST' });
          } catch (e) {}
          setShowVoiceCall(true);
        }}
        onReject={async () => {
          setShowIncomingCall(false);
          setIncomingCallInfo(null);
          try {
            await fetch(`${API_URL}/voice/reject-call?tag_id=${activeTag?.id}&user_id=${user.id}`, { method: 'POST' });
          } catch (e) {}
        }}
      />

      {/* Sesli/Görüntülü Arama Modal */}
      {activeTag && (
        <VideoCall
          visible={showVoiceCall}
          remoteUserName={selectedPassengerName}
          channelName={activeTag.id}
          userId={user.id}
          isVideoCall={isVideoCall}
          isCaller={isCallCaller}
          onEnd={() => {
            setShowVoiceCall(false);
            setIsVideoCall(false);
            setIsCallCaller(false);
          }}
          onRejected={() => {
            setShowVoiceCall(false);
            setIsVideoCall(false);
            setIsCallCaller(false);
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
                      loadRequests();
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
      </>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
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
  roleHeader: {
    alignItems: 'center',
    paddingTop: 40,
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
});
