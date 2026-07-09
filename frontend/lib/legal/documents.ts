import type { LegalRegistryDocument, LegalRegistryDocumentId } from './legalDocumentTypes';
import {
  LEGAL_DRAFT_VERSION,
  LEGAL_LAST_UPDATED,
  LEGAL_PRODUCT_DISPLAY_NAME,
} from './brand';

const PN = LEGAL_PRODUCT_DISPLAY_NAME;

const COMPANY = 'Karekod Teknoloji ve Yazılım A.Ş.';

const SUPPORT_CONTACT = 'info@karekodteknoloji.com · 0850 307 80 29';

const ACCOUNT_ACTION_NOTICE =
  `Şirket; işbu metin kapsamındaki kuralların ihlali, mevzuata aykırılık şüphesi veya makul güvenlik gerekçesi bulunması halinde hesabı incelemeye alabilir, geçici olarak askıya alabilir veya sonlandırabilir. İşlem gerekçesi mümkün olduğunca kullanıcıya bildirilir. Kullanıcı, ${SUPPORT_CONTACT} üzerinden itiraz ve destek talebinde bulunabilir. Şirket, keyfi veya sınırsız hesap kapatma uygulamaz.`;

const DRAFT_META = {
  version: LEGAL_DRAFT_VERSION,
  lastUpdated: '09/07/2026',
  company: COMPANY,
  lawyerReviewRequired: true,
} as const;

const PRODUCTION_META = {
  version: '1.0.0',
  lastUpdated: LEGAL_LAST_UPDATED,
  company: COMPANY,
  lawyerReviewRequired: false,
} as const;

const DRAFT_PREAMBLE =
  'Bu metin taslak niteliğindedir ve nitelikli hukukçu incelemesi tamamlanana kadar bağlayıcı hukuki dayanak olarak kullanılmamalıdır.';

export const LEGAL_REGISTRY_DOCUMENTS: Record<LegalRegistryDocumentId, LegalRegistryDocument> = {
  kvkk: {
    id: 'kvkk',
    title: 'KVKK Aydınlatma Metni',
    subtitle: 'Kişisel verilerin işlenmesine ilişkin aydınlatma',
    readingTimeMinutes: 6,
    ...PRODUCTION_META,
    sections: [
      {
        title: '1. Veri Sorumlusu',
        body:
          `${PN} mobil uygulaması kapsamında kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla KAREKOD TEKNOLOJİ VE YAZILIM A.Ş. tarafından işlenmektedir.`,
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
    ],
  },

  privacy: {
    id: 'privacy',
    title: 'Gizlilik Politikası',
    subtitle: 'Kişisel verilerinizin korunması',
    readingTimeMinutes: 6,
    ...PRODUCTION_META,
    sections: [
      {
        title: '1. Genel İlke',
        body:
          `${PN}, kullanıcı verilerini yalnızca hizmet sunumu amacıyla işler. Yetkisiz üçüncü kişilerle paylaşılmaz.`,
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
    ],
  },

  'terms-user': {
    id: 'terms-user',
    title: 'Kullanıcı Sözleşmesi',
    subtitle: 'Platform kullanım koşulları ve kullanıcı yükümlülükleri (avukat taslağı)',
    readingTimeMinutes: 14,
    ...DRAFT_META,
    sections: [
      {
        title: 'Madde 1 — Taraflar',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          `İşbu Kullanıcı Sözleşmesi; ${COMPANY} (“Şirket”) ile ${PN} mobil uygulamasına üye olan ve platformu kullanan gerçek kişi (“Kullanıcı”) arasında elektronik ortamda kurulmuştur.`,
      },
      {
        title: 'Madde 2 — Tanımlar',
        body:
          `• Platform: ${PN} mobil uygulaması ve ilişkili dijital hizmetler.\n` +
          '• Şirket: Karekod Teknoloji ve Yazılım A.Ş.\n' +
          '• Kullanıcı: Platforma kayıt olan veya platformu kullanan gerçek kişi.\n' +
          '• Sürücü: Gönüllü yol paylaşımı sunan kullanıcı profili.\n' +
          '• Yolcu: Yol paylaşımı talep eden veya katılan kullanıcı profili.\n' +
          '• Yol paylaşımı: Tarafların karşılıklı mutabakatıyla gerçekleşen gönüllü ortak rota paylaşımı.\n' +
          '• Katkı payı: Seyahat masraflarının taraflar arasında karşılıklı anlaşmayla paylaşılması.\n' +
          '• Hesap: Kullanıcıya özgü platform erişim kaydı.',
      },
      {
        title: 'Madde 3 — Platformun hukuki niteliği',
        body:
          `${PN} yalnızca kullanıcıları dijital ortamda eşleştiren ve iletişim kurmalarına teknik altyapı sağlayan bir teknoloji platformudur.\n\n` +
          'Platform;\n' +
          '• taşıma veya yolcu taşımacılığı hizmeti sunmaz,\n' +
          '• taşıma sözleşmesinin tarafı değildir,\n' +
          '• ödeme kuruluşu veya elektronik para kuruluşu değildir,\n' +
          '• katkı payını belirlemez, tahsil etmez ve ödemeye aracılık etmez.\n\n' +
          'Kullanıcılar arasındaki hukuki ilişki, fiili davranışlar ve yolculuk sürecinden doğan sorumluluklar ilgili taraflara aittir.',
      },
      {
        title: 'Madde 4 — Üyelik ve rol kullanımı',
        body:
          'Kullanıcı; 18 yaşından büyük olduğunu, doğru ve güncel bilgi vereceğini, hesabını koruyacağını ve platformu hukuka uygun şekilde kullanacağını kabul eder.\n\n' +
          'Aynı hesap kapsamında yolcu ve/veya sürücü rolü seçilebilir. Rol değişiklikleri, ilgili doğrulama ve onay süreçlerine tabidir. Kullanıcı, seçtiği role uygun davranmakla yükümlüdür.',
      },
      {
        title: 'Madde 5 — Kimlik doğrulama',
        body:
          'Platform; güvenlik ve kötüye kullanımın önlenmesi amacıyla kimlik, ehliyet, ruhsat, araç görselleri ve diğer belgeleri talep edebilir. Sunulan belgelerin doğruluğundan kullanıcı sorumludur.\n\n' +
          'Doğrulama süreçleri profil güvenilirliğini artırmaya yöneliktir; resmi merciler nezdinde mutlak güvenilirlik veya hukuki garanti oluşturmaz.',
      },
      {
        title: 'Madde 6 — Sürücü yükümlülükleri',
        body:
          'Sürücü olarak hareket eden kullanıcı;\n' +
          '• geçerli sürücü belgesine sahip olduğunu,\n' +
          '• aracı kullanmaya yetkili olduğunu,\n' +
          '• zorunlu trafik sigortası ve yasal yükümlülükleri yerine getirdiğini,\n' +
          '• trafik kurallarına uyacağını,\n' +
          '• yolcu güvenliğini gözeterek hareket edeceğini\n\n' +
          'kabul eder. Ayrıntılar Sürücü Sözleşmesinde düzenlenir.',
      },
      {
        title: 'Madde 7 — Yolcu yükümlülükleri',
        body:
          'Yolcu olarak hareket eden kullanıcı;\n' +
          '• güvenlik kurallarına uyacağını,\n' +
          '• sürücüye ve araca zarar vermeyeceğini,\n' +
          '• buluşma ve yolculuk sürecinde saygılı davranacağını,\n' +
          '• doğru iletişim bilgisi kullanacağını\n\n' +
          'kabul eder.',
      },
      {
        title: 'Madde 8 — Katkı payı',
        body:
          'Katkı payı yalnızca seyahat masraflarının (yakıt, otoyol vb.) taraflar arasında karşılıklı anlaşmayla paylaşılması amacıyla belirlenir.\n\n' +
          'Platform katkı payını belirlemez, tahsil etmez, tutarı garanti etmez ve taraflar arasındaki mutabakatın tarafı değildir.',
      },
      {
        title: 'Madde 9 — Ödemeler',
        body:
          'Nakit veya banka transferi / havale yoluyla yapılan ödemeler doğrudan kullanıcılar arasında gerçekleşir. Platform ödeme hesabı işletmez, transfer gerçekleştirmez ve finansal aracılık sunmaz.\n\n' +
          'Kullanıcılar, katkı tutarı ve alıcı bilgisini kendi sorumluluklarında kontrol etmekle yükümlüdür.',
      },
      {
        title: 'Madde 10 — Yasak davranışlar',
        body:
          'Aşağıdaki davranışlar yasaktır:\n' +
          '• sahte hesap veya yanıltıcı profil oluşturmak,\n' +
          '• dolandırıcılık, taciz, tehdit, ayrımcılık veya nefret söylemi,\n' +
          '• hukuka aykırı faaliyet veya eşya taşıma teklifi,\n' +
          '• başkasının kimlik veya belgelerini kullanmak,\n' +
          '• platform güvenliğini ihlal eden yazılım, bot veya otomasyon kullanımı,\n' +
          '• ticari taşımacılık veya korsan taksi faaliyeti,\n' +
          '• kişisel verileri izinsiz paylaşmak,\n' +
          '• Topluluk Kurallarına veya mevzuata aykırı kullanım.',
      },
      {
        title: 'Madde 11 — Hesabın askıya alınması ve sonlandırılması',
        body: ACCOUNT_ACTION_NOTICE,
      },
      {
        title: 'Madde 12 — Kişisel veriler',
        body:
          'Kişisel veriler 6698 sayılı KVKK ve ilgili mevzuata uygun olarak işlenir. Ayrıntılı bilgi KVKK Aydınlatma Metni ve Gizlilik Politikasında yer alır.\n\n' +
          `Başvuru ve talepler: ${SUPPORT_CONTACT}`,
      },
      {
        title: 'Madde 13 — Fikri mülkiyet',
        body:
          'Platformun yazılımı, tasarımı, arayüzü, marka unsurları ve içerikleri ilgili mevzuat kapsamında Şirket veya lisans verenlerine aittir. İzinsiz kopyalama, tersine mühendislik veya ticari kullanım yasaktır.',
      },
      {
        title: 'Madde 14 — Sorumluluğun sınırlandırılması',
        body:
          `${PN}; yalnızca dijital eşleştirme ve iletişim altyapısı sağlar. Kullanıcılar arasındaki uyuşmazlıklar, trafik kazaları, maddi/manevi zararlar, gecikmeler, ödeme anlaşmazlıkları ve fiili davranışlardan Şirket sorumlu tutulamaz.\n\n` +
          'Platform, kullanıcı beyanlarının doğruluğunu garanti etmez.',
      },
      {
        title: 'Madde 15 — Uyuşmazlıklar',
        body:
          'İşbu sözleşmede Türk Hukuku uygulanır. Uyuşmazlıklarda Şirket merkezinin bulunduğu yer mahkeme ve icra daireleri yetkilidir.\n\n' +
          `Öncelikle destek kanalları: ${SUPPORT_CONTACT}`,
      },
      {
        title: 'Madde 16 — Yürürlük',
        body:
          'Kullanıcı, üyeliği tamamlayarak ve platformu kullanmaya devam ederek işbu sözleşmeyi kabul etmiş sayılır. Güncellemeler uygulama içinde yayımlandığında duyurulur.',
      },
    ],
  },

  'terms-driver': {
    id: 'terms-driver',
    title: 'Sürücü Sözleşmesi',
    subtitle: 'Gönüllü sürücü profili, belge yükümlülükleri ve sorumluluklar (avukat taslağı)',
    readingTimeMinutes: 12,
    ...DRAFT_META,
    sections: [
      {
        title: 'Madde 1 — Taraflar',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          `İşbu Sürücü Sözleşmesi; ${COMPANY} (“Şirket”) ile ${PN} platformuna sürücü olarak kayıt olan kullanıcı (“Sürücü”) arasında elektronik ortamda kurulmuştur. Kullanıcı Sözleşmesi ile birlikte okunur.`,
      },
      {
        title: 'Madde 2 — Sözleşmenin konusu',
        body:
          'Bu sözleşme; sürücünün platformu kullanırken uyması gereken kuralları, belge ve güvenlik yükümlülüklerini ve tarafların hak ile sorumluluklarını düzenler.',
      },
      {
        title: 'Madde 3 — Sürücü beyanları',
        body:
          'Sürücü;\n' +
          '• geçerli sürücü belgesine (ehliyet) sahip olduğunu,\n' +
          '• aracı kullanmaya yetkili olduğunu,\n' +
          '• verdiği profil, araç ve iletişim bilgilerinin doğru olduğunu,\n' +
          '• ticari taşımacılık veya taksi hizmeti sunmadığını,\n' +
          '• yol paylaşımını gönüllü ve topluluk odaklı gerçekleştirdiğini\n\n' +
          'beyan ve taahhüt eder.',
      },
      {
        title: 'Madde 4 — Ehliyet, ruhsat ve belge doğrulama',
        body:
          'Sürücü, talep edilmesi halinde ehliyet, araç ruhsatı, zorunlu trafik sigortası poliçesi, plaka ve araç görselleri ile diğer belgeleri platforma sunmayı kabul eder.\n\n' +
          'Belgelerin okunabilir, güncel ve sürücüye ait olması zorunludur. Yanıltıcı veya sahte belge sunulması halinde hesap işlemleri uygulanabilir.',
      },
      {
        title: 'Madde 5 — Sigorta ve araç uygunluğu',
        body:
          'Sürücü; aracın trafik mevzuatına uygun durumda olduğunu, zorunlu sigortasının yürürlükte olduğunu ve periyodik bakım ile teknik gereklilikleri yerine getirdiğini kabul eder.\n\n' +
          'Araç güvenliği ve yasal uygunluktan sürücü sorumludur.',
      },
      {
        title: 'Madde 6 — Trafik kuralları ve yolcu güvenliği',
        body:
          'Sürücü;\n' +
          '• Karayolları Trafik Kanunu ve ilgili mevzuata uymayı,\n' +
          '• alkollü veya uyuşturucu etkisi altında araç kullanmamayı,\n' +
          '• emniyet kemeri ve güvenlik önlemlerine riayet etmeyi,\n' +
          '• yolcuların güvenliğini gözetmeyi,\n' +
          '• yolculuk sırasında dikkat dağıtıcı ve tehlikeli davranışlardan kaçınmayı\n\n' +
          'kabul eder.',
      },
      {
        title: 'Madde 7 — Kaza, ceza ve fiili sorumluluk',
        body:
          'Trafik kazası, idari para cezası, araç hasarı, üçüncü kişilere verilen zarar ve yolculuk sırasındaki fiili davranışlardan sürücü sorumludur.\n\n' +
          `${PN} taşıma işletmecisi veya taşıma sözleşmesinin tarafı değildir; kaza ve ceza süreçlerinde doğrudan taraf sıfatı taşımaz.`,
      },
      {
        title: 'Madde 8 — Katkı payı',
        body:
          'Katkı payı yalnızca seyahat masraflarının paylaşımı amacıyla taraflar arasında belirlenir. Platform katkı payını belirlemez, tahsil etmez, tutarı garanti etmez ve ödemeye aracılık etmez.\n\n' +
          'Nakit veya banka transferi kullanıcılar arasında doğrudan gerçekleşir.',
      },
      {
        title: 'Madde 9 — Yasak davranışlar',
        body:
          'Sürücü için özellikle yasaktır:\n' +
          '• sahte bilgi veya belge vermek,\n' +
          '• hukuka aykırı eşya taşımak veya taşıma teklif etmek,\n' +
          '• yolculara kötü muamele, taciz veya tehdit,\n' +
          '• ticari taşımacılık veya korsan taksi faaliyeti,\n' +
          '• platform kurallarını veya mevzuatı ihlal etmek.',
      },
      {
        title: 'Madde 10 — Platformun sorumluluk sınırı',
        body:
          `${PN} yalnızca dijital eşleştirme ve iletişim altyapısı sağlar. Sürücünün fiilleri, araç durumu, trafik ihlalleri, ödeme anlaşmazlıkları ve kullanıcılar arası uyuşmazlıklardan Şirket sorumlu tutulamaz.\n\n` +
          'Platform, sürücünün sabıka veya trafik geçmişini resmi merciler nezdinde doğrulama taahhüdü vermez.',
      },
      {
        title: 'Madde 11 — Hesabın askıya alınması ve sonlandırılması',
        body: ACCOUNT_ACTION_NOTICE,
      },
      {
        title: 'Madde 12 — Yürürlük',
        body:
          'Sürücü, sürücü profilini etkinleştirerek ve platformu sürücü olarak kullanmaya devam ederek işbu sözleşmeyi kabul etmiş sayılır. Belge yükleme ve elektronik onay adımları tamamlandığında kabul kayıt altına alınabilir.',
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
          `${PN} resmi devlet onayı, sabıka kaydı sorgusu veya taksi/taşımacılık lisansı kontrolü yapmaz.`,
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
          `${PN} bir ödeme kuruluşu değildir; uygulama içinde katkı payı tahsilatı yapmaz, ödeme hesabı işletmez ve finansal aracılık sunmaz.\n\n` +
          'Gösterilen tutarlar bilgilendirme ve taraflar arası mutabakat amaçlıdır.',
      },
      {
        title: 'Katkı payı nedir',
        body:
          'Katkı payı (masraf paylaşımı); gönüllü yol paylaşımında yakıt, otoyol ve benzeri masrafların taraflarca karşılıklı anlaşmayla paylaşılmasıdır.\n\n' +
          `Tutar ve yöntem teklif / eşleşme aşamasında netleştirilir; ${PN} bu anlaşmanın tarafı değildir.`,
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
          `Havale/EFT işlemi banka kanallarında taraflar arasında yapılır. ${PN} transferi gerçekleştirmez veya garanti etmez.`,
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
          `Katkı payına ilişkin taraflar arası anlaşmazlıklarda ${PN} mahkeme kararı veya resmi belge olmaksızın ödeme iadesi veya zorunlu tahsilat yapamaz.\n\n` +
          'Destek ekibi; teknik kayıtlar ve bildirimler çerçevesinde bilgilendirme sağlayabilir. Hukuki uyuşmazlık çözümü taraflara aittir.',
      },
    ],
  },

  'community-guidelines': {
    id: 'community-guidelines',
    title: 'Topluluk Kuralları',
    subtitle: 'Güvenli, saygılı ve hukuka uygun platform kullanımı (avukat taslağı)',
    readingTimeMinutes: 15,
    ...DRAFT_META,
    sections: [
      {
        title: '1. Amaç',
        body:
          `${DRAFT_PREAMBLE}\n\n` +
          `Bu Topluluk Kuralları; ${PN} platformunun güvenli, saygılı ve hukuka uygun şekilde kullanılmasını sağlamak amacıyla hazırlanmıştır. Platformu kullanan her kullanıcı, bu kuralları okuduğunu, anladığını ve kabul ettiğini beyan eder.\n\n` +
          `${PN}; aynı güzergâhta seyahat etmek isteyen kullanıcıların birbirleriyle iletişim kurmasına teknik altyapı sağlayan dijital bir platformdur. Amaç; güvenli yol paylaşımını teşvik etmek, saygılı davranışı desteklemek ve hukuka uygun bir topluluk oluşturmaktır.`,
      },
      {
        title: '2. Saygılı davranış ilkesi',
        body:
          'Her kullanıcı;\n' +
          '• diğer kullanıcılara karşı nazik davranmalı,\n' +
          '• küçük düşürücü ifade, hakaret, küfür ve tehditten kaçınmalı,\n' +
          '• psikolojik baskı ve cinsel içerikli rahatsız edici davranışlarda bulunmamalı,\n' +
          '• nefret söylemi paylaşmamalıdır.\n\n' +
          'Irk, renk, dil, din, mezhep, cinsiyet, cinsel yönelim, engellilik, yaş, siyasi düşünce veya benzeri herhangi bir nedenle ayrımcılık kesinlikle yasaktır.',
      },
      {
        title: '3. Güvenli yolculuk',
        body:
          'Sürücü ve yolcular;\n' +
          '• trafik kurallarına uymalı,\n' +
          '• emniyet kemeri kullanımına özen göstermeli,\n' +
          '• alkollü veya uyuşturucu etkisi altında yolculuk yapmamalı,\n' +
          '• diğer kullanıcıların güvenliğini tehlikeye düşürecek davranışlardan kaçınmalıdır.\n\n' +
          'Acil durumlarda 112 Acil Çağrı Merkezi ve ilgili resmi mercilere başvurulmalıdır.',
      },
      {
        title: '4. Yasaklanan davranışlar',
        body:
          'Aşağıdaki davranışlar kesin olarak yasaktır:\n' +
          '• sahte hesap oluşturmak, başkasının kimlik veya ehliyetini kullanmak,\n' +
          '• gerçeğe aykırı belge yüklemek, sahte plaka kullanmak,\n' +
          '• dolandırıcılık, yanıltıcı ilan, sahte güzergâh veya gerçekleşmeyecek teklif oluşturmak,\n' +
          '• spam, reklam, istenmeyen mesaj ve platform üzerinden ticari reklam,\n' +
          '• kanuna aykırı ürün/hizmet, kumar, bahis veya yasa dışı faaliyet teklifi,\n' +
          '• uyuşturucu, silah, yasak eşya veya suç teşkil eden eylemler,\n' +
          '• kullanıcıları kandırmak veya platform güvenliğini ihlal etmek.',
      },
      {
        title: '5. Kimlik doğruluğu',
        body:
          'Kullanıcı;\n' +
          '• doğru kimlik bilgisi vermeyi,\n' +
          '• güncel iletişim bilgilerini kullanmayı,\n' +
          '• yalnızca kendi adına hesap oluşturmayı,\n' +
          '• başkasının hesabını kullanmamayı,\n' +
          '• doğrulama süreçlerinde doğru belge sunmayı\n\n' +
          'kabul eder. Yanıltıcı bilgi verilmesi halinde hesap işlemleri uygulanabilir.',
      },
      {
        title: '6. Profil ve hesap güvenliği',
        body:
          'Kullanıcı hesabını üçüncü kişilere devredemez, şifresini paylaşamaz ve hesap güvenliğini sağlamakla yükümlüdür. Hesaptan yapılan işlemlerden kullanıcı sorumludur.',
      },
      {
        title: '7. Araç bilgileri',
        body:
          'Sürücüler doğru araç ve plaka bilgisi paylaşmalı, aracın trafik mevzuatına uygun durumda olduğunu beyan etmelidir.',
      },
      {
        title: '8. Gizlilik ve kişisel veriler',
        body:
          'Kullanıcılar; diğer kullanıcıların telefon numarası, adres, kimlik, fotoğraf ve konum bilgilerini ilgili kişinin açık rızası olmadan paylaşamaz.\n\n' +
          'Kişisel verilerin hukuka aykırı paylaşımından doğan hukuki ve cezai sorumluluk ilgili kullanıcıya aittir.',
      },
      {
        title: '9. Fotoğraf ve içerik paylaşımı',
        body:
          'Platforma yüklenen fotoğraf ve içerikler;\n' +
          '• gerçeği yansıtmalı,\n' +
          '• başkasına ait olmamalı,\n' +
          '• telif hakkını ihlal etmemeli,\n' +
          '• müstehcen, şiddet içerikli veya nefret söylemi barındırmamalıdır.',
      },
      {
        title: '10. Ticari faaliyet yasağı',
        body:
          `${PN} ticari taşımacılık platformu değildir. Kullanıcılar korsan taşımacılık yapamaz, ticari taksi hizmeti sunamaz ve uygulamayı ticari amaçlarla kullanamaz.`,
      },
      {
        title: '11. Şikayet ve bildirim',
        body:
          'Her kullanıcı; uygunsuz davranışları, sahte hesapları, dolandırıcılık girişimlerini ve güvenlik risklerini uygulama içinden veya destek kanallarından bildirebilir.\n\n' +
          `Bildirim: ${SUPPORT_CONTACT}`,
      },
      {
        title: '12. Hesap askıya alma',
        body:
          'Şirket; sahte belge, dolandırıcılık, tehdit, taciz, hukuka aykırı faaliyet, topluluk kurallarının ihlali veya kötü niyetli kullanım şüphesi halinde hesabı incelemeye alabilir, geçici veya kalıcı olarak kısıtlayabilir.\n\n' +
          ACCOUNT_ACTION_NOTICE,
      },
      {
        title: '13. Platformun rolü',
        body:
          `${PN};\n` +
          '• taşıma hizmeti sunmaz,\n' +
          '• taraflar arasında kurulan hukuki ilişkinin tarafı değildir,\n' +
          '• sürücü veya yolcu sıfatına sahip değildir,\n' +
          '• ödeme kuruluşu veya elektronik para kuruluşu değildir,\n' +
          '• seyahat organizatörü değildir,\n' +
          '• katkı payını belirlemez, tahsil etmez ve aracılık etmez.\n\n' +
          'Platform yalnızca kullanıcıların birbirleriyle iletişim kurmasına teknik altyapı sağlar.',
      },
      {
        title: '14. Güvenlik uyarısı',
        body:
          'Her kullanıcı; tanımadığı kişilerle yolculuk yaparken gerekli dikkat ve özeni göstermeli, değerli eşyalarını korumalı ve acil durumlarda 112 Acil Çağrı Merkezini aramalıdır.\n\n' +
          `${PN} acil müdahale birimi değildir; yolculuk sırasındaki fiili risklerden kullanıcılar sorumludur.`,
      },
      {
        title: '15. Hukuka uygun kullanım',
        body:
          `Kullanıcılar, ${PN} uygulamasını yalnızca yürürlükteki mevzuata uygun şekilde kullanacaklarını kabul eder. Türk Ceza Kanunu, Karayolları Trafik Kanunu, Kişisel Verilerin Korunması Kanunu ve diğer ilgili mevzuata aykırı kullanımlar yasaktır.`,
      },
      {
        title: '16. Güncellemeler',
        body:
          'Şirket, bu Topluluk Kurallarını gerekli gördüğü zaman güncelleyebilir. Güncellenen metin uygulama içerisinde yayımlandığı tarihte yürürlüğe girer.',
      },
      {
        title: '17. İletişim',
        body:
          `Her türlü soru, bildirim ve itiraz için:\n${COMPANY}\nE-posta: info@karekodteknoloji.com\nTelefon: 0850 307 80 29`,
      },
    ],
  },
};

export function getLegalRegistryDocument(id: LegalRegistryDocumentId): LegalRegistryDocument {
  return LEGAL_REGISTRY_DOCUMENTS[id];
}
