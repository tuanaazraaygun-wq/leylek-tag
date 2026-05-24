import { NextResponse } from "next/server";
import {
  buildWebsiteLeylekZekaHistory,
  callBackendLeylekZeka,
  checkLeylekZekaRateLimit,
  extractClientIp,
  fetchOwnedSupportTicket,
  fetchTicketAiHistoryRows,
  getSupabaseServiceRoleClientForLeylekZeka,
  insertLeylekZekaSystemReply,
  shouldMuteLeylekZekaForTicket,
  threadHasAdminReply,
  validateClientToken,
  validateLeylekZekaMessage,
  validateTicketId,
  verifySiteUserAccessToken,
  warnLeylekZekaEvent,
} from "@/lib/support-leylek-zeka-server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" as const };

type LeylekZekaRequestBody = {
  ticketId?: unknown;
  clientToken?: unknown;
  message?: unknown;
};

export async function POST(request: Request) {
  const service = getSupabaseServiceRoleClientForLeylekZeka();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!service || !url || !anonKey) {
    console.warn("[leylek-zeka:unknown] server_misconfigured");
    return NextResponse.json(
      { success: false, error: "server_misconfigured" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const identity = await verifySiteUserAccessToken(accessToken);
  if (!identity) {
    return NextResponse.json(
      { success: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  let body: LeylekZekaRequestBody;
  try {
    body = (await request.json()) as LeylekZekaRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_json" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const ticketId = validateTicketId(body.ticketId);
  const clientToken = validateClientToken(body.clientToken);
  const message = validateLeylekZekaMessage(body.message);

  if (!ticketId || !clientToken || !message) {
    return NextResponse.json(
      { success: false, error: "invalid_request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!checkLeylekZekaRateLimit(identity.email, ticketId)) {
    warnLeylekZekaEvent("rate_limited", ticketId);
    return NextResponse.json(
      { success: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const ticket = await fetchOwnedSupportTicket(service, ticketId, clientToken, identity.email);
  if (!ticket) {
    warnLeylekZekaEvent("forbidden", ticketId);
    return NextResponse.json(
      { success: false, error: "forbidden" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  if (shouldMuteLeylekZekaForTicket(ticket)) {
    return NextResponse.json(
      { success: true, skipped: true, reason: "human_support_active" },
      { headers: NO_STORE_HEADERS },
    );
  }

  if (await threadHasAdminReply(service, ticketId)) {
    return NextResponse.json(
      { success: true, skipped: true, reason: "admin_reply_present" },
      { headers: NO_STORE_HEADERS },
    );
  }

  const historyRows = await fetchTicketAiHistoryRows(service, ticketId);
  const history = buildWebsiteLeylekZekaHistory(historyRows, message);

  const ai = await callBackendLeylekZeka({
    message,
    history,
    clientIp: extractClientIp(request),
  });

  if (!ai) {
    warnLeylekZekaEvent("ai_unavailable", ticketId);
    return NextResponse.json(
      { success: false, error: "ai_unavailable" },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }

  const inserted = await insertLeylekZekaSystemReply(service, ticketId, ai.reply);
  if (!inserted) {
    warnLeylekZekaEvent("persist_failed", ticketId);
    return NextResponse.json(
      { success: false, error: "persist_failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      success: true,
      reply: ai.reply,
      source: ai.source,
      messageId: inserted.id,
    },
    { headers: NO_STORE_HEADERS },
  );
}
