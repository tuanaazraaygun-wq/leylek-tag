/**
 * B4-2 — LSX sonic token / event → production sound.ts export mapping (declarative).
 */

import type { LsxEventId, LsxSonicTokenId } from './types';

/** Production handler names in frontend/utils/sound.ts */
export type SonicProductionHandlerName =
  | 'playMatchChimeSound'
  | 'playDriverNewOfferLuxuryTone'
  | 'playUiTapSound'
  | 'playQrScanSuccessSound'
  | 'playQrScanErrorSound'
  | 'playPaymentConfirmedSound'
  | 'playFeedbackErrorSound';

/** LSX sonic token id → sound.ts export (null = intentional silence). */
export const LSX_SONIC_PRODUCTION_MAP: Record<
  LsxSonicTokenId,
  SonicProductionHandlerName | null
> = {
  'brand.boot': null,
  'screen.enter': null,
  'screen.exit': null,
  'match.accept': 'playMatchChimeSound',
  'match.reject': null,
  'offer.new': 'playDriverNewOfferLuxuryTone',
  'offer.accept': 'playUiTapSound',
  'offer.reject': null,
  'journey.start': null,
  'journey.finish': null,
  'qr.scan.success': 'playQrScanSuccessSound',
  'qr.scan.error': 'playQrScanErrorSound',
  'payment.success': 'playPaymentConfirmedSound',
  'payment.error': 'playFeedbackErrorSound',
  'trust.connected': null,
  'rating.complete': null,
  loading: null,
  success: null,
  warning: null,
  error: 'playFeedbackErrorSound',
};

/** LSX event id → production handler (via event's sonic token). */
export const LSX_EVENT_SONIC_PRODUCTION_MAP: Record<
  LsxEventId,
  SonicProductionHandlerName | null
> = {
  'brand.boot': null,
  'screen.enter': null,
  'screen.exit': null,
  'match.accept': 'playMatchChimeSound',
  'match.reject': null,
  'offer.new': 'playDriverNewOfferLuxuryTone',
  'offer.accept': 'playUiTapSound',
  'offer.reject': null,
  'journey.start': null,
  'journey.finish': null,
  'qr.scan.success': 'playQrScanSuccessSound',
  'qr.scan.error': 'playQrScanErrorSound',
  'payment.success': 'playPaymentConfirmedSound',
  'payment.error': 'playFeedbackErrorSound',
  'trust.connected': null,
  'rating.complete': null,
  loading: null,
  success: null,
  warning: null,
  error: 'playFeedbackErrorSound',
};

export function getProductionHandlerForSonicToken(
  tokenId: LsxSonicTokenId,
): SonicProductionHandlerName | null {
  return LSX_SONIC_PRODUCTION_MAP[tokenId] ?? null;
}

export function getProductionHandlerForEvent(
  eventId: LsxEventId,
): SonicProductionHandlerName | null {
  return LSX_EVENT_SONIC_PRODUCTION_MAP[eventId] ?? null;
}
