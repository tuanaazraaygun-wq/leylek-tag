export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: "gizlilik-politikasi" | "kullanim-sartlari" | "kvkk" | "hesap-silme";
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

const SUPPORT_LINE = "Destek: info@karekodteknoloji.com | 0850 307 80 29";

export const legalDocuments: Record<LegalDocument["slug"], LegalDocument> = {
  "gizlilik-politikasi": {
    slug: "gizlilik-politikasi",
    title: "Gizlilik Politikası",
    updatedAt: "Mayıs 2026",
    intro:
      "Karekod Teknoloji ve Yazılım A.Ş. olarak Leylek TAG hizmetlerinde kişisel verilerin korunmasına önem veririz. Bu metin, hizmet kapsamında verilerin nasıl işlendiğini açıklar.",
    sections: [
      {
        heading: "Genel İlke",
        paragraphs: [
          "Leylek TAG, kullanıcı verilerini yalnızca hizmet sunumu amacıyla işler. Yetkisiz üçüncü kişilerle paylaşılmaz.",
        ],
      },
      {
        heading: "Konum Verisi",
        paragraphs: [
          "Konum verisi yalnızca yolculuk oluşturma ve aktif yolculuk süresi boyunca kullanılır. Sürekli arka plan takibi yapılmaz.",
        ],
      },
      {
        heading: "Ürün Kapsamı (Bilgilendirme)",
        bullets: [
          "Sürücü/yolcu eşleşme ve teklif sistemi",
          "Leylek Teklifi / Muhabbet mesajlaşma",
          "Sesli görüşme / VoIP kullanımı",
          "Sesli mesaj veya ses verisi özellikleri (varsa)",
          "Cihaz, log ve güvenlik kayıtları",
        ],
      },
      {
        heading: "Sürücü Doğrulama",
        paragraphs: [
          "Ehliyet ve araç görselleri kimlik doğrulama, güvenlik ve dolandırıcılığı önleme amaçlı işlenir; kamuya açık paylaşılmaz.",
        ],
      },
      {
        heading: "Muhabbet İçerik Saklama",
        paragraphs: [
          "Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse), ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir.",
        ],
      },
      {
        heading: "Güvenlik",
        bullets: [
          "HTTPS şifreleme",
          "Yetkilendirme sistemi",
          "Rol bazlı erişim",
          "Sunucu taraflı güvenlik önlemleri",
        ],
      },
      {
        heading: "Hesap Silme / Veri Silme",
        paragraphs: [
          "Kullanıcılar uygulama içinden hesaplarını silebilir. Silme sonrası veriler yasal zorunluluklar saklı kalmak kaydıyla silinir veya anonimleştirilir.",
        ],
      },
      {
        heading: "KVKK Başvuru Hakları",
        paragraphs: [
          "KVKK kapsamındaki başvuru haklarınızı kullanmak için aşağıdaki iletişim kanallarını kullanabilirsiniz.",
          SUPPORT_LINE,
        ],
      },
      {
        heading: "5651 Uyum",
        paragraphs: [
          "Şirket, 5651 sayılı Kanun kapsamında hukuka aykırı içerikleri bildirim üzerine kaldırma yükümlülüğünü yerine getirir.",
        ],
      },
    ],
  },
  "kullanim-sartlari": {
    slug: "kullanim-sartlari",
    title: "Hizmet Şartları",
    updatedAt: "Mayıs 2026",
    intro:
      "Bu sayfa Leylek TAG platformunun kullanım koşullarını özetler. Veri işlemesine ilişkin ayrıntılar Gizlilik Politikası ve KVKK Aydınlatma Metni ile birlikte değerlendirilmelidir.",
    sections: [
      {
        heading: "Hizmet Tanımı",
        paragraphs: [
          "Leylek TAG, yolcu ve sürücü kullanıcıları dijital ortamda eşleştiren bir platformdur. Şirket taşımacılık hizmeti sunmaz.",
        ],
      },
      {
        heading: "Sorumluluk",
        paragraphs: [
          "Yolculuk sırasında meydana gelebilecek trafik kazaları, maddi/manevi zararlar ve kullanıcılar arası uyuşmazlıklar taraflar arasındadır.",
        ],
      },
      {
        heading: "Sürücü Sorumluluğu",
        bullets: [
          "Geçerli sürücü belgesine sahip olduğunu beyan etmek",
          "Aracın trafiğe uygun olduğunu beyan etmek",
          "Sigortasının geçerli olduğunu beyan etmek",
        ],
      },
      {
        heading: "Topluluk Kuralları",
        bullets: [
          "Hakaret, tehdit, dolandırıcılık ve kişisel veri paylaşımı yasaktır",
          "Şirket içerik kaldırma ve hesap kapatma hakkını saklı tutar",
        ],
      },
      {
        heading: "Ücretlendirme",
        paragraphs: [
          "Yolculuk ücretleri uygulama içi hesaplama veya teklif sistemiyle belirlenir. Şirket komisyon veya üyelik modeli uygulayabilir.",
        ],
      },
      {
        heading: "Ürün Kapsamı (Bilgilendirme)",
        bullets: [
          "Konum verisi ile sürücü/yolcu eşleşme ve teklif sistemi",
          "Leylek Teklifi / Muhabbet mesajlaşma",
          "Sesli görüşme / VoIP ve ilgili teknik kayıtlar",
          "Sesli mesaj veya ses verisi özellikleri (varsa)",
          "Cihaz, log ve güvenlik kayıtları",
        ],
        paragraphs: [
          "Detaylar Gizlilik Politikası ve KVKK Aydınlatma Metni'nde açıklanır.",
        ],
      },
      {
        heading: "Muhabbet Kayıt Süresi (Bilgilendirme)",
        paragraphs: [
          "Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse) ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir.",
        ],
      },
      {
        heading: "Hesap Silme / Veri Silme",
        paragraphs: [
          "Kullanıcı, uygulama içinden hesap silme talebi oluşturabilir. İşlem koşulları ve detaylar hesap silme açıklama sayfasında yer alır.",
        ],
      },
      {
        heading: "KVKK Başvuru Hakları ve Destek",
        paragraphs: [
          "KVKK kapsamındaki başvuru hakları ve destek iletişimi için aşağıdaki kanallar kullanılabilir.",
          SUPPORT_LINE,
        ],
      },
      {
        heading: "Uyuşmazlık",
        paragraphs: ["Uyuşmazlıklarda Ankara Mahkemeleri yetkilidir."],
      },
    ],
  },
  kvkk: {
    slug: "kvkk",
    title: "KVKK Aydınlatma Metni",
    updatedAt: "Mayıs 2026",
    intro:
      "6698 sayılı KVKK kapsamında veri sorumlusu Karekod Teknoloji ve Yazılım A.Ş. olarak, Leylek TAG ürünlerinde kişisel veri işleme süreçlerine ilişkin bilgilendirme sunuyoruz.",
    sections: [
      {
        heading: "Veri Sorumlusu",
        paragraphs: [
          "Leylek TAG mobil uygulaması kapsamında kişisel verileriniz, 6698 sayılı KVKK uyarınca veri sorumlusu sıfatıyla Karekod Teknoloji ve Yazılım A.Ş. tarafından işlenmektedir.",
          "Meşrutiyet Mah. Konur Sk. Özsoy İş Hanı No: 25 İç Kapı No: 13 Çankaya / Ankara",
          "E-posta: info@karekodteknoloji.com",
          "Telefon: 0850 307 80 29",
        ],
      },
      {
        heading: "İşlenen Veriler — Yolcu Kullanıcılar",
        bullets: [
          "Ad, soyad",
          "Telefon numarası",
          "Şehir bilgisi",
          "Konum verisi (aktif kullanım sırasında)",
          "Mesaj içerikleri",
          "Yolculuk geçmişi",
        ],
      },
      {
        heading: "İşlenen Veriler — Sürücü Kullanıcılar (ek olarak)",
        bullets: [
          "Ehliyet görseli",
          "Araç ön ve arka fotoğrafları (plaka dahil)",
          "Plaka numarası",
          "Araç bilgileri",
        ],
      },
      {
        heading: "İşlenen Veriler — Teknik",
        bullets: [
          "IP adresi",
          "Cihaz bilgisi",
          "Push bildirim token'ı",
          "Sistem log ve güvenlik kayıtları",
        ],
      },
      {
        heading: "İşleme Amaçları",
        bullets: [
          "Kullanıcı kaydı ve kimlik doğrulama",
          "Yolcu–sürücü eşleştirme",
          "Sürücü/yolcu teklif sistemi",
          "Leylek Teklifi / Muhabbet mesajlaşma hizmetleri",
          "Sesli görüşme / VoIP hizmetleri",
          "Sesli mesaj veya ses verisi özellikleri (varsa)",
          "Güvenliğin sağlanması",
          "Hukuki yükümlülüklerin yerine getirilmesi",
          "Dolandırıcılığın önlenmesi",
          "Topluluk alanının yönetimi",
        ],
      },
      {
        heading: "Saklama Süreleri",
        bullets: [
          "Hesap bilgileri: üyelik süresince",
          "Trip kayıtları: 5 yıl",
          "Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse): 7 güne kadar",
          "Ehliyet ve araç görselleri: üyelik süresince",
          "Log kayıtları: mevzuat süresi boyunca",
        ],
      },
      {
        heading: "Yurt Dışına Aktarım",
        paragraphs: [
          "Altyapı hizmetleri (Supabase, Google Maps vb.) nedeniyle veriler yurt dışında bulunan sunucularda saklanabilir.",
        ],
      },
      {
        heading: "Haklarınız",
        paragraphs: [
          "KVKK m.11 kapsamındaki haklarınızı info@karekodteknoloji.com adresine başvurarak kullanabilirsiniz. Destek hattı: 0850 307 80 29.",
        ],
      },
    ],
  },
  "hesap-silme": {
    slug: "hesap-silme",
    title: "Hesap Silme ve Veri Silme",
    updatedAt: "Mayıs 2026",
    intro:
      "Hesabınızı silmek istediğinizde aşağıdaki bilgileri dikkate alın. Hesap silme talebi Leylek TAG uygulaması içinden başlatılır; bu sayfa süreci açıklar.",
    sections: [
      {
        heading: "Uygulama İçinden Silme",
        paragraphs: [
          "Hesap silme işlemi uygulama içindeki Hesap Silme ekranından başlatılır. İşlem onayınızla hesabınız devre dışı bırakılır ve oturumunuz kapatılır.",
          "Aktif yolculuk veya aktif Leylek Teklifi yolculuğu varken hesap silinemez.",
        ],
      },
      {
        heading: "Silinecek Veriler",
        bullets: [
          "Profil bilgileriniz",
          "Yolculuk geçmişiniz",
          "Mesajlarınız",
          "Puanlarınız ve değerlendirmeleriniz",
          "Ehliyet ve araç bilgileriniz (sürücüler için)",
        ],
      },
      {
        heading: "Silme Süreci",
        bullets: [
          "Hesabınız hemen devre dışı bırakılır",
          "Kişisel verileriniz 30 gün içinde silinir",
          "Muhabbet mesajları ve ses verisi/ses kayıtları (özellik aktifse) ürün ve güvenlik operasyonları kapsamında 7 güne kadar saklanabilir",
          "Yasal zorunluluklar kapsamındaki veriler anonimleştirilir",
          "Bu işlem geri alınamaz",
        ],
      },
      {
        heading: "Destek ve KVKK Başvurusu",
        paragraphs: [
          "Hesap veya veri silme talepleriniz ve KVKK başvurularınız için:",
          SUPPORT_LINE,
        ],
      },
      {
        heading: "İlgili Yasal Metinler",
        paragraphs: [
          "Gizlilik Politikası, Hizmet Şartları ve KVKK Aydınlatma Metni bu süreçle birlikte değerlendirilmelidir.",
        ],
      },
    ],
  },
};
