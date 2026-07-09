/**
 * B3-6e — Driver cockpit theme gate.
 */

import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../featureFlags';
import { buildThemeTokens } from './buildTheme';
import type { LhThemeTokens } from './types';

export type DriverUiColors = {
  accent: string;
  textMuted: string;
  textSoft: string;
  activity: string;
  sessionActive: string;
  sessionInactive: string;
  statCar: string;
  iconMuted: string;
  chevron: string;
  trustIcon: string;
  flashIcon: string;
  acceptText: string;
  mapFallback: string;
  emptyChip: string;
  motorAccent: string;
};

export type DriverWaitingShellLightSurfaces = {
  waitingRoot: ViewStyle;
  cockpitHeaderGlass: ViewStyle;
  cockpitHeaderBtnShell: ViewStyle;
  cockpitHeaderBrand: TextStyle;
  cockpitOfferGround: ViewStyle;
};

export type DriverDashboardPanelLightSurfaces = {
  onlineStripActive: ViewStyle;
  onlineStripInactive: ViewStyle;
  onlineStripLoading: ViewStyle;
  switchTrackOn: ViewStyle;
  switchTrackOff: ViewStyle;
  switchThumbOn: ViewStyle;
  switchThumbOff: ViewStyle;
  statusDotOnline: ViewStyle;
  statusDotOffline: ViewStyle;
  panelShell: ViewStyle;
  panelShellLoading: ViewStyle;
  onlineStatusLabel: TextStyle;
  onlineStatusHint: TextStyle;
};

export type DriverCockpitQuickStripLightSurfaces = {
  card: ViewStyle;
  trustIconWrap: ViewStyle;
  compactRow: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  badge: ViewStyle;
  badgeText: TextStyle;
};

export type DriverQuickMatchInviteLightSurfaces = {
  scrim: ViewStyle;
  card: ViewStyle;
  iconRing: ViewStyle;
  contributionValue: TextStyle;
  countdownChip: ViewStyle;
  countdownText: TextStyle;
  primaryBtnWrap: ViewStyle;
  primaryBtnText: TextStyle;
  secondaryBtnWrap: ViewStyle;
  errorCard: ViewStyle;
  pollWarningBanner: ViewStyle;
};

export type DriverOfferScreenLightSurfaces = {
  container: ViewStyle;
  dispatchDeck: ViewStyle;
  listHeader: ViewStyle;
  listTitleCompact: TextStyle;
  listHeaderCountPill: ViewStyle;
  listHeaderCountText: TextStyle;
  emptyStateCard: ViewStyle;
  emptyBrandStrip: ViewStyle;
  emptyBrandLabel: TextStyle;
  emptyOrbRingOuter: ViewStyle;
  emptyOrbRingMid: ViewStyle;
  emptyOrbCore: ViewStyle;
  emptyStatusPill: ViewStyle;
  emptyStatusText: TextStyle;
  emptyTitle: TextStyle;
  emptySubtitle: TextStyle;
  emptyChip: ViewStyle;
  emptyChipText: TextStyle;
  mapFallback: ViewStyle;
  mapChromeShell: ViewStyle;
  mapChromeShellCollapsed: ViewStyle;
  fieldOpHudCollapsed: ViewStyle;
  fieldOpHudBrand: TextStyle;
  fieldOpHudTitle: TextStyle;
  fieldOpHudCaption: TextStyle;
  fieldOpMetricCell: ViewStyle;
  fieldOpMetricLabel: TextStyle;
  fieldOpMetricValue: TextStyle;
  fieldOpInsightLine: TextStyle;
  reqCard: ViewStyle;
  reqPriceText: TextStyle;
  reqPassengerName: TextStyle;
  reqMetaValue: TextStyle;
  reqRouteText: TextStyle;
  reqDismissBtn: ViewStyle;
  reqAcceptBtn: ViewStyle;
  reqAcceptText: TextStyle;
  reqCountdownPill: ViewStyle;
  reqCountdownText: TextStyle;
  reqNewBadge: ViewStyle;
  reqNewBadgeText: TextStyle;
  reqDismissText: TextStyle;
  reqCardWrapExpired: ViewStyle;
  reqCardExpired: ViewStyle;
  reqAcceptBtnOuterExpired: ViewStyle;
  reqAcceptBtnExpired: ViewStyle;
  reqAcceptTextExpired: TextStyle;
};

const DRIVER_UI_DARK: DriverUiColors = {
  accent: '#22D3EE',
  textMuted: 'rgba(186,201,222,0.9)',
  textSoft: 'rgba(243,248,255,0.94)',
  activity: '#22D3EE',
  sessionActive: 'rgba(34,211,238,0.88)',
  sessionInactive: 'rgba(148,163,184,0.72)',
  statCar: 'rgba(34,211,238,0.88)',
  iconMuted: 'rgba(148,163,184,0.82)',
  chevron: 'rgba(186,201,222,0.9)',
  trustIcon: 'rgba(34,211,238,0.72)',
  flashIcon: 'rgba(34,211,238,0.92)',
  acceptText: '#08111F',
  mapFallback: '#22D3EE',
  emptyChip: '#22D3EE',
  motorAccent: 'rgba(134,239,172,0.92)',
};

function buildDriverWaitingShellDarkSurfaces(): DriverWaitingShellLightSurfaces {
  return {
    waitingRoot: { backgroundColor: '#08111F' },
    cockpitHeaderGlass: {
      backgroundColor: 'rgba(8,17,31,0.55)',
      borderColor: 'rgba(30,58,95,0.42)',
    },
    cockpitHeaderBtnShell: {
      backgroundColor: 'rgba(8,17,31,0.42)',
      borderColor: 'rgba(30,58,95,0.38)',
    },
    cockpitHeaderBrand: { color: 'rgba(243,248,255,0.94)' },
    cockpitOfferGround: { borderTopColor: 'rgba(30,58,95,0.38)' },
  };
}

function buildDriverWaitingShellLightSurfaces(tokens: LhThemeTokens): DriverWaitingShellLightSurfaces {
  return {
    waitingRoot: { backgroundColor: tokens.bg.canvas },
    cockpitHeaderGlass: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    cockpitHeaderBtnShell: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    cockpitHeaderBrand: { color: tokens.text.primary },
    cockpitOfferGround: { borderTopColor: tokens.border.default },
  };
}

function buildDriverDashboardPanelDarkSurfaces(): DriverDashboardPanelLightSurfaces {
  return {
    onlineStripActive: {
      backgroundColor: 'rgba(8,17,31,0.52)',
      borderColor: 'rgba(34,211,238,0.10)',
      borderTopColor: 'rgba(34,211,238,0.12)',
    },
    onlineStripInactive: {
      backgroundColor: 'rgba(8,17,31,0.38)',
      borderColor: 'rgba(30,58,95,0.42)',
    },
    onlineStripLoading: {
      backgroundColor: 'rgba(8,17,31,0.38)',
    },
    switchTrackOn: {
      backgroundColor: 'rgba(16,26,43,0.92)',
      borderColor: 'rgba(34,211,238,0.22)',
    },
    switchTrackOff: {
      backgroundColor: 'rgba(16,26,43,0.92)',
      borderColor: 'rgba(30,58,95,0.48)',
    },
    switchThumbOn: {
      backgroundColor: '#22D3EE',
      borderColor: 'rgba(243,248,255,0.35)',
    },
    switchThumbOff: {
      backgroundColor: 'rgba(148,163,184,0.72)',
      borderColor: 'rgba(148,163,184,0.35)',
    },
    statusDotOnline: {
      backgroundColor: '#22D3EE',
      borderColor: 'rgba(243,248,255,0.28)',
    },
    statusDotOffline: {
      backgroundColor: 'rgba(148,163,184,0.55)',
      borderColor: 'rgba(30,58,95,0.38)',
    },
    panelShell: {
      backgroundColor: 'rgba(8,17,31,0.42)',
    },
    panelShellLoading: {
      backgroundColor: 'rgba(8,17,31,0.42)',
    },
    onlineStatusLabel: { color: 'rgba(243,248,255,0.96)', fontSize: 20, lineHeight: 24, fontWeight: '800' },
    onlineStatusHint: { color: 'rgba(186,201,222,0.82)', fontSize: 12, lineHeight: 16 },
  };
}

function buildDriverDashboardPanelLightSurfaces(tokens: LhThemeTokens): DriverDashboardPanelLightSurfaces {
  return {
    onlineStripActive: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.border.default,
    },
    onlineStripInactive: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    onlineStripLoading: {
      backgroundColor: tokens.bg.glassMuted,
    },
    switchTrackOn: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.accent.glowMid,
    },
    switchTrackOff: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    switchThumbOn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.text.inverse,
    },
    switchThumbOff: {
      backgroundColor: tokens.text.muted,
      borderColor: tokens.border.default,
    },
    statusDotOnline: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.border.default,
    },
    statusDotOffline: {
      backgroundColor: tokens.text.muted,
      borderColor: tokens.border.default,
    },
    panelShell: {
      backgroundColor: tokens.bg.glassMuted,
    },
    panelShellLoading: {
      backgroundColor: tokens.bg.glassMuted,
    },
    onlineStatusLabel: { color: tokens.text.primary, fontSize: 20, lineHeight: 24, fontWeight: '800' },
    onlineStatusHint: { color: tokens.text.muted, fontSize: 12, lineHeight: 16 },
  };
}

function buildDriverCockpitQuickStripDarkSurfaces(): DriverCockpitQuickStripLightSurfaces {
  return {
    card: {
      backgroundColor: 'rgba(8,17,31,0.38)',
      borderColor: 'rgba(30,58,95,0.38)',
    },
    trustIconWrap: {
      backgroundColor: 'rgba(8,17,31,0.32)',
      borderColor: 'rgba(30,58,95,0.38)',
    },
    compactRow: {
      backgroundColor: 'transparent',
    },
    title: { color: 'rgba(243,248,255,0.94)' },
    subtitle: { color: 'rgba(186,201,222,0.78)' },
    badge: {
      backgroundColor: 'rgba(34,211,238,0.10)',
      borderColor: 'rgba(34,211,238,0.18)',
    },
    badgeText: { color: 'rgba(34,211,238,0.88)' },
  };
}

function buildDriverCockpitQuickStripLightSurfaces(
  tokens: LhThemeTokens,
): DriverCockpitQuickStripLightSurfaces {
  return {
    card: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    trustIconWrap: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    compactRow: {
      backgroundColor: 'transparent',
    },
    title: { color: tokens.text.primary },
    subtitle: { color: tokens.text.muted },
    badge: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    badgeText: { color: tokens.accent.primary },
  };
}

function buildDriverQuickMatchInviteLightSurfaces(
  tokens: LhThemeTokens,
): DriverQuickMatchInviteLightSurfaces {
  return {
    scrim: { backgroundColor: tokens.shadow.modal },
    card: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    iconRing: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    contributionValue: { color: tokens.accent.primary },
    countdownChip: {
      borderColor: tokens.borderColors.cardTopCyan,
      backgroundColor: tokens.bg.glassMuted,
    },
    countdownText: { color: tokens.accent.primary },
    primaryBtnWrap: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.selected,
      borderTopColor: tokens.borderColors.selectedTop,
    },
    primaryBtnText: { color: tokens.text.primary },
    secondaryBtnWrap: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    errorCard: {
      borderColor: 'rgba(248, 113, 113, 0.35)',
      borderTopColor: 'rgba(248, 113, 113, 0.42)',
      backgroundColor: tokens.bg.glassMuted,
    },
    pollWarningBanner: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.28)',
    },
  };
}

function buildDriverOfferScreenLightSurfaces(tokens: LhThemeTokens): DriverOfferScreenLightSurfaces {
  return {
    container: { backgroundColor: tokens.bg.canvas },
    dispatchDeck: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    listHeader: { borderBottomColor: tokens.border.default },
    listTitleCompact: { color: tokens.text.primary },
    listHeaderCountPill: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    listHeaderCountText: { color: tokens.accent.primary },
    emptyStateCard: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    emptyBrandStrip: { borderBottomColor: tokens.border.default },
    emptyBrandLabel: { color: tokens.accent.primary, opacity: 1 },
    emptyOrbRingOuter: {
      borderColor: tokens.accent.glowMid,
      backgroundColor: tokens.accent.glowLow,
    },
    emptyOrbRingMid: {
      borderColor: tokens.accent.glowMid,
      backgroundColor: tokens.bg.glass,
    },
    emptyOrbCore: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.accent.glowMid,
    },
    emptyStatusPill: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.accent.glowMid,
      borderTopColor: tokens.accent.glowMid,
    },
    emptyStatusText: { color: tokens.text.primary },
    emptyTitle: { color: tokens.text.primary },
    emptySubtitle: { color: tokens.text.muted },
    emptyChip: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    emptyChipText: { color: tokens.accent.primary },
    mapFallback: { backgroundColor: tokens.bg.glassMuted },
    mapChromeShell: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    mapChromeShellCollapsed: {
      backgroundColor: tokens.bg.glassMuted,
    },
    fieldOpHudCollapsed: { maxHeight: 76 },
    fieldOpHudBrand: { color: tokens.accent.primary, opacity: 1 },
    fieldOpHudTitle: { color: tokens.text.primary },
    fieldOpHudCaption: { color: tokens.text.muted },
    fieldOpMetricCell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    fieldOpMetricLabel: { color: tokens.text.muted },
    fieldOpMetricValue: { color: tokens.accent.primary },
    fieldOpInsightLine: { color: tokens.text.muted, opacity: 1 },
    reqCard: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    reqPriceText: { color: tokens.accent.primary },
    reqPassengerName: { color: tokens.text.primary },
    reqMetaValue: { color: tokens.text.primary },
    reqRouteText: { color: tokens.text.muted },
    reqDismissBtn: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    reqAcceptBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    reqAcceptText: { color: tokens.text.inverse },
    reqCountdownPill: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    reqCountdownText: { color: tokens.accent.primary },
    reqNewBadge: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    reqNewBadgeText: { color: tokens.accent.primary },
    reqDismissText: { color: tokens.text.muted },
    reqCardWrapExpired: { opacity: 0.62 },
    reqCardExpired: { backgroundColor: tokens.bg.glass },
    reqAcceptBtnOuterExpired: { opacity: 0.88 },
    reqAcceptBtnExpired: {
      backgroundColor: tokens.text.muted,
      borderColor: tokens.border.default,
    },
    reqAcceptTextExpired: { color: tokens.text.inverse, opacity: 0.82 },
  };
}

export function useDriverTheme() {
  const { tokens, resolvedTheme } = useTheme();
  const isScopeLight = isLightThemeScreenEnabled('driver') && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isScopeLight ? tokens : buildThemeTokens('dark')),
    [isScopeLight, tokens],
  );

  const ui = useMemo<DriverUiColors>(() => {
    if (!isScopeLight) return DRIVER_UI_DARK;
    return {
      accent: effectiveTokens.accent.primary,
      textMuted: effectiveTokens.text.muted,
      textSoft: effectiveTokens.text.primary,
      activity: effectiveTokens.accent.primary,
      sessionActive: effectiveTokens.accent.primary,
      sessionInactive: effectiveTokens.text.muted,
      statCar: effectiveTokens.accent.primary,
      iconMuted: effectiveTokens.text.muted,
      chevron: effectiveTokens.text.muted,
      trustIcon: effectiveTokens.accent.primary,
      flashIcon: effectiveTokens.accent.primary,
      acceptText: effectiveTokens.text.inverse,
      mapFallback: effectiveTokens.accent.primary,
      emptyChip: effectiveTokens.accent.primary,
      motorAccent: effectiveTokens.status.success,
    };
  }, [isScopeLight, effectiveTokens]);

  const waitingShellSurfaces = useMemo(
    () =>
      isScopeLight
        ? buildDriverWaitingShellLightSurfaces(effectiveTokens)
        : buildDriverWaitingShellDarkSurfaces(),
    [isScopeLight, effectiveTokens],
  );

  const dashboardPanelSurfaces = useMemo(
    () =>
      isScopeLight
        ? buildDriverDashboardPanelLightSurfaces(effectiveTokens)
        : buildDriverDashboardPanelDarkSurfaces(),
    [isScopeLight, effectiveTokens],
  );

  const quickStripSurfaces = useMemo(
    () =>
      isScopeLight
        ? buildDriverCockpitQuickStripLightSurfaces(effectiveTokens)
        : buildDriverCockpitQuickStripDarkSurfaces(),
    [isScopeLight, effectiveTokens],
  );

  const quickMatchSurfaces = useMemo(
    () => (isScopeLight ? buildDriverQuickMatchInviteLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const offerScreenSurfaces = useMemo(
    () => (isScopeLight ? buildDriverOfferScreenLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  return {
    tokens: effectiveTokens,
    isScopeLight,
    ui,
    waitingShellSurfaces,
    dashboardPanelSurfaces,
    quickStripSurfaces,
    quickMatchSurfaces,
    offerScreenSurfaces,
  };
}
