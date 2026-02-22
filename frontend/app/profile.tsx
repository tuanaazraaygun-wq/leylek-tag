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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/Colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${BACKEND_URL}/api`;

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
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

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
      const response = await fetch(`${API_URL}/auth/user/${user.id}/profile`, {
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
      <SafeAreaView style={styles.container}>
        <Text>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.photoContainer} onPress={pickImage}>
            {user.profile_photo ? (
              <Image source={{ uri: user.profile_photo }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={60} color={Colors.gray400} />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.roleText}>
            {user.role === 'passenger' ? '🧑 Yolcu' : '🚗 Sürücü'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
          
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Adınızı girin"
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.label}>Telefon</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user.phone}
            editable={false}
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && { opacity: 0.5 }]}
            onPress={handleSaveName}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>İstatistikler</Text>
          
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.total_trips}</Text>
              <Text style={styles.statLabel}>Yolculuk</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>⭐ {user.rating}</Text>
              <Text style={styles.statLabel}>Puan</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user.total_ratings}</Text>
              <Text style={styles.statLabel}>Değerlendirme</Text>
            </View>
          </View>
        </View>

        {user.role === 'driver' && (
          <TouchableOpacity
            style={styles.verifyCard}
            onPress={() => router.push('/driver-verify' as any)}
          >
            <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
            <View style={styles.verifyInfo}>
              <Text style={styles.verifyTitle}>Sürücü Doğrulama</Text>
              <Text style={styles.verifySubtitle}>
                {user.driver_details?.is_verified
                  ? '✅ Doğrulandı'
                  : '⏳ Doğrulama bekliyor'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.gray400} />
          </TouchableOpacity>
        )}

        {/* Yasal Bilgiler */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yasal Bilgiler</Text>
          
          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => router.push('/privacy' as any)}
          >
            <Ionicons name="lock-closed-outline" size={24} color={Colors.primary} />
            <Text style={styles.linkText}>Gizlilik Politikası</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => router.push('/terms' as any)}
          >
            <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
            <Text style={styles.linkText}>Hizmet Şartları</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkItem}
            onPress={() => router.push('/kvkk' as any)}
          >
            <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
            <Text style={styles.linkText}>KVKK Aydınlatma Metni</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Hesap İşlemleri */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hesap İşlemleri</Text>
          
          <TouchableOpacity
            style={[styles.linkItem, styles.dangerItem]}
            onPress={() => router.push('/delete-account' as any)}
          >
            <Ionicons name="trash-outline" size={24} color="#E74C3C" />
            <Text style={[styles.linkText, styles.dangerText]}>Hesabımı Sil</Text>
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
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: 'bold',
    color: Colors.text
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
    elevation: 3,
    alignItems: 'center'
  },
  photoContainer: {
    position: 'relative',
    marginBottom: Spacing.md
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.background
  },
  roleText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start'
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
    width: '100%'
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    width: '100%',
    color: Colors.text
  },
  inputDisabled: {
    backgroundColor: Colors.surface,
    color: Colors.gray500
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    width: '100%'
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: 'bold'
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%'
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: 'bold',
    color: Colors.primary
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    marginTop: Spacing.xs
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border
  },
  verifyCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center'
  },
  verifyInfo: {
    flex: 1,
    marginLeft: Spacing.md
  },
  verifyTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text
  },
  verifySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.gray500,
    marginTop: Spacing.xs
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    width: '100%',
  },
  linkText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.md,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#E74C3C',
  },
});
