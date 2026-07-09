import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Spacing, BorderRadius, FontSize } from '../constants/Colors';
import { API_BASE_URL } from '../lib/backendConfig';
import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_DEEP,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../components/auth/premiumAuthStyles';
import { useSettingsTheme } from '../lib/theme/useSettingsTheme';

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

export default function ProfileScreen() {
  const router = useRouter();
  const { profileSurfaces: lt, ui, isScopeLight, tokens } = useSettingsTheme('profile');
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const openExternalLink = async (url: string, errorTitle: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(errorTitle, 'Bu bağlantı bu cihazda açılamıyor.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.warn('External link open failed:', error);
      Alert.alert(errorTitle, 'Bağlantı açılamadı. Lütfen tekrar deneyin.');
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setName(parsed.name);
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Kullanıcı yüklenemedi:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Hata', 'Galeri erişim izni gerekli');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      updateProfile({ profile_photo: base64Image });
    }
  };

  const updateProfile = async (updates: any) => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/user/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (data.success) {
        const updatedUser = { ...user, ...updates };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('Başarılı', 'Profil güncellendi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Profil güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = () => {
    if (!name) {
      Alert.alert('Hata', 'Ad boş bırakılamaz');
      return;
    }
    updateProfile({ name });
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, lt?.container]}>
        <View style={[styles.loadingWrap, lt?.loadingWrap]}>
          <ActivityIndicator size="large" color={ui.accent} />
          <Text style={[styles.loadingText, lt?.loadingText]}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, lt?.container]}>
      <View style={[styles.header, lt?.header]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={ui.accent} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, lt?.headerTitle]}>Profil</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.card, lt?.card]}>
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
            {user.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={[styles.photo, lt?.photo]} />
            ) : (
              <View style={[styles.photoPlaceholder, lt?.photoPlaceholder]}>
                <Ionicons name="person" size={60} color={ui.textMuted} />
              </View>
            )}
            <View style={[styles.cameraButton, lt?.cameraButton]}>
              <Ionicons
                name="camera"
                size={20}
                color={isScopeLight ? tokens.text.inverse : 'rgba(243,248,255,0.94)'}
              />
            </View>
          </TouchableOpacity>

          <Text style={[styles.roleText, lt?.roleText]}>
            {user.role === 'passenger' ? '🧑 Yolcu' : '🚗 Sürücü'}
          </Text>
        </View>

        <View style={[styles.card, lt?.card]}>
          <Text style={[styles.cardTitle, lt?.cardTitle]}>Kişisel Bilgiler</Text>
          
          <Text style={[styles.label, lt?.label]}>Ad Soyad</Text>
          <TextInput
            style={[styles.input, lt?.input]}
            value={name}
            onChangeText={setName}
            placeholder="Adınızı girin"
            placeholderTextColor={ui.textMuted}
          />

          <Text style={[styles.label, lt?.label]}>Telefon</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled, lt?.input, lt?.inputDisabled]}
            value={user.phone}
            editable={false}
          />

          <TouchableOpacity
            style={[styles.primaryButton, lt?.primaryButton, loading && { opacity: 0.5 }]}
            onPress={handleSaveName}
            disabled={loading}
          >
            <Text style={[styles.primaryButtonText, lt?.primaryButtonText]}>
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, lt?.card]}>
          <Text style={[styles.cardTitle, lt?.cardTitle]}>İstatistikler</Text>
          
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, lt?.statValue]}>{user.total_trips}</Text>
              <Text style={[styles.statLabel, lt?.statLabel]}>Yolculuk</Text>
            </View>
            <View style={[styles.statDivider, lt?.statDivider]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, lt?.statValue]}>⭐ {user.rating}</Text>
              <Text style={[styles.statLabel, lt?.statLabel]}>Puan</Text>
            </View>
            <View style={[styles.statDivider, lt?.statDivider]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, lt?.statValue]}>{user.total_ratings}</Text>
              <Text style={[styles.statLabel, lt?.statLabel]}>Değerlendirme</Text>
            </View>
          </View>
        </View>

        {user.role === 'driver' && (
          <TouchableOpacity
            style={[styles.verifyCard, lt?.verifyCard]}
            onPress={() => router.push('/driver-vehicles' as any)}
          >
            <Ionicons name="car-outline" size={40} color={ui.accent} />
            <View style={styles.verifyInfo}>
              <Text style={[styles.verifyTitle, lt?.verifyTitle]}>Araçlarım</Text>
              <Text style={[styles.verifySubtitle, lt?.verifySubtitle]}>
                Sürücü araç kayıtlarınızı görüntüleyin ve yönetin
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={ui.textMuted} />
          </TouchableOpacity>
        )}

        {/* Yasal Bilgiler */}
        <View style={[styles.card, lt?.card]}>
          <Text style={[styles.cardTitle, lt?.cardTitle]}>Yasal Bilgiler</Text>

          <TouchableOpacity
            style={[styles.linkItem, lt?.linkItem]}
            onPress={() => router.push('/trust-center' as any)}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>Yasal ve Güven Merkezi</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.linkItem, lt?.linkItem]}
            onPress={() => router.push('/terms-user' as any)}
          >
            <Ionicons name="document-text-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>Kullanıcı Sözleşmesi</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkItem, lt?.linkItem]}
            onPress={() => router.push('/kvkk' as any)}
          >
            <Ionicons name="information-circle-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>KVKK Aydınlatma Metni</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkItem, lt?.linkItem]}
            onPress={() => router.push('/privacy' as any)}
          >
            <Ionicons name="lock-closed-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>Gizlilik Politikası</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkItem, lt?.linkItem]}
            onPress={() => router.push('/delete-account' as any)}
          >
            <Ionicons name="trash-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>Hesap Silme</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, lt?.card]}>
          <Text style={[styles.cardTitle, lt?.cardTitle]}>Destek</Text>
          <Text style={[styles.supportCompany, lt?.supportCompany]}>Karekod Teknoloji ve Yazılım A.Ş.</Text>
          <TouchableOpacity
            style={[styles.linkItem, lt?.linkItem]}
            onPress={() => {
              void openExternalLink('mailto:info@karekodteknoloji.com', 'E-posta açılamadı');
            }}
          >
            <Ionicons name="mail-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>info@karekodteknoloji.com</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkItem, styles.supportPhoneItem, lt?.linkItem]}
            onPress={() => {
              void openExternalLink('tel:08503078029', 'Telefon açılamadı');
            }}
          >
            <Ionicons name="call-outline" size={24} color={ui.accent} />
            <Text style={[styles.linkText, lt?.linkText]}>0850 307 80 29</Text>
            <Ionicons name="chevron-forward" size={20} color={ui.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Hesap İşlemleri */}
        <View style={[styles.card, lt?.card]}>
          <Text style={[styles.cardTitle, lt?.cardTitle]}>Hesap İşlemleri</Text>
          
          <TouchableOpacity
            style={[styles.linkItem, styles.dangerItem, lt?.linkItem, lt?.dangerItem]}
            onPress={() => router.push('/delete-account' as any)}
          >
            <Ionicons name="trash-outline" size={24} color="#E74C3C" />
            <Text style={[styles.linkText, styles.dangerText, lt?.linkText, lt?.dangerText]}>Hesabımı Sil</Text>
            <Ionicons name="chevron-forward" size={20} color="#E74C3C" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: 14,
    backgroundColor: PREMIUM_NAVY_DEEP,
  },
  loadingText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: 'rgba(186,201,222,0.82)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth + 1,
    borderBottomColor: 'rgba(34,211,238,0.14)',
    backgroundColor: 'rgba(11,18,32,0.94)',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  card: {
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    borderTopColor: 'rgba(34,211,238,0.26)',
    borderLeftColor: 'rgba(34,211,238,0.12)',
    shadowColor: 'rgba(34,211,238,0.12)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
    alignItems: 'center',
  },
  photoContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(8,17,31,0.65)',
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.42)',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(8,17,31,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(34,211,238,0.32)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34,211,238,0.5)',
  },
  roleText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
    marginTop: Spacing.sm,
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
    letterSpacing: 0.15,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: 'rgba(186,201,222,0.82)',
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
    width: '100%',
  },
  input: {
    backgroundColor: 'rgba(8,17,31,0.58)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    marginBottom: Spacing.md,
    width: '100%',
    color: PREMIUM_TEXT_SOFT,
  },
  inputDisabled: {
    backgroundColor: 'rgba(16, 26, 43, 0.65)',
    color: PREMIUM_TEXT_MUTED,
  },
  primaryButton: {
    backgroundColor: PREMIUM_AUTH_CYAN,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#08111F',
    fontSize: FontSize.md,
    fontWeight: 'bold',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: PREMIUM_TEXT_SOFT,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(186,201,222,0.82)',
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: PREMIUM_BORDER_SLATE,
  },
  verifyCard: {
    backgroundColor: 'rgba(16,26,43,0.88)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: PREMIUM_BORDER_SLATE,
    borderTopColor: 'rgba(110,231,183,0.35)',
    borderLeftColor: 'rgba(16,185,129,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: 'rgba(34,211,238,0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 7,
  },
  verifyInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  verifyTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: PREMIUM_TEXT_SOFT,
  },
  verifySubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(186,201,222,0.82)',
    marginTop: Spacing.xs,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(30, 58, 95, 0.55)',
    width: '100%',
  },
  linkText: {
    flex: 1,
    fontSize: FontSize.md,
    color: PREMIUM_TEXT_SOFT,
    marginLeft: Spacing.md,
  },
  dangerItem: {
    borderBottomWidth: 0,
    backgroundColor: 'rgba(127,29,29,0.14)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  dangerText: {
    color: 'rgba(248, 113, 113, 0.98)',
  },
  supportCompany: {
    width: '100%',
    fontSize: FontSize.sm,
    color: PREMIUM_TEXT_MUTED,
    marginBottom: Spacing.sm,
  },
  supportPhoneItem: {
    borderBottomWidth: 0,
  },
});
