import type { LegalRegistryDocument, LegalRegistryDocumentId } from './legalDocumentTypes';

const DRAFT_META = {
  version: '0.1.0-draft',
  lastUpdated: '2026-06',
  company: 'Karekod Teknoloji ve Yazılım A.Ş.',
  lawyerReviewRequired: true,
} as const;

const DRAFT_PREAMBLE =
  'Bu metin taslak niteliğindedir ve nitelikli hukukçu incelemesi tamamlanana kadar bağlayıcı hukuki dayanak olarak kullanılmamalıdır.';

export const LEGAL_REGISTRY_DOCUMENTS: Record<LegalRegistryDocumentId, LegalRegistryDocument> = {
  'terms-user': {
    id: 'terms-user',
    title: 'Kullanıcı Sözleşmesi',
    subtitle: 'Topluluk odaklı gönüllü yol paylaşımı platformu kullanım koşulları (taslak)',
    readingTimeMinutes: 7,
    ...DRAFT_META,
    sections: [
      {
        title: 'Taraflar ve tanımlar',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          'İşbu taslak sözleşme; Karekod Teknoloji ve Yazılım A.Ş. (“Şirket”, “LeylekTAG”) ile LeylekTAG mobil uygulamasını kullanan gerçek kişi kullanıcı (“Kullanıcı”) arasında akdedilir.\n\n' +
          '“Platform”: Yolcu ve sürücü profillerinin eşleştirildiği, teklif ve iletişim altyapısının sunulduğu dijital ortamdır.\n\n' +
          '“Yol paylaşımı”: Tarafların karşılıklı mutabakatıyla gerçekleşen, gönüllü nitelikte ortak rota paylaşımıdır.',
      },
      {
        title: 'Platformun niteliği',
        body:
          'LeylekTAG; topluluk odaklı gönüllü yol paylaşımı ve kişi eşleştirme teknolojisi sunan bir platformdur.\n\n' +
          'LeylekTAG bir taksi uygulaması, taşıma şirketi veya ödeme kuruluşu değildir. Platform, ticari yolcu taşımacılığı hizmeti sunmaz ve taşıma sözleşmesi tarafı değildir.',
      },
      {
        title: 'Gönüllü yol paylaşımı ve kişi eşleştirme',
        body:
          'Platform; kullanıcıların rota, teklif ve iletişim yoluyla birbirleriyle eşleşmesine teknik altyapı sağlar.\n\n' +
          'Yol paylaşımına ilişkin karar, rota, zaman ve katkı payı (masraf paylaşımı) taraflar arasında serbestçe belirlenir. LeylekTAG bu süreçte aracı teknoloji sağlayıcısıdır.',
      },
      {
        title: 'Kullanıcı yükümlülükleri',
        body:
          'Kullanıcı;\n' +
          '• 18 yaşından büyük olduğunu beyan eder,\n' +
          '• Kayıt ve profil bilgilerini doğru tutar,\n' +
          '• Yürürlükteki mevzuata ve Topluluk Kurallarına uyar,\n' +
          '• Diğer kullanıcılara saygılı iletişim kurar,\n' +
          '• Platformu yalnızca amacına uygun kullanır.',
      },
      {
        title: 'LeylekTAG’in rolü ve sorumluluk sınırları',
        body:
          'LeylekTAG; eşleşme, iletişim, doğrulama katmanları ve güvenlik özellikleri sunar; yol paylaşımının tarafı veya garantörü değildir.\n\n' +
          'Yol paylaşımı sırasında doğabilecek trafik, maddi/manevi zarar, gecikme veya taraflar arası anlaşmazlıklardan LeylekTAG sorumlu tutulamaz. Platform tahsilat yapmaz; katkı payı mutabakatı kullanıcılar arasındadır.',
      },
      {
        title: 'Hesap güvenliği',
        body:
          'Kullanıcı, hesap erişim bilgilerinin gizliliğinden sorumludur. Şüpheli kullanım durumunda destek kanallarına bildirim yapılmalıdır.\n\n' +
          'Şirket; güvenlik, kötüye kullanım ve mevzuat uyumu kapsamında hesabı askıya alma veya sonlandırma hakkını saklı tutar.',
      },
      {
        title: 'Uyuşmazlık ve iletişim',
        body:
          'Kişisel verilere ilişkin ayrıntılar KVKK Aydınlatma Metni ve Gizlilik Politikasında yer alır.\n\n' +
          'Destek ve başvuru: info@karekodteknoloji.com · 0850 307 80 29\n\n' +
          'Uyuşmazlık hükümleri nitelikli hukukçu incelemesi sonrası netleştirilecektir.',
      },
    ],
  },

  'terms-driver': {
    id: 'terms-driver',
    title: 'Sürücü Sözleşmesi',
    subtitle: 'Gönüllü sürücü profili ve yol paylaşımı yükümlülükleri (taslak)',
    readingTimeMinutes: 8,
    ...DRAFT_META,
    sections: [
      {
        title: 'Sürücü başvurusu ve beyanlar',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          'Sürücü profili; Kullanıcı Sözleşmesine ek nitelikte olup gönüllü yol paylaşımı sunmak isteyen kullanıcılar için geçerlidir.\n\n' +
          'Sürücü; ticari taşımacılık veya taksi hizmeti sunmadığını, yol paylaşımını gönüllü ve topluluk odaklı gerçekleştirdiğini beyan eder.',
      },
      {
        title: 'Ehliyet, araç ve belge doğruluğu',
        body:
          'Sürücü;\n' +
          '• Geçerli sürücü belgesine sahip olduğunu,\n' +
          '• Aracın trafiğe çıkmaya uygun olduğunu,\n' +
          '• Zorunlu sigorta ve yasal yükümlülüklerini yerine getirdiğini,\n' +
          '• Kimlik doğrulama sürecinde sunulan belgelerin güncel ve kendisine ait olduğunu\n\n' +
          'beyan ve taahhüt eder.',
      },
      {
        title: 'Gönüllü yol paylaşımı ilkesi',
        body:
          'Sürücü; LeylekTAG üzerinden sunulan yol paylaşımının gönüllü nitelikte olduğunu, platformun taşıma işletmecisi olmadığını kabul eder.\n\n' +
          'Rota, kapasite ve katkı payı beklentisi teklif aşamasında diğer kullanıcıyla karşılıklı netleştirilir.',
      },
      {
        title: 'Trafik ve güvenlik sorumluluğu',
        body:
          'Trafik kurallarına uyum, yolcu güvenliği, araç bakımı ve yol paylaşımı sırasındaki davranış sürücünün sorumluluğundadır.\n\n' +
          'LeylekTAG; sürücünün trafik veya ceza geçmişini resmi merciler nezdinde doğrulama taahhüdü vermez (ayrıntılar Kimlik Doğrulama Bilgilendirmesinde).',
      },
      {
        title: 'Katkı payı mutabakatı',
        body:
          'Yol paylaşım katkı payı (masraf paylaşımı) taraflar arasında belirlenir. LeylekTAG platform tahsilatı yapmaz; ödeme kuruluşu veya finansal aracı değildir.\n\n' +
          'Nakit veya IBAN / havale yoluyla katkı, tarafların karşılıklı mutabakatıyla tamamlanır. Ayrıntılar Katkı Payı ve IBAN Bilgilendirmesinde yer alır.',
      },
      {
        title: 'Platform kuralları ve yaptırımlar',
        body:
          'Sürücü; Topluluk Kuralları, Kullanıcı Sözleşmesi ve mevzuata aykırı davranışlardan sorumludur.\n\n' +
          'Şirket; güvenlik, şikayet veya belge tutarsızlığı hallerinde sürücü profilini askıya alma veya kapatma hakkını saklı tutar.',
      },
      {
        title: 'Sözleşme kabulü',
        body:
          'Sürücü başvurusu; belge yükleme, doğrulama adımları ve elektronik onay ile tamamlanır.\n\n' +
          'Kabul anı ve sürüm bilgisi ürün kayıtlarında tutulabilir. Güncellemeler uygulama içi bildirimle duyurulur; nitelikli hukukçu incelemesi sonrası yürürlük tarihi netleştirilecektir.',
      },
    ],
  },

  'identity-verification': {
    id: 'identity-verification',
    title: 'Kimlik Doğrulama Bilgilendirmesi',
    subtitle: 'Sürücü profili doğrulama süreci ve veri işleme özeti (taslak)',
    readingTimeMinutes: 6,
    ...DRAFT_META,
    sections: [
      {
        title: 'Doğrulamanın amacı',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          'Kimlik doğrulama; topluluk odaklı yol paylaşımında profil güvenilirliğini artırmak, kötüye kullanımı azaltmak ve sürücü rozetini anlamlı kılmak içindir.\n\n' +
          'LeylekTAG resmi devlet onayı, sabıka kaydı sorgusu veya taksi/taşımacılık lisansı kontrolü yapmaz.',
      },
      {
        title: 'Toplanan bilgiler ve belgeler',
        body:
          'Doğrulama kapsamında (ürün sürümüne göre) şunlar istenebilir:\n' +
          '• Ehliyet görseli\n' +
          '• Araç / plaka fotoğrafları\n' +
          '• Ruhsat veya araç bilgileri\n' +
          '• Telefon doğrulaması\n' +
          '• Profil adı ve iletişim bilgileri\n\n' +
          'Ayrıntılı veri kategorileri KVKK Aydınlatma Metninde listelenir.',
      },
      {
        title: 'Selfie / belge inceleme',
        body:
          'Belge görselleri; okunabilirlik, tutarlılık ve sahtecilik riski açısından otomatik ve/veya manuel süreçlerle incelenebilir.\n\n' +
          'Selfie veya yüz eşleştirme katmanı devreye alındığında, kullanıcıya ayrı bilgilendirme sunulacaktır.',
      },
      {
        title: 'Manuel inceleme',
        body:
          'Otomatik kontroller yetersiz kaldığında veya şüpheli durumlarda yetkili operasyon ekibi manuel inceleme yapabilir.\n\n' +
          'İnceleme sonucu onay, ek belge talebi veya ret gerekçesi uygulama içi bildirimle iletilir.',
      },
      {
        title: 'Gelecek NFC / OCR / liveness katmanı',
        body:
          'Ürün yol haritasında NFC okuma, OCR (optik karakter tanıma) ve canlılık (liveness) kontrolleri planlanabilir.\n\n' +
          'Bu katmanlar devreye alınmadan önce ayrı aydınlatma ve — gerektiğinde — açık rıza metni yayımlanacaktır.',
      },
      {
        title: 'Saklama ve erişim',
        body:
          'Doğrulama belgeleri; üyelik süresince ve mevzuattaki zorunlu süreler boyunca güvenli ortamda saklanır.\n\n' +
          'Erişim; yetkili moderasyon, destek ve güvenlik ekipleriyle sınırlıdır. Belgeler kamuya açık profilde gösterilmez.',
      },
      {
        title: 'Kullanıcı hakları',
        body:
          'KVKK m.11 kapsamındaki haklarınızı info@karekodteknoloji.com adresine başvurarak kullanabilirsiniz.\n\n' +
          'Doğrulama reddi veya belge güncelleme talepleri destek kanalları üzerinden iletilebilir. Detaylı prosedür hukukçu incelemesi sonrası yayımlanacaktır.',
      },
    ],
  },

  'contribution-iban': {
    id: 'contribution-iban',
    title: 'Katkı Payı ve IBAN Bilgilendirmesi',
    subtitle: 'Taraflar arası masraf paylaşımı ve IBAN iletimi (taslak)',
    readingTimeMinutes: 5,
    ...DRAFT_META,
    sections: [
      {
        title: 'Platform tahsilat yapmaz',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          'LeylekTAG bir ödeme kuruluşu değildir; uygulama içinde katkı payı tahsilatı yapmaz, ödeme hesabı işletmez ve finansal aracılık sunmaz.\n\n' +
          'Gösterilen tutarlar bilgilendirme ve taraflar arası mutabakat amaçlıdır.',
      },
      {
        title: 'Katkı payı nedir',
        body:
          'Katkı payı (masraf paylaşımı); gönüllü yol paylaşımında yakıt, otoyol ve benzeri masrafların taraflarca karşılıklı anlaşmayla paylaşılmasıdır.\n\n' +
          'Tutar ve yöntem teklif / eşleşme aşamasında netleştirilir; LeylekTAG bu anlaşmanın tarafı değildir.',
      },
      {
        title: 'Nakit katkı',
        body:
          'Taraflar katkı payını nakit olarak kararlaştırabilir. Yolculuk sonunda yolcu, katkıyı ilettiğini; sürücü ise aldığını uygulama içi onay adımlarıyla bildirebilir.\n\n' +
          'Nakit teslimi fiziksel ortamda taraflar arasında gerçekleşir.',
      },
      {
        title: 'IBAN / havale katkı',
        body:
          'Sürücü, isteğe bağlı olarak IBAN bilgisini profiline ekleyebilir. IBAN; yalnızca eşleşen tarafa katkı payı iletimi için gösterilir.\n\n' +
          'Havale/EFT işlemi banka kanallarında taraflar arasında yapılır. LeylekTAG transferi gerçekleştirmez veya garanti etmez.',
      },
      {
        title: 'Taraflar arası mutabakat',
        body:
          'Yolculuk kapanışında taraflar; nakit veya IBAN yoluyla katkı bildirimini karşılıklı onaylar. Onay, platformun tahsilat yaptığı anlamına gelmez.\n\n' +
          'Kullanıcılar katkı tutarı ve alıcı bilgisini kendi sorumluluklarında kontrol etmekle yükümlüdür.',
      },
      {
        title: 'Uyuşmazlık durumunda destek sınırları',
        body:
          'Katkı payına ilişkin taraflar arası anlaşmazlıklarda LeylekTAG mahkeme kararı veya resmi belge olmaksızın ödeme iadesi veya zorunlu tahsilat yapamaz.\n\n' +
          'Destek ekibi; teknik kayıtlar ve bildirimler çerçevesinde bilgilendirme sağlayabilir. Hukuki uyuşmazlık çözümü taraflara aittir.',
      },
    ],
  },

  'community-guidelines': {
    id: 'community-guidelines',
    title: 'Topluluk Kuralları',
    subtitle: 'Muhabbet, teklif ve yol paylaşımı davranış standartları (taslak)',
    readingTimeMinutes: 6,
    ...DRAFT_META,
    sections: [
      {
        title: 'Saygılı iletişim',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          'LeylekTAG topluluğunda tüm kullanıcılar birbirine saygılı, ayrımcılık içermeyen ve güvenli bir dil kullanmalıdır.\n\n' +
          'Hakaret, tehdit, taciz ve nefret söylemi yasaktır.',
      },
      {
        title: 'Güvenli yol paylaşımı',
        body:
          'Yol paylaşımı kararları bilinçli ve gönüllü verilmelidir. Taraflar rota, buluşma noktası ve katkı payını netleştirmelidir.\n\n' +
          'QR doğrulama ve uygulama içi onay adımları atlanmamalı; güvenlik uyarıları dikkate alınmalıdır.',
      },
      {
        title: 'Yasaklı davranışlar',
        body:
          'Aşağıdakiler kesinlikle yasaktır:\n' +
          '• Dolandırıcılık veya yanıltıcı teklif\n' +
          '• Yasadışı faaliyet veya eşya taşıma teklifi\n' +
          '• İzinsiz kişisel veri paylaşımı\n' +
          '• Platform dışına zorla yönlendirme ve ödeme manipülasyonu\n' +
          '• Spam, bot veya çoklu sahte hesap kullanımı',
      },
      {
        title: 'Yanıltıcı bilgi ve sahte hesap',
        body:
          'Profil, ehliyet, araç veya kimlik bilgilerinde yanıltıcı içerik sunulamaz. Başkasının adına hesap işletmek yasaktır.\n\n' +
          'Tespit halinde hesap askıya alınabilir veya kapatılabilir.',
      },
      {
        title: 'Şikayet / raporlama',
        body:
          'Kural ihlali veya güvensiz davranış uygulama içi raporlama ve destek kanallarıyla bildirilebilir.\n\n' +
          'Acil güvenlik risklerinde yerel acil hatları (112 vb.) aranmalıdır; LeylekTAG acil müdahale birimi değildir.',
      },
      {
        title: 'Yaptırımlar',
        body:
          'İhlalin niteliğine göre uyarı, geçici askı, özellik kısıtı veya kalıcı hesap kapatma uygulanabilir.\n\n' +
          'Yaptırım ve itiraz prosedürleri nitelikli hukukçu incelemesi sonrası ayrıntılandırılacaktır.',
      },
    ],
  },
};

export function getLegalRegistryDocument(id: LegalRegistryDocumentId): LegalRegistryDocument {
  return LEGAL_REGISTRY_DOCUMENTS[id];
}
