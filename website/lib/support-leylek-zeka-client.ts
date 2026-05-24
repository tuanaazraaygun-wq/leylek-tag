export type SupportLeylekZekaRequest = {
  accessToken: string;
  ticketId: string;
  clientToken: string;
  message: string;
};

export type LeylekZekaErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "ai_unavailable"
  | "server_misconfigured"
  | "persist_failed"
  | "network_error"
  | "invalid_client_request"
  | "empty_reply"
  | "request_failed"
  | "invalid_request"
  | "invalid_json";

export type SupportLeylekZekaResult =
  | { success: true; skipped: true; reason?: string }
  | { success: true; skipped?: false; reply: string; source?: string | null; messageId?: string }
  | { success: false; error: LeylekZekaErrorCode; status?: number };

const LEYLEK_ZEKA_ROUTE = "/api/support/leylek-zeka";
const FETCH_TIMEOUT_MS = 28_000;

function mapHttpStatusToError(status: number, bodyError: unknown): LeylekZekaErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 502) return "ai_unavailable";
  if (status === 503) return "server_misconfigured";
  if (status === 500) {
    return bodyError === "persist_failed" ? "persist_failed" : "request_failed";
  }
  if (typeof bodyError === "string" && bodyError.length > 0) {
    const known: LeylekZekaErrorCode[] = [
      "unauthorized",
      "forbidden",
      "rate_limited",
      "ai_unavailable",
      "server_misconfigured",
      "persist_failed",
      "invalid_request",
      "invalid_json",
    ];
    if (known.includes(bodyError as LeylekZekaErrorCode)) {
      return bodyError as LeylekZekaErrorCode;
    }
  }
  return "request_failed";
}

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

    const bodyError = data?.error;

    if (!res.ok) {
      return {
        success: false,
        error: mapHttpStatusToError(res.status, bodyError),
        status: res.status,
      };
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
      return { success: false, error: "empty_reply", status: res.status };
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
