/**
 * KVKK Aydınlatma Metni Sayfası
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

export default function KVKKScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KVKK Aydınlatma Metni</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>KAREKOD TEKNOLOJİ VE YAZILIM ANONİM ŞİRKETİ</Text>
          <Text style={styles.companyAddress}>Meşrutiyet Mah. Konur Sk. Özsoy İş Hanı No: 25 İç Kapı No: 13 Çankaya / Ankara</Text>
          <Text style={styles.companyEmail}>E-posta: destek@leylektag.com</Text>
        </View>

        <Text style={styles.sectionTitle}>1. Veri Sorumlusu</Text>
        <Text style={styles.paragraph}>
          Leylek Tag mobil uygulaması kapsamında kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla KAREKOD TEKNOLOJİ VE YAZILIM A.Ş. tarafından işlenmektedir.
        </Text>

        <Text style={styles.sectionTitle}>2. İşlenen Veriler</Text>
        <Text style={styles.subTitle}>Yolcu Kullanıcılar:</Text>
        <Text style={styles.paragraph}>
          • Ad, Soyad{"\n"}
          • Telefon numarası{"\n"}
          • Şehir bilgisi{"\n"}
          • Konum verisi (aktif kullanım sırasında){"\n"}
          • Mesaj içerikleri{"\n"}
          • Yolculuk geçmişi
        </Text>

        <Text style={styles.subTitle}>Sürücü Kullanıcılar (ek olarak):</Text>
        <Text style={styles.paragraph}>
          • Ehliyet görseli{"\n"}
          • Araç ön ve arka fotoğrafları (plaka dahil){"\n"}
          • Plaka numarası{"\n"}
          • Araç bilgileri
        </Text>

        <Text style={styles.subTitle}>Teknik Veriler:</Text>
        <Text style={styles.paragraph}>
          • IP adresi{"\n"}
          • Cihaz bilgisi{"\n"}
          • Push bildirim token'ı{"\n"}
          • Sistem log kayıtları
        </Text>

        <Text style={styles.sectionTitle}>3. İşleme Amaçları</Text>
        <Text style={styles.paragraph}>
          • Kullanıcı kaydı ve kimlik doğrulama{"\n"}
          • Yolcu–sürücü eşleştirme{"\n"}
          • Güvenliğin sağlanması{"\n"}
          • Hukuki yükümlülüklerin yerine getirilmesi{"\n"}
          • Dolandırıcılığın önlenmesi{"\n"}
          • Topluluk alanının yönetimi
        </Text>

        <Text style={styles.sectionTitle}>4. Saklama Süreleri</Text>
        <Text style={styles.paragraph}>
          • Hesap bilgileri: Üyelik süresince{"\n"}
          • Trip kayıtları: 5 yıl{"\n"}
          • Topluluk mesajları: 90 gün{"\n"}
          • Ehliyet ve araç görselleri: Üyelik süresince{"\n"}
          • Log kayıtları: Mevzuat süresi boyunca
        </Text>

        <Text style={styles.sectionTitle}>5. Yurt Dışına Aktarım</Text>
        <Text style={styles.paragraph}>
          Altyapı hizmetleri (Supabase, Google Maps vb.) nedeniyle veriler yurt dışında bulunan sunucularda saklanabilir.
        </Text>

        <Text style={styles.sectionTitle}>6. Haklarınız</Text>
        <Text style={styles.paragraph}>
          KVKK m.11 kapsamındaki haklarınızı destek@leylektag.com adresine başvurarak kullanabilirsiniz.
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
  companyInfo: {
    backgroundColor: '#16213e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 8,
  },
  companyAddress: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 4,
  },
  companyEmail: {
    fontSize: 14,
    color: '#3498db',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 20,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
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
