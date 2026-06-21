/**
 * B4-5 — QR / Payment / Trust LSX wrapper helpers (flags OFF → no-op).
 * Does not replace existing playQrScan* / playPayment* call sites.
 */

import type { PlayLsxEventOptions } from './orchestrator';
import { playLsxEvent } from './orchestrator';

export type LsxBindingOptions = PlayLsxEventOptions;

/** QR decode valid — maps to registry event qr.scan.success */
export async function playQrSuccessLsx(options?: LsxBindingOptions): Promise<void> {
  await playLsxEvent('qr.scan.success', options);
}

/** QR decode invalid — maps to registry event qr.scan.error */
export async function playQrErrorLsx(options?: LsxBindingOptions): Promise<void> {
  await playLsxEvent('qr.scan.error', options);
}

/** Payment / contribution confirmed — maps to payment.success */
export async function playPaymentSuccessLsx(options?: LsxBindingOptions): Promise<void> {
  await playLsxEvent('payment.success', options);
}

/** Trust network accept — maps to trust.connected */
export async function playTrustConnectedLsx(options?: LsxBindingOptions): Promise<void> {
  await playLsxEvent('trust.connected', options);
}

/** Rating submit complete — maps to rating.complete */
export async function playRatingCompleteLsx(options?: LsxBindingOptions): Promise<void> {
  await playLsxEvent('rating.complete', options);
}
