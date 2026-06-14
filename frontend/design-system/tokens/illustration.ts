/**
 * LDS blueprint illustration tokens — hero cards, chips, Leylek Eye adjacency.
 */
export const LDS_ILLUSTRATION = {
  /** Hero illustration height as fraction of card height */
  heroHeightRatio: 0.63,
  /** Compact hero slot ratio */
  heroHeightRatioCompact: 0.66,
  /** Very compact hero slot ratio (LDS-4D-I4) */
  heroHeightRatioVeryCompact: 0.65,
  /** Portrait hero viewBox width (LDS-4D-I) */
  heroViewBoxWidth: 120,
  /** Portrait hero viewBox height (LDS-4D-I) */
  heroViewBoxHeight: 160,
  /** Render height relative to hero slot (LDS-4D-I4 boost) */
  stageFillRatio: 1,
  /** Max render width relative to hero slot */
  stageWidthRatio: 0.98,
  /** Very compact stage fill clamp — prevents card overflow */
  stageFillRatioVeryCompact: 0.96,
  /** Very compact stage width clamp */
  stageWidthRatioVeryCompact: 0.96,
  /** Default viewBox aspect (width / height) */
  viewBoxAspect: 120 / 160,
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
