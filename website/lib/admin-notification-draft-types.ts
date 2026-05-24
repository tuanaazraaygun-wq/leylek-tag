/** Admin Bildirim Merkezi — hedef kitle seçenekleri. */
export const NOTIFICATION_AUDIENCES = [
  "all_users",
  "drivers",
  "passengers",
  "kyc_pending",
  "kyc_approved",
  "specific_user",
] as const;

export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

/** Faz 1B: gerçek push aktif hedefler. */
export const NOTIFICATION_ACTIVE_PUSH_AUDIENCES = [
  "specific_user",
  "all_users",
  "drivers",
  "passengers",
] as const;

export type NotificationActivePushAudience = (typeof NOTIFICATION_ACTIVE_PUSH_AUDIENCES)[number];

export type NotificationBulkPushAudience = Exclude<NotificationActivePushAudience, "specific_user">;

/** Faz 2: henüz devre dışı KYC segmentleri. */
export const NOTIFICATION_KYC_AUDIENCES = ["kyc_pending", "kyc_approved"] as const;

export type NotificationKycAudience = (typeof NOTIFICATION_KYC_AUDIENCES)[number];

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

/** Toplu taslak / bulk push (specific_user hariç). */
export function isBulkNotificationAudience(audience: NotificationAudience): boolean {
  return audience !== "specific_user";
}

export function isBulkPushAudience(audience: NotificationAudience): audience is NotificationBulkPushAudience {
  return audience === "all_users" || audience === "drivers" || audience === "passengers";
}

export function isActivePushAudience(audience: string): audience is NotificationActivePushAudience {
  return (NOTIFICATION_ACTIVE_PUSH_AUDIENCES as readonly string[]).includes(audience);
}

export function isKycDisabledAudience(audience: string): audience is NotificationKycAudience {
  return audience === "kyc_pending" || audience === "kyc_approved";
}

export function audienceLabel(audience: NotificationAudience): string {
  return NOTIFICATION_AUDIENCE_LABELS[audience];
}

/** Website audience → backend `target` query param. */
export function audienceToBackendTarget(audience: NotificationActivePushAudience): string {
  switch (audience) {
    case "specific_user":
      return "user";
    case "all_users":
      return "all";
    case "drivers":
      return "drivers";
    case "passengers":
      return "passengers";
  }
}

const USER_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidNotificationUserId(value: string): boolean {
  const t = value.trim();
  return Boolean(t) && USER_ID_UUID_RE.test(t);
}

export const BULK_PUSH_CONFIRM_PHRASE = "GÖNDER";

export type NotificationSendSpecificRequestBody = {
  audience: "specific_user";
  title: string;
  body: string;
  user_id: string;
};

export type NotificationSendBulkRequestBody = {
  audience: NotificationBulkPushAudience;
  title: string;
  body: string;
  confirm_phrase: typeof BULK_PUSH_CONFIRM_PHRASE;
};

export type NotificationSendRequestBody =
  | NotificationSendSpecificRequestBody
  | NotificationSendBulkRequestBody;

export type NotificationSendResult = {
  success: boolean;
  sent_count: number;
  message: string;
  total_users?: number;
  users_with_token?: number;
  audience?: NotificationActivePushAudience;
  backendTarget?: string;
  error?: string;
};
