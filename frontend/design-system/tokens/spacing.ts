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
