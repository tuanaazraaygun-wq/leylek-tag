/**
 * Hesap Silme Sayfası - Google Play Zorunlu
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { clearSessionStorage, getPersistedAccessToken, getPersistedUserRaw } from '../lib/sessionToken';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://api.leylektag.com';
const API_URL = `${BACKEND_URL}/api`;

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ Hesabı Sil',
      'Bu işlem hesabınızı devre dışı bırakır.\n\nAktif yolculuk varsa hesap silinemez.\n\nDevam etmek için onaylayın.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const token = (await getPersistedAccessToken())?.trim();
      if (!token) {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
        return;
      }

      // user_id backend tarafından Bearer token'dan belirlenir
      const response = await fetch(`${API_URL}/user/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'user_request_mobile' }),
      });

      const data = await response.json();

      if (response.status === 409 && data?.code === 'active_tag_exists') {
        Alert.alert('Hesap Silinemedi', 'Aktif yolculuk varken hesabınızı silemezsiniz.');
        return;
      }
      if (response.status === 409 && data?.code === 'active_muhabbet_trip_exists') {
        Alert.alert('Hesap Silinemedi', 'Aktif Leylek Teklifi yolculuğu varken hesabınızı silemezsiniz.');
        return;
      }

      if (data.success) {
        // Push token temizliği (best-effort)
        try {
          const raw = await getPersistedUserRaw();
          const parsed = raw ? (JSON.parse(raw) as { id?: string }) : null;
          const uid = String(parsed?.id || '').trim();
          if (uid) {
            await fetch(`${API_URL}/user/remove-push-token?user_id=${encodeURIComponent(uid)}`, {
              method: 'DELETE',
            });
          }
        } catch {
          // no-op
        }
        await clearSessionStorage();

        Alert.alert(
          '✅ Hesap Silindi',
          'Hesabınız devre dışı bırakıldı ve oturumunuz kapatıldı.',
          [
            {
              text: 'Tamam',
              onPress: () => router.replace('/'),
            },
          ]
        );
      } else {
        Alert.alert('Hata', data?.message || data?.error || 'Hesap silinemedi');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Hata', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hesap Silme</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={48} color="#E74C3C" />
          <Text style={styles.warningTitle}>Dikkat!</Text>
          <Text style={styles.warningText}>
            Hesabınızı sildiğinizde aşağıdaki verileriniz kalıcı olarak silinecektir.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Silinecek Veriler:</Text>
        <View style={styles.listItem}>
          <Ionicons name="person" size={20} color="#E74C3C" />
          <Text style={styles.listText}>Profil bilgileriniz</Text>
        </View>
        <View style={styles.listItem}>
          <Ionicons name="car" size={20} color="#E74C3C" />
          <Text style={styles.listText}>Yolculuk geçmişiniz</Text>
        </View>
        <View style={styles.listItem}>
          <Ionicons name="chatbubbles" size={20} color="#E74C3C" />
          <Text style={styles.listText}>Mesajlarınız</Text>
        </View>
        <View style={styles.listItem}>
          <Ionicons name="star" size={20} color="#E74C3C" />
          <Text style={styles.listText}>Puanlarınız ve değerlendirmeleriniz</Text>
        </View>
        <View style={styles.listItem}>
          <Ionicons name="document-text" size={20} color="#E74C3C" />
          <Text style={styles.listText}>Ehliyet ve araç bilgileriniz (sürücüler için)</Text>
        </View>

        <Text style={styles.infoTitle}>Silme Süreci:</Text>
        <Text style={styles.infoText}>
          • Hesabınız hemen devre dışı bırakılacaktır{"\n"}
          • Kişisel verileriniz 30 gün içinde silinecektir{"\n"}
          • Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse) ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir{"\n"}
          • Yasal zorunluluklar kapsamındaki veriler anonimleştirilecektir{"\n"}
          • Bu işlem geri alınamaz
        </Text>

        <TouchableOpacity
          style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash" size={24} color="#fff" />
              <Text style={styles.deleteButtonText}>Hesabımı Kalıcı Olarak Sil</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Destek</Text>
          <Text style={styles.supportCompany}>Karekod Teknoloji ve Yazılım A.Ş.</Text>
          <TouchableOpacity
            onPress={() => {
              void openExternalLink('mailto:info@karekodteknoloji.com', 'E-posta açılamadı');
            }}
          >
            <Text style={styles.supportLink}>info@karekodteknoloji.com</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              void openExternalLink('tel:08503078029', 'Telefon açılamadı');
            }}
          >
            <Text style={styles.supportLink}>0850 307 80 29</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legalCard}>
          <Text style={styles.legalTitle}>Yasal Metinler</Text>
          <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
            <Text style={styles.legalLink}>Gizlilik Politikası</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/terms' as any)}>
            <Text style={styles.legalLink}>Hizmet Şartları</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/kvkk' as any)}>
            <Text style={styles.legalLink}>KVKK Aydınlatma Metni</Text>
          </TouchableOpacity>
          <Text style={styles.supportCompany}>
            KVKK başvuru hakları ve destek için: info@karekodteknoloji.com / 0850 307 80 29
          </Text>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  warningBox: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 15,
    color: '#ddd',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  listText: {
    fontSize: 15,
    color: '#ddd',
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#999',
    lineHeight: 24,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    gap: 10,
  },
  deleteButtonDisabled: {
    backgroundColor: '#666',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  supportCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#2a3b5f',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#182640',
  },
  supportTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  supportCompany: {
    color: '#b8c7e0',
    fontSize: 13,
    marginBottom: 10,
  },
  supportLink: {
    color: '#6fb7ff',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginBottom: 6,
  },
  legalCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#2a3b5f',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#182640',
  },
  legalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  legalLink: {
    color: '#6fb7ff',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginBottom: 6,
  },
});
