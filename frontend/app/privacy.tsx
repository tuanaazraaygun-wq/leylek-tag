/**
 * Gizlilik Politikası Sayfası
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gizlilik Politikası</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>1. Genel İlke</Text>
        <Text style={styles.paragraph}>
          Leylek Tag, kullanıcı verilerini yalnızca hizmet sunumu amacıyla işler. Yetkisiz üçüncü kişilerle paylaşılmaz.
        </Text>

        <Text style={styles.sectionTitle}>2. Konum Verisi</Text>
        <Text style={styles.paragraph}>
          Konum verisi yalnızca:{"\n"}
          • Yolculuk oluşturma{"\n"}
          • Aktif yolculuk süresi{"\n\n"}
          boyunca kullanılır. Sürekli arka plan takibi yapılmaz.
        </Text>

        <Text style={styles.sectionTitle}>3. Sürücü Doğrulama</Text>
        <Text style={styles.paragraph}>
          Ehliyet ve araç görselleri:{"\n"}
          • Kimlik doğrulama{"\n"}
          • Güvenlik{"\n"}
          • Dolandırıcılığı önleme{"\n\n"}
          amaçlı işlenir ve kamuya açık paylaşılmaz.
        </Text>

        <Text style={styles.sectionTitle}>4. Güvenlik</Text>
        <Text style={styles.paragraph}>
          • HTTPS şifreleme{"\n"}
          • Yetkilendirme sistemi{"\n"}
          • Rol bazlı erişim{"\n"}
          • Sunucu taraflı güvenlik önlemleri
        </Text>

        <Text style={styles.sectionTitle}>5. Hesap Silme</Text>
        <Text style={styles.paragraph}>
          Kullanıcılar uygulama içinden hesaplarını silebilir.{"\n\n"}
          Silme sonrası veriler yasal zorunluluklar saklı kalmak kaydıyla silinir veya anonimleştirilir.
        </Text>

        <Text style={styles.sectionTitle}>6. 5651 Uyum</Text>
        <Text style={styles.paragraph}>
          Şirket, 5651 sayılı Kanun kapsamında hukuka aykırı içerikleri bildirim üzerine kaldırma yükümlülüğünü yerine getirir.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>KAREKOD TEKNOLOJİ VE YAZILIM A.Ş.</Text>
          <Text style={styles.footerText}>destek@leylektag.com</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    color: '#ddd',
    lineHeight: 24,
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 5,
  },
});
