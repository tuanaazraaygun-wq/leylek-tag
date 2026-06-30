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
  /** Matched comm row (Ara / Yaz / Güven) on elevated deck — light theme needs dark ink. */
  matchedCommIcon: string;
  /** Yolcuya Git compass on matched nav chip gradient. */
  matchedNavIcon: string;
  /** QR glyph on accent primary matched CTA. */
  matchedQrIcon: string;
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
  navManeuverBannerStage: TextStyle;
  navManeuverBannerManeuver: TextStyle;
  navManeuverStreet: TextStyle;
  navManeuverIconCircle: ViewStyle;
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
  topPhaseChipText: TextStyle;
  topLiveChipText: TextStyle;
  paxTopLiveHintShell: ViewStyle;
  paxTopLiveHintText: TextStyle;
  matchedRouteLineText: TextStyle;
  matchedRouteLineLabelText: TextStyle;
  matchedPriceChipText: TextStyle;
  matchedNearChipText: TextStyle;
  paxLiveChipText: TextStyle;
  driverNavChipLabelText: TextStyle;
  trustedAddChipText: TextStyle;
  trustedAddChipMutedText: TextStyle;
  dangerBtnText: TextStyle;
  qrPrimaryBtnText: TextStyle;
  paxBottomCallLabel: TextStyle;
  paxBottomChatBtnText: TextStyle;
  paxBottomGuvenBtnText: TextStyle;
  drvBottomCallLabel: TextStyle;
  drvBottomChatBtnText: TextStyle;
  drvBottomGuvenBtnText: TextStyle;
  bottomGradient: ViewStyle;
  navImmersiveAraText: TextStyle;
  navImmersiveGuvenText: TextStyle;
  navImmersiveTrustHint: TextStyle;
  /** Driver matrix status row ("Yolcuya gidiliyor" vb.) */
  drvTopMatrixText: TextStyle;
  /** Modern driver ride card */
  driverRideLiveTag: TextStyle;
  driverRideAddr: TextStyle;
  driverRideSectionLabel: TextStyle;
  driverRideVehicleChipText: TextStyle;
  driverRideStatusPillText: TextStyle;
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
  matchedCommIcon: 'rgba(243,248,255,0.94)',
  matchedNavIcon: '#22D3EE',
  matchedQrIcon: 'rgba(243,248,255,0.94)',
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
  const topInkPrimary = 'rgba(15, 23, 42, 0.92)';
  const topInkMuted = 'rgba(51, 65, 85, 0.88)';

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
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderBottomColor: 'rgba(19, 78, 74, 0.18)',
      borderColor: 'rgba(19, 78, 74, 0.14)',
      borderWidth: 0.5,
      shadowColor: 'rgba(15, 23, 42, 0.14)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 10,
    },
    navManeuverBannerStage: {
      color: 'rgba(15, 118, 110, 0.88)',
      fontWeight: '800',
    },
    navManeuverBannerManeuver: {
      color: tokens.text.primary,
      fontWeight: '800',
    },
    navManeuverStreet: {
      color: tokens.text.muted,
      fontWeight: '600',
    },
    navManeuverIconCircle: {
      backgroundColor: 'rgba(240, 253, 250, 0.98)',
      borderColor: 'rgba(13, 148, 136, 0.38)',
      borderWidth: 1.5,
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
      borderTopColor: tokens.border.default,
    },
    drvBottomDeckShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.border.default,
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
    topPhaseChipText: {
      color: topInkPrimary,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    topLiveChipText: {
      color: topInkPrimary,
      fontWeight: '700',
      letterSpacing: 0.25,
    },
    paxTopLiveHintShell: {
      alignSelf: 'flex-start',
      marginRight: 0,
      marginLeft: 0,
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    paxTopLiveHintText: {
      color: topInkPrimary,
      fontWeight: '700',
      textAlign: 'left',
      letterSpacing: 0.12,
    },
    matchedRouteLineText: {
      color: topInkPrimary,
      fontWeight: '700',
      letterSpacing: 0.08,
    },
    matchedRouteLineLabelText: {
      color: topInkMuted,
      fontWeight: '700',
      letterSpacing: 0.35,
    },
    matchedPriceChipText: { color: tokens.accent.primary, fontWeight: '700' },
    matchedNearChipText: { color: topInkPrimary, fontWeight: '700' },
    paxLiveChipText: { color: topInkPrimary, fontWeight: '700', letterSpacing: 0.35 },
    /** Yolcuya Git — inverse on accent gradient */
    driverNavChipLabelText: { color: tokens.text.inverse, fontWeight: '800' },
    trustedAddChipText: { color: tokens.accent.primary },
    trustedAddChipMutedText: { color: tokens.text.muted },
    dangerBtnText: { color: 'rgba(185, 28, 28, 0.92)', fontWeight: '700' },
    qrPrimaryBtnText: { color: tokens.text.inverse, fontWeight: '800' },
    paxBottomCallLabel: { color: tokens.text.primary },
    paxBottomChatBtnText: { color: tokens.text.primary },
    paxBottomGuvenBtnText: { color: tokens.text.primary },
    drvBottomCallLabel: { color: tokens.text.primary },
    drvBottomChatBtnText: { color: tokens.text.primary },
    drvBottomGuvenBtnText: { color: tokens.text.primary },
    bottomGradient: {
      backgroundColor: tokens.bg.elevated,
      borderTopWidth: 1,
      borderTopColor: tokens.border.default,
    },
    navImmersiveAraText: { color: tokens.text.primary },
    navImmersiveGuvenText: { color: tokens.text.primary },
    navImmersiveTrustHint: { color: tokens.text.muted },
    drvTopMatrixText: {
      color: topInkPrimary,
      fontWeight: '600',
    },
    driverRideLiveTag: {
      color: tokens.accent.primary,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    driverRideAddr: {
      color: topInkPrimary,
      fontWeight: '700',
      lineHeight: 21,
    },
    driverRideSectionLabel: {
      color: topInkMuted,
      fontWeight: '700',
    },
    driverRideVehicleChipText: {
      color: topInkPrimary,
      fontWeight: '700',
    },
    driverRideStatusPillText: {
      color: topInkPrimary,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
  };
}

function buildJourneyUi(tokens: LhThemeTokens): JourneyUiColors {
  const inkPrimary = 'rgba(15, 23, 42, 0.94)';
  return {
    accent: tokens.accent.primary,
    textMuted: tokens.text.muted,
    textSoft: inkPrimary,
    activity: tokens.accent.primary,
    successIcon: tokens.accent.primary,
    errorIcon: tokens.status.error,
    ctaIcon: inkPrimary,
    ctaIconLight: inkPrimary,
    ctaIconFill: tokens.text.inverse,
    matchedCommIcon: inkPrimary,
    matchedNavIcon: tokens.text.inverse,
    matchedQrIcon: '#FFFFFF',
    closeIcon: tokens.text.primary,
    chevron: tokens.text.muted,
    routeDotPrimary: tokens.accent.primary,
    routeDotSecondary: tokens.accent.glowMid,
    loadingText: tokens.text.muted,
    loadingDots: tokens.accent.primary,
    webFallbackGradient: [tokens.bg.canvas, tokens.bg.elevated, tokens.accent.primary],
    ctaGradient: [tokens.accent.primary, tokens.accent.primaryHover, tokens.accent.secondary],
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
