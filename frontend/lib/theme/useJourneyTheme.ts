/**
 * B3-6g — LiveMap / Journey chrome theme gate.
 */

import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../featureFlags';
import { buildThemeTokens } from './buildTheme';
import type { LhThemeTokens } from './types';

export type JourneyThemeScope = 'journey' | 'map';

export type JourneyUiColors = {
  accent: string;
  textMuted: string;
  textSoft: string;
  activity: string;
  successIcon: string;
  errorIcon: string;
  ctaIcon: string;
  ctaIconLight: string;
  ctaIconFill: string;
  closeIcon: string;
  chevron: string;
  routeDotPrimary: string;
  routeDotSecondary: string;
  loadingText: string;
  loadingDots: string;
  webFallbackGradient: readonly [string, string, string];
  ctaGradient: readonly [string, string, string, string];
  ctaGradientSoft: readonly [string, string, string];
  qrGradientBoarding: readonly [string, string, string, string];
  qrGradientTripEnd: readonly [string, string, string, string];
  qrGradientBoardingNear: readonly [string, string, string, string];
};

export type JourneyChromeLightSurfaces = {
  topRouteShell: ViewStyle;
  topPhaseChipShell: ViewStyle;
  topLiveChipShell: ViewStyle;
  topLiveChipDot: ViewStyle;
  matchedTopPriceChip: ViewStyle;
  matchedTopNearChip: ViewStyle;
  mapLoadingOverlay: ViewStyle;
  mapLoadingText: TextStyle;
  webFallback: ViewStyle;
  navManeuverBanner: ViewStyle;
  trustedAddCompactChip: ViewStyle;
  trustedAddCompactChipMuted: ViewStyle;
  trustedAddCompactChipError: ViewStyle;
  drvTopStatusChip: ViewStyle;
  drvOpsStatusChipDot: ViewStyle;
  paxBottomDeckShell: ViewStyle;
  drvBottomDeckShell: ViewStyle;
  paxBottomQrBtnBoarding: ViewStyle;
  paxBottomQrBtnTripEnd: ViewStyle;
  drvBottomQrBtnBoarding: ViewStyle;
  drvBottomQrBtnBoardingNear: ViewStyle;
  drvBottomQrBtnTripEnd: ViewStyle;
  paxBottomCallBtn: ViewStyle;
  paxBottomChatBtn: ViewStyle;
  paxBottomGuvenBtn: ViewStyle;
  drvBottomCallBtn: ViewStyle;
  drvBottomChatBtn: ViewStyle;
  drvBottomGuvenBtn: ViewStyle;
  paxBottomEndBtn: ViewStyle;
  driverRideForceBtn: ViewStyle;
  peerCardShell: ViewStyle;
  warningBanner: ViewStyle;
  successBanner: ViewStyle;
  tripBannerAlert: ViewStyle;
  tripBannerPlain: ViewStyle;
  tripBannerBtnPrimary: ViewStyle;
  tripBannerBtnSecondary: ViewStyle;
  tripBannerHintAccent: TextStyle;
  matchedRouteLineText: TextStyle;
  matchedPriceChipText: TextStyle;
  matchedNearChipText: TextStyle;
  paxLiveChipText: TextStyle;
  driverNavChipLabelText: TextStyle;
  trustedAddChipText: TextStyle;
  trustedAddChipMutedText: TextStyle;
  dangerBtnText: TextStyle;
  qrPrimaryBtnText: TextStyle;
};

const JOURNEY_UI_DARK: JourneyUiColors = {
  accent: '#22D3EE',
  textMuted: 'rgba(186,201,222,0.9)',
  textSoft: 'rgba(243,248,255,0.94)',
  activity: '#22D3EE',
  successIcon: 'rgba(34,211,238,0.95)',
  errorIcon: 'rgba(252,165,165,0.95)',
  ctaIcon: 'rgba(243,248,255,0.94)',
  ctaIconLight: 'rgba(243,248,255,0.94)',
  ctaIconFill: 'rgba(243,248,255,0.94)',
  closeIcon: 'rgba(243,248,255,0.88)',
  chevron: 'rgba(186,201,222,0.78)',
  routeDotPrimary: '#22D3EE',
  routeDotSecondary: 'rgba(34,211,238,0.88)',
  loadingText: 'rgba(186,201,222,0.88)',
  loadingDots: '#22D3EE',
  webFallbackGradient: ['#08111F', '#101A2B', '#22D3EE'],
  ctaGradient: ['#08111F', '#0B1220', '#101A2B', '#22D3EE'],
  ctaGradientSoft: ['#08111F', '#0B1220', '#22D3EE'],
  qrGradientBoarding: ['#08111F', '#101A2B', 'rgba(30,58,95,0.92)', 'rgba(34,211,238,0.5)'],
  qrGradientTripEnd: ['rgba(217,119,6,0.26)', '#0B1220', '#101A2B', 'rgba(34,211,238,0.48)'],
  qrGradientBoardingNear: ['rgba(217,119,6,0.14)', '#08111F', '#101A2B', 'rgba(34,211,238,0.4)'],
};

function buildJourneyChromeLightSurfaces(tokens: LhThemeTokens): JourneyChromeLightSurfaces {
  const dangerBg = 'rgba(220, 38, 38, 0.08)';
  const dangerBorder = 'rgba(220, 38, 38, 0.28)';

  return {
    topRouteShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    topPhaseChipShell: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
    },
    topLiveChipShell: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
    },
    topLiveChipDot: { backgroundColor: tokens.accent.primary },
    matchedTopPriceChip: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    matchedTopNearChip: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
    },
    mapLoadingOverlay: { backgroundColor: tokens.shadow.modal },
    mapLoadingText: { color: tokens.text.muted },
    webFallback: { backgroundColor: tokens.bg.canvas },
    navManeuverBanner: {
      backgroundColor: tokens.bg.elevated,
      borderBottomColor: tokens.border.default,
    },
    trustedAddCompactChip: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    trustedAddCompactChipMuted: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
    },
    trustedAddCompactChipError: {
      backgroundColor: dangerBg,
      borderColor: dangerBorder,
    },
    drvTopStatusChip: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
    },
    drvOpsStatusChipDot: { backgroundColor: tokens.accent.primary },
    paxBottomDeckShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    drvBottomDeckShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    paxBottomQrBtnBoarding: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    paxBottomQrBtnTripEnd: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    drvBottomQrBtnBoarding: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    drvBottomQrBtnBoardingNear: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    drvBottomQrBtnTripEnd: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    paxBottomCallBtn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    paxBottomChatBtn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    paxBottomGuvenBtn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    drvBottomCallBtn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    drvBottomChatBtn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    drvBottomGuvenBtn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    paxBottomEndBtn: {
      backgroundColor: dangerBg,
      borderColor: dangerBorder,
    },
    driverRideForceBtn: {
      backgroundColor: dangerBg,
      borderColor: dangerBorder,
    },
    peerCardShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    warningBanner: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.28)',
    },
    successBanner: {
      backgroundColor: 'rgba(6, 78, 59, 0.12)',
      borderColor: 'rgba(52, 211, 153, 0.28)',
    },
    tripBannerAlert: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    tripBannerPlain: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    tripBannerBtnPrimary: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    tripBannerBtnSecondary: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
    },
    tripBannerHintAccent: { color: tokens.accent.primary },
    matchedRouteLineText: { color: tokens.text.primary },
    matchedPriceChipText: { color: tokens.accent.primary, fontWeight: '700' },
    matchedNearChipText: { color: tokens.text.primary, fontWeight: '600' },
    paxLiveChipText: { color: tokens.accent.primary, fontWeight: '700' },
    driverNavChipLabelText: { color: tokens.text.primary },
    trustedAddChipText: { color: tokens.accent.primary },
    trustedAddChipMutedText: { color: tokens.text.muted },
    dangerBtnText: { color: tokens.status.error },
    qrPrimaryBtnText: { color: tokens.text.inverse, fontWeight: '800' },
  };
}

function buildJourneyUi(tokens: LhThemeTokens): JourneyUiColors {
  return {
    accent: tokens.accent.primary,
    textMuted: tokens.text.muted,
    textSoft: tokens.text.primary,
    activity: tokens.accent.primary,
    successIcon: tokens.accent.primary,
    errorIcon: tokens.status.error,
    ctaIcon: tokens.text.primary,
    ctaIconLight: tokens.text.primary,
    ctaIconFill: tokens.text.inverse,
    closeIcon: tokens.text.primary,
    chevron: tokens.text.muted,
    routeDotPrimary: tokens.accent.primary,
    routeDotSecondary: tokens.accent.glowMid,
    loadingText: tokens.text.muted,
    loadingDots: tokens.accent.primary,
    webFallbackGradient: [tokens.bg.canvas, tokens.bg.elevated, tokens.accent.primary],
    ctaGradient: [tokens.bg.canvas, tokens.bg.elevated, tokens.bg.glassMuted, tokens.accent.primary],
    ctaGradientSoft: [tokens.bg.canvas, tokens.bg.elevated, tokens.accent.primary],
    qrGradientBoarding: [
      tokens.bg.canvas,
      tokens.bg.elevated,
      tokens.border.default,
      tokens.accent.glowMid,
    ],
    qrGradientTripEnd: [
      'rgba(245, 158, 11, 0.18)',
      tokens.bg.elevated,
      tokens.bg.glassMuted,
      tokens.accent.glowMid,
    ],
    qrGradientBoardingNear: [
      'rgba(245, 158, 11, 0.10)',
      tokens.bg.canvas,
      tokens.bg.elevated,
      tokens.accent.glowMid,
    ],
  };
}

export function useJourneyTheme(scope: JourneyThemeScope) {
  const { tokens, resolvedTheme } = useTheme();
  const isScopeLight = isLightThemeScreenEnabled(scope) && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isScopeLight ? tokens : buildThemeTokens('dark')),
    [isScopeLight, tokens],
  );

  const ui = useMemo<JourneyUiColors>(() => {
    if (!isScopeLight) return JOURNEY_UI_DARK;
    return buildJourneyUi(effectiveTokens);
  }, [isScopeLight, effectiveTokens]);

  const chromeSurfaces = useMemo(
    () => (isScopeLight ? buildJourneyChromeLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  return {
    tokens: effectiveTokens,
    isScopeLight,
    ui,
    chromeSurfaces,
  };
}

/** LiveMap uses journey + map scopes — light when either is enabled. */
export function useLiveMapChromeTheme() {
  const journey = useJourneyTheme('journey');
  const map = useJourneyTheme('map');
  const isScopeLight = journey.isScopeLight || map.isScopeLight;

  const ui = useMemo<JourneyUiColors>(() => {
    if (journey.isScopeLight) return journey.ui;
    if (map.isScopeLight) return map.ui;
    return JOURNEY_UI_DARK;
  }, [journey.isScopeLight, map.isScopeLight, journey.ui, map.ui]);

  const chromeSurfaces = useMemo(
    () => journey.chromeSurfaces ?? map.chromeSurfaces,
    [journey.chromeSurfaces, map.chromeSurfaces],
  );

  const tokens = useMemo(
    () => (journey.isScopeLight ? journey.tokens : map.isScopeLight ? map.tokens : journey.tokens),
    [journey.isScopeLight, map.isScopeLight, journey.tokens, map.tokens],
  );

  return {
    tokens,
    isScopeLight,
    ui,
    chromeSurfaces,
  };
}

/** Active-trip banners (index.tsx) — same journey|map scope OR as LiveMap chrome. */
export function useJourneyBannerTheme() {
  return useLiveMapChromeTheme();
}
