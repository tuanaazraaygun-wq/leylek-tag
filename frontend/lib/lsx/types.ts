/**
 * B4-1 — LSX shared types (registry-only).
 */

import type {
  LSX_HAPTIC_TOKEN_VERSION,
  LSX_MOTION_TOKEN_VERSION,
  LSX_REGISTRY_VERSION,
  LSX_SONIC_TOKEN_VERSION,
  LSX_VERSION,
} from './version';

/** Canonical token IDs — identical across motion / sonic / haptic channels. */
export type LsxTokenId =
  | 'brand.boot'
  | 'screen.enter'
  | 'screen.exit'
  | 'match.accept'
  | 'match.reject'
  | 'offer.new'
  | 'offer.accept'
  | 'offer.reject'
  | 'journey.start'
  | 'journey.finish'
  | 'qr.scan.success'
  | 'qr.scan.error'
  | 'payment.success'
  | 'payment.error'
  | 'trust.connected'
  | 'rating.complete'
  | 'loading'
  | 'success'
  | 'warning'
  | 'error';

export type LsxMotionTokenId = LsxTokenId;
export type LsxSonicTokenId = LsxTokenId;
export type LsxHapticTokenId = LsxTokenId;

/** Registry event IDs — same namespace as tokens for B4-1; extensible in v2. */
export type LsxEventId = LsxTokenId;

export type LsxEventPriority = 'critical' | 'high' | 'normal' | 'low' | 'ambient';

export type LsxDedupeStrategy =
  | 'none'
  | 'cooldownMs'
  | 'oncePerSessionKey'
  | 'oncePerEventKey';

export type LsxEventScope =
  | 'global'
  | 'passenger'
  | 'driver'
  | 'auth'
  | 'journey'
  | 'qr'
  | 'payment'
  | 'trust';

export type LsxDedupeConfig = {
  strategy: LsxDedupeStrategy;
  /** Used when strategy is cooldownMs. */
  cooldownMs?: number;
  /** Session dedupe key field hint for orchestrator (e.g. tagId, inviteId). */
  keyField?: 'tagId' | 'inviteId' | 'scanSessionId' | 'eventId';
};

export type LsxEventBinding = {
  eventId: LsxEventId;
  motion: LsxMotionTokenId | null;
  sonic: LsxSonicTokenId | null;
  haptic: LsxHapticTokenId | null;
  priority: LsxEventPriority;
  dedupe: LsxDedupeConfig;
  /** Feature rollback id — maps to future per-event env flags. */
  rollbackId: string;
  scope: LsxEventScope;
};

export type LsxMotionTokenDef = {
  id: LsxMotionTokenId;
  version: typeof LSX_MOTION_TOKEN_VERSION;
  /** v4 DNA alias (design-lab) — documentation bridge only. */
  dnaAlias?: string;
  durationMs?: number;
  tier: 'A' | 'B' | 'C' | 'D';
  description: string;
};

export type LsxSonicTokenDef = {
  id: LsxSonicTokenId;
  version: typeof LSX_SONIC_TOKEN_VERSION;
  /** LSDS token name — design-lab bridge. */
  lsdToken?: string;
  /** Future mapping to existing production module (B4-2). Not invoked in B4-1. */
  productionRef?: string;
  tier: 'A' | 'B' | 'C' | 'D';
  description: string;
};

export type LsxHapticTokenDef = {
  id: LsxHapticTokenId;
  version: typeof LSX_HAPTIC_TOKEN_VERSION;
  /** v4 haptic DNA pattern id — documentation bridge. */
  dnaPattern?: string;
  tier: 'A' | 'B' | 'C' | 'D';
  description: string;
};

export type LsxManifest = {
  lsxVersion: typeof LSX_VERSION;
  registryVersion: typeof LSX_REGISTRY_VERSION;
  motionTokenVersion: typeof LSX_MOTION_TOKEN_VERSION;
  sonicTokenVersion: typeof LSX_SONIC_TOKEN_VERSION;
  hapticTokenVersion: typeof LSX_HAPTIC_TOKEN_VERSION;
  tokenIds: readonly LsxTokenId[];
  eventCount: number;
};
