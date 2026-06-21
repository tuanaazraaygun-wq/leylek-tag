/**
 * B4-4 — LSX orchestrator (flags OFF → no-op; never throws to UI).
 */

import { tryGetLsxEventBinding } from './eventRegistry';
import { isLsxHapticChannelEnabled, isLsxMotionChannelEnabled, isLsxOrchestratorEnabled } from './featureFlags';
import { playLsxHapticForToken } from './hapticController';
import { orchestratorDedupeAllows } from './orchestratorDedupe';
import { playLsxSonicEvent } from './sonicController';
import type { LsxEventId, LsxMotionTokenId } from './types';

export type PlayLsxEventOptions = {
  dedupeKey?: string;
  bypassDedupe?: boolean;
  skipMotion?: boolean;
  skipSonic?: boolean;
  skipHaptic?: boolean;
};

/**
 * Motion channel placeholder — B5+ wires LDS/v4 motion tokens.
 * Intentional no-op in B4; registry metadata only.
 */
async function playLsxMotionPlaceholder(_tokenId: LsxMotionTokenId): Promise<void> {
  if (!isLsxMotionChannelEnabled()) return;
  /* no-op */
}

/**
 * Unified LSX event dispatch.
 * Requires EXPO_PUBLIC_FEATURE_LSX=true AND EXPO_PUBLIC_FEATURE_LSX_ORCHESTRATOR=true.
 * Per-channel flags gate sonic / haptic / motion independently.
 */
export async function playLsxEvent(
  eventId: LsxEventId,
  options?: PlayLsxEventOptions,
): Promise<void> {
  if (!isLsxOrchestratorEnabled()) {
    return;
  }

  try {
    const binding = tryGetLsxEventBinding(eventId);
    if (!binding) {
      if (__DEV__) console.warn('[LSX] playLsxEvent unknown event:', eventId);
      return;
    }

    if (!options?.bypassDedupe && !orchestratorDedupeAllows(binding, options?.dedupeKey)) {
      return;
    }

    if (!options?.skipMotion && binding.motion) {
      await playLsxMotionPlaceholder(binding.motion);
    }

    if (!options?.skipSonic && binding.sonic) {
      await playLsxSonicEvent(eventId, options);
    }

    if (!options?.skipHaptic && binding.haptic) {
      await playLsxHapticForToken(binding.haptic, options);
    }
  } catch (e) {
    if (__DEV__) console.warn('[LSX] playLsxEvent failed:', eventId, e);
  }
}
