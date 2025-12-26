import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, Dimensions, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ===================== KVKK VE GİZLİLİK POLİTİKASI İÇERİĞİ =====================

export const AYDINLATMA_METNI = `
LEYLEK MOBİL UYGULAMA
KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ

Son Güncelleme: 26 Aralık 2024

Leylek Teknoloji A.Ş. ("Şirket" veya "Biz") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla, kişisel verilerinizin işlenmesine ilişkin sizi bilgilendirmek istiyoruz.

1. VERİ SORUMLUSU

Leylek Teknoloji A.Ş.
Adres: Ankara, Türkiye
E-posta: info@leylekapp.com
Telefon: +90 312 000 00 00

2. TOPLANAN KİŞİSEL VERİLER

Hizmetlerimizi sunabilmek için aşağıdaki kişisel verilerinizi topluyoruz:

a) Kimlik Bilgileri:
- Ad, soyad
- Telefon numarası
- Profil fotoğrafı (isteğe bağlı)

b) İletişim Bilgileri:
- Telefon numarası
- Şehir bilgisi

c) Konum Bilgileri:
- Anlık konum (GPS)
- Yolculuk başlangıç ve bitiş noktaları
- Rota bilgileri

d) İşlem Bilgileri:
- Yolculuk geçmişi
- Ödeme bilgileri
- Değerlendirme puanları
- Uygulama kullanım verileri

e) Sürücü Bilgileri (Sürücü hesapları için):
- Ehliyet bilgileri
- Araç plakası
- Araç modeli ve rengi

3. KİŞİSEL VERİLERİN İŞLENME AMAÇLARI

Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:

- Yolcu ve sürücü eşleştirme hizmetinin sunulması
- Güvenli yolculuk deneyiminin sağlanması
- Konum tabanlı hizmetlerin sunulması
- İletişim ve bilgilendirme
- Ödeme işlemlerinin gerçekleştirilmesi
- Yasal yükümlülüklerin yerine getirilmesi
- Hizmet kalitesinin artırılması
- Anlaşmazlıkların çözülmesi

4. KİŞİSEL VERİLERİN AKTARILMASI

Kişisel verileriniz aşağıdaki taraflarla paylaşılabilir:

- Eşleştiğiniz sürücü veya yolcu (isim, telefon, konum)
- Ödeme hizmeti sağlayıcıları
- Yasal merciler (mahkeme kararı ile)
- Bulut hizmet sağlayıcıları (veri güvenliği sağlanarak)

5. KİŞİSEL VERİLERİN SAKLANMA SÜRESİ

Kişisel verileriniz:
- Hesabınız aktif olduğu sürece saklanır
- Hesap silme talebinden itibaren 30 gün içinde silinir
- Yasal zorunluluklar gereği 5 yıla kadar saklanabilir

6. VERİ SAHİBİNİN HAKLARI

KVKK'nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:

- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- İşlenmişse buna ilişkin bilgi talep etme
- İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
- Aktarıldığı üçüncü kişileri bilme
- Eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme
- KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme
- Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme
- İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme
- Kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme

7. BAŞVURU YÖNTEMİ

Yukarıdaki haklarınızı kullanmak için info@leylekapp.com adresine e-posta gönderebilir veya uygulama içinden "Destek" bölümünden bize ulaşabilirsiniz.

8. GÜNCELLEMELERİ

Bu aydınlatma metni zaman zaman güncellenebilir. Güncellemeler uygulama üzerinden bildirilecektir.
`;

export const GIZLILIK_POLITIKASI = `
LEYLEK MOBİL UYGULAMA
GİZLİLİK POLİTİKASI

Son Güncelleme: 26 Aralık 2024

1. GİRİŞ

Leylek ("Uygulama", "Biz") olarak gizliliğinize saygı duyuyor ve kişisel verilerinizi korumayı taahhüt ediyoruz. Bu Gizlilik Politikası, hangi bilgileri topladığımızı, nasıl kullandığımızı ve koruduğumuzu açıklamaktadır.

2. TOPLANAN BİLGİLER

2.1 Sizin Sağladığınız Bilgiler:
- Kayıt bilgileri (ad, telefon numarası, şehir)
- Profil bilgileri (fotoğraf, tercihler)
- Sürücü bilgileri (ehliyet, araç bilgileri)
- İletişim içerikleri (destek talepleri)

2.2 Otomatik Toplanan Bilgiler:
- Konum verileri (GPS)
- Cihaz bilgileri (model, işletim sistemi)
- Uygulama kullanım verileri
- Çerez ve benzeri teknolojiler

3. BİLGİLERİN KULLANIMI

Topladığımız bilgileri şu amaçlarla kullanıyoruz:

- Hizmetlerimizi sunmak ve geliştirmek
- Yolcu-sürücü eşleştirmesi yapmak
- Güvenliğinizi sağlamak
- Müşteri desteği sunmak
- Yasal yükümlülüklerimizi yerine getirmek
- Size bildirimler göndermek

4. BİLGİ PAYLAŞIMI

Bilgilerinizi şu durumda üçüncü taraflarla paylaşabiliriz:

- Eşleştiğiniz kullanıcıyla (sürücü/yolcu)
- Hizmet sağlayıcılarımızla (ödeme işlemcileri, bulut hizmetleri)
- Yasal gereklilikler nedeniyle (mahkeme kararı)
- Güvenlik tehditlerine karşı

5. VERİ GÜVENLİĞİ

Verilerinizi korumak için:
- SSL/TLS şifreleme kullanıyoruz
- Güvenli sunucularda saklıyoruz
- Düzenli güvenlik denetimleri yapıyoruz
- Erişim kontrolü uyguluyoruz

6. KONUM VERİLERİ

Uygulamamız konum verilerinizi şu amaçlarla kullanır:

- Size en yakın sürücüleri bulmak
- Yolculuk sırasında güvenliğinizi sağlamak
- Doğru rota ve mesafe hesaplaması yapmak
- Acil durumlarda konumunuzu paylaşmak

Konum izni vermezseniz uygulama temel özelliklerini kullanamazsınız.

7. VERİ SAKLAMA

- Aktif hesaplar: Hesap aktif olduğu sürece
- Silinen hesaplar: 30 gün içinde kalıcı silme
- Yasal gereklilikler: 5 yıla kadar

8. HAKLARINIZ

- Verilerinize erişim hakkı
- Düzeltme hakkı
- Silme hakkı (hesap silme)
- İtiraz hakkı
- Taşınabilirlik hakkı

9. ÇOCUKLARIN GİZLİLİĞİ

Uygulamamız 18 yaşın altındaki kişilere yönelik değildir. Bilerek 18 yaşın altındaki kişilerden veri toplamıyoruz.

10. DEĞİŞİKLİKLER

Bu politikayı değiştirebiliriz. Önemli değişiklikler uygulama içinden bildirilecektir.

11. İLETİŞİM

Sorularınız için:
E-posta: info@leylekapp.com
Telefon: +90 312 000 00 00

12. KULLANIM ŞARTLARI

Uygulamayı kullanarak:
- 18 yaşından büyük olduğunuzu
- Verdiğiniz bilgilerin doğru olduğunu
- Başkalarının haklarına saygı göstereceğinizi
- Yasalara uygun davranacağınızı kabul edersiniz.

Yasadışı faaliyetler, taciz, tehdit veya uygunsuz davranışlar hesabınızın askıya alınmasına neden olabilir.
`;

// ===================== KVKK ONAYI MODAL =====================

interface KVKKConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function KVKKConsentModal({ visible, onAccept, onDecline }: KVKKConsentModalProps) {
  const [showFullText, setShowFullText] = useState<'aydinlatma' | 'gizlilik' | null>(null);

  if (showFullText) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.fullTextContainer}>
          <View style={styles.fullTextHeader}>
            <TouchableOpacity onPress={() => setShowFullText(null)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.fullTextTitle}>
              {showFullText === 'aydinlatma' ? 'Aydınlatma Metni' : 'Gizlilik Politikası'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.fullTextScroll} showsVerticalScrollIndicator={true}>
            <Text style={styles.fullTextContent}>
              {showFullText === 'aydinlatma' ? AYDINLATMA_METNI : GIZLILIK_POLITIKASI}
            </Text>
          </ScrollView>
          <TouchableOpacity 
            style={styles.closeFullTextButton}
            onPress={() => setShowFullText(null)}
          >
            <Text style={styles.closeFullTextButtonText}>Kapat</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.consentContainer}>
          <LinearGradient
            colors={['#3FA9F5', '#2563EB']}
            style={styles.consentHeader}
          >
            <Ionicons name="shield-checkmark" size={40} color="#FFF" />
            <Text style={styles.consentTitle}>Gizlilik ve KVKK Onayı</Text>
          </LinearGradient>

          <ScrollView style={styles.consentScroll}>
            <Text style={styles.consentIntro}>
              Leylek uygulamasını kullanabilmeniz için aşağıdaki metinleri okumanız ve kabul etmeniz gerekmektedir.
            </Text>

            {/* Aydınlatma Metni */}
            <TouchableOpacity 
              style={styles.consentLink}
              onPress={() => setShowFullText('aydinlatma')}
            >
              <View style={styles.consentLinkIcon}>
                <Ionicons name="document-text" size={24} color="#3FA9F5" />
              </View>
              <View style={styles.consentLinkText}>
                <Text style={styles.consentLinkTitle}>Aydınlatma Metni (KVKK)</Text>
                <Text style={styles.consentLinkDesc}>Kişisel verilerinizin nasıl işlendiğini öğrenin</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* Gizlilik Politikası */}
            <TouchableOpacity 
              style={styles.consentLink}
              onPress={() => setShowFullText('gizlilik')}
            >
              <View style={styles.consentLinkIcon}>
                <Ionicons name="lock-closed" size={24} color="#3FA9F5" />
              </View>
              <View style={styles.consentLinkText}>
                <Text style={styles.consentLinkTitle}>Gizlilik Politikası</Text>
                <Text style={styles.consentLinkDesc}>Verilerinizin nasıl korunduğunu öğrenin</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <Text style={styles.consentNote}>
              ⚠️ Devam ederek, yukarıdaki metinleri okuduğunuzu, anladığınızı ve kabul ettiğinizi onaylıyorsunuz.
            </Text>
          </ScrollView>

          <View style={styles.consentButtons}>
            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
              <Text style={styles.declineButtonText}>Reddet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <LinearGradient
                colors={['#22C55E', '#16A34A']}
                style={styles.acceptButtonGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.acceptButtonText}>Kabul Ediyorum</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ===================== DESTEK MODAL =====================

interface SupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SupportModal({ visible, onClose }: SupportModalProps) {
  const openWhatsApp = () => {
    const phone = '905001234567'; // WhatsApp numarası
    const message = 'Merhaba, Leylek uygulaması hakkında destek almak istiyorum.';
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'WhatsApp açılamadı. Lütfen WhatsApp\'ın yüklü olduğundan emin olun.');
    });
  };

  const openEmail = () => {
    const email = 'destek@leylekapp.com';
    const subject = 'Leylek Uygulama Destek Talebi';
    const body = 'Merhaba,\n\nDestek talebim:\n\n';
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Hata', 'E-posta uygulaması açılamadı.');
    });
  };

  const callPhone = () => {
    const phone = '+903120000000';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Hata', 'Telefon uygulaması açılamadı.');
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.supportContainer}>
          <LinearGradient
            colors={['#3FA9F5', '#2563EB']}
            style={styles.supportHeader}
          >
            <Ionicons name="headset" size={40} color="#FFF" />
            <Text style={styles.supportTitle}>Destek</Text>
            <Text style={styles.supportSubtitle}>Size nasıl yardımcı olabiliriz?</Text>
          </LinearGradient>

          <View style={styles.supportOptions}>
            {/* WhatsApp */}
            <TouchableOpacity style={styles.supportOption} onPress={openWhatsApp}>
              <View style={[styles.supportOptionIcon, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={28} color="#FFF" />
              </View>
              <View style={styles.supportOptionText}>
                <Text style={styles.supportOptionTitle}>WhatsApp</Text>
                <Text style={styles.supportOptionDesc}>Hızlı mesaj gönderin</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* E-posta */}
            <TouchableOpacity style={styles.supportOption} onPress={openEmail}>
              <View style={[styles.supportOptionIcon, { backgroundColor: '#EA4335' }]}>
                <Ionicons name="mail" size={28} color="#FFF" />
              </View>
              <View style={styles.supportOptionText}>
                <Text style={styles.supportOptionTitle}>E-posta</Text>
                <Text style={styles.supportOptionDesc}>destek@leylekapp.com</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {/* Telefon */}
            <TouchableOpacity style={styles.supportOption} onPress={callPhone}>
              <View style={[styles.supportOptionIcon, { backgroundColor: '#3FA9F5' }]}>
                <Ionicons name="call" size={28} color="#FFF" />
              </View>
              <View style={styles.supportOptionText}>
                <Text style={styles.supportOptionTitle}>Telefon</Text>
                <Text style={styles.supportOptionDesc}>+90 312 000 00 00</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <Text style={styles.supportNote}>
            Çalışma saatleri: Hafta içi 09:00 - 18:00
          </Text>

          <TouchableOpacity style={styles.supportCloseButton} onPress={onClose}>
            <Text style={styles.supportCloseButtonText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ===================== STİLLER =====================

const styles = StyleSheet.create({
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // KVKK Consent Modal
  consentContainer: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  consentHeader: {
    alignItems: 'center',
    padding: 24,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
  },
  consentScroll: {
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  consentIntro: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  consentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  consentLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  consentLinkText: {
    flex: 1,
  },
  consentLinkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  consentLinkDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  consentNote: {
    fontSize: 13,
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    lineHeight: 20,
  },
  consentButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  acceptButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Full Text View
  fullTextContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  fullTextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  fullTextTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  fullTextScroll: {
    flex: 1,
    padding: 20,
  },
  fullTextContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 24,
  },
  closeFullTextButton: {
    margin: 16,
    backgroundColor: '#3FA9F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeFullTextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Support Modal
  supportContainer: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  supportHeader: {
    alignItems: 'center',
    padding: 24,
  },
  supportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
  },
  supportSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  supportOptions: {
    padding: 16,
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  supportOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  supportOptionText: {
    flex: 1,
  },
  supportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  supportOptionDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  supportNote: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  supportCloseButton: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  supportCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});
