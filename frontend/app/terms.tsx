/**
 * Hizmet Şartları Sayfası
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

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hizmet Şartları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>1. Hizmet Tanımı</Text>
        <Text style={styles.paragraph}>
          Leylek Tag, yolcu ve sürücü kullanıcıları dijital ortamda eşleştiren bir platformdur.{"\n\n"}
          Şirket taşımacılık hizmeti sunmaz.
        </Text>

        <Text style={styles.sectionTitle}>2. Sorumluluk</Text>
        <Text style={styles.paragraph}>
          Yolculuk sırasında meydana gelebilecek:{"\n"}
          • Trafik kazaları{"\n"}
          • Maddi/manevi zararlar{"\n"}
          • Kullanıcılar arası uyuşmazlıklar{"\n\n"}
          taraflar arasındadır.
        </Text>

        <Text style={styles.sectionTitle}>3. Sürücü Sorumluluğu</Text>
        <Text style={styles.paragraph}>
          Sürücü:{"\n"}
          • Geçerli sürücü belgesine sahip olduğunu{"\n"}
          • Aracın trafiğe uygun olduğunu{"\n"}
          • Sigortasının geçerli olduğunu{"\n\n"}
          beyan eder.
        </Text>

        <Text style={styles.sectionTitle}>4. Topluluk Kuralları</Text>
        <Text style={styles.paragraph}>
          Yasak:{"\n"}
          • Hakaret{"\n"}
          • Tehdit{"\n"}
          • Dolandırıcılık{"\n"}
          • Kişisel veri paylaşımı{"\n\n"}
          Şirket içerik kaldırma ve hesap kapatma hakkını saklı tutar.
        </Text>

        <Text style={styles.sectionTitle}>5. Ücretlendirme</Text>
        <Text style={styles.paragraph}>
          Yolculuk ücretleri uygulama içi hesaplama veya teklif sistemiyle belirlenir.{"\n\n"}
          Şirket komisyon veya üyelik modeli uygulayabilir.
        </Text>

        <Text style={styles.sectionTitle}>6. Uyuşmazlık</Text>
        <Text style={styles.paragraph}>
          Uyuşmazlıklarda Ankara Mahkemeleri yetkilidir.
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
