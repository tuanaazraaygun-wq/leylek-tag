/**
 * B4-1 — LSX feature flags (default OFF — zero sensory behaviour change).
 */

function readBoolEnv(name: string): boolean {
  const value = process.env[name];
  return value === 'true' || value === '1';
}

/** Master LSX orchestrator gate — must be true for any LSX channel. */
export const lsxEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LSX');

/** Motion channel — registry-driven animations (future B4-4+). */
export const lsxMotionEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LSX_MOTION');

/** Sonic channel — registry-driven audio (future B4-2+). */
export const lsxSonicEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LSX_SONIC');

/** Haptic channel — registry-driven tactile (future B4-3+). */
export const lsxHapticEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LSX_HAPTIC');

export function isLsxMasterEnabled(): boolean {
  return lsxEnabled;
}

export function isLsxMotionChannelEnabled(): boolean {
  return lsxEnabled && lsxMotionEnabled;
}

export function isLsxSonicChannelEnabled(): boolean {
  return lsxEnabled && lsxSonicEnabled;
}

export function isLsxHapticChannelEnabled(): boolean {
  return lsxEnabled && lsxHapticEnabled;
}

/** All channels — for future full triad fire. */
export function isLsxFullyEnabled(): boolean {
  return (
    lsxEnabled &&
    lsxMotionEnabled &&
    lsxSonicEnabled &&
    lsxHapticEnabled
  );
}
