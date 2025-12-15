import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, FlatList, Platform, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Logo from '../components/Logo';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

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
  const [screen, setScreen] = useState<'login' | 'otp' | 'register' | 'role-select' | 'dashboard'>('login');

  // Auth states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  
  // Role Selection (Dinamik - Her girişte seçilir)
  const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver' | null>(null);
  
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
      if (userData) {
        setUser(JSON.parse(userData));
        setScreen('role-select'); // Her girişte rol seçimi
      }
    } catch (error) {
      console.error('Kullanıcı yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
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
          await saveUser(data.user);
          setScreen('role-select'); // Her girişte rol seçimi
        } else {
          setScreen('register'); // Yeni kullanıcı
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
        <ActivityIndicator size="large" color="#00A67E" />
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Logo size="large" showSlogan={true} />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Telefon Numarası</Text>
            <TextInput
              style={styles.input}
              placeholder="5XX XXX XX XX"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={11}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSendOTP}>
              <Text style={styles.primaryButtonText}>OTP Gönder</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'otp') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={60} color="#00A67E" />
            <Text style={styles.logoText}>Doğrulama</Text>
            <Text style={styles.subtitle}>{phone} numarasına gönderilen kodu girin</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>OTP Kodu</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOTP}>
              <Text style={styles.primaryButtonText}>Doğrula</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen('login')}>
              <Text style={styles.secondaryButtonText}>Geri Dön</Text>
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="person-add" size={60} color="#00A67E" />
            <Text style={styles.logoText}>Kayıt Ol</Text>
            <Text style={styles.subtitle}>Hesabınızı oluşturun</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Adınız</Text>
            <TextInput
              style={styles.input}
              placeholder="Adınızı girin"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>Şehir</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowCityPicker(true)}
            >
              <Text style={selectedCity ? styles.inputText : styles.placeholderText}>
                {selectedCity || 'Şehir seçin'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 20, textAlign: 'center', fontSize: 14, color: '#666' }]}>
              📍 Telefon: {phone}
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
              <Text style={styles.primaryButtonText}>Kayıt Ol</Text>
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
                      {selectedCity === item && <Ionicons name="checkmark" size={24} color="#00A67E" />}
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={styles.modalCloseButton}
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
                
                <TextInput
                  style={styles.searchInput}
                  placeholder="Adres ara... (örn: Taksim, İstanbul)"
                  placeholderTextColor="#999"
                  autoFocus={true}
                  onSubmitEditing={(e) => {
                    const address = e.nativeEvent.text;
                    if (address) {
                      // Mock koordinatlar (şimdilik)
                      setDestination({
                        address: address,
                        latitude: 41.0082 + Math.random() * 0.1,
                        longitude: 28.9784 + Math.random() * 0.1
                      });
                      setShowDestinationPicker(false);
                    }
                  }}
                />
                
                <Text style={styles.popularTitle}>Popüler Konumlar:</Text>
                <ScrollView style={styles.popularList}>
                  {[
                    'Taksim Meydanı, İstanbul',
                    'Kadıköy İskele, İstanbul',
                    'Atatürk Havalimanı',
                    'Sabiha Gökçen Havalimanı',
                    'Kızılay, Ankara',
                    'Konak, İzmir'
                  ].map((place, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.popularItem}
                      onPress={() => {
                        setDestination({
                          address: place,
                          latitude: 41.0082 + Math.random() * 0.1,
                          longitude: 28.9784 + Math.random() * 0.1
                        });
                        setShowDestinationPicker(false);
                      }}
                    >
                      <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.popularItemText}>{place}</Text>
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

  // Role Selection Screen - Her girişte gösterilir
  if (screen === 'role-select') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="person-circle" size={60} color="#00A67E" />
            <Text style={styles.logoText}>Rol Seçimi</Text>
            <Text style={styles.subtitle}>Bugün nasıl kullanmak istiyorsunuz?</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={[styles.label, { textAlign: 'center', marginBottom: 30 }]}>
              Hoş geldiniz {user?.name}! Rolünüzü seçin:
            </Text>
            
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'passenger' && styles.roleButtonActive
                ]}
                onPress={() => setSelectedRole('passenger')}
              >
                <Ionicons
                  name="person"
                  size={40}
                  color={selectedRole === 'passenger' ? '#FFF' : '#00A67E'}
                />
                <Text
                  style={[
                    styles.roleButtonText,
                    selectedRole === 'passenger' && styles.roleButtonTextActive
                  ]}
                >
                  Yolcu
                </Text>
                <Text style={styles.roleDescription}>
                  Yolculuk talep et
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'driver' && styles.roleButtonActive
                ]}
                onPress={() => setSelectedRole('driver')}
              >
                <Ionicons
                  name="car"
                  size={40}
                  color={selectedRole === 'driver' ? '#FFF' : '#00A67E'}
                />
                <Text
                  style={[
                    styles.roleButtonText,
                    selectedRole === 'driver' && styles.roleButtonTextActive
                  ]}
                >
                  Sürücü
                </Text>
                <Text style={styles.roleDescription}>
                  Yolcu taşı
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, !selectedRole && { opacity: 0.5 }]} 
              onPress={() => {
                if (selectedRole && user) {
                  // Kullanıcının rolünü güncelle
                  const updatedUser = { ...user, role: selectedRole };
                  setUser(updatedUser);
                  setScreen('dashboard');
                }
              }}
              disabled={!selectedRole}
            >
              <Text style={styles.primaryButtonText}>Devam Et</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={logout}>
              <Text style={styles.secondaryButtonText}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
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
      />
    ) : (
      <DriverDashboard user={user} logout={logout} />
    );
  }

  return null;
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

  useEffect(() => {
    // Araç yukarı aşağı hareket
    Animated.loop(
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
    ).start();

    // Buton nefes alma
    Animated.loop(
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
    ).start();
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
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fullScreenGradient}
        >
          {/* Sol Üst: Sayfa Göstergesi */}
          <View style={styles.pageIndicatorLeft}>
            <Text style={styles.pageIndicatorText}>{currentIndex + 1} / {totalOffers}</Text>
          </View>

          {/* Sağ Üst: Şoför Profili */}
          <View style={styles.driverProfileRight}>
            <View style={styles.driverAvatarSmall}>
              <Text style={styles.driverAvatarSmallText}>
                {offer.driver_name?.charAt(0) || '?'}
              </Text>
            </View>
            <Text style={styles.driverNameSmall}>{offer.driver_name}</Text>
            <Text style={styles.driverRatingSmall}>⭐ {offer.driver_rating}</Text>
          </View>

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

          {/* Mesaj */}
          <View style={styles.messageSection}>
            <Text style={styles.messageText}>
              📍 {offer.estimated_time || 5} dakikada gelirim
            </Text>
            <Text style={styles.messageText}>
              🚗 {Math.round((offer.estimated_time || 5) * 3)} dakikada gideriz
            </Text>
          </View>

          {/* Fiyat */}
          <View style={styles.priceSection}>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabelLarge}>Teklif Fiyatım</Text>
              <Text style={styles.priceLarge}>₺{offer.price}</Text>
            </View>

            {/* HEMEN GEL Butonu - Nefes Alır */}
            <Animated.View style={{ transform: [{ scale: buttonPulse }] }}>
              <TouchableOpacity 
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.acceptButtonGradient}
                >
                  <Text style={styles.acceptButtonText}>HEMEN GEL</Text>
                  <Ionicons name="checkmark-circle" size={32} color="#FFF" />
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
        </LinearGradient>
      </View>
  );
}

// ==================== SIMPLE PULSE BUTTON ====================
function AnimatedPulseButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    // Basit scale animasyonu
    Animated.loop(
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
    ).start();

    // Opacity animasyonu
    Animated.loop(
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
    ).start();
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
              <Text style={styles.callButtonText}>ÇAĞRI</Text>
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
  setShowDestinationPicker
}: { 
  user: User; 
  logout: () => void;
  destination: any;
  setDestination: any;
  userLocation: any;
  showDestinationPicker: boolean;
  setShowDestinationPicker: (show: boolean) => void;
}) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);

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
        Alert.alert('✅ Çağrı Gönderildi', `Yakındaki sürücüler "${destination.address}" için tekliflerini gönderiyor...`);
      } else {
        Alert.alert('Hata', data.detail || 'Çağrı gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Çağrı gönderilemedi');
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

    Alert.alert(
      'Teklifi Kabul Et',
      'Bu teklifi kabul etmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kabul Et',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/passenger/accept-offer?user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: activeTag.id, offer_id: offerId })
              });

              const data = await response.json();
              if (data.success) {
                Alert.alert('Başarılı', 'Eşleşme sağlandı! Sürücünüz size ulaşıyor.');
                loadActiveTag();
              }
            } catch (error) {
              Alert.alert('Hata', 'Teklif kabul edilemedi');
            }
          }
        }
      ]
    );
  };

  const handleCancelTag = async () => {
    if (!activeTag) return;

    Alert.alert(
      'Çağrıyı İptal Et',
      'Çağrınızı iptal etmek istediğinizden emin misiniz? Sürücülere bildirim gönderilecek.',
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
                Alert.alert('✅ İptal Edildi', 'Çağrınız başarıyla iptal edildi.');
                setActiveTag(null);
                setOffers([]);
              } else {
                Alert.alert('Hata', data.detail || 'Çağrı iptal edilemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'Çağrı iptal edilemedi');
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
  if (offers.length > 0 && activeTag && activeTag.status !== 'matched' && activeTag.status !== 'in_progress') {
    return (
      <View style={styles.fullScreenContainer}>
        <FullScreenOfferCard
          offer={offers[currentOfferIndex]}
          onSwipeUp={() => {
            if (currentOfferIndex < offers.length - 1) {
              setCurrentOfferIndex(currentOfferIndex + 1);
            }
          }}
          onSwipeDown={() => {
            if (currentOfferIndex > 0) {
              setCurrentOfferIndex(currentOfferIndex - 1);
            }
          }}
          onAccept={() => handleAcceptOffer(offers[currentOfferIndex].id)}
          isFirst={currentOfferIndex === 0}
          isLast={currentOfferIndex === offers.length - 1}
          currentIndex={currentOfferIndex}
          totalOffers={offers.length}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Yolcu Paneli</Text>
          <Text style={styles.headerSubtitle}>{user.name}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {!activeTag ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.welcomeTitle}>Hoş Geldiniz</Text>
            <Text style={styles.welcomeSubtitle}>Nereye gitmek istiyorsunuz?</Text>
            
            {/* Hedef Seçme Alanı */}
            <TouchableOpacity
              style={styles.destinationInput}
              onPress={() => setShowDestinationPicker(true)}
            >
              <Ionicons name="location" size={24} color={COLORS.primary} />
              <Text style={destination ? styles.destinationText : styles.destinationPlaceholder}>
                {destination ? destination.address : 'Hedef seçin...'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
            
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
            
            <Text style={styles.callHintText}>
              📍 Konumunuz otomatik tespit edilecek
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.tagStatusBadge}>
                <Text style={styles.tagStatusText}>
                  {activeTag.status === 'pending' && '⏳ Teklifler Bekleniyor'}
                  {activeTag.status === 'offers_received' && '📬 Teklifler Alındı'}
                  {activeTag.status === 'matched' && '✅ Eşleşildi'}
                  {activeTag.status === 'in_progress' && '🚗 Yolculuk Devam Ediyor'}
                  {activeTag.status === 'completed' && '✔️ Tamamlandı'}
                </Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location" size={20} color="#00A67E" />
                <Text style={styles.locationText}>{activeTag.pickup_location}</Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="flag" size={20} color="#FF5A5F" />
                <Text style={styles.locationText}>{activeTag.dropoff_location}</Text>
              </View>

              {activeTag.driver_name && (
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>Sürücü: {activeTag.driver_name}</Text>
                  <Text style={styles.driverPrice}>Fiyat: ₺{activeTag.final_price}</Text>
                </View>
              )}

              {/* Hedef Düzenle ve Çağrıyı İptal Et Butonları */}
              {(activeTag.status === 'pending' || activeTag.status === 'offers_received') && (
                <View style={styles.tagActionsContainer}>
                  <TouchableOpacity
                    style={styles.editDestinationButton}
                    onPress={() => setShowDestinationPicker(true)}
                  >
                    <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.editDestinationButtonText}>Hedefi Düzenle</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.cancelTagButton}
                    onPress={handleCancelTag}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#FF5A5F" />
                    <Text style={styles.cancelTagButtonText}>Çağrıyı İptal Et</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {activeTag.status === 'matched' || activeTag.status === 'in_progress' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📞 İletişim</Text>
                <TouchableOpacity 
                  style={[styles.callButton, calling && { opacity: 0.7 }]}
                  onPress={handleVoiceCall}
                  disabled={calling}
                >
                  <Ionicons name="call" size={24} color="#FFF" />
                  <Text style={styles.callButtonText}>
                    {calling ? 'Aranıyor...' : 'Sürücüyü Ara'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.callNote}>🔒 Uçtan uca şifreli arama • 📱 Numaralar gizli</Text>
              </View>
            ) : null}
          </>
        )}
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
            
            <TextInput
              style={styles.searchInput}
              placeholder="Adres ara... (örn: Taksim, İstanbul)"
              placeholderTextColor="#999"
              autoFocus={true}
              onSubmitEditing={(e) => {
                const address = e.nativeEvent.text;
                if (address) {
                  handleDestinationSelect(
                    address,
                    41.0082 + Math.random() * 0.1,
                    28.9784 + Math.random() * 0.1
                  );
                }
              }}
            />
            
            <Text style={styles.popularTitle}>Popüler Konumlar:</Text>
            <ScrollView style={styles.popularList}>
              {[
                'Taksim Meydanı, İstanbul',
                'Kadıköy İskele, İstanbul',
                'Atatürk Havalimanı',
                'Sabiha Gökçen Havalimanı',
                'Kızılay, Ankara',
                'Konak, İzmir'
              ].map((place, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.popularItem}
                  onPress={() => {
                    handleDestinationSelect(
                      place,
                      41.0082 + Math.random() * 0.1,
                      28.9784 + Math.random() * 0.1
                    );
                  }}
                >
                  <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.popularItemText}>{place}</Text>
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
    </SafeAreaView>
  );
}

// ==================== DRIVER DASHBOARD ====================
function DriverDashboard({ user, logout }: { user: User; logout: () => void }) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Sürücü Paneli</Text>
          <Text style={styles.headerSubtitle}>{user.name} ⭐ {user.rating}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTag ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aktif Yolculuk</Text>
            
            <View style={styles.tagStatusBadge}>
              <Text style={styles.tagStatusText}>
                {activeTag.status === 'matched' && '✅ Eşleşildi'}
                {activeTag.status === 'in_progress' && '🚗 Devam Ediyor'}
              </Text>
            </View>

            <Text style={styles.passengerName}>Yolcu: {activeTag.passenger_name}</Text>

            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color="#00A67E" />
              <Text style={styles.locationText}>{activeTag.pickup_location}</Text>
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="flag" size={20} color="#FF5A5F" />
              <Text style={styles.locationText}>{activeTag.dropoff_location}</Text>
            </View>

            <Text style={styles.priceText}>Fiyat: ₺{activeTag.final_price}</Text>

            {activeTag.status === 'matched' && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleStartTag}>
                <Text style={styles.primaryButtonText}>Yolculuğu Başlat</Text>
              </TouchableOpacity>
            )}

            {activeTag.status === 'in_progress' && (
              <TouchableOpacity style={styles.completeButton} onPress={handleCompleteTag}>
                <Text style={styles.primaryButtonText}>Yolculuğu Tamamla</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.callButton, calling && { opacity: 0.7 }]}
              onPress={handleDriverVoiceCall}
              disabled={calling}
            >
              <Ionicons name="call" size={24} color="#FFF" />
              <Text style={styles.callButtonText}>
                {calling ? 'Aranıyor...' : 'Yolcuyu Ara'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aktif Talepler ({requests.length})</Text>
            
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>Henüz talep yok</Text>
            ) : (
              requests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  {/* Yolcu Bilgisi */}
                  <View style={styles.requestHeader}>
                    <View style={styles.passengerAvatar}>
                      <Text style={styles.passengerAvatarText}>
                        {request.passenger_name?.charAt(0) || '?'}
                      </Text>
                    </View>
                    <Text style={styles.requestPassenger}>{request.passenger_name}</Text>
                  </View>
                  
                  {/* Mesafe Bilgileri - ÖNEMLİ! */}
                  <View style={styles.distanceContainer}>
                    <View style={styles.distanceBox}>
                      <Ionicons name="car" size={20} color={COLORS.primary} />
                      <Text style={styles.distanceLabel}>Size Mesafe</Text>
                      <Text style={styles.distanceValue}>
                        {request.distance_to_passenger_km ? `${request.distance_to_passenger_km} km` : 'Hesaplanıyor...'}
                      </Text>
                    </View>
                    
                    <View style={styles.distanceDivider} />
                    
                    <View style={styles.distanceBox}>
                      <Ionicons name="navigate" size={20} color={COLORS.secondary} />
                      <Text style={styles.distanceLabel}>Yolculuk</Text>
                      <Text style={styles.distanceValue}>
                        {request.trip_distance_km ? `${request.trip_distance_km} km` : 'Hesaplanıyor...'}
                      </Text>
                    </View>
                  </View>

                  {/* Lokasyon Bilgileri */}
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={18} color="#00A67E" />
                    <Text style={styles.requestLocation}>Başlangıç: {request.pickup_location}</Text>
                  </View>

                  <View style={styles.locationRow}>
                    <Ionicons name="flag" size={18} color="#FF5A5F" />
                    <Text style={styles.requestLocation}>Hedef: {request.dropoff_location}</Text>
                  </View>

                  {/* Teklif Gönder / Gönderildi */}
                  {request.has_offered ? (
                    <View style={styles.offeredBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#00A67E" />
                      <Text style={styles.offeredText}>Teklif Gönderildi</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.sendOfferButton}
                      onPress={() => handleSendOffer(request.id)}
                    >
                      <Ionicons name="cash-outline" size={20} color="#FFF" />
                      <Text style={styles.sendOfferButtonText}>Teklif Gönder</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Teklif Gönderme Modalı */}
      <Modal
        visible={offerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💰 Teklif Gönder</Text>
            <Text style={styles.modalSubtitle}>Fiyat teklifinizi girin</Text>
            
            <TextInput
              style={styles.priceInput}
              placeholder="Fiyat (₺)"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={offerPrice}
              onChangeText={setOfferPrice}
              autoFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setOfferModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={submitOffer}
              >
                <Text style={styles.modalSubmitButtonText}>Gönder</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00A67E',
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
    backgroundColor: '#00A67E',
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
    borderColor: '#00A67E'
  },
  secondaryButtonText: {
    color: '#00A67E',
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
    backgroundColor: '#00A67E',
    borderColor: '#00A67E'
  },
  roleButtonText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#00A67E'
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
    backgroundColor: '#00A67E',
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
    color: '#00A67E'
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
  driverInfo: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  driverPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00A67E',
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
    color: '#00A67E'
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
  acceptButton: {
    backgroundColor: '#00A67E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold'
  },
  callButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12
  },
  callButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8
  },
  callNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8
  },
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
    color: COLORS.gray500,
    fontWeight: '600',
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  requestPassenger: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  requestLocation: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1
  },
  sendOfferButton: {
    backgroundColor: '#00A67E',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12
  },
  sendOfferButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold'
  },
  offeredBadge: {
    backgroundColor: '#E8F8F5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12
  },
  offeredText: {
    color: '#00A67E',
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
    color: '#00A67E',
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
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
    letterSpacing: 3,
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
  },
  vehicleSection: {
    alignItems: 'center',
    marginTop: 120,
    marginBottom: 20,
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
    fontSize: 120,
    marginBottom: 16,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 20,
    marginVertical: 20,
  },
  messageText: {
    fontSize: 18,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  priceSection: {
    alignItems: 'center',
  },
  priceBox: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 20,
    alignItems: 'center',
  },
  priceLabelLarge: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  priceLarge: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
  },
  acceptButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  acceptButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 2,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    gap: 20,
  },
  navButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  navButtonText: {
    color: '#FFF',
    fontSize: 14,
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
  pageIndicatorLeft: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 1000,
  },
  pageIndicatorText: {
    color: '#FFF',
    fontSize: 14,
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
  vehicleBrand: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
});
