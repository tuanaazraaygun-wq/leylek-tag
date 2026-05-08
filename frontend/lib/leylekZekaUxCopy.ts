/**
 * Leylek Zeka — API’siz premium UX metinleri (widget pill, mini ipuçları).
 */
import type { LeylekZekaFlowHint, LeylekZekaHomeFlowScreen } from '../contexts/LeylekZekaChromeContext';

export type LeylekZekaContextCopy = {
  stageLabel: string;
  intentScope: string;
  emptyTitle: string;
  emptyBody: string;
  placeholder: string;
  starterPrompts: string[];
  idleHints: string[];
  operationAwarenessTitle: string;
  operationAwarenessBody: string;
  safeChecklist: string[];
  knownSignals: string[];
  safeAdviceOnly: true;
};

type LeylekZekaBaseCopy = Omit<
  LeylekZekaContextCopy,
  'operationAwarenessTitle' | 'operationAwarenessBody' | 'safeChecklist' | 'knownSignals' | 'safeAdviceOnly'
>;

const LEYLEK_OFFER_GUIDE_PROMPTS = [
  'Leylek Teklifi nasıl açılır?',
  'Şehir dışı teklif nasıl çalışır?',
  'Muhabbet/chat nasıl kullanılır?',
  'QR biniş ve bitiş nasıl çalışır?',
] as const;

const DEFAULT_COPY: LeylekZekaBaseCopy = {
  stageLabel: 'Uygulama rehberi',
  intentScope: 'general_app_guide',
  emptyTitle: 'Leylek Zeka yanınızda',
  emptyBody:
    'LeylekTag içinde normal TAG, Leylek Teklifi, Muhabbet, QR, Güven Al ve yolculuk adımları için kısa rehberlik alabilirsiniz. Gerçek yoğunluk veya süre iddiası paylaşmadan, ekrandaki adımları anlaşılır şekilde açıklarım.',
  placeholder: 'Örn. QR biniş nasıl çalışır?',
  starterPrompts: [
    'Yolcu nasıl yolculuk başlatır?',
    'Sürücü teklifleri nasıl görür?',
    LEYLEK_OFFER_GUIDE_PROMPTS[0],
    LEYLEK_OFFER_GUIDE_PROMPTS[2],
  ],
  idleHints: [
    'Uygulama adımlarında takılırsan kısa ve güvenli şekilde açıklayabilirim.',
    'Normal TAG, Leylek Teklifi, Muhabbet, QR ve Güven Al başlıklarını anlatabilirim.',
  ],
};

const ROLE_SELECT_COPY: LeylekZekaBaseCopy = {
  stageLabel: 'Rol seçimi',
  intentScope: 'role_selection_guide',
  emptyTitle: 'Rol seçimini birlikte netleştirelim',
  emptyBody:
    'Yolcu akışı yolculuk başlatmaya, sürücü akışı teklifleri takip etmeye odaklanır. Hangi rolün hangi ekrana götürdüğünü kısa ve iddiasız şekilde açıklayabilirim.',
  placeholder: 'Örn. Yolcu ve sürücü farkı nedir?',
  starterPrompts: [
    'Yolcu akışı nasıl çalışır?',
    'Sürücü akışı nasıl çalışır?',
    'Normal TAG ile Leylek Teklifi farkı nedir?',
    'Güven Al ne işe yarar?',
  ],
  idleHints: [
    'Yolcu akışı yolculuk başlatmaya, sürücü akışı teklifleri takip etmeye odaklanır.',
    'Rol seçimini değiştirmeden önce hangi ekranda devam edeceğini birlikte netleştirebiliriz.',
    'Leylek Teklifi ve normal TAG akışlarını kısa başlıklarla anlatabilirim.',
  ],
};

const FLOW_COPY: Record<Exclude<LeylekZekaFlowHint, null>, LeylekZekaBaseCopy> = {
  passenger_home: {
    stageLabel: 'Yolcu ana ekranı',
    intentScope: 'passenger_start_guide',
    emptyTitle: 'Yolculuk başlatmadan önce',
    emptyBody:
      'Başlangıç, hedef, araç tercihi, Güven Al ve Leylek Teklifi farkını ekrandaki akışa göre açıklayabilirim. Gerçek yoğunluk veya süre tahmini vermeden kontrol listesi sunarım.',
    placeholder: 'Örn. Yolcu nasıl yolculuk başlatır?',
    starterPrompts: [
      'Yolcu nasıl yolculuk başlatır?',
      'Araç veya motor seçerken nelere bakmalıyım?',
      'Güven Al ne işe yarar?',
      LEYLEK_OFFER_GUIDE_PROMPTS[0],
    ],
    idleHints: [
      'Yolculuk başlatmadan önce başlangıç, hedef ve araç tercihini kontrol edebilirsin.',
      'Normal TAG ve Leylek Teklifi arasındaki kullanım farkını anlatabilirim.',
      'Güven Al ve QR adımlarının ne işe yaradığını açıklayabilirim.',
    ],
  },
  passenger_matching: {
    stageLabel: 'Yolcu eşleşme bekleme',
    intentScope: 'passenger_matching_guide',
    emptyTitle: 'Eşleşme beklerken rehber',
    emptyBody:
      'Bekleme ekranında konum, rota ve araç tercihi gibi görünen adımları nasıl kontrol edeceğini anlatabilirim. Kesin eşleşme veya süre tahmini paylaşmam.',
    placeholder: 'Örn. Eşleşme beklerken neyi kontrol etmeliyim?',
    starterPrompts: [
      'Eşleşme beklerken hangi adımları kontrol etmeliyim?',
      'Teklif gelmezse ne yapabilirim?',
      'Konum ve rota bilgisi neden önemli?',
      'Şehir dışı teklif nasıl çalışır?',
    ],
    idleHints: [
      'Eşleşme beklerken konum, rota ve araç tercihini kontrol edebilirsin.',
      'Gerçek süre tahmini vermeden, bekleme ekranındaki adımları anlatabilirim.',
      'Teklif gelirse bilgileri karşılaştırmadan onay vermemen iyi olur.',
    ],
  },
  passenger_offer_waiting: {
    stageLabel: 'Yolcu teklif bekleme',
    intentScope: 'passenger_offer_review_guide',
    emptyTitle: 'Gelen teklifleri birlikte okuyalım',
    emptyBody:
      'Teklif kartındaki ücret, araç tipi, sürücü bilgisi, Muhabbet/chat ve QR adımlarını açıklayabilirim. Karar vermeden önce hangi bilgileri kontrol edeceğini özetlerim.',
    placeholder: 'Örn. Gelen teklifleri nasıl karşılaştırmalıyım?',
    starterPrompts: [
      'Gelen teklifleri nasıl karşılaştırmalıyım?',
      'Sürücü teklifinde hangi bilgileri kontrol etmeliyim?',
      'Muhabbet/chat nasıl kullanılır?',
      'QR biniş ve bitiş nasıl çalışır?',
    ],
    idleHints: [
      'Teklif kartında araç tipi, ücret ve sürücü bilgilerini birlikte okuyabiliriz.',
      'Eşleşme sonrası Muhabbet, QR ve destek adımlarını anlatabilirim.',
      'Şehir dışı tekliflerde yolculuk detaylarını uygulama içinde netleştirmek önemlidir.',
    ],
  },
  passenger_trip: {
    stageLabel: 'Yolcu yolculuk desteği',
    intentScope: 'passenger_trip_guide',
    emptyTitle: 'Yolculuk sırasında destek',
    emptyBody:
      'Yolculukta QR, Muhabbet/chat, Güven Al, destek ve görüşme adımlarını uygulama içindeki kullanım amacıyla anlatabilirim. İşlem kararı ve güvenlik kontrolü kullanıcıda kalır.',
    placeholder: 'Örn. Yolculuk sırasında destek nasıl alınır?',
    starterPrompts: [
      'Yolculuk sırasında destek nasıl alınır?',
      'QR biniş ve bitiş nasıl çalışır?',
      'Güven Al yolculukta ne sağlar?',
      'Muhabbet/chat nasıl kullanılır?',
    ],
    idleHints: [
      'Yolculukta QR, Muhabbet, Güven Al ve destek adımlarını uygulama içinde takip edebilirsin.',
      'Sesli veya görüntülü görüşme, yolculukla ilgili iletişim gerektiğinde kullanılabilir.',
      'Sorun yaşarsan destek adımlarını anlatabilirim; işlem kararı sende kalır.',
    ],
  },
  driver_idle: {
    stageLabel: 'Sürücü ana ekranı',
    intentScope: 'driver_idle_guide',
    emptyTitle: 'Sürücü ekranı rehberi',
    emptyBody:
      'Teklifleri görme, KYC durumu, normal TAG ve Leylek Teklifi adımlarını açıklayabilirim. Gerçek bölgesel veri olmadan yönlendirme yapmam; sadece ekran kullanımını anlatırım.',
    placeholder: 'Örn. Sürücü teklifleri nasıl görür?',
    starterPrompts: [
      'Sürücü teklifleri nasıl görür?',
      'Teklif vermeden önce nelere bakmalıyım?',
      'Leylek Teklifi nasıl açılır?',
      'Şehir dışı teklif nasıl çalışır?',
    ],
    idleHints: [
      'Sürücü ekranında teklifleri görme ve değerlendirme adımlarını anlatabilirim.',
      'Bölgesel hareketlilik için gerçek veri olmadan yönlendirme yapmam; ekran kullanımını açıklarım.',
      'KYC, teklif, Muhabbet ve QR başlıklarında rehberlik edebilirim.',
    ],
  },
  driver_offer_list: {
    stageLabel: 'Sürücü açık talepler',
    intentScope: 'driver_offer_list_guide',
    emptyTitle: 'Açık talepleri değerlendirirken',
    emptyBody:
      'Talep kartında rota, araç tercihi, yolcu bilgisi ve teklif adımlarını nasıl okuyacağını anlatabilirim. Yoğunluk veya kazanç garantisi vermeden kontrol listesi sunarım.',
    placeholder: 'Örn. Açık taleplerde nelere bakmalıyım?',
    starterPrompts: [
      'Açık talepleri incelerken nelere bakmalıyım?',
      'Sürücü nasıl teklif verir?',
      'Muhabbet/chat nasıl kullanılır?',
      'QR biniş ve bitiş nasıl çalışır?',
    ],
    idleHints: [
      'Açık taleplerde rota, araç tercihi ve yolcu bilgilerini kontrol ederek ilerleyebilirsin.',
      'Yoğunluk iddiası vermeden teklif ekranındaki adımları açıklayabilirim.',
      'Şehir dışı taleplerde fiyat ve iletişim adımlarını uygulama içinden takip etmek önemlidir.',
    ],
  },
  driver_offer_compose: {
    stageLabel: 'Sürücü teklif hazırlama',
    intentScope: 'driver_offer_compose_guide',
    emptyTitle: 'Teklif vermeden önce',
    emptyBody:
      'Teklif tutarı, rota bilgisi, yolculuk detayı ve eşleşme sonrası Muhabbet/QR adımlarını rehber olarak açıklayabilirim. Fiyat veya rota kararı vermem.',
    placeholder: 'Örn. Teklif vermeden önce neyi kontrol etmeliyim?',
    starterPrompts: [
      'Teklif tutarını yazmadan önce hangi bilgileri kontrol etmeliyim?',
      'Şehir dışı teklif nasıl çalışır?',
      'Muhabbet/chat nasıl kullanılır?',
      'Yolculukta sorun olursa destek nasıl alınır?',
    ],
    idleHints: [
      'Teklif vermeden önce rota ve yolculuk bilgisini gözden geçirmek güven verir.',
      'Teklif metni kısa ve net olursa yolcu hangi adımı onayladığını daha iyi anlar.',
      'Eşleşme sonrası Muhabbet, QR ve görüşme adımlarını anlatabilirim.',
    ],
  },
  driver_trip: {
    stageLabel: 'Sürücü yolculuk desteği',
    intentScope: 'driver_trip_guide',
    emptyTitle: 'Sürücü yolculuk rehberi',
    emptyBody:
      'Yolculuk sırasında QR, Muhabbet/chat, destek ve görüşme adımlarını açıklayabilirim. Navigasyon veya bölge yönlendirmesi yapmadan uygulama adımlarını anlatırım.',
    placeholder: 'Örn. Sürücü yolculukta hangi adımları takip eder?',
    starterPrompts: [
      'Sürücü yolculuk sırasında hangi adımları takip eder?',
      'QR biniş ve bitiş nasıl çalışır?',
      'Muhabbet/chat nasıl kullanılır?',
      'Yolculukta destek nasıl alınır?',
    ],
    idleHints: [
      'Yolculukta QR, Muhabbet, Güven Al ve destek adımlarını uygulama içinde takip edebilirsin.',
      'Sesli veya görüntülü görüşme, yolculukla ilgili iletişim gerektiğinde kullanılabilir.',
      'Sorun yaşarsan destek adımlarını anlatabilirim; işlem kararı sende kalır.',
    ],
  },
  driver_kyc_pending: {
    stageLabel: 'Sürücü onay süreci',
    intentScope: 'driver_kyc_guide',
    emptyTitle: 'Onay sürecinde rehber',
    emptyBody:
      'KYC/onay ekranında görünen durumun ne anlama gelebileceğini ve sonraki uygulama adımlarını genel olarak açıklayabilirim. İnceleme sonucu veya süre tahmini vermem.',
    placeholder: 'Örn. Sürücü onay sürecinde ne kontrol edilir?',
    starterPrompts: [
      'Sürücü onay sürecinde ne kontrol edilir?',
      'Onay beklerken uygulamada neleri görebilirim?',
      'Sürücü olarak teklifleri ne zaman görürüm?',
      'Güvenli kullanım için hangi bilgiler önemlidir?',
    ],
    idleHints: [
      'Onay sürecinde görünen durumu ve sonraki uygulama adımlarını açıklayabilirim.',
      'KYC tamamlanmadan teklif görünürlüğü sınırlı olabilir; ekrandaki bilgi esas alınır.',
      'Sürücü güvenliği ve profil bilgileri hakkında genel rehberlik verebilirim.',
    ],
  },
};

const DEFAULT_OPERATION = {
  operationAwarenessTitle: 'Kontrol listesi',
  operationAwarenessBody:
    'Bu rehber yalnızca ekrandaki akışa göre genel kullanım desteği verir; gerçek operasyon verisi veya yönlendirme içermez.',
  safeChecklist: [
    'Ekrandaki güncel durumu kontrol et.',
    'Bildirimlerin açık olduğundan emin ol.',
    'QR, Muhabbet/chat ve destek adımlarını uygulama içinden takip et.',
  ],
  knownSignals: ['homeFlowScreen', 'flowHint'],
} as const;

function operationForIntent(intentScope: string): Omit<
  LeylekZekaContextCopy,
  keyof LeylekZekaBaseCopy | 'safeAdviceOnly'
> {
  switch (intentScope) {
    case 'passenger_matching_guide':
      return {
        operationAwarenessTitle: 'Eşleşme kontrol listesi',
        operationAwarenessBody:
          'Eşleşme beklerken yalnız ekrandaki duruma göre rehberlik ederim; kesin süre veya garanti paylaşmam.',
        safeChecklist: [
          'Konum, hedef ve araç tercihini kontrol et.',
          'Bildirimlerin açık olduğundan emin ol.',
          'Teklif gelirse karttaki ücret, araç ve sürücü bilgilerine bak.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'isWaitingMatch'],
      };
    case 'passenger_offer_review_guide':
      return {
        operationAwarenessTitle: 'Teklif kontrol listesi',
        operationAwarenessBody:
          'Gelen tekliflerde ekrandaki güncel kart bilgisi esas alınır; fiyat veya seçim kararı vermem.',
        safeChecklist: [
          'Teklif kartındaki ücret, araç tipi ve sürücü bilgilerine bak.',
          'Muhabbet/chat, QR ve destek adımlarını uygulama içinde takip et.',
          'Ekrandaki güncel durum değişirse kart bilgilerini yeniden kontrol et.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'hasActiveOffer'],
      };
    case 'passenger_trip_guide':
      return {
        operationAwarenessTitle: 'Yolculuk kontrol listesi',
        operationAwarenessBody:
          'Yolculuk sırasında uygulamadaki güvenlik ve iletişim adımlarını anlatırım; navigasyon veya işlem kararı vermem.',
        safeChecklist: [
          'QR, Güven Al, destek ve görüşme adımlarını uygulama içinden takip et.',
          'Muhabbet/chat içinde gerekli detayları teyit et.',
          'Sorun yaşarsan uygulamadaki destek adımlarını kullan.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'isPassenger'],
      };
    case 'driver_idle_guide':
      return {
        operationAwarenessTitle: 'Sürücü hazır olma kontrolü',
        operationAwarenessBody:
          'Açık talepler geldikçe ekran güncellenebilir; gerçek bölge yönlendirmesi yapmam.',
        safeChecklist: [
          'Çevrimiçi durumunu ve bildirimlerini kontrol et.',
          'Açık talepler geldikçe ekrandaki kartları takip et.',
          'Bölge veya rota yönlendirmesi yerine ekrandaki kullanım adımlarını açıklarım.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'isDriver'],
      };
    case 'driver_offer_list_guide':
      return {
        operationAwarenessTitle: 'Talep kartı kontrolü',
        operationAwarenessBody:
          'Talep listesi ekrandaki güncel kartlara göre değerlendirilir; kazanç veya yönlendirme garantisi vermem.',
        safeChecklist: [
          'Talep kartındaki rota, araç tercihi ve notları kontrol et.',
          'Yolcu bilgisi ve yolculuk detaylarını tekliften önce gözden geçir.',
          'Bildirimler ve ekran güncellemelerini takip et.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'hasActiveOffer'],
      };
    case 'driver_offer_compose_guide':
      return {
        operationAwarenessTitle: 'Teklif hazırlama kontrolü',
        operationAwarenessBody:
          'Teklif öncesi görünen bilgileri netleştirmeye yardım ederim; fiyat kararı veya rota talimatı vermem.',
        safeChecklist: [
          'Teklif vermeden önce rota, zaman ve iletişim detaylarını netleştir.',
          'Şehir dışı tekliflerde rota, tarih ve rol bilgisini kontrol et.',
          'Eşleşme sonrası Muhabbet/chat içinde detayları teyit et.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'hasActiveOffer'],
      };
    case 'driver_kyc_guide':
      return {
        operationAwarenessTitle: 'Onay süreci kontrolü',
        operationAwarenessBody:
          'Onay süreci devam ederken bazı sürücü özellikleri sınırlı olabilir; ekrandaki durum esas alınır.',
        safeChecklist: [
          'Başvuru durumunu uygulama içindeki ekrandan kontrol et.',
          'Onay tamamlanmadan bazı sürücü özelliklerinin sınırlı olabileceğini unutma.',
          'Eksik veya reddedilen bilgi varsa ekrandaki yönlendirmeyi takip et.',
        ],
        knownSignals: ['homeFlowScreen', 'flowHint', 'isDriver'],
      };
    default:
      return { ...DEFAULT_OPERATION };
  }
}

function withOperationAwareness(copy: LeylekZekaBaseCopy): LeylekZekaContextCopy {
  const operation = operationForIntent(copy.intentScope);
  const offerChecklist = [
    'Şehir dışı tekliflerde rota, tarih ve rol bilgilerini netleştir.',
    'Eşleşme sonrası Muhabbet/chat içinde detayları teyit et.',
    'QR ve görüşme adımlarını uygulama içinde takip et.',
  ];
  return {
    ...copy,
    ...operation,
    safeChecklist: [...operation.safeChecklist, ...offerChecklist],
    knownSignals: Array.from(new Set([...operation.knownSignals, 'stageLabel', 'intentScope'])),
    safeAdviceOnly: true,
    idleHints: [...copy.idleHints, operation.safeChecklist[0]],
  };
}

export function getLeylekZekaContextCopy(
  home: LeylekZekaHomeFlowScreen,
  hint: LeylekZekaFlowHint,
): LeylekZekaContextCopy {
  if (home === 'role-select') return withOperationAwareness(ROLE_SELECT_COPY);
  if (home === 'dashboard' && hint) return withOperationAwareness(FLOW_COPY[hint]);
  return withOperationAwareness(DEFAULT_COPY);
}

/** Ekran + akışa göre ara sıra gösterilen kısa pill (widget). */
export function getContextualPillLine(
  home: LeylekZekaHomeFlowScreen,
  hint: LeylekZekaFlowHint,
): string | null {
  if (home === 'role-select') return ROLE_SELECT_COPY.idleHints[0];
  if (home !== 'dashboard') return null;
  if (!hint) return null;
  return getLeylekZekaContextCopy(home, hint).idleHints[0] ?? null;
}

export function getLeylekZekaStarterPrompts(
  home: LeylekZekaHomeFlowScreen,
  hint: LeylekZekaFlowHint,
): string[] {
  return getLeylekZekaContextCopy(home, hint).starterPrompts;
}

/** Mini ipuçları — ekrana uygun havuz; sırayla seçilir (aynısı üst üste gelmez). */
export function getMiniHintPool(
  home: LeylekZekaHomeFlowScreen,
  hint: LeylekZekaFlowHint,
): string[] {
  return getLeylekZekaContextCopy(home, hint).idleHints;
}

export function pickNextSequential(pool: string[], last: string | null): string {
  if (!pool.length) return '';
  if (!last) return pool[0];
  const idx = pool.findIndex((t) => t !== last);
  return idx >= 0 ? pool[idx] : pool[0];
}
