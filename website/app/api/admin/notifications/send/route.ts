import { NextResponse } from "next/server";

import {
  NO_STORE_HEADERS,
  notificationSendErrorMessage,
  parseNotificationSendBody,
  proxyAdminPushSend,
  verifyAdminNotificationRequest,
} from "@/lib/admin-notification-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await verifyAdminNotificationRequest(request);
  if (identity instanceof NextResponse) {
    return identity;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "invalid_body",
        message: notificationSendErrorMessage("invalid_body"),
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = parseNotificationSendBody(body);
  if ("error" in parsed) {
    const status =
      parsed.error === "user_not_found"
        ? 404
        : parsed.error === "ambiguous_phone"
          ? 409
          : 400;
    return NextResponse.json(
      {
        success: false,
        error: parsed.error,
        message: notificationSendErrorMessage(parsed.error),
      },
      { status, headers: NO_STORE_HEADERS },
    );
  }

  return proxyAdminPushSend(identity, parsed);
}
