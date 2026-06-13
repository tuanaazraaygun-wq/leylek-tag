/**
 * LDS corner radius tokens — single card language across premium surfaces.
 */
export const LDS_RADIUS = {
  /** Chips, small controls */
  sm: 12,
  /** Secondary cards, outline buttons */
  md: 16,
  /** Primary cards, modals */
  lg: 20,
  /** Hero panels, full-width sheets */
  xl: 24,
  /** Leylek Eye tile, compact orbs */
  orb: 14,
  /** Role selection legacy primary card (24) — alias during migration */
  cardPrimary: 24,
  /** Pills, circular badges */
  full: 9999,
} as const;

export type LdsRadiusToken = keyof typeof LDS_RADIUS;
