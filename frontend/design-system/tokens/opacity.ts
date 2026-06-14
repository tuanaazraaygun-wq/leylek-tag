/**
 * LDS opacity tokens — ambient, glass, grid, selection (presentation layer).
 */
export const LDS_OPACITY = {
  /** Cockpit grid horizontal lines */
  gridLine: 0.028,
  /** Perspective grid lines */
  gridPerspective: 0.018,
  /** Horizon accent line */
  horizonLine: 0.045,
  /** Top cyan haze on deep navy */
  topHaze: 0.025,
  /** Bottom vignette depth */
  bottomVignette: 0.32,
  /** Glass surface top sheen (white) */
  glassSheenWhite: 0.055,
  /** Glass surface cyan wash */
  glassSheenCyan: 0.02,
  /** Selected card inner glow peak */
  selectionGlowPeak: 0.22,
  /** Selected card inner glow mid */
  selectionGlowMid: 0.08,
  /** Selected card side wash */
  selectionGlowSide: 0.1,
  /** Blueprint illustration idle stroke */
  illustrationStrokeIdle: 0.62,
  /** Inner rim highlight on glass */
  glassInnerRim: 0.06,
  /** Press feedback */
  pressDim: 0.94,
} as const;

export type LdsOpacityToken = keyof typeof LDS_OPACITY;
