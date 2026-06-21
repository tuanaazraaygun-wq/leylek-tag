/**
 * B4-1 — LSX manifest (single SSOT snapshot for registry + versions).
 */

import { LSX_EVENT_REGISTRY } from './eventRegistry';
import { LSX_HAPTIC_TOKEN_IDS } from './hapticTokens';
import { LSX_MOTION_TOKEN_IDS } from './motionTokens';
import { LSX_SONIC_TOKEN_IDS } from './sonicTokens';
import type { LsxManifest, LsxTokenId } from './types';
import {
  LSX_COMPATIBILITY,
  LSX_HAPTIC_TOKEN_VERSION,
  LSX_MIGRATION_NOTES,
  LSX_MOTION_TOKEN_VERSION,
  LSX_REGISTRY_VERSION,
  LSX_SONIC_TOKEN_VERSION,
  LSX_VERSION,
} from './version';

/** Canonical ordered token list — all three channels share IDs in v1. */
export const LSX_TOKEN_IDS: readonly LsxTokenId[] = LSX_MOTION_TOKEN_IDS;

export const LSX_MANIFEST: LsxManifest = {
  lsxVersion: LSX_VERSION,
  registryVersion: LSX_REGISTRY_VERSION,
  motionTokenVersion: LSX_MOTION_TOKEN_VERSION,
  sonicTokenVersion: LSX_SONIC_TOKEN_VERSION,
  hapticTokenVersion: LSX_HAPTIC_TOKEN_VERSION,
  tokenIds: LSX_TOKEN_IDS,
  eventCount: LSX_EVENT_REGISTRY.length,
};

export const LSX_MANIFEST_META = {
  compatibility: LSX_COMPATIBILITY,
  migration: LSX_MIGRATION_NOTES,
  channels: {
    motion: LSX_MOTION_TOKEN_IDS.length,
    sonic: LSX_SONIC_TOKEN_IDS.length,
    haptic: LSX_HAPTIC_TOKEN_IDS.length,
  },
  registry: {
    events: LSX_EVENT_REGISTRY.length,
    critical: LSX_EVENT_REGISTRY.filter((e) => e.priority === 'critical').length,
    withSonic: LSX_EVENT_REGISTRY.filter((e) => e.sonic !== null).length,
    withHaptic: LSX_EVENT_REGISTRY.filter((e) => e.haptic !== null).length,
    withMotion: LSX_EVENT_REGISTRY.filter((e) => e.motion !== null).length,
  },
} as const;

export function assertLsxRegistryIntegrity(): boolean {
  if (LSX_MOTION_TOKEN_IDS.length !== LSX_SONIC_TOKEN_IDS.length) return false;
  if (LSX_MOTION_TOKEN_IDS.length !== LSX_HAPTIC_TOKEN_IDS.length) return false;
  for (let i = 0; i < LSX_TOKEN_IDS.length; i += 1) {
    if (
      LSX_MOTION_TOKEN_IDS[i] !== LSX_SONIC_TOKEN_IDS[i] ||
      LSX_MOTION_TOKEN_IDS[i] !== LSX_HAPTIC_TOKEN_IDS[i]
    ) {
      return false;
    }
  }
  for (const binding of LSX_EVENT_REGISTRY) {
    if (binding.motion && !LSX_MOTION_TOKEN_IDS.includes(binding.motion)) return false;
    if (binding.sonic && !LSX_SONIC_TOKEN_IDS.includes(binding.sonic)) return false;
    if (binding.haptic && !LSX_HAPTIC_TOKEN_IDS.includes(binding.haptic)) return false;
  }
  return true;
}

/** Dev-only sanity check — safe to call from tests; no side effects. */
export const LSX_REGISTRY_INTEGRITY_OK = assertLsxRegistryIntegrity();
