import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo from '../components/Logo';

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
  const [screen, setScreen] = useState<'login' | 'otp' | 'register' | 'dashboard'>('login');

  // Auth states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'passenger' | 'driver'>('passenger');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
        setScreen('dashboard');
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
          setScreen('dashboard');
        } else {
          setScreen('register');
        }
      } else {
        Alert.alert('Hata', data.detail || 'OTP doğrulanamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'OTP doğrulanamadı');
    }
  };

  const handleRegister = async () => {
    if (!name) {
      Alert.alert('Hata', 'Adınızı girin');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, role: selectedRole })
      });

      const data = await response.json();
      if (data.success) {
        await saveUser(data.user);
        setScreen('dashboard');
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

            <Text style={[styles.label, { marginTop: 20 }]}>Rol Seçin</Text>
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
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
              <Text style={styles.primaryButtonText}>Kayıt Ol</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Dashboard
  if (user && screen === 'dashboard') {
    return user.role === 'passenger' ? (
      <PassengerDashboard user={user} logout={logout} />
    ) : (
      <DriverDashboard user={user} logout={logout} />
    );
  }

  return null;
}

// ==================== PASSENGER DASHBOARD ====================
function PassengerDashboard({ user, logout }: { user: User; logout: () => void }) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);

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

  // ÇAĞRI BUTONU - Otomatik konum ile talep oluştur
  const handleCallButton = async () => {
    setLoading(true);
    try {
      // Mock konum (gerçek GPS sonra eklenecek)
      const mockLocation = 'Mevcut Konumunuz';
      const mockDestination = 'Varış Noktası';

      const response = await fetch(`${API_URL}/passenger/create-request?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_location: mockLocation,
          dropoff_location: mockDestination,
          notes: 'Çağrı butonu ile oluşturuldu'
        })
      });

      const data = await response.json();
      if (data.success) {
        setActiveTag(data.tag);
        Alert.alert('✅ Çağrı Gönderildi', 'Yakındaki sürücüler tekliflerini gönderiyor...');
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🚗 Taksi Çağır</Text>
            <Text style={styles.subtitle}>Tek dokunuşla yakındaki sürücülere çağrı gönder</Text>
            
            <TouchableOpacity
              style={[styles.callButtonLarge, loading && { opacity: 0.5 }]}
              onPress={handleCallButton}
              disabled={loading}
            >
              <Ionicons name="call" size={40} color="#FFF" />
              <Text style={styles.callButtonLargeText}>
                {loading ? 'ÇAĞRI GÖNDERİLİYOR...' : 'ÇAĞRI GÖNDER'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.callNote}>
              📍 Mevcut konumunuz otomatik tespit edilecek
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
            </View>

            {offers.length > 0 && activeTag.status !== 'matched' && activeTag.status !== 'in_progress' && (
              <View style={styles.offersContainer}>
                <Text style={styles.offersTitle}>💬 Gelen Teklifler ({offers.length})</Text>
                <View style={styles.balloonsContainer}>
                  {offers.map((offer) => (
                    <TouchableOpacity
                      key={offer.id}
                      style={styles.offerBalloon}
                      onPress={() => handleAcceptOffer(offer.id)}
                    >
                      <View style={styles.balloonContent}>
                        <Text style={styles.balloonDriverName}>{offer.driver_name}</Text>
                        <Text style={styles.balloonRating}>⭐ {offer.driver_rating}</Text>
                        <Text style={styles.balloonPrice}>₺{offer.price}</Text>
                        <Text style={styles.balloonTime}>~{offer.estimated_time} dk</Text>
                        {offer.notes && (
                          <Text style={styles.balloonNotes}>{offer.notes}</Text>
                        )}
                      </View>
                      <View style={styles.balloonTail} />
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.balloonHint}>💡 Bir balona dokunarak teklifi kabul edin</Text>
              </View>
            )}

            {activeTag.status === 'matched' || activeTag.status === 'in_progress' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>İletişim</Text>
                <TouchableOpacity style={styles.callButton}>
                  <Ionicons name="call" size={24} color="#FFF" />
                  <Text style={styles.callButtonText}>Sürücüyü Ara</Text>
                </TouchableOpacity>
                <Text style={styles.callNote}>🔒 Uçtan uca şifreli arama</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== DRIVER DASHBOARD ====================
function DriverDashboard({ user, logout }: { user: User; logout: () => void }) {
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleSendOffer = async (tagId: string) => {
    Alert.prompt(
      'Teklif Gönder',
      'Fiyat teklifinizi girin (₺)',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Gönder',
          onPress: async (price) => {
            if (!price || isNaN(Number(price))) {
              Alert.alert('Hata', 'Geçerli bir fiyat girin');
              return;
            }

            try {
              const response = await fetch(`${API_URL}/driver/send-offer?user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tag_id: tagId,
                  price: Number(price),
                  estimated_time: 15,
                  notes: 'Hemen geliyorum!'
                })
              });

              const data = await response.json();
              if (data.success) {
                Alert.alert('Başarılı', 'Teklifiniz gönderildi');
                loadRequests();
              } else {
                Alert.alert('Hata', data.detail || 'Teklif gönderilemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'Teklif gönderilemedi');
            }
          }
        }
      ],
      'plain-text',
      '',
      'numeric'
    );
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

            <TouchableOpacity style={styles.callButton}>
              <Ionicons name="call" size={24} color="#FFF" />
              <Text style={styles.callButtonText}>Yolcuyu Ara</Text>
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
                  <Text style={styles.requestPassenger}>{request.passenger_name}</Text>
                  
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={18} color="#00A67E" />
                    <Text style={styles.requestLocation}>{request.pickup_location}</Text>
                  </View>

                  <View style={styles.locationRow}>
                    <Ionicons name="flag" size={18} color="#FF5A5F" />
                    <Text style={styles.requestLocation}>{request.dropoff_location}</Text>
                  </View>

                  {request.has_offered ? (
                    <View style={styles.offeredBadge}>
                      <Text style={styles.offeredText}>✓ Teklif Gönderildi</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.sendOfferButton}
                      onPress={() => handleSendOffer(request.id)}
                    >
                      <Text style={styles.sendOfferButtonText}>Teklif Gönder</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
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
  // ÇAĞRI BUTONU STİLLERİ
  callButtonLarge: {
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    flexDirection: 'row',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  callButtonLargeText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    letterSpacing: 1
  },
  // MAVİ BALON STİLLERİ
  offersContainer: {
    marginBottom: 16
  },
  offersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center'
  },
  balloonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 10
  },
  offerBalloon: {
    backgroundColor: '#3FA9F5',
    borderRadius: 20,
    padding: 16,
    margin: 8,
    minWidth: 140,
    maxWidth: 160,
    shadowColor: '#3FA9F5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative'
  },
  balloonContent: {
    alignItems: 'center'
  },
  balloonDriverName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  balloonRating: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.9,
    marginBottom: 8
  },
  balloonPrice: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  balloonTime: {
    color: '#FFF',
    fontSize: 12,
    opacity: 0.8
  },
  balloonNotes: {
    color: '#FFF',
    fontSize: 10,
    opacity: 0.8,
    marginTop: 4,
    textAlign: 'center'
  },
  balloonTail: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#3FA9F5'
  },
  balloonHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic'
  }
});
