/** Admin Bildirim Merkezi — taslak-only hedef kitle seçenekleri. */
export const NOTIFICATION_AUDIENCES = [
  "all_users",
  "drivers",
  "passengers",
  "kyc_pending",
  "kyc_approved",
  "specific_user",
] as const;

export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export const NOTIFICATION_CHANNELS = ["push", "sms", "whatsapp"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationDraft = {
  id: string;
  audience: NotificationAudience;
  channel: NotificationChannel;
  title: string;
  body: string;
  specificTarget: string | null;
  createdAt: string;
  createdByEmail: string;
};

export const NOTIFICATION_AUDIENCE_LABELS: Record<NotificationAudience, string> = {
  all_users: "Tüm kullanıcılar",
  drivers: "Sürücüler",
  passengers: "Yolcular",
  kyc_pending: "KYC bekleyen sürücüler",
  kyc_approved: "KYC onaylanan sürücüler",
  specific_user: "Belirli telefon / e-posta / kullanıcı",
};

export const NOTIFICATION_TITLE_MAX = 80;
export const NOTIFICATION_BODY_MAX = 500;

export function isBulkNotificationAudience(audience: NotificationAudience): boolean {
  return audience !== "specific_user";
}

export function audienceLabel(audience: NotificationAudience): string {
  return NOTIFICATION_AUDIENCE_LABELS[audience];
}
