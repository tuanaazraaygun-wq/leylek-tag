/**
 * B4-1 — Haptic token registry (metadata only — touchHaptics untouched).
 */

import { LSX_HAPTIC_TOKEN_VERSION } from './version';
import type { LsxHapticTokenDef, LsxHapticTokenId } from './types';

const HAPTIC_TOKEN_LIST: readonly LsxHapticTokenId[] = [
  'brand.boot',
  'screen.enter',
  'screen.exit',
  'match.accept',
  'match.reject',
  'offer.new',
  'offer.accept',
  'offer.reject',
  'journey.start',
  'journey.finish',
  'qr.scan.success',
  'qr.scan.error',
  'payment.success',
  'payment.error',
  'trust.connected',
  'rating.complete',
  'loading',
  'success',
  'warning',
  'error',
] as const;

export const LSX_HAPTIC_TOKEN_IDS: readonly LsxHapticTokenId[] = HAPTIC_TOKEN_LIST;

export const LSX_HAPTIC_TOKENS: Record<LsxHapticTokenId, LsxHapticTokenDef> = {
  'brand.boot': {
    id: 'brand.boot',
    version: LSX_HAPTIC_TOKEN_VERSION,
    tier: 'D',
    description: 'Boot — T0 intentional none (LSX constitution)',
  },
  'screen.enter': {
    id: 'screen.enter',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.selection',
    tier: 'C',
    description: 'Screen enter — optional light selection',
  },
  'screen.exit': {
    id: 'screen.exit',
    version: LSX_HAPTIC_TOKEN_VERSION,
    tier: 'C',
    description: 'Screen exit — intentional none',
  },
  'match.accept': {
    id: 'match.accept',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.success',
    tier: 'A',
    description: 'Match confirmed — P6 success delayed +16ms',
  },
  'match.reject': {
    id: 'match.reject',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.warning',
    tier: 'B',
    description: 'Match rejected — warning tap',
  },
  'offer.new': {
    id: 'offer.new',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.medium',
    tier: 'A',
    description: 'Driver new offer — P2 confirm (urgent: haptic.double)',
  },
  'offer.accept': {
    id: 'offer.accept',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.selection',
    tier: 'B',
    description: 'Offer accept CTA — P1 selection',
  },
  'offer.reject': {
    id: 'offer.reject',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.light',
    tier: 'B',
    description: 'Offer dismiss — light tap',
  },
  'journey.start': {
    id: 'journey.start',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.light',
    tier: 'A',
    description: 'Boarding confirmed — light +16ms',
  },
  'journey.finish': {
    id: 'journey.finish',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.light',
    tier: 'B',
    description: 'Trip complete — light closure',
  },
  'qr.scan.success': {
    id: 'qr.scan.success',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.lock',
    tier: 'A',
    description: 'QR verified — P4 lock +8ms',
  },
  'qr.scan.error': {
    id: 'qr.scan.error',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.warning',
    tier: 'B',
    description: 'QR invalid — T5 warning',
  },
  'payment.success': {
    id: 'payment.success',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.success',
    tier: 'A',
    description: 'Payment confirmed — P6 +24ms',
  },
  'payment.error': {
    id: 'payment.error',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.error',
    tier: 'B',
    description: 'Payment failed — T6 error',
  },
  'trust.connected': {
    id: 'trust.connected',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.success',
    tier: 'B',
    description: 'Trust accept — P6 +16ms',
  },
  'rating.complete': {
    id: 'rating.complete',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.selection',
    tier: 'C',
    description: 'Rating submit — light selection',
  },
  loading: {
    id: 'loading',
    version: LSX_HAPTIC_TOKEN_VERSION,
    tier: 'D',
    description: 'Loading — intentional none',
  },
  success: {
    id: 'success',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.success',
    tier: 'B',
    description: 'Generic success notification',
  },
  warning: {
    id: 'warning',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.warning',
    tier: 'B',
    description: 'Generic warning notification',
  },
  error: {
    id: 'error',
    version: LSX_HAPTIC_TOKEN_VERSION,
    dnaPattern: 'haptic.error',
    tier: 'B',
    description: 'Generic error notification',
  },
};

export function getHapticToken(id: LsxHapticTokenId): LsxHapticTokenDef {
  return LSX_HAPTIC_TOKENS[id];
}

export function isHapticTokenId(value: string): value is LsxHapticTokenId {
  return Object.prototype.hasOwnProperty.call(LSX_HAPTIC_TOKENS, value);
}
