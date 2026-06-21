/**
 * B4-6 — LSX QA helpers (read-only runtime checks).
 */

import {
  isLsxFullyEnabled,
  isLsxHapticChannelEnabled,
  isLsxMasterEnabled,
  isLsxMotionChannelEnabled,
  isLsxOrchestratorEnabled,
  isLsxSonicChannelEnabled,
  lsxEnabled,
  lsxHapticEnabled,
  lsxMotionEnabled,
  lsxOrchestratorEnabled,
  lsxSonicEnabled,
} from './featureFlags';
import { assertLsxRegistryIntegrity, LSX_REGISTRY_INTEGRITY_OK } from './manifest';

export type LsxChannelName = 'master' | 'orchestrator' | 'motion' | 'sonic' | 'haptic';

/** Manifest / registry structural integrity. */
export function assertLsxManifestSafe(): boolean {
  return assertLsxRegistryIntegrity();
}

/**
 * Runtime safety snapshot — integrity OK; production defaults flags OFF.
 * Does not execute sensory output.
 */
export function assertLsxRuntimeSafe(): boolean {
  if (!LSX_REGISTRY_INTEGRITY_OK) return false;
  if (!assertLsxManifestSafe()) return false;
  return true;
}

/** Lists env-enabled LSX channels (empty when all flags OFF). */
export function listEnabledLsxChannels(): LsxChannelName[] {
  const channels: LsxChannelName[] = [];
  if (lsxEnabled) channels.push('master');
  if (lsxOrchestratorEnabled) channels.push('orchestrator');
  if (lsxMotionEnabled) channels.push('motion');
  if (lsxSonicEnabled) channels.push('sonic');
  if (lsxHapticEnabled) channels.push('haptic');
  return channels;
}

/** Effective channel gates (master AND sub-flag). */
export function listActiveLsxChannels(): LsxChannelName[] {
  const channels: LsxChannelName[] = [];
  if (isLsxMasterEnabled()) channels.push('master');
  if (isLsxOrchestratorEnabled()) channels.push('orchestrator');
  if (isLsxMotionChannelEnabled()) channels.push('motion');
  if (isLsxSonicChannelEnabled()) channels.push('sonic');
  if (isLsxHapticChannelEnabled()) channels.push('haptic');
  return channels;
}

export function isLsxProductionDefault(): boolean {
  return listEnabledLsxChannels().length === 0 && !isLsxFullyEnabled();
}
