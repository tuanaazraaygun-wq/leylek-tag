/**
 * LDS blueprint illustration tokens — hero cards, chips, Leylek Eye adjacency.
 */
export const LDS_ILLUSTRATION = {
  /** Hero illustration height as fraction of card height (LDS-4C target) */
  heroHeightRatio: 0.6,
  /** Render size relative to stage container */
  stageFillRatio: 0.84,
  /** Default viewBox aspect (width / height) */
  viewBoxAspect: 1,
  /** Blueprint stroke — idle */
  strokeWidthIdle: 1.2,
  /** Blueprint stroke — active / selected */
  strokeWidthActive: 1.5,
  /** Grid dash inside illustration */
  gridDash: '2 3',
  /** Stage corner radius factor (size * factor) */
  stageRadiusFactor: 0.26,
} as const;

export type LdsIllustrationToken = keyof typeof LDS_ILLUSTRATION;
