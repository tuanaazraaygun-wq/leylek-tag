/**
 * Sprint 5E-3 — Driver offer urgency helpers (UI-only; no dispatch/backend coupling).
 * Countdown is a local visual estimate from first card appearance, not server revoke time.
 */

export const DRIVER_OFFER_COUNTDOWN_FALLBACK_SEC = 60;
export const DRIVER_OFFER_NEW_EMPHASIS_MS = 9000;
export const DRIVER_OFFER_URGENCY_PULSE_MS = 2200;
export const DRIVER_OFFER_URGENCY_PULSE_CYCLES = 3;

export type OfferCountdownTier = 'normal' | 'warn' | 'critical' | 'expired';

export function resolveDriverOfferCountdownTotalSec(request: {
  dispatch_timeout?: number | null;
}): number {
  const dt = Number(request.dispatch_timeout);
  if (Number.isFinite(dt) && dt > 0) return Math.round(dt);
  return DRIVER_OFFER_COUNTDOWN_FALLBACK_SEC;
}

export function computeDriverOfferCountdownRemainingSec(
  firstSeenAtMs: number,
  totalSec: number,
  nowMs: number = Date.now(),
): number {
  const elapsed = Math.floor((nowMs - firstSeenAtMs) / 1000);
  return Math.max(0, totalSec - elapsed);
}

export function resolveOfferCountdownTier(remainingSec: number): OfferCountdownTier {
  if (remainingSec <= 0) return 'expired';
  if (remainingSec <= 5) return 'critical';
  if (remainingSec <= 15) return 'warn';
  return 'normal';
}

export function isDriverOfferFresh(firstSeenAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - firstSeenAtMs < DRIVER_OFFER_NEW_EMPHASIS_MS;
}
