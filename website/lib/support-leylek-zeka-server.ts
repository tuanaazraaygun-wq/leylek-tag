/**
 * Server-only Leylek Zeka destek proxy mantığı.
 * Yalnızca API route tarafından import edilmeli — client component'ten çağrılmaz.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const LEYLEK_ZEKA_UPSTREAM = "https://api.leylektag.com/api/ai/leylekzeka";
const BACKEND_TIMEOUT_MS = 25_000;
const MESSAGE_MAX_LEN = 800;
const HISTORY_MAX_ROWS = 10;
const RATE_LIMIT_MS = 10_000;

const WEBSITE_AI_CONTEXT = {
  screen: "website_support",
  flowHint: "website_support",
  guideMode: true,
  safeAdviceOnly: true,
  intentScope: "website_help",
} as const;

export type LeylekZekaHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type SiteUserIdentity = {
  email: string;
  authUid: string;
};

export type LeylekZekaTicketRow = {
  id: string;
  status: string | null;
  assigned_admin_id: string | null;
  client_token: string | null;
  email: string | null;
};

export type LeylekZekaChatRow = {
  sender_type: string;
  body: string;
  created_at: string;
};

type RateLimitEntry = {
  expiresAt: number;
};

const rateLimitByKey = new Map<string, RateLimitEntry>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function trimTicketStatus(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function getSupabaseServiceRoleClientForLeylekZeka(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifySiteUserAccessToken(
  accessToken: string,
): Promise<SiteUserIdentity | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !accessToken.trim()) return null;

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(accessToken.trim());
  const rawEmail = data.user?.email;
  if (error || !rawEmail?.trim() || !data.user?.id) return null;

  return {
    email: normalizeEmail(rawEmail),
    authUid: data.user.id,
  };
}

export function validateLeylekZekaMessage(message: unknown): string | null {
  if (typeof message !== "string") return null;
  const trimmed = message.trim();
  if (trimmed.length < 1 || trimmed.length > MESSAGE_MAX_LEN) return null;
  return trimmed;
}

export function validateTicketId(ticketId: unknown): string | null {
  if (typeof ticketId !== "string") return null;
  const trimmed = ticketId.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

export function validateClientToken(clientToken: unknown): string | null {
  if (typeof clientToken !== "string") return null;
  const trimmed = clientToken.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

export function checkLeylekZekaRateLimit(email: string, ticketId: string): boolean {
  const key = `${normalizeEmail(email)}|${ticketId.trim()}`;
  const now = Date.now();
  const existing = rateLimitByKey.get(key);
  if (existing && existing.expiresAt > now) return false;
  rateLimitByKey.set(key, { expiresAt: now + RATE_LIMIT_MS });
  return true;
}

export async function fetchOwnedSupportTicket(
  service: SupabaseClient,
  ticketId: string,
  clientToken: string,
  sessionEmail: string,
): Promise<LeylekZekaTicketRow | null> {
  const { data, error } = await service
    .from("support_messages")
    .select("id, status, assigned_admin_id, client_token, email")
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !data?.id) return null;

  const row = data as LeylekZekaTicketRow;
  if (normalizeToken(row.client_token ?? "") !== normalizeToken(clientToken)) return null;
  if (normalizeEmail(row.email ?? "") !== normalizeEmail(sessionEmail)) return null;

  return row;
}

export function shouldMuteLeylekZekaForTicket(ticket: LeylekZekaTicketRow): boolean {
  if (trimTicketStatus(ticket.status) === "resolved") return true;
  if ((ticket.assigned_admin_id ?? "").trim().length > 0) return true;
  return false;
}

export async function threadHasAdminReply(
  service: SupabaseClient,
  ticketId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from("support_chat_messages")
    .select("id")
    .eq("support_message_id", ticketId)
    .eq("sender_type", "admin")
    .limit(1);

  if (error) return true;
  return Array.isArray(data) && data.length > 0;
}

export function buildWebsiteLeylekZekaHistory(
  rows: LeylekZekaChatRow[],
  currentMessage: string,
): LeylekZekaHistoryItem[] {
  const current = currentMessage.trim();
  const filtered = rows.filter((row) => {
    const st = (row.sender_type ?? "").trim().toLowerCase();
    return st === "user" || st === "system";
  });

  let working = filtered;
  if (working.length > 0) {
    const last = working[working.length - 1]!;
    const lastType = (last.sender_type ?? "").trim().toLowerCase();
    if (lastType === "user" && last.body.trim() === current) {
      working = working.slice(0, -1);
    }
  }

  const tail = working.slice(-HISTORY_MAX_ROWS);
  return tail
    .map((row) => {
      const st = (row.sender_type ?? "").trim().toLowerCase();
      return {
        role: st === "system" ? ("assistant" as const) : ("user" as const),
        content: row.body.trim(),
      };
    })
    .filter((item) => item.content.length > 0);
}

export async function fetchTicketAiHistoryRows(
  service: SupabaseClient,
  ticketId: string,
): Promise<LeylekZekaChatRow[]> {
  const { data, error } = await service
    .from("support_chat_messages")
    .select("sender_type, body, created_at")
    .eq("support_message_id", ticketId)
    .in("sender_type", ["user", "system"])
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) return [];
  return data as LeylekZekaChatRow[];
}

type BackendLeylekZekaResponse = {
  reply?: unknown;
  source?: unknown;
  success?: unknown;
  ok?: unknown;
};

export async function callBackendLeylekZeka(params: {
  message: string;
  history: LeylekZekaHistoryItem[];
  clientIp?: string | null;
}): Promise<{ reply: string; source: string | null } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const ip = params.clientIp?.trim();
  if (ip) headers["X-Forwarded-For"] = ip;

  try {
    const res = await fetch(LEYLEK_ZEKA_UPSTREAM, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: params.message,
        history: params.history,
        context: WEBSITE_AI_CONTEXT,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const bodyText = await res.text();
    let data: BackendLeylekZekaResponse | null = null;
    try {
      data = bodyText ? (JSON.parse(bodyText) as BackendLeylekZekaResponse) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return null;
    }

    const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
    if (!reply) return null;

    const source = typeof data?.source === "string" ? data.source.trim() : null;
    return { reply, source };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function insertLeylekZekaSystemReply(
  service: SupabaseClient,
  ticketId: string,
  body: string,
): Promise<{ id: string } | null> {
  const { data, error } = await service
    .from("support_chat_messages")
    .insert({
      support_message_id: ticketId,
      sender_type: "system",
      body: body.trim(),
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) return null;
  return { id: String(data.id) };
}

export function extractClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}
