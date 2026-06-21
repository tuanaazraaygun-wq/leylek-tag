/**
 * B4 — LSX public surface (registry + gated runtime; flags OFF = zero side effects).
 */

export {
  LSX_VERSION,
  LSX_REGISTRY_VERSION,
  LSX_MOTION_TOKEN_VERSION,
  LSX_SONIC_TOKEN_VERSION,
  LSX_HAPTIC_TOKEN_VERSION,
  LSX_COMPATIBILITY,
  LSX_MIGRATION_NOTES,
} from './version';

export type {
  LsxTokenId,
  LsxMotionTokenId,
  LsxSonicTokenId,
  LsxHapticTokenId,
  LsxEventId,
  LsxEventPriority,
  LsxDedupeStrategy,
  LsxEventScope,
  LsxDedupeConfig,
  LsxEventBinding,
  LsxMotionTokenDef,
  LsxSonicTokenDef,
  LsxHapticTokenDef,
  LsxManifest,
} from './types';

export {
  lsxEnabled,
  lsxMotionEnabled,
  lsxSonicEnabled,
  lsxHapticEnabled,
  lsxOrchestratorEnabled,
  isLsxMasterEnabled,
  isLsxOrchestratorEnabled,
  isLsxMotionChannelEnabled,
  isLsxSonicChannelEnabled,
  isLsxHapticChannelEnabled,
  isLsxFullyEnabled,
} from './featureFlags';

export {
  LSX_MOTION_TOKEN_IDS,
  LSX_MOTION_TOKENS,
  getMotionToken,
  isMotionTokenId,
} from './motionTokens';

export {
  LSX_SONIC_TOKEN_IDS,
  LSX_SONIC_TOKENS,
  getSonicToken,
  isSonicTokenId,
} from './sonicTokens';

export {
  LSX_HAPTIC_TOKEN_IDS,
  LSX_HAPTIC_TOKENS,
  getHapticToken,
  isHapticTokenId,
} from './hapticTokens';

export {
  LSX_EVENT_REGISTRY,
  LSX_EVENT_IDS,
  getLsxEventBinding,
  tryGetLsxEventBinding,
  isLsxEventId,
  listLsxEventsByScope,
  listLsxEventsByPriority,
} from './eventRegistry';

export {
  LSX_TOKEN_IDS,
  LSX_MANIFEST,
  LSX_MANIFEST_META,
  assertLsxRegistryIntegrity,
  LSX_REGISTRY_INTEGRITY_OK,
} from './manifest';

export {
  SONIC_DEDUPE_MS,
  matchChimeCooldownGate,
  driverOfferToneCooldownGate,
  driverOfferSessionGate,
  quickMatchOpsCooldownGate,
  quickMatchOpsSessionGate,
  qrScanSonicGate,
  paymentConfirmedCooldownGate,
  feedbackErrorCooldownGate,
  uiTapCooldownGate,
} from './sonicDedupe';

export {
  LSX_SONIC_PRODUCTION_MAP,
  LSX_EVENT_SONIC_PRODUCTION_MAP,
  getProductionHandlerForSonicToken,
  getProductionHandlerForEvent,
} from './sonicProductionMap';
export type { SonicProductionHandlerName } from './sonicProductionMap';

export {
  registerSonicProductionHandlers,
  playLsxSonicEvent,
} from './sonicController';
export type { SonicProductionHandlers, PlayLsxSonicEventOptions } from './sonicController';

export {
  playLsxHapticSemantic,
  playLsxHapticForToken,
  playLsxHapticEvent,
  isHapticSemanticSupported,
} from './hapticController';
export type { HapticSemanticId, PlayLsxHapticOptions } from './hapticController';

export { playLsxEvent } from './orchestrator';
export type { PlayLsxEventOptions } from './orchestrator';

export { orchestratorDedupeAllows, resetOrchestratorDedupeState } from './orchestratorDedupe';

export {
  playQrSuccessLsx,
  playQrErrorLsx,
  playPaymentSuccessLsx,
  playTrustConnectedLsx,
  playRatingCompleteLsx,
} from './qrPaymentTrustBindings';
export type { LsxBindingOptions } from './qrPaymentTrustBindings';

export {
  assertLsxManifestSafe,
  assertLsxRuntimeSafe,
  listEnabledLsxChannels,
  listActiveLsxChannels,
  isLsxProductionDefault,
} from './qa';
export type { LsxChannelName } from './qa';
