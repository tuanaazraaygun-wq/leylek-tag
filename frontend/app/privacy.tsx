/**
 * Gizlilik Politikası Sayfası
 */

import React from 'react';
import { LegalDocumentReader, type LegalSection } from '../components/legal/LegalDocumentReader';
import { LEGAL_DOC_LAST_UPDATED } from '../lib/legalUxCopy';

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Genel İlke',
    body:
      'Leylek Yolculuk, kullanıcı verilerini yalnızca hizmet sunumu amacıyla işler. Yetkisiz üçüncü kişilerle paylaşılmaz.',
  },
  {
    title: '2. Konum Verisi',
    body:
      'Konum verisi yalnızca:\n• Yolculuk oluşturma\n• Aktif yolculuk süresi\n\nboyunca kullanılır. Sürekli arka plan takibi yapılmaz.',
  },
  {
    title: '3. Ürün Kapsamı (Bilgilendirme)',
    body:
      'Uygulama kapsamında aşağıdaki ürün özellikleri kapsamında veri işlenebilir:\n• Sürücü/yolcu eşleşme ve teklif sistemi\n• Leylek Teklifi / Muhabbet mesajlaşma\n• Sesli görüşme / VoIP kullanımı\n• Sesli mesaj veya ses verisi özellikleri (varsa)\n• Cihaz, log ve güvenlik kayıtları',
  },
  {
    title: '4. Sürücü Doğrulama',
    body:
      'Ehliyet ve araç görselleri:\n• Kimlik doğrulama\n• Güvenlik\n• Dolandırıcılığı önleme\n\namaçlı işlenir ve kamuya açık paylaşılmaz.',
  },
  {
    title: '5. Muhabbet İçerik Saklama',
    body:
      'Muhabbet metin mesajları sunucuda en fazla 90 gün erişilebilir.\n\nSes mesajları en fazla 30 gün saklanabilir.\n\nSüre sonunda erişim kapanır; kayıtlar güvenlik, destek ve sistem operasyonları kapsamında silinir, anonimleştirilir veya erişime kapatılır.',
  },
  {
    title: '6. Güvenlik',
    body:
      '• HTTPS şifreleme\n• Yetkilendirme sistemi\n• Rol bazlı erişim\n• Sunucu taraflı güvenlik önlemleri',
  },
  {
    title: '7. Hesap Silme / Veri Silme',
    body:
      'Kullanıcılar uygulama içinden hesaplarını silebilir.\n\nSilme sonrası veriler yasal zorunluluklar saklı kalmak kaydıyla silinir veya anonimleştirilir.',
  },
  {
    title: '8. KVKK Başvuru Hakları',
    body:
      'KVKK kapsamındaki başvuru haklarınızı kullanmak için aşağıdaki iletişim kanallarını kullanabilirsiniz.',
  },
  {
    title: '9. 5651 Uyum',
    body:
      'Şirket, 5651 sayılı Kanun kapsamında hukuka aykırı içerikleri bildirim üzerine kaldırma yükümlülüğünü yerine getirir.',
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocumentReader
      title="Gizlilik Politikası"
      subtitle="Kişisel verilerinizin korunması"
      lastUpdated={LEGAL_DOC_LAST_UPDATED}
      sections={PRIVACY_SECTIONS}
    />
  );
}
