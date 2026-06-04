"use client";

export type SupportNotifyClientEvent = "new_ticket" | "user_message";

const ADMIN_NOTIFY_ROUTE = "/api/support/admin-notify";
const FETCH_TIMEOUT_MS = 6000;

type NotifySupportAdminsClientParams = {
  event: SupportNotifyClientEvent;
  ticketId: string;
  clientToken: string;
  accessToken: string;
};

/** Fire-and-forget admin bildirimi — kullanıcı akışını etkilemez. */
export async function notifySupportAdminsClient(params: NotifySupportAdminsClientParams): Promise<void> {
  const ticketId = params.ticketId.trim();
  const clientToken = params.clientToken.trim();
  const accessToken = params.accessToken.trim();
  if (!ticketId || !clientToken || !accessToken) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    await fetch(ADMIN_NOTIFY_ROUTE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        event: params.event,
        ticketId,
        clientToken,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    /* fail-safe */
  } finally {
    clearTimeout(timer);
  }
}
