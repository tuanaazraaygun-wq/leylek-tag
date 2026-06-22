/**
 * Hizmet Şartları Sayfası
 */

import React from 'react';
import { LegalDocumentReader, type LegalSection } from '../components/legal/LegalDocumentReader';
import { LEGAL_DOC_LAST_UPDATED } from '../lib/legalUxCopy';

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Hizmet Tanımı',
    body:
      'Leylek Tag, yolcu ve sürücü kullanıcıları dijital ortamda eşleştiren bir platformdur.\n\nŞirket taşımacılık hizmeti sunmaz.',
  },
  {
    title: '2. Sorumluluk',
    body:
      'Yolculuk sırasında meydana gelebilecek:\n• Trafik kazaları\n• Maddi/manevi zararlar\n• Kullanıcılar arası uyuşmazlıklar\n\ntaraflar arasındadır.',
  },
  {
    title: '3. Sürücü Sorumluluğu',
    body:
      'Sürücü:\n• Geçerli sürücü belgesine sahip olduğunu\n• Aracın trafiğe uygun olduğunu\n• Sigortasının geçerli olduğunu\n\nbeyan eder.',
  },
  {
    title: '4. Topluluk Kuralları',
    body:
      'Yasak:\n• Hakaret\n• Tehdit\n• Dolandırıcılık\n• Kişisel veri paylaşımı\n\nŞirket içerik kaldırma ve hesap kapatma hakkını saklı tutar.',
  },
  {
    title: '5. Katkı payı ve masraf paylaşımı',
    body:
      'Masraf paylaşımı (katkı payı) uygulama içi teklif sistemiyle taraflar arasında belirlenir.\n\nLeylekTAG platform tahsilatı yapmaz; katkı payı taraflar arasında mutabakata bağlıdır.',
  },
  {
    title: '6. Ürün Kapsamı (Bilgilendirme)',
    body:
      "Hizmet kapsamında aşağıdaki modüller çalışabilir:\n• Konum verisi ile sürücü/yolcu eşleşme ve teklif sistemi\n• Leylek Teklifi / Muhabbet mesajlaşma\n• Sesli görüşme / VoIP ve ilgili teknik kayıtlar\n• Sesli mesaj veya ses verisi özellikleri (varsa)\n• Cihaz, log ve güvenlik kayıtları\n\nDetaylar Gizlilik Politikası ve KVKK Aydınlatma Metni'nde açıklanır.",
  },
  {
    title: '7. Muhabbet Kayıt Süresi (Bilgilendirme)',
    body:
      'Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse) ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir.',
  },
  {
    title: '8. Hesap Silme / Veri Silme',
    body:
      'Kullanıcı, uygulama içinden hesap silme talebi oluşturabilir. İşlem koşulları ve detaylar ilgili hesap silme açıklama sayfasında yer alır.',
  },
  {
    title: '9. KVKK Başvuru Hakları ve Destek',
    body:
      'KVKK kapsamındaki başvuru hakları ve destek iletişimi için aşağıdaki kanallar kullanılabilir.',
  },
  {
    title: '10. Uyuşmazlık',
    body: 'Uyuşmazlıklarda Ankara Mahkemeleri yetkilidir.',
  },
];

export default function TermsScreen() {
  return (
    <LegalDocumentReader
      title="Hizmet Şartları"
      subtitle="Platform kullanım koşulları"
      lastUpdated={LEGAL_DOC_LAST_UPDATED}
      sections={TERMS_SECTIONS}
    />
  );
}
