/**
 * Leylek Zeka — API’siz premium UX metinleri (widget pill, mini ipuçları).
 */
import type { LeylekZekaFlowHint, LeylekZekaHomeFlowScreen } from '../contexts/LeylekZekaChromeContext';

/** Ekran + akışa göre ara sıra gösterilen kısa pill (widget). */
export function getContextualPillLine(
  home: LeylekZekaHomeFlowScreen,
  hint: LeylekZekaFlowHint,
): string | null {
  if (home === 'role-select') {
    return 'Sana uygun rolü seçmende yardımcı olabilirim.';
  }
  if (home !== 'dashboard') return null;

  switch (hint) {
    case 'passenger_matching':
      return 'Eşleşme mantığını istersen açıklayayım.';
    case 'passenger_offer_waiting':
      return 'Beklerken araç seçimi konusunda yardımcı olabilirim.';
    case 'driver_offer_list':
    case 'driver_offer_compose':
      return 'Teklif gönderme adımlarını anlatabilirim.';
    case 'passenger_trip':
    case 'driver_trip':
      return 'Yolculuk adımlarında sorun olursa yaz.';
    case 'driver_kyc_pending':
      return 'Başvuru süreci hakkında bilgi verebilirim.';
    default:
      return null;
  }
}

/** Mini ipuçları — ekrana uygun havuz; sırayla seçilir (aynısı üst üste gelmez). */
export function getMiniHintPool(
  home: LeylekZekaHomeFlowScreen,
  hint: LeylekZekaFlowHint,
): string[] {
  if (home === 'role-select') {
    return [
      'Yolcu ve sürücü akışları farklıdır; rolünü net seçmen yeterli.',
      'İstersen rol seçimini birlikte düşünelim.',
    ];
  }
  if (home !== 'dashboard') return [];

  switch (hint) {
    case 'passenger_matching':
      return [
        'İstersen eşleşme sürecini anlatayım.',
        'Konum açıkken eşleşme genelde daha hızlıdır.',
      ];
    case 'passenger_offer_waiting':
      return [
        'Motor seçimi teklifleri filtrelemene yardımcı olur.',
        'Teklifleri karşılaştırmadan önce süreyi kontrol edebilirsin.',
      ];
    case 'driver_offer_list':
    case 'driver_offer_compose':
      return [
        'Teklif fiyatını net yazmak yolcu güvenini artırır.',
        'İstersen teklif adımlarını sırayla özetleyeyim.',
      ];
    case 'passenger_trip':
    case 'driver_trip':
      return [
        'Güvenlik için yolculuk bilgilerini uygulama içinden teyit et.',
        'İstersen mesajlaşma veya iptal konusunda yönlendireyim.',
      ];
    case 'passenger_home':
    case 'driver_idle':
      return [
        'Motor seçimi daha hızlı eşleşme için önemli olabilir.',
        'İstersen eşleşme sürecini anlatayım.',
        'Güvenlik hakkında bilgi verebilirim.',
      ];
    case 'driver_kyc_pending':
      return ['Onay sürecinde sabırlı ol; durum güncellenince haber alırsın.'];
    default:
      return [
        'Uygulama adımlarında takılırsan sorabilirsin.',
        'Güvenlik ve eşleşme konularında yardımcı olabilirim.',
      ];
  }
}

export function pickNextSequential(pool: string[], last: string | null): string {
  if (!pool.length) return '';
  if (!last) return pool[0];
  const idx = pool.findIndex((t) => t !== last);
  return idx >= 0 ? pool[idx] : pool[0];
}
