/**
 * B4-1 — Motion token registry (metadata only — no Animated wiring).
 */

import { LSX_MOTION_TOKEN_VERSION } from './version';
import type { LsxMotionTokenDef, LsxMotionTokenId } from './types';

const MOTION_TOKEN_LIST: readonly LsxMotionTokenId[] = [
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

export const LSX_MOTION_TOKEN_IDS: readonly LsxMotionTokenId[] = MOTION_TOKEN_LIST;

export const LSX_MOTION_TOKENS: Record<LsxMotionTokenId, LsxMotionTokenDef> = {
  'brand.boot': {
    id: 'brand.boot',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.presence.pulse',
    durationMs: 220,
    tier: 'A',
    description: 'Splash logo presence pulse — boot handoff',
  },
  'screen.enter': {
    id: 'screen.enter',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.dismiss.sheet',
    durationMs: 280,
    tier: 'B',
    description: 'Screen / sheet enter — translateY or fade in',
  },
  'screen.exit': {
    id: 'screen.exit',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.dismiss.sheet',
    durationMs: 280,
    tier: 'B',
    description: 'Screen / sheet exit dismiss',
  },
  'match.accept': {
    id: 'match.accept',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.pulse.journey',
    durationMs: 480,
    tier: 'A',
    description: 'Match confirmed — map chrome breathe + overlay',
  },
  'match.reject': {
    id: 'match.reject',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.error.nudge',
    durationMs: 180,
    tier: 'B',
    description: 'Match declined or expired — soft nudge',
  },
  'offer.new': {
    id: 'offer.new',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.relay.ingress',
    durationMs: 260,
    tier: 'A',
    description: 'Driver new offer row ingress',
  },
  'offer.accept': {
    id: 'offer.accept',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.click.press',
    durationMs: 90,
    tier: 'B',
    description: 'Offer accepted CTA press',
  },
  'offer.reject': {
    id: 'offer.reject',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.error.nudge',
    durationMs: 180,
    tier: 'B',
    description: 'Offer dismissed — soft nudge',
  },
  'journey.start': {
    id: 'journey.start',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.pulse.journey',
    durationMs: 480,
    tier: 'A',
    description: 'Boarding confirmed — journey active chrome',
  },
  'journey.finish': {
    id: 'journey.finish',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.success.checkDraw',
    durationMs: 360,
    tier: 'A',
    description: 'Trip complete — closure gesture',
  },
  'qr.scan.success': {
    id: 'qr.scan.success',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.scan.viewfinderFlash',
    durationMs: 100,
    tier: 'A',
    description: 'QR decode success — viewfinder flash on chrome',
  },
  'qr.scan.error': {
    id: 'qr.scan.error',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.error.nudge',
    durationMs: 180,
    tier: 'B',
    description: 'Invalid QR — caution nudge',
  },
  'payment.success': {
    id: 'payment.success',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.lock.ringClose',
    durationMs: 320,
    tier: 'A',
    description: 'Payment confirmed — lock ring close + check',
  },
  'payment.error': {
    id: 'payment.error',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.error.nudge',
    durationMs: 180,
    tier: 'B',
    description: 'Payment failed — soft nudge',
  },
  'trust.connected': {
    id: 'trust.connected',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.success.checkDraw',
    durationMs: 360,
    tier: 'B',
    description: 'Trust network accept — check draw',
  },
  'rating.complete': {
    id: 'rating.complete',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.rating.star',
    durationMs: 120,
    tier: 'B',
    description: 'Rating star tap stagger',
  },
  loading: {
    id: 'loading',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.loading.indeterminate',
    durationMs: 1500,
    tier: 'C',
    description: 'Indeterminate loading — meridian sweep loop',
  },
  success: {
    id: 'success',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.success.checkDraw',
    durationMs: 360,
    tier: 'B',
    description: 'Generic success micro animation',
  },
  warning: {
    id: 'warning',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.error.nudge',
    durationMs: 180,
    tier: 'B',
    description: 'Generic warning nudge',
  },
  error: {
    id: 'error',
    version: LSX_MOTION_TOKEN_VERSION,
    dnaAlias: 'v4.motion.error.nudge',
    durationMs: 180,
    tier: 'B',
    description: 'Generic error nudge',
  },
};

export function getMotionToken(id: LsxMotionTokenId): LsxMotionTokenDef {
  return LSX_MOTION_TOKENS[id];
}

export function isMotionTokenId(value: string): value is LsxMotionTokenId {
  return Object.prototype.hasOwnProperty.call(LSX_MOTION_TOKENS, value);
}
