/**
 * LDS spacing scale (dp) — 4px base grid.
 */
export const LDS_SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export type LdsSpacingToken = keyof typeof LDS_SPACING;

const SPACING_GRID = 4;

/** Snap a computed dp value to the nearest 4px grid unit. */
export function ldsSnapSpacing(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / SPACING_GRID) * SPACING_GRID;
}
