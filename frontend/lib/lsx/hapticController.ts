/**
 * B4-3 — LSX semantic haptic controller (flags OFF → no-op).
 *
 * CallScreenV2 uses an independent looping Vibration pattern for trust calls.
 * Do not wire LSX haptics into CallScreenV2 — collision risk documented in B4 QA docs.
 */

import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { tapButtonHaptic } from '../../utils/touchHaptics';
import { isLsxHapticChannelEnabled } from './featureFlags';
import { createCooldownGate, SONIC_DEDUPE_MS } from './sonicDedupe';
import type { LsxHapticTokenId, LsxEventId } from './types';
import { tryGetLsxEventBinding } from './eventRegistry';

/** Semantic haptic events supported by LSX v1. */
export type HapticSemanticId =
  | 'success'
  | 'error'
  | 'warning'
  | 'selection'
  | 'tap'
  | 'lock'
  | 'match.accept'
  | 'offer.new'
  | 'qr.scan.success'
  | 'qr.scan.error'
  | 'payment.success'
  | 'trust.connected'
  | 'rating.complete';

export type PlayLsxHapticOptions = {
  dedupeKey?: string;
  bypassDedupe?: boolean;
};

const HAPTIC_DEDUPE_MS = {
  success: 800,
  error: SONIC_DEDUPE_MS.feedbackError,
  warning: 1200,
  selection: 70,
  tap: 70,
  lock: 400,
  matchAccept: 800,
  offerNew: SONIC_DEDUPE_MS.driverOffer,
  qrScan: SONIC_DEDUPE_MS.qrScan,
  paymentSuccess: SONIC_DEDUPE_MS.paymentConfirmed,
  trustConnected: 800,
  ratingComplete: 500,
} as const;

const gates = {
  success: createCooldownGate(HAPTIC_DEDUPE_MS.success),
  error: createCooldownGate(HAPTIC_DEDUPE_MS.error),
  warning: createCooldownGate(HAPTIC_DEDUPE_MS.warning),
  selection: createCooldownGate(HAPTIC_DEDUPE_MS.selection),
  tap: createCooldownGate(HAPTIC_DEDUPE_MS.tap),
  lock: createCooldownGate(HAPTIC_DEDUPE_MS.lock),
  matchAccept: createCooldownGate(HAPTIC_DEDUPE_MS.matchAccept),
  offerNew: createCooldownGate(HAPTIC_DEDUPE_MS.offerNew),
  qrSuccess: createCooldownGate(HAPTIC_DEDUPE_MS.qrScan),
  qrError: createCooldownGate(HAPTIC_DEDUPE_MS.qrScan),
  paymentSuccess: createCooldownGate(HAPTIC_DEDUPE_MS.paymentSuccess),
  trustConnected: createCooldownGate(HAPTIC_DEDUPE_MS.trustConnected),
  ratingComplete: createCooldownGate(HAPTIC_DEDUPE_MS.ratingComplete),
};

const TOKEN_TO_SEMANTIC: Record<LsxHapticTokenId, HapticSemanticId | null> = {
  'brand.boot': null,
  'screen.enter': 'selection',
  'screen.exit': null,
  'match.accept': 'match.accept',
  'match.reject': 'warning',
  'offer.new': 'offer.new',
  'offer.accept': 'tap',
  'offer.reject': 'tap',
  'journey.start': 'success',
  'journey.finish': 'success',
  'qr.scan.success': 'qr.scan.success',
  'qr.scan.error': 'qr.scan.error',
  'payment.success': 'payment.success',
  'payment.error': 'error',
  'trust.connected': 'trust.connected',
  'rating.complete': 'rating.complete',
  loading: null,
  success: 'success',
  warning: 'warning',
  error: 'error',
};

function androidPulse(ms: number): void {
  try {
    if (Platform.OS === 'android') {
      Vibration.vibrate(ms);
    }
  } catch {
    /* safe no-op */
  }
}

async function firePattern(semantic: HapticSemanticId): Promise<void> {
  switch (semantic) {
    case 'success':
    case 'match.accept':
    case 'payment.success':
    case 'trust.connected':
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        androidPulse(30);
      }
      return;
    case 'error':
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        androidPulse(40);
      }
      return;
    case 'warning':
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        androidPulse(35);
      }
      return;
    case 'selection':
      try {
        await Haptics.selectionAsync();
      } catch {
        androidPulse(12);
      }
      return;
    case 'tap':
    case 'offer.new':
    case 'rating.complete':
      await tapButtonHaptic();
      return;
    case 'lock':
    case 'qr.scan.success':
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
      } catch {
        androidPulse(22);
      }
      return;
    case 'qr.scan.error':
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        androidPulse(28);
      }
      return;
    default:
      return;
  }
}

function gateForSemantic(semantic: HapticSemanticId) {
  switch (semantic) {
    case 'success':
      return gates.success;
    case 'error':
      return gates.error;
    case 'warning':
      return gates.warning;
    case 'selection':
      return gates.selection;
    case 'tap':
      return gates.tap;
    case 'lock':
      return gates.lock;
    case 'match.accept':
      return gates.matchAccept;
    case 'offer.new':
      return gates.offerNew;
    case 'qr.scan.success':
      return gates.qrSuccess;
    case 'qr.scan.error':
      return gates.qrError;
    case 'payment.success':
      return gates.paymentSuccess;
    case 'trust.connected':
      return gates.trustConnected;
    case 'rating.complete':
      return gates.ratingComplete;
    default:
      return gates.tap;
  }
}

function dedupeAllows(semantic: HapticSemanticId, opts?: PlayLsxHapticOptions): boolean {
  if (opts?.bypassDedupe) return true;
  return gateForSemantic(semantic).tryPass();
}

/**
 * Fire semantic haptic pattern.
 * EXPO_PUBLIC_FEATURE_LSX=false or LSX_HAPTIC=false → no-op.
 */
export async function playLsxHapticSemantic(
  semantic: HapticSemanticId,
  options?: PlayLsxHapticOptions,
): Promise<void> {
  if (!isLsxHapticChannelEnabled()) return;
  if (!dedupeAllows(semantic, options)) return;

  try {
    await firePattern(semantic);
  } catch (e) {
    if (__DEV__) console.warn('[LSX] playLsxHapticSemantic', semantic, e);
  }
}

/** Fire haptic for registry token id. */
export async function playLsxHapticForToken(
  tokenId: LsxHapticTokenId,
  options?: PlayLsxHapticOptions,
): Promise<void> {
  const semantic = TOKEN_TO_SEMANTIC[tokenId];
  if (!semantic) return;
  await playLsxHapticSemantic(semantic, options);
}

/** Fire haptic channel for LSX event id (reads registry binding). */
export async function playLsxHapticEvent(
  eventId: LsxEventId,
  options?: PlayLsxHapticOptions,
): Promise<void> {
  if (!isLsxHapticChannelEnabled()) return;
  const binding = tryGetLsxEventBinding(eventId);
  if (!binding?.haptic) return;
  await playLsxHapticForToken(binding.haptic, options);
}

export function isHapticSemanticSupported(_semantic: HapticSemanticId): boolean {
  return Platform.OS !== 'web';
}
