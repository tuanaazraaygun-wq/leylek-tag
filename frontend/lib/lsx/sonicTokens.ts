/**
 * B4-1 — Sonic token registry (metadata only — sound.ts untouched).
 */

import { LSX_SONIC_TOKEN_VERSION } from './version';
import type { LsxSonicTokenDef, LsxSonicTokenId } from './types';

const SONIC_TOKEN_LIST: readonly LsxSonicTokenId[] = [
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

export const LSX_SONIC_TOKEN_IDS: readonly LsxSonicTokenId[] = SONIC_TOKEN_LIST;

/** productionRef documents existing sound.ts exports for B4-2 migration — not called here. */
export const LSX_SONIC_TOKENS: Record<LsxSonicTokenId, LsxSonicTokenDef> = {
  'brand.boot': {
    id: 'brand.boot',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.brand.signature',
    productionRef: undefined,
    tier: 'A',
    description: 'Boot presence sting — not wired in production',
  },
  'screen.enter': {
    id: 'screen.enter',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'C',
    description: 'Screen transition — intentional silence',
  },
  'screen.exit': {
    id: 'screen.exit',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'C',
    description: 'Screen exit — intentional silence',
  },
  'match.accept': {
    id: 'match.accept',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.match.success',
    productionRef: 'playMatchChimeSound',
    tier: 'A',
    description: 'Match confirmed chime',
  },
  'match.reject': {
    id: 'match.reject',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'B',
    description: 'Match rejected — silent or micro tap only',
  },
  'offer.new': {
    id: 'offer.new',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.driver.offer.classic',
    productionRef: 'playDriverNewOfferLuxuryTone',
    tier: 'A',
    description: 'Driver new TAG offer (classic/urgent via prefs)',
  },
  'offer.accept': {
    id: 'offer.accept',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.ui.tap',
    productionRef: 'playUiTapSound',
    tier: 'B',
    description: 'Offer accept CTA micro click',
  },
  'offer.reject': {
    id: 'offer.reject',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'B',
    description: 'Offer dismiss — intentional silence',
  },
  'journey.start': {
    id: 'journey.start',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'A',
    description: 'Boarding confirmed — future journey.start token',
  },
  'journey.finish': {
    id: 'journey.finish',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'A',
    description: 'Trip end — future journey.end token',
  },
  'qr.scan.success': {
    id: 'qr.scan.success',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.qr.success',
    productionRef: 'playQrScanSuccessSound',
    tier: 'A',
    description: 'QR decode valid — lock blip',
  },
  'qr.scan.error': {
    id: 'qr.scan.error',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.qr.error',
    productionRef: 'playQrScanErrorSound',
    tier: 'B',
    description: 'QR decode invalid — soft caution',
  },
  'payment.success': {
    id: 'payment.success',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.payment.confirmed',
    productionRef: 'playPaymentConfirmedSound',
    tier: 'A',
    description: 'Payment or contribution confirmed',
  },
  'payment.error': {
    id: 'payment.error',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.feedback.error',
    productionRef: 'playFeedbackErrorSound',
    tier: 'B',
    description: 'Payment API failure',
  },
  'trust.connected': {
    id: 'trust.connected',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'B',
    description: 'Trust accept — future trust micro token',
  },
  'rating.complete': {
    id: 'rating.complete',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'C',
    description: 'Rating submit — optional micro confirm',
  },
  loading: {
    id: 'loading',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'D',
    description: 'Loading — intentional silence',
  },
  success: {
    id: 'success',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'B',
    description: 'Generic success — context-specific tokens preferred',
  },
  warning: {
    id: 'warning',
    version: LSX_SONIC_TOKEN_VERSION,
    tier: 'B',
    description: 'Generic warning — paired with feedback.error where applicable',
  },
  error: {
    id: 'error',
    version: LSX_SONIC_TOKEN_VERSION,
    lsdToken: 'sonic.feedback.error',
    productionRef: 'playFeedbackErrorSound',
    tier: 'B',
    description: 'Generic API/form error tone',
  },
};

export function getSonicToken(id: LsxSonicTokenId): LsxSonicTokenDef {
  return LSX_SONIC_TOKENS[id];
}

export function isSonicTokenId(value: string): value is LsxSonicTokenId {
  return Object.prototype.hasOwnProperty.call(LSX_SONIC_TOKENS, value);
}
