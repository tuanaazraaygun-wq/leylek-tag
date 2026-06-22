/** Shared legal metadata + payment microcopy (UI only — SSOT content Phase 2). */

export const LEGAL_COMPANY_META = {
  companyName: 'Karekod Teknoloji ve Yazılım A.Ş.',
  address: 'Meşrutiyet Mah. Konur Sk. Özsoy İş Hanı No: 25 İç Kapı No: 13 Çankaya / Ankara',
  email: 'info@karekodteknoloji.com',
  phone: '0850 307 80 29',
} as const;

/** Informational badge for in-app legal routes (body text unchanged in Phase 1). */
export const LEGAL_DOC_LAST_UPDATED = 'Ocak 2025';

export const PAYMENT_LEGAL_DISCLAIMER_LINES = [
  'LeylekTAG platform tahsilat yapmaz.',
  'Nakit veya IBAN katkı payı mutabakatı taraflar arasındadır.',
  'Kullanıcılar katkı payı bilgisini kontrol etmekle sorumludur.',
] as const;

export const IBAN_OPTIONAL_NOTICE =
  'IBAN eklemek zorunlu değildir. Yol paylaşım katkısı nakit veya IBAN ile taraflar arasında netleşir; LeylekTAG platform tahsilat yapmaz.';

/** IBAN yönetim ekranı — taraflar arası iletim bilgilendirmesi */
export const IBAN_SHARING_NOTICE =
  'IBAN bilgisi yalnızca taraflar arası katkı payı iletimi için gösterilir. LeylekTAG platform tahsilatı yapmaz.';
