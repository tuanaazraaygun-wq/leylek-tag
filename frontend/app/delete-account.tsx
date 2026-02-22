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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL 
  || process.env.EXPO_PUBLIC_BACKEND_URL 
  || 'https://api.leylektag.com';
const API_URL = `${BACKEND_URL}/api`;

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ Hesabı Sil',
      'Hesabınızı silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz ve tüm verileriniz 30 gün içinde kalıcı olarak silinecektir.',
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
    setIsDeleting(true);
    try {
      const userData = await AsyncStorage.getItem('leylek_user');
      if (!userData) {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
        return;
      }

      const user = JSON.parse(userData);

      // Backend'e silme isteği gönder
      const response = await fetch(`${API_URL}/user/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await response.json();

      if (data.success) {
        // Local storage'ı temizle
        await AsyncStorage.multiRemove([
          'leylek_user',
          'leylek_token',
          'leylek_role',
        ]);

        Alert.alert(
          '✅ Hesap Silindi',
          'Hesabınız başarıyla silindi. Tüm verileriniz 30 gün içinde kalıcı olarak kaldırılacaktır.',
          [
            {
              text: 'Tamam',
              onPress: () => router.replace('/'),
            },
          ]
        );
      } else {
        Alert.alert('Hata', data.error || 'Hesap silinemedi');
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

        <Text style={styles.disclaimer}>
          Hesabınızı silmek yerine geçici olarak devre dışı bırakmak isterseniz destek@leylektag.com adresine e-posta gönderebilirsiniz.
        </Text>

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
  disclaimer: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
});
