import { NextResponse } from "next/server";

import {
  buildSupportNotifyPayload,
  notifySupportAdmins,
  type SupportNotifyEvent,
} from "@/lib/support-admin-notify-server";
import {
  fetchOwnedSupportTicket,
  getSupabaseServiceRoleClientForLeylekZeka,
  validateClientToken,
  validateTicketId,
  verifySiteUserAccessToken,
} from "@/lib/support-leylek-zeka-server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" as const };

type AdminNotifyRequestBody = {
  event?: unknown;
  ticketId?: unknown;
  clientToken?: unknown;
};

function parseNotifyEvent(raw: unknown): SupportNotifyEvent | null {
  if (raw === "new_ticket" || raw === "user_message") return raw;
  return null;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const identity = await verifySiteUserAccessToken(accessToken);
  if (!identity) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  let body: AdminNotifyRequestBody;
  try {
    body = (await request.json()) as AdminNotifyRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const event = parseNotifyEvent(body.event);
  const ticketId = validateTicketId(body.ticketId);
  const clientToken = validateClientToken(body.clientToken);

  if (!event || !ticketId || !clientToken) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const service = getSupabaseServiceRoleClientForLeylekZeka();
  if (!service) {
    return NextResponse.json({ ok: true, notified: false }, { headers: NO_STORE_HEADERS });
  }

  const ticket = await fetchOwnedSupportTicket(service, ticketId, clientToken, identity.email);
  if (!ticket) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const payload = await buildSupportNotifyPayload(service, event, ticketId, ticket);
    const channels = await notifySupportAdmins(payload);
    const notified = channels.discord || channels.telegram;
    return NextResponse.json({ ok: true, notified }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: true, notified: false }, { headers: NO_STORE_HEADERS });
  }
}
