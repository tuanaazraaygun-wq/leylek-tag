/** Destek masası — yalnızca görünür operasyon bilgisi (auth değildir). */

export type SupportDutyContact = {
  /** Gösterim etiketi, örn. "Destek / KYC" */
  label: string;
  /** 10 haneli TR GSM, başında 0 yok */
  phone: string;
  tasks: string[];
};

/** Display-only; backend ADMIN_PHONE_NUMBERS ile bağlantılı değil. */
export const SUPPORT_DUTY_CONTACTS: readonly SupportDutyContact[] = [
  {
    label: "Destek / KYC",
    phone: "5326497412",
    tasks: ["Canlı destek", "KYC doğrulama"],
  },
  {
    label: "Destek yedek",
    phone: "5354169632",
    tasks: ["Canlı destek"],
  },
] as const;

export const CANNED_REPLY_PRESETS = [
  "Merhaba, size nasıl yardımcı olabilirim?",
  "Talebinizi inceliyorum.",
  "Kısa süre içinde dönüş sağlayacağım.",
  "Sorununuz çözüldü mü?",
  "İyi yolculuklar dileriz.",
  "Belgelerinizi kontrol ediyoruz.",
  "Teknik ekibe yönlendirildi.",
] as const;

/** 5326497412 → 532 ••• •• 12 */
export function maskDutyPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ••• •• ${digits.slice(8)}`;
  }
  if (digits.length >= 4) {
    return `${digits.slice(0, 3)} ••• ${digits.slice(-2)}`;
  }
  return phone;
}

export function formatDutyPhoneReadable(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}
