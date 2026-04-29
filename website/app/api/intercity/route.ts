import { NextResponse } from "next/server";

const UPSTREAM_INTERCITY_LIVE = "https://api.leylektag.com/api/public/live/intercity";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" as const };

const TIMEOUT_MS = 5000;

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(UPSTREAM_INTERCITY_LIVE, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false as const, error: "intercity_upstream_error" },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (e) {
    if (isAbortError(e)) {
      return NextResponse.json(
        { success: false as const, error: "intercity_timeout" },
        { status: 504, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { success: false as const, error: "intercity_live_unavailable" },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
