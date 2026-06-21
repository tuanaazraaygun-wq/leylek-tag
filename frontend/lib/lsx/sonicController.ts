/**
 * B4-2 — LSX sonic controller (registry dispatch; flags OFF = no-op).
 */

import { isLsxSonicChannelEnabled } from './featureFlags';
import { getProductionHandlerForEvent, type SonicProductionHandlerName } from './sonicProductionMap';
import type { LsxEventId } from './types';

export type SonicProductionHandlers = Partial<
  Record<SonicProductionHandlerName, () => void | Promise<void>>
>;

let productionHandlers: SonicProductionHandlers = {};

/** Called once from sound.ts after play* exports are defined — avoids import cycles. */
export function registerSonicProductionHandlers(handlers: SonicProductionHandlers): void {
  productionHandlers = { ...productionHandlers, ...handlers };
}

export type PlayLsxSonicEventOptions = {
  /** Reserved for B4-4 orchestrator session dedupe (tagId, inviteId, …). */
  dedupeKey?: string;
  /** Reserved for preview paths. */
  bypassDedupe?: boolean;
};

/**
 * Fire sonic channel for an LSX event id.
 * EXPO_PUBLIC_FEATURE_LSX=false or LSX_SONIC=false → immediate return (no-op).
 * Delegates to existing play* exports which own production dedupe gates.
 */
export async function playLsxSonicEvent(
  eventId: LsxEventId,
  _options?: PlayLsxSonicEventOptions,
): Promise<void> {
  if (!isLsxSonicChannelEnabled()) {
    return;
  }

  const handlerName = getProductionHandlerForEvent(eventId);
  if (!handlerName) {
    return;
  }

  const handler = productionHandlers[handlerName];
  if (!handler) {
    if (__DEV__) {
      console.warn('[LSX] sonic handler not registered:', handlerName, 'for', eventId);
    }
    return;
  }

  await handler();
}
