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
    title: "Gizlilik Politikasi",
    updatedAt: "Mayis 2026",
    intro:
      "Karekod Teknoloji ve Yazilim A.S. olarak Leylek TAG hizmetlerinde kisisel verilerin korunmasina onem veririz. Bu metin, urun kapsaminda verilerin hangi amaclarla islenebilecegini genel olarak aciklar.",
    sections: [
      {
        heading: "Toplanan Veri Gruplari",
        bullets: [
          "Kimlik ve iletisim bilgileri (ad, telefon)",
          "Konum bilgisi (eslesme ve yolculuk akislarinda)",
          "Cihaz, log ve guvenlik kayitlari",
          "Yolculuk, teklif ve eslesme kayitlari",
        ],
      },
      {
        heading: "Urun Kapsami Bilgilendirmesi",
        bullets: [
          "Surucu/yolcu eslesme ve teklif sistemi",
          "Leylek Teklifi / Muhabbet mesajlasma",
          "Sesli gorusme / VoIP kullanimi",
          "Sesli mesaj veya ses kaydi ozelligi varsa ilgili veri islemesi",
        ],
      },
      {
        heading: "Saklama Yaklasimi",
        paragraphs: [
          "Standart VoIP gorusmelerinde cagri icerigi kaydedilmez; baglanti ve arama metadata'si urun ve guvenlik operasyonlari kapsaminda islenebilir.",
          "Muhabbet mesaj icerikleri ve ozellik aktifse sesli mesaj/ses kaydi verileri urun ve guvenlik operasyonlari kapsaminda 7 gune kadar saklanabilir.",
        ],
      },
      {
        heading: "Hesap ve KVKK Haklari",
        paragraphs: [
          "Kullanicilar uygulama icinden hesap silme / veri silme sureclerini baslatabilir.",
          "KVKK kapsamindaki basvurularinizi destek iletisim kanallarindan iletebilirsiniz.",
          SUPPORT_LINE,
        ],
      },
    ],
  },
  "kullanim-sartlari": {
    slug: "kullanim-sartlari",
    title: "Kullanim Sartlari",
    updatedAt: "Mayis 2026",
    intro:
      "Bu sayfa Leylek TAG platformunun genel kullanim kosullarini ozetler. Detayli veri islemesi icin Gizlilik Politikasi ve KVKK Aydinlatma Metni ile birlikte degerlendirilmelidir.",
    sections: [
      {
        heading: "Hizmet Tanimi",
        paragraphs: [
          "Leylek TAG, surucu ve yolcularin teklif/rota bazli eslesmesini kolaylastiran dijital bir platformdur.",
          "Platform aracilik altyapisi sunar; tasimacilik hizmeti saglamaz.",
        ],
      },
      {
        heading: "Kullanici Yukumlulukleri",
        bullets: [
          "Dogrulugu olan bilgilerle hesap olusturmak",
          "Topluluk kurallarina uygun davranmak",
          "Diger kullanicilarin haklarina ve guvenligine saygi gostermek",
        ],
      },
      {
        heading: "Urun Modulleri",
        bullets: [
          "Konum verisi ile eslesme ve teklif surecleri",
          "Leylek Teklifi / Muhabbet mesajlasma",
          "Sesli gorusme / VoIP",
          "Ozellik aktifse sesli mesaj/ses kaydi",
          "Cihaz, log ve guvenlik kayitlari",
        ],
      },
      {
        heading: "Saklama ve Destek",
        paragraphs: [
          "Muhabbet mesaj icerikleri ve ozellik aktifse sesli mesaj/ses kaydi verileri urun ve guvenlik operasyonlari kapsaminda 7 gune kadar saklanabilir.",
          SUPPORT_LINE,
        ],
      },
    ],
  },
  kvkk: {
    slug: "kvkk",
    title: "KVKK Aydinlatma Metni",
    updatedAt: "Mayis 2026",
    intro:
      "6698 sayili KVKK kapsaminda veri sorumlusu Karekod Teknoloji ve Yazilim A.S. olarak, Leylek TAG urunlerinde kisisel veri isleme sureclerine iliskin genel bilgilendirme sunuyoruz.",
    sections: [
      {
        heading: "Veri Sorumlusu ve Iletisim",
        paragraphs: [
          "Karekod Teknoloji ve Yazilim A.S.",
          "E-posta: info@karekodteknoloji.com",
          "Telefon: 0850 307 80 29",
        ],
      },
      {
        heading: "Islenen Veri ve Amaclar",
        bullets: [
          "Kimlik/iletisim, konum, cihaz ve guvenlik verileri",
          "Surucu/yolcu eslesme ve teklif surecleri",
          "Leylek Teklifi / Muhabbet mesajlasma",
          "Sesli gorusme / VoIP ve ozellik aktifse sesli mesaj/ses kaydi",
        ],
      },
      {
        heading: "Saklama ve Guvenlik",
        paragraphs: [
          "Standart VoIP gorusmelerinde cagri icerigi kaydedilmez; baglanti/arama metadata'si islenebilir.",
          "Muhabbet mesaj icerikleri ve ozellik aktifse sesli mesaj/ses kaydi verileri urun ve guvenlik operasyonlari kapsaminda 7 gune kadar saklanabilir.",
        ],
      },
      {
        heading: "Basvuru Haklari",
        paragraphs: [
          "KVKK m.11 kapsamindaki haklarinizi destek iletisim kanallarindan iletebilirsiniz.",
          SUPPORT_LINE,
        ],
      },
    ],
  },
  "hesap-silme": {
    slug: "hesap-silme",
    title: "Hesap Silme ve Veri Silme Aciklamasi",
    updatedAt: "Mayis 2026",
    intro:
      "Kullanicilar Leylek TAG uygulamasi icinden hesap silme surecini baslatabilir. Bu metin, surece iliskin genel bilgilendirme amaciyla hazirlanmistir.",
    sections: [
      {
        heading: "Genel Surec",
        bullets: [
          "Hesap silme talebi uygulama icinden baslatilabilir",
          "Aktif yolculuklar varsa islem kosullara bagli olarak sinirlanabilir",
          "Silme sonrasi veriler yasal yukumluluklar kapsaminda silinir veya anonimlestirilir",
        ],
      },
      {
        heading: "Urun ve Guvenlik Operasyonlari",
        paragraphs: [
          "Muhabbet mesaj icerikleri ve ozellik aktifse sesli mesaj/ses kaydi verileri urun ve guvenlik operasyonlari kapsaminda 7 gune kadar saklanabilir.",
          "Cihaz, log ve guvenlik kayitlari mevzuat ve guvenlik gerekleri kapsaminda islenebilir.",
        ],
      },
      {
        heading: "Destek ve KVKK Basvuru",
        paragraphs: [
          "Hesap/veri silme veya KVKK basvuru talepleriniz icin:",
          SUPPORT_LINE,
        ],
      },
    ],
  },
};
