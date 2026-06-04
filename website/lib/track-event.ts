"use client";

export type TrackEventParams = Record<string, string | number | boolean | undefined>;

export type TrackEventName =
  | "store_click_google_play"
  | "store_click_app_store"
  | "support_open"
  | "city_landing_cta_click"
  | "driver_cta_click"
  | "passenger_cta_click";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function sanitizeParams(params?: TrackEventParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  ) as Record<string, string | number | boolean>;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** Client-only Meta Pixel custom event — no-op when fbq or window is unavailable. */
export function trackMetaEvent(name: TrackEventName, params?: TrackEventParams): void {
  try {
    if (typeof window === "undefined") return;
    if (typeof window.fbq !== "function") return;
    const payload = sanitizeParams(params);
    if (payload) {
      window.fbq("trackCustom", name, payload);
    } else {
      window.fbq("trackCustom", name);
    }
  } catch {
    /* fail-safe */
  }
}

export function trackStoreClick(
  variant: "apple" | "google",
  meta?: { source?: string; page?: string; placement?: string },
): void {
  const event: TrackEventName = variant === "apple" ? "store_click_app_store" : "store_click_google_play";
  trackMetaEvent(event, meta);
}

export function trackSupportOpen(meta?: { page?: string; placement?: string }): void {
  trackMetaEvent("support_open", meta);
}

export function trackCityLandingCta(meta?: { city_slug?: string; role?: string; placement?: string; page?: string }): void {
  trackMetaEvent("city_landing_cta_click", meta);
}

export function trackPassengerCta(meta?: { placement?: string; page?: string }): void {
  trackMetaEvent("passenger_cta_click", meta);
}

export function trackDriverCta(meta?: { placement?: string; page?: string }): void {
  trackMetaEvent("driver_cta_click", meta);
}
