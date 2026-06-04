/**
 * Server-only — Telegram + Discord destek admin bildirimleri.
 * Yalnızca API route tarafından import edilmeli.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { LeylekZekaTicketRow } from "@/lib/support-leylek-zeka-server";

const NOTIFY_TIMEOUT_MS = 4500;
const PREVIEW_MAX = 80;
const ADMIN_PANEL_URL = "https://leylektag.com/support/admin";

export type SupportNotifyEvent = "new_ticket" | "user_message";

export type SupportNotifyPayload = {
  event: SupportNotifyEvent;
  ticketId: string;
  pagePath: string | null;
  maskedEmail: string;
  preview: string;
};

export function isSupportNotifyEnabled(): boolean {
  if (process.env.SUPPORT_NOTIFY_ENABLED?.trim().toLowerCase() !== "true") {
    return false;
  }
  const discord = process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim();
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramChat = process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim();
  return Boolean(discord || (telegramToken && telegramChat));
}

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "***";
  const visible = local.slice(0, 1) || "*";
  return `${visible}***@${domain}`;
}

export function truncatePreview(text: string, max = PREVIEW_MAX): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "—";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function ticketShortId(ticketId: string): string {
  return ticketId.replace(/-/g, "").slice(0, 8) || "unknown";
}

function safeLogFail(provider: string, ticketId: string, reason: string): void {
  console.warn(
    `[support-admin-notify] failed provider=${provider} ticket=${ticketShortId(ticketId)} reason=${reason}`,
  );
}

function eventLabel(event: SupportNotifyEvent): string {
  return event === "new_ticket" ? "Yeni destek talebi" : "Kullanıcı mesajı (insan destek)";
}

function buildNotificationText(payload: SupportNotifyPayload): string {
  const lines = [
    "LeylekTAG · Destek bildirimi",
    eventLabel(payload.event),
    `Ticket: ${ticketShortId(payload.ticketId)}`,
  ];
  if (payload.pagePath?.trim()) {
    lines.push(`Sayfa: ${payload.pagePath.trim()}`);
  }
  lines.push(`E-posta: ${payload.maskedEmail}`);
  lines.push(`Önizleme: ${payload.preview}`);
  lines.push(`Panel: ${ADMIN_PANEL_URL}`);
  return lines.join("\n");
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendDiscordSupportNotification(payload: SupportNotifyPayload): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  try {
    const res = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: buildNotificationText(payload),
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) {
      safeLogFail("discord", payload.ticketId, `http_${res.status}`);
      return false;
    }
    return true;
  } catch {
    safeLogFail("discord", payload.ticketId, "request_failed");
    return false;
  }
}

export async function sendTelegramSupportNotification(payload: SupportNotifyPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  try {
    const apiUrl = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    const res = await fetchWithTimeout(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildNotificationText(payload),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      safeLogFail("telegram", payload.ticketId, `http_${res.status}`);
      return false;
    }
    return true;
  } catch {
    safeLogFail("telegram", payload.ticketId, "request_failed");
    return false;
  }
}

export async function buildSupportNotifyPayload(
  service: SupabaseClient,
  event: SupportNotifyEvent,
  ticketId: string,
  ticket: LeylekZekaTicketRow,
): Promise<SupportNotifyPayload> {
  const { data: row } = await service
    .from("support_messages")
    .select("message, page_path, email")
    .eq("id", ticketId)
    .maybeSingle();

  const pagePath = typeof row?.page_path === "string" ? row.page_path : null;
  const emailRaw = (ticket.email ?? row?.email ?? "").trim();
  let previewSource = typeof row?.message === "string" ? row.message : "";

  if (event === "user_message") {
    const { data: latestUserLine } = await service
      .from("support_chat_messages")
      .select("body")
      .eq("support_message_id", ticketId)
      .eq("sender_type", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (typeof latestUserLine?.body === "string" && latestUserLine.body.trim()) {
      previewSource = latestUserLine.body;
    }
  }

  return {
    event,
    ticketId,
    pagePath,
    maskedEmail: maskEmail(emailRaw),
    preview: truncatePreview(previewSource),
  };
}

export async function notifySupportAdmins(
  payload: SupportNotifyPayload,
): Promise<{ discord: boolean; telegram: boolean }> {
  if (!isSupportNotifyEnabled()) {
    return { discord: false, telegram: false };
  }

  const [discord, telegram] = await Promise.all([
    sendDiscordSupportNotification(payload),
    sendTelegramSupportNotification(payload),
  ]);

  return { discord, telegram };
}
