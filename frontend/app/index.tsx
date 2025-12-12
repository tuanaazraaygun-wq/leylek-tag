import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/Colors';
import Logo from '../components/Logo';
import { Link, useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

// Types
interface User {
  id: string;
  phone: string;
  name: string;
  role: 'passenger' | 'driver';
  rating: number;
  total_ratings: number;
  total_trips: number;
  profile_photo?: string;
  driver_details?: any;
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
  emergency_shared: boolean;
  share_link?: string;
  created_at: string;
  matched_at?: string;
  completed_at?: string;
}

interface Offer {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_rating: number;
  driver_photo?: string;
  price: number;
  estimated_time: number;
  notes?: string;
  status: string;
  created_at: string;
}

export default function App() {
  const router = useRouter();
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

  // Auth Functions
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

  // Render Functions
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Logo size=\"large\" showSlogan={true} />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Telefon Numarası</Text>
            <TextInput
              style={styles.input}
              placeholder=\"5XX XXX XX XX\"
              placeholderTextColor={Colors.gray400}
              keyboardType=\"phone-pad\"
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
            <Ionicons name=\"shield-checkmark\" size={60} color={Colors.primary} />
            <Text style={styles.title}>Doğrulama</Text>
            <Text style={styles.subtitle}>{phone} numarasına gönderilen kodu girin</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>OTP Kodu</Text>
            <TextInput
              style={styles.input}
              placeholder=\"123456\"
              placeholderTextColor={Colors.gray400}
              keyboardType=\"number-pad\"
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
            <Ionicons name=\"person-add\" size={60} color={Colors.primary} />
            <Text style={styles.title}>Kayıt Ol</Text>
            <Text style={styles.subtitle}>Hesabınızı oluşturun</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Adınız</Text>
            <TextInput
              style={styles.input}
              placeholder=\"Adınızı girin\"
              placeholderTextColor={Colors.gray400}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>Rol Seçin</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  selectedRole === 'passenger' && styles.roleButtonActive
                ]}
                onPress={() => setSelectedRole('passenger')}
              >
                <Ionicons
                  name=\"person\"
                  size={40}
                  color={selectedRole === 'passenger' ? '#FFF' : Colors.primary}
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
                  name=\"car\"
                  size={40}
                  color={selectedRole === 'driver' ? '#FFF' : Colors.primary}
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

// Passenger Dashboard Component
function PassengerDashboard({ user, logout }: { user: User; logout: () => void }) {
  const router = useRouter();
  const [activeTag, setActiveTag] = useState<Tag | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActiveTag();
    const interval = setInterval(loadActiveTag, 5000);
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

  const handleCreateRequest = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Hata', 'Başlangıç ve varış noktalarını girin');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/passenger/create-request?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_location: pickupLocation,
          dropoff_location: dropoffLocation,
          notes
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Başarılı', 'Talebiniz oluşturuldu, teklifler bekleniyor...');
        setActiveTag(data.tag);
        setPickupLocation('');
        setDropoffLocation('');
        setNotes('');
      } else {
        Alert.alert('Hata', data.detail || 'Talep oluşturulamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Talep oluşturulamadı');
    } finally {
      setLoading(false);
    }
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
          <Logo size=\"small\" showText={false} />
          <Text style={styles.headerSubtitle}>{user.name}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.headerIcon}>
            <Ionicons name=\"person\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/history' as any)} style={styles.headerIcon}>
            <Ionicons name=\"time\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerIcon}>
            <Ionicons name=\"log-out\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadActiveTag} colors={[Colors.primary]} />
      }>
        {!activeTag ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Yeni Yolculuk Talebi</Text>
            
            <Text style={styles.label}>Nereden</Text>
            <TextInput
              style={styles.input}
              placeholder=\"Başlangıç konumu (örn: Kadıköy, İstanbul)\"
              placeholderTextColor={Colors.gray400}
              value={pickupLocation}
              onChangeText={setPickupLocation}
            />

            <Text style={styles.label}>Nereye</Text>
            <TextInput
              style={styles.input}
              placeholder=\"Varış konumu (örn: Beşiktaş, İstanbul)\"
              placeholderTextColor={Colors.gray400}
              value={dropoffLocation}
              onChangeText={setDropoffLocation}
            />

            <Text style={styles.label}>Notlar (Opsiyonel)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder=\"Ek bilgiler...\"
              placeholderTextColor={Colors.gray400}
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.5 }]}
              onPress={handleCreateRequest}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Oluşturuluyor...' : 'Talep Oluştur'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={[styles.tagStatusBadge, { backgroundColor: Colors.surface }]}>
                <Text style={[styles.tagStatusText, { color: Colors.primary }]}>
                  {activeTag.status === 'pending' && '⏳ Teklifler Bekleniyor'}
                  {activeTag.status === 'offers_received' && '📬 Teklifler Alındı'}
                  {activeTag.status === 'matched' && '✅ Eşleşildi'}
                  {activeTag.status === 'in_progress' && '🚗 Yolculuk Devam Ediyor'}
                  {activeTag.status === 'completed' && '✔️ Tamamlandı'}
                </Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name=\"location\" size={20} color={Colors.primary} />
                <Text style={styles.locationText}>{activeTag.pickup_location}</Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name=\"flag\" size={20} color={Colors.secondary} />
                <Text style={styles.locationText}>{activeTag.dropoff_location}</Text>
              </View>

              {activeTag.driver_name && (
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>Sürücü: {activeTag.driver_name}</Text>
                  <Text style={styles.driverPrice}>Fiyat: ₺{activeTag.final_price}</Text>
                </View>
              )}

              {activeTag.emergency_shared && (
                <TouchableOpacity style={styles.emergencyButton}>
                  <Ionicons name=\"warning\" size={20} color=\"#FFF\" />
                  <Text style={styles.emergencyButtonText}>Acil Durum Aktif</Text>
                </TouchableOpacity>
              )}
            </View>

            {offers.length > 0 && activeTag.status !== 'matched' && activeTag.status !== 'in_progress' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Gelen Teklifler ({offers.length})</Text>
                {offers.map((offer) => (
                  <View key={offer.id} style={styles.offerCard}>
                    <View style={styles.offerHeader}>
                      <View>
                        <Text style={styles.offerDriverName}>{offer.driver_name}</Text>
                        <Text style={styles.offerRating}>⭐ {offer.driver_rating}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.offerPrice}>₺{offer.price}</Text>
                        <Text style={styles.offerTime}>~{offer.estimated_time} dk</Text>
                      </View>
                    </View>
                    {offer.notes && (
                      <Text style={styles.offerNotes}>{offer.notes}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptOffer(offer.id)}
                    >
                      <Text style={styles.acceptButtonText}>Kabul Et</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {(activeTag.status === 'matched' || activeTag.status === 'in_progress') && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>İletişim</Text>
                <TouchableOpacity style={styles.callButton}>
                  <Ionicons name=\"call\" size={24} color=\"#FFF\" />
                  <Text style={styles.callButtonText}>Sürücüyü Ara</Text>
                </TouchableOpacity>
                <Text style={styles.callNote}>🔒 Uçtan uca şifreli arama</Text>

                <TouchableOpacity style={styles.shareButton}>
                  <Ionicons name=\"share-social\" size={20} color={Colors.primary} />
                  <Text style={styles.shareButtonText}>Yolculuğu Paylaş</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Driver Dashboard Component (devam edecek...)
function DriverDashboard({ user, logout }: { user: User; logout: () => void }) {
  const router = useRouter();
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
        <View style={styles.headerLeft}>
          <Logo size=\"small\" showText={false} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{user.name}</Text>
            <Text style={styles.headerSubtitle}>⭐ {user.rating}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/driver-verify' as any)} style={styles.headerIcon}>
            <Ionicons name=\"shield-checkmark\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} style={styles.headerIcon}>
            <Ionicons name=\"person\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/history' as any)} style={styles.headerIcon}>
            <Ionicons name=\"time\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerIcon}>
            <Ionicons name=\"log-out\" size={24} color=\"#FFF\" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {activeTag ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aktif Yolculuk</Text>
            
            <View style={[styles.tagStatusBadge, { backgroundColor: Colors.surface }]}>
              <Text style={[styles.tagStatusText, { color: Colors.primary }]}>
                {activeTag.status === 'matched' && '✅ Eşleşildi'}
                {activeTag.status === 'in_progress' && '🚗 Devam Ediyor'}
              </Text>
            </View>

            <Text style={styles.passengerName}>Yolcu: {activeTag.passenger_name}</Text>

            <View style={styles.locationRow}>
              <Ionicons name=\"location\" size={20} color={Colors.primary} />
              <Text style={styles.locationText}>{activeTag.pickup_location}</Text>
            </View>

            <View style={styles.locationRow}>
              <Ionicons name=\"flag\" size={20} color={Colors.secondary} />
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
              <Ionicons name=\"call\" size={24} color=\"#FFF\" />
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
                    <Ionicons name=\"location\" size={18} color={Colors.primary} />
                    <Text style={styles.requestLocation}>{request.pickup_location}</Text>
                  </View>

                  <View style={styles.locationRow}>
                    <Ionicons name=\"flag\" size={18} color={Colors.secondary} />
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

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.md
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.gray500,
    marginTop: Spacing.sm,
    textAlign: 'center'
  },
  formContainer: {
    width: '100%'
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    color: Colors.text
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: 'bold'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: 'bold'
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg
  },
  roleButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.border
  },
  roleButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary
  },
  roleButtonText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary
  },
  roleButtonTextActive: {
    color: '#FFF'
  },
  header: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerInfo: {
    marginLeft: Spacing.md
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: '#FFF'
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: '#FFF',
    opacity: 0.9,
    marginTop: Spacing.xs
  },
  headerActions: {
    flexDirection: 'row'
  },
  headerIcon: {
    marginLeft: Spacing.md
  },
  content: {
    flex: 1,
    padding: Spacing.md
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md
  },
  tagStatusBadge: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center'
  },
  tagStatusText: {
    fontSize: FontSize.md,
    fontWeight: '600'
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  locationText: {
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    flex: 1
  },
  driverInfo: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md
  },
  driverName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text
  },
  driverPrice: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.xs
  },
  offerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm
  },
  offerDriverName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text
  },
  offerRating: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    marginTop: Spacing.xs
  },
  offerPrice: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary
  },
  offerTime: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    marginTop: Spacing.xs
  },
  offerNotes: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    marginBottom: Spacing.md
  },
  acceptButton: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center'
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: 'bold'
  },
  callButton: {
    backgroundColor: Colors.info,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md
  },
  callButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: 'bold',
    marginLeft: Spacing.sm
  },
  callNote: {
    fontSize: FontSize.xs,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: Spacing.sm
  },
  shareButton: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm
  },
  shareButtonText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginLeft: Spacing.sm
  },
  emergencyButton: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md
  },
  emergencyButtonText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    marginLeft: Spacing.sm
  },
  requestCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  requestPassenger: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm
  },
  requestLocation: {
    fontSize: FontSize.sm,
    color: Colors.gray600,
    marginLeft: Spacing.sm,
    flex: 1
  },
  sendOfferButton: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md
  },
  sendOfferButtonText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: 'bold'
  },
  offeredBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md
  },
  offeredText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600'
  },
  passengerName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md
  },
  priceText: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: Spacing.md,
    marginBottom: Spacing.md
  },
  completeButton: {
    backgroundColor: Colors.warning,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.gray400,
    textAlign: 'center',
    marginTop: Spacing.lg
  }
});
