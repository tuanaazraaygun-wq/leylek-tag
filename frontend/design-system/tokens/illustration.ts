/**
 * LDS blueprint illustration tokens — hero cards, chips, Leylek Eye adjacency.
 */
export const LDS_ILLUSTRATION = {
  /** Hero illustration height as fraction of card height (LDS-4G-A) */
  heroHeightRatio: 0.72,
  /** Compact hero slot ratio (LDS-4G-A) */
  heroHeightRatioCompact: 0.73,
  /** Very compact hero slot ratio (LDS-4G-A) */
  heroHeightRatioVeryCompact: 0.7,
  /** Portrait hero viewBox width (LDS-4D-I) */
  heroViewBoxWidth: 120,
  /** Portrait hero viewBox height (LDS-4D-I) */
  heroViewBoxHeight: 160,
  /** Render height relative to hero slot (LDS-4D-I4 boost) */
  stageFillRatio: 1,
  /** Max render width relative to hero slot (LDS-4G-A) */
  stageWidthRatio: 1,
  /** Very compact stage fill clamp — prevents card overflow */
  stageFillRatioVeryCompact: 0.96,
  /** Very compact stage width clamp (LDS-4G-A) */
  stageWidthRatioVeryCompact: 1,
  /** Role card hero — full blueprint visible, horizontal letterbox OK (LDS-4G-A) */
  stagePreserveAspectRatioRoleCard: 'xMidYMid meet' as const,
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
