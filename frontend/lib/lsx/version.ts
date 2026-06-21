/**
 * B4-1 — LSX version constants (registry-only; no runtime sensory wiring).
 */

/** Top-level LSX manifest generation. Bump on breaking registry shape changes. */
export const LSX_VERSION = 1 as const;

/** Event registry schema generation. */
export const LSX_REGISTRY_VERSION = 1 as const;

/** Per-channel token registry generations. */
export const LSX_MOTION_TOKEN_VERSION = 1 as const;
export const LSX_SONIC_TOKEN_VERSION = 1 as const;
export const LSX_HAPTIC_TOKEN_VERSION = 1 as const;

export type LsxVersion = typeof LSX_VERSION;
export type LsxRegistryVersion = typeof LSX_REGISTRY_VERSION;

/** Future migration hooks — B4-2+ controllers read these for compatibility checks. */
export const LSX_COMPATIBILITY = {
  /** Sensory layer is independent of B3 theme flags. */
  themeIndependent: true,
  /** Minimum LSX registry version understood by orchestrator (future). */
  minRegistryVersion: LSX_REGISTRY_VERSION,
  /** When true, unknown event IDs should no-op (never throw in production). */
  unknownEventNoOp: true,
} as const;

export const LSX_MIGRATION_NOTES = {
  v1: 'Initial manifest — tokens + event registry only; no fireLsxEvent wiring.',
  next: 'B4-2 sonic controller maps sonicToken.productionRef → sound.ts exports.',
} as const;
