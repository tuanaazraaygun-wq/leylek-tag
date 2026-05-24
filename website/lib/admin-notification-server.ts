/**
 * Server-only — Admin Bildirim Merkezi push proxy (Faz 1B: specific + bulk).
 * Yalnızca API route tarafından import edilmeli.
 */
import { NextResponse } from "next/server";

import {
  audienceToBackendTarget,
  BULK_PUSH_CONFIRM_PHRASE,
  isActivePushAudience,
  isKycDisabledAudience,
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  type NotificationSendRequestBody,
  type NotificationSendResult,
} from "@/lib/admin-notification-draft-types";
import { type KycAdminIdentity, verifyKycAdminRequest } from "@/lib/kyc-admin-auth";

const DEFAULT_BACKEND_API_BASE = "https://api.leylektag.com/api";
const BACKEND_TIMEOUT_MS = 25_000;

const SPECIFIC_RATE_LIMIT_WINDOW_MS = 60_000;
const SPECIFIC_RATE_LIMIT_MAX = 5;

const BULK_RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const BULK_RATE_LIMIT_MAX = 1;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RateLimitEntry = {
  windowStart: number;
  count: number;
};

const specificRateLimitByAdminEmail = new Map<string, RateLimitEntry>();
const bulkRateLimitByAdminEmail = new Map<string, RateLimitEntry>();

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" as const };

function backendApiBase(): string {
  const fromEnv = process.env.BACKEND_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return DEFAULT_BACKEND_API_BASE;
}

function adminBackendPhone(): string | null {
  const raw = process.env.ADMIN_BACKEND_PHONE?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return raw;
}

function checkRateLimit(
  map: Map<string, RateLimitEntry>,
  adminEmail: string,
  windowMs: number,
  maxPerWindow: number,
): boolean {
  const key = adminEmail.trim().toLowerCase();
  const now = Date.now();
  const existing = map.get(key);
  if (!existing || now - existing.windowStart >= windowMs) {
    map.set(key, { windowStart: now, count: 1 });
    return true;
  }
  if (existing.count >= maxPerWindow) {
    return false;
  }
  existing.count += 1;
  return true;
}

function checkSpecificPushRateLimit(adminEmail: string): boolean {
  return checkRateLimit(
    specificRateLimitByAdminEmail,
    adminEmail,
    SPECIFIC_RATE_LIMIT_WINDOW_MS,
    SPECIFIC_RATE_LIMIT_MAX,
  );
}

function checkBulkPushRateLimit(adminEmail: string): boolean {
  return checkRateLimit(
    bulkRateLimitByAdminEmail,
    adminEmail,
    BULK_RATE_LIMIT_WINDOW_MS,
    BULK_RATE_LIMIT_MAX,
  );
}

export function parseNotificationSendBody(body: unknown): NotificationSendRequestBody | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "invalid_body" };
  }
  const b = body as Record<string, unknown>;
  const audience = typeof b.audience === "string" ? b.audience.trim() : "";

  if (isKycDisabledAudience(audience)) {
    return { error: "faz_2_disabled" };
  }
  if (!isActivePushAudience(audience)) {
    return { error: "invalid_audience" };
  }

  const title = typeof b.title === "string" ? b.title.trim() : "";
  const messageBody = typeof b.body === "string" ? b.body.trim() : "";

  if (!title || title.length > NOTIFICATION_TITLE_MAX) {
    return { error: "invalid_title" };
  }
  if (!messageBody || messageBody.length > NOTIFICATION_BODY_MAX) {
    return { error: "invalid_body_text" };
  }

  if (audience === "specific_user") {
    const userId = typeof b.user_id === "string" ? b.user_id.trim() : "";
    if (!userId || !UUID_RE.test(userId)) {
      return { error: "invalid_user_id" };
    }
    return {
      audience: "specific_user",
      title,
      body: messageBody,
      user_id: userId.toLowerCase(),
    };
  }

  const userId = typeof b.user_id === "string" ? b.user_id.trim() : "";
  if (userId) {
    return { error: "bulk_user_id_forbidden" };
  }

  const confirmPhrase = typeof b.confirm_phrase === "string" ? b.confirm_phrase.trim() : "";
  if (confirmPhrase !== BULK_PUSH_CONFIRM_PHRASE) {
    return { error: "bulk_confirm_required" };
  }

  return {
    audience,
    title,
    body: messageBody,
    confirm_phrase: BULK_PUSH_CONFIRM_PHRASE,
  };
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_body: "Geçersiz istek gövdesi.",
  invalid_audience: "Geçersiz hedef kitle.",
  faz_2_disabled: "KYC segmentleri Faz 2'de açılacak.",
  invalid_title: "Başlık gerekli (en fazla 80 karakter).",
  invalid_body_text: "Mesaj gerekli (en fazla 500 karakter).",
  invalid_user_id: "Geçerli bir kullanıcı UUID gerekir.",
  bulk_user_id_forbidden: "Toplu gönderimde kullanıcı ID gönderilemez.",
  bulk_confirm_required: 'Toplu gönderim için onay ifadesi "GÖNDER" olmalıdır.',
  server_misconfigured: "Sunucu yapılandırması eksik.",
  upstream_error: "Bildirim servisine ulaşılamadı.",
  upstream_timeout: "Bildirim servisi zaman aşımına uğradı.",
  forbidden: "Bu hesap bildirim göndermeye yetkili değil.",
  unauthorized: "Oturum geçersiz. Tekrar giriş yapın.",
  rate_limited: "Çok sık deneme. Lütfen bir dakika bekleyin.",
  rate_limited_bulk: "Toplu gönderim sınırı: 5 dakikada en fazla 1 deneme.",
};

export async function verifyAdminNotificationRequest(
  request: Request,
): Promise<KycAdminIdentity | NextResponse> {
  return verifyKycAdminRequest(request);
}

export async function proxyAdminPushSend(
  identity: KycAdminIdentity,
  payload: NotificationSendRequestBody,
): Promise<NextResponse> {
  const phone = adminBackendPhone();
  if (!phone) {
    return NextResponse.json(
      { success: false, error: "server_misconfigured", message: ERROR_MESSAGES.server_misconfigured },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const isBulk = payload.audience !== "specific_user";
  const withinLimit = isBulk
    ? checkBulkPushRateLimit(identity.email)
    : checkSpecificPushRateLimit(identity.email);

  if (!withinLimit) {
    return NextResponse.json(
      {
        success: false,
        error: isBulk ? "rate_limited_bulk" : "rate_limited",
        message: isBulk ? ERROR_MESSAGES.rate_limited_bulk : ERROR_MESSAGES.rate_limited,
      },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const backendTarget = audienceToBackendTarget(payload.audience);
  const params = new URLSearchParams({
    admin_phone: phone,
    title: payload.title,
    body: payload.body,
    target: backendTarget,
  });

  if (payload.audience === "specific_user") {
    params.set("user_id", payload.user_id);
  }

  const url = `${backendApiBase()}/admin/notifications/send?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    const raw = await res.text().catch(() => "");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }

    if (!res.ok) {
      const detail =
        typeof parsed.detail === "string"
          ? parsed.detail
          : typeof parsed.message === "string"
            ? parsed.message
            : ERROR_MESSAGES.upstream_error;
      const status = res.status === 403 ? 403 : 502;
      return NextResponse.json(
        {
          success: false,
          error: res.status === 403 ? "forbidden" : "upstream_error",
          message: detail,
        },
        { status, headers: NO_STORE_HEADERS },
      );
    }

    const sentCount =
      typeof parsed.sent_count === "number" && Number.isFinite(parsed.sent_count)
        ? parsed.sent_count
        : 0;
    const totalUsers =
      typeof parsed.total_users === "number" && Number.isFinite(parsed.total_users)
        ? parsed.total_users
        : undefined;
    const usersWithToken =
      typeof parsed.users_with_token === "number" && Number.isFinite(parsed.users_with_token)
        ? parsed.users_with_token
        : undefined;

    let message =
      typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : "";

    if (!message) {
      if (isBulk) {
        message =
          sentCount > 0
            ? `${sentCount} kullanıcıya bildirim iletildi.`
            : "Bildirim iletilemedi. Hedef segmentte geçerli push token kaydı olmayabilir.";
      } else {
        message =
          sentCount === 1
            ? "Bildirim gönderildi."
            : "Bildirim iletilemedi. Kullanıcının uygulamada geçerli push token kaydı olmayabilir.";
      }
    }

    const result: NotificationSendResult = {
      success: Boolean(parsed.success ?? true),
      sent_count: sentCount,
      message,
      audience: payload.audience,
      backendTarget,
    };

    if (totalUsers !== undefined) {
      result.total_users = totalUsers;
    }
    if (usersWithToken !== undefined) {
      result.users_with_token = usersWithToken;
    }

    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        error: isTimeout ? "upstream_timeout" : "upstream_error",
        message: isTimeout ? ERROR_MESSAGES.upstream_timeout : ERROR_MESSAGES.upstream_error,
      },
      { status: isTimeout ? 504 : 502, headers: NO_STORE_HEADERS },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function notificationSendErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "İşlem başarısız.";
}
