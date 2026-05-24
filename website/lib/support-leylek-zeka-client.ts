export type SupportLeylekZekaRequest = {
  accessToken: string;
  ticketId: string;
  clientToken: string;
  message: string;
};

export type SupportLeylekZekaResult =
  | { success: true; skipped: true; reason?: string }
  | { success: true; skipped?: false; reply: string; source?: string | null; messageId?: string }
  | { success: false; error?: string };

const LEYLEK_ZEKA_ROUTE = "/api/support/leylek-zeka";
const FETCH_TIMEOUT_MS = 28_000;

export async function requestSupportLeylekZeka(
  params: SupportLeylekZekaRequest,
): Promise<SupportLeylekZekaResult> {
  const accessToken = params.accessToken.trim();
  const ticketId = params.ticketId.trim();
  const clientToken = params.clientToken.trim();
  const message = params.message.trim();

  if (!accessToken || !ticketId || !clientToken || !message) {
    return { success: false, error: "invalid_client_request" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(LEYLEK_ZEKA_ROUTE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ ticketId, clientToken, message }),
      signal: controller.signal,
      cache: "no-store",
    });

    let data: Record<string, unknown> | null = null;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = null;
    }

    if (res.status === 429) {
      return { success: false, error: "rate_limited" };
    }

    if (!res.ok) {
      const err = typeof data?.error === "string" ? data.error : "request_failed";
      return { success: false, error: err };
    }

    if (data?.skipped === true) {
      return {
        success: true,
        skipped: true,
        reason: typeof data.reason === "string" ? data.reason : undefined,
      };
    }

    const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
    if (!reply) {
      return { success: false, error: "empty_reply" };
    }

    return {
      success: true,
      reply,
      source: typeof data?.source === "string" ? data.source : null,
      messageId: typeof data?.messageId === "string" ? data.messageId : undefined,
    };
  } catch {
    return { success: false, error: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}
