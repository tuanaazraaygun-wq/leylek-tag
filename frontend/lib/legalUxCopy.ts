/** Shared legal metadata + payment microcopy (UI only — SSOT content Phase 2). */

import { LEGAL_LAST_UPDATED, LEGAL_PRODUCT_DISPLAY_NAME } from './legal/brand';

export const LEGAL_COMPANY_META = {
  companyName: 'Karekod Teknoloji ve Yazılım A.Ş.',
  address: 'Meşrutiyet Mah. Konur Sk. Özsoy İş Hanı No: 25 İç Kapı No: 13 Çankaya / Ankara',
  email: 'info@karekodteknoloji.com',
  phone: '0850 307 80 29',
} as const;

/** Informational badge for in-app legal routes. */
export const LEGAL_DOC_LAST_UPDATED = LEGAL_LAST_UPDATED;

export const PAYMENT_LEGAL_DISCLAIMER_LINES = [
  `${LEGAL_PRODUCT_DISPLAY_NAME} platform tahsilat yapmaz.`,
  'Nakit veya IBAN katkı payı mutabakatı taraflar arasındadır.',
  'Kullanıcılar katkı payı bilgisini kontrol etmekle sorumludur.',
] as const;

export const IBAN_OPTIONAL_NOTICE =
  `IBAN eklemek zorunlu değildir. Yol paylaşım katkısı nakit veya IBAN ile taraflar arasında netleşir; ${LEGAL_PRODUCT_DISPLAY_NAME} platform tahsilat yapmaz.`;

/** IBAN yönetim ekranı — taraflar arası iletim bilgilendirmesi */
export const IBAN_SHARING_NOTICE =
  `IBAN bilgisi yalnızca taraflar arası katkı payı iletimi için gösterilir. ${LEGAL_PRODUCT_DISPLAY_NAME} platform tahsilatı yapmaz.`;

/** Sürücü KYC intro — platform niteliği (taşıma/taksi değildir). */
export const KYC_INTRO_PLATFORM_NOTICE =
  `${LEGAL_PRODUCT_DISPLAY_NAME} bir taşıma şirketi veya taksi hizmeti sunmaz; gönüllü yol paylaşımı ve kişi eşleştirme platformudur. Kimlik doğrulama, profil güven rozeti ve topluluk güvenliği içindir — resmi devlet onayı veya sabıka kaydı kontrolü yapılmaz.`;

/** Sürücü KYC — belge, trafik ve katkı payı sorumlulukları. */
export const KYC_DRIVER_RESPONSIBILITY_LINES = [
  'Sürücü; paylaştığı ehliyet, ruhsat/araç bilgisi, plaka ve diğer belgelerin doğru ve güncel olmasından sorumludur.',
  'Geçerli ehliyet, yürürlükteki zorunlu trafik sigortası, trafik kurallarına uyum ve yolcu güvenliği sürücünün yükümlülüğündedir.',
  PAYMENT_LEGAL_DISCLAIMER_LINES[0],
  PAYMENT_LEGAL_DISCLAIMER_LINES[1],
] as const;

/** Sürücü KYC — dengeli hesap inceleme / askıya alma bilgilendirmesi. */
export const KYC_ACCOUNT_REVIEW_NOTICE =
  `Şirket; Sürücü Sözleşmesi, Topluluk Kuralları veya mevzuat ihlali ya da makul güvenlik gerekçesi bulunması halinde başvuruyu incelemeye alabilir, profili geçici olarak askıya alabilir veya sonlandırabilir. İşlem gerekçesi mümkün olduğunca bildirilir; itiraz ve destek için ${LEGAL_COMPANY_META.email} · ${LEGAL_COMPANY_META.phone} kullanılabilir. Şirket keyfi veya sınırsız hesap kapatma uygulamaz.`;
