/**
 * KVKK Aydınlatma Metni Sayfası
 */

import React from 'react';
import { LegalDocumentReader, type LegalSection } from '../components/legal/LegalDocumentReader';
import { LEGAL_DOC_LAST_UPDATED } from '../lib/legalUxCopy';

const KVKK_SECTIONS: LegalSection[] = [
  {
    title: '1. Veri Sorumlusu',
    body:
      'Leylek Tag mobil uygulaması kapsamında kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla KAREKOD TEKNOLOJİ VE YAZILIM A.Ş. tarafından işlenmektedir.',
  },
  {
    title: '2. İşlenen Veriler',
    body: '',
    subsections: [
      {
        subtitle: 'Yolcu Kullanıcılar:',
        body:
          '• Ad, Soyad\n• Telefon numarası\n• Şehir bilgisi\n• Konum verisi (aktif kullanım sırasında)\n• Mesaj içerikleri\n• Yolculuk geçmişi',
      },
      {
        subtitle: 'Sürücü Kullanıcılar (ek olarak):',
        body:
          '• Ehliyet görseli\n• Araç ön ve arka fotoğrafları (plaka dahil)\n• Plaka numarası\n• Araç bilgileri',
      },
      {
        subtitle: 'Teknik Veriler:',
        body:
          "• IP adresi\n• Cihaz bilgisi\n• Push bildirim token'ı\n• Sistem log ve güvenlik kayıtları",
      },
    ],
  },
  {
    title: '3. İşleme Amaçları',
    body:
      '• Kullanıcı kaydı ve kimlik doğrulama\n• Yolcu–sürücü eşleştirme\n• Sürücü/yolcu teklif sistemi\n• Leylek Teklifi / Muhabbet mesajlaşma hizmetleri\n• Sesli görüşme / VoIP hizmetleri\n• Sesli mesaj veya ses verisi özellikleri (varsa)\n• Güvenliğin sağlanması\n• Hukuki yükümlülüklerin yerine getirilmesi\n• Dolandırıcılığın önlenmesi\n• Topluluk alanının yönetimi',
  },
  {
    title: '4. Saklama Süreleri',
    body:
      '• Hesap bilgileri: Üyelik süresince\n• Trip kayıtları: 5 yıl\n• Muhabbet metin mesajları: sunucuda en fazla 90 gün erişilebilir\n• Muhabbet ses mesajları (varsa): en fazla 30 gün saklanabilir\n• Ehliyet ve araç görselleri: Üyelik süresince\n• Log kayıtları: Mevzuat süresi boyunca\n\nSüre sonunda erişim kapanır; kayıtlar güvenlik, destek ve sistem operasyonları kapsamında silinir, anonimleştirilir veya erişime kapatılır.',
  },
  {
    title: '5. Yurt Dışına Aktarım',
    body:
      'Altyapı hizmetleri (Supabase, Google Maps vb.) nedeniyle veriler yurt dışında bulunan sunucularda saklanabilir.',
  },
  {
    title: '6. Haklarınız',
    body:
      'KVKK m.11 kapsamındaki haklarınızı info@karekodteknoloji.com adresine başvurarak kullanabilirsiniz. Destek hattı: 0850 307 80 29.',
  },
];

export default function KVKKScreen() {
  return (
    <LegalDocumentReader
      title="KVKK Aydınlatma Metni"
      subtitle="Kişisel verilerin işlenmesine ilişkin aydınlatma"
      showCompanyMeta
      lastUpdated={LEGAL_DOC_LAST_UPDATED}
      sections={KVKK_SECTIONS}
    />
  );
}
