/**
 * B3-6d — Passenger dashboard theme gate.
 */

import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../featureFlags';
import { buildThemeTokens } from './buildTheme';
import type { LhThemeTokens } from './types';

export type PassengerUiColors = {
  accent: string;
  textMuted: string;
  textSoft: string;
  activity: string;
  dangerIcon: string;
  modalCloseIcon: string;
  avatarIcon: string;
  acceptText: string;
  dropoffDot: string;
  routeArrow: string;
  liveText: string;
  toastAccent: string;
};

export type PassengerWaitingLightSurfaces = {
  container: ViewStyle;
  navButton: ViewStyle;
  navButtonDanger: ViewStyle;
  mapStatsBar: ViewStyle;
  mapStatsBarText: TextStyle;
  mapPlaceholder: ViewStyle;
  mapPlaceholderText: TextStyle;
  mapPlaceholderSub: TextStyle;
  locationText: TextStyle;
  dividerLine: ViewStyle;
  shareButton: ViewStyle;
  shareButtonText: TextStyle;
  loadingDot: ViewStyle;
  statusTitle: TextStyle;
  dispatchBadge: ViewStyle;
  dispatchBadgeText: TextStyle;
  cancelTagButton: ViewStyle;
  cancelTagButtonText: TextStyle;
  modalOverlay: ViewStyle;
  driverProfileModal: ViewStyle;
  driverAvatar: ViewStyle;
  driverName: TextStyle;
  driverRating: ViewStyle;
  driverRatingEmpty: ViewStyle;
  driverDistance: TextStyle;
};

export type PassengerSearchingMapLightSurfaces = {
  container: ViewStyle;
  webFallback: ViewStyle;
  carPriceTag: ViewStyle;
  carPriceText: TextStyle;
  driverCountBadge: ViewStyle;
  infoBanner: ViewStyle;
};

export type PassengerSearchingPhaseLightSurfaces = {
  backBtn: ViewStyle;
  cancelBtn: ViewStyle;
  routeText: TextStyle;
  shareButton: ViewStyle;
  shareButtonText: TextStyle;
  liveIndicator: ViewStyle;
  liveDot: ViewStyle;
  liveText: TextStyle;
};

export type PassengerOfferCardLightSurfaces = {
  card: ViewStyle;
  cardBest: ViewStyle;
  bestBadge: ViewStyle;
  bestText: TextStyle;
  avatarPlaceholder: ViewStyle;
  avatarLetter: TextStyle;
  onlineDot: ViewStyle;
  driverName: TextStyle;
  ratingText: TextStyle;
  priceBox: ViewStyle;
  priceAmount: TextStyle;
  bottomRow: ViewStyle;
  dismissBtn: ViewStyle;
  acceptBtn: ViewStyle;
  acceptText: TextStyle;
};

export type PassengerDashboardLightSurfaces = {
  matchBackBtn: ViewStyle;
  matchLogoutBtn: ViewStyle;
  container: ViewStyle;
  tripShell: ViewStyle;
  matchCockpitShell: ViewStyle;
  searchingCockpitShell: ViewStyle;
  matchPhaseStep: TextStyle;
  destinationBox: ViewStyle;
  destinationBoxText: TextStyle;
  passengerRouteCtaLabel: TextStyle;
  passengerIdleSendOfferBtn: ViewStyle;
  passengerIdleSendOfferBtnText: TextStyle;
};

export type QuickMatchLightSurfaces = {
  modalRoot: ViewStyle;
  headerRow: ViewStyle;
  headerIconOrb: ViewStyle;
  guardianChip: ViewStyle;
  guardianChipText: TextStyle;
  headerTitle: TextStyle;
  glassCard: ViewStyle;
  statusChip: ViewStyle;
  statusChipText: TextStyle;
  routeLabel: TextStyle;
  routeConnector: ViewStyle;
  routeMetaText: TextStyle;
  title: TextStyle;
  secondaryBtn: ViewStyle;
  secondaryBtnText: TextStyle;
  cancelBtn: ViewStyle;
  cancelBtnText: TextStyle;
  inlineError: TextStyle;
  dot: ViewStyle;
  dotActive: ViewStyle;
};

export type PassengerRoutePickerLightSurfaces = {
  floatingPanel: ViewStyle;
  pickupFloatingPanel: ViewStyle;
  changeAreaBtn: ViewStyle;
  changeAreaBtnText: TextStyle;
  mapVerifyHintCard: ViewStyle;
  mapVerifyHintTitle: TextStyle;
  mapVerifyHintBody: TextStyle;
  mapHintTitle: TextStyle;
  mapHintMinimal: TextStyle;
  mapConfirmBtnWrap: ViewStyle;
  mapConfirmBtnText: TextStyle;
  pickupUseLocationBtnGlass: ViewStyle;
  pickupUseLocationIconRing: ViewStyle;
  pickupUseLocationBtnText: TextStyle;
  pickupUseLocationBtnSub: TextStyle;
  destinationMapPickBtnGlass: ViewStyle;
  destinationMapPickIconRing: ViewStyle;
  destinationMapPickBtnText: TextStyle;
  destinationMapPickBtnSub: TextStyle;
  pickupSaveTitle: TextStyle;
  pickupSaveBtn: ViewStyle;
  pickupSaveChipBtn: ViewStyle;
  pickupSaveChipText: TextStyle;
  pickupSaveBtnText: TextStyle;
  savedQuickCardPremium: ViewStyle;
  savedQuickCardTitle: TextStyle;
  routeRecentSectionTitle: TextStyle;
  destinationSearchFlowHint: TextStyle;
  destinationHeroTitleStep: TextStyle;
  pickupHeroTitle: TextStyle;
  pickupRouteSubtitle: TextStyle;
  routeRecentCard: ViewStyle;
  routeRecentCardTitle: TextStyle;
  routeRecentIconRing: ViewStyle;
  routeRecentSourceBadge: ViewStyle;
  routeRecentSourceBadgeText: TextStyle;
  destinationMapSearchChipOverlay: ViewStyle;
  priceModalPayOptionCardCash: ViewStyle;
  priceOfferPaymentWarnCard: ViewStyle;
  priceOfferPaymentWarnTitle: TextStyle;
  priceOfferPaymentWarnBody: TextStyle;
};

const PASSENGER_UI_DARK: PassengerUiColors = {
  accent: '#22D3EE',
  textMuted: 'rgba(186,201,222,0.9)',
  textSoft: 'rgba(243,248,255,0.94)',
  activity: '#3FA9F5',
  dangerIcon: 'rgba(248,113,113,0.92)',
  modalCloseIcon: 'rgba(186,201,222,0.82)',
  avatarIcon: 'rgba(243,248,255,0.94)',
  acceptText: '#08111F',
  dropoffDot: 'rgba(248,140,148,0.78)',
  routeArrow: 'rgba(186,201,222,0.55)',
  liveText: 'rgba(186, 230, 253, 0.95)',
  toastAccent: '#22D3EE',
};

function buildPassengerWaitingLightSurfaces(tokens: LhThemeTokens): PassengerWaitingLightSurfaces {
  return {
    container: { backgroundColor: tokens.bg.canvas },
    navButton: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    navButtonDanger: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: 'rgba(248, 113, 113, 0.35)',
    },
    mapStatsBar: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    mapStatsBarText: { color: tokens.text.primary },
    mapPlaceholder: { backgroundColor: tokens.bg.glassMuted },
    mapPlaceholderText: { color: tokens.accent.primary },
    mapPlaceholderSub: { color: tokens.text.muted },
    locationText: { color: tokens.text.primary },
    dividerLine: { backgroundColor: tokens.border.default },
    shareButton: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    shareButtonText: { color: tokens.accent.primary },
    loadingDot: { backgroundColor: tokens.accent.glowMid },
    statusTitle: { color: tokens.text.primary },
    dispatchBadge: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
    },
    dispatchBadgeText: { color: tokens.text.primary },
    cancelTagButton: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: 'rgba(248, 113, 113, 0.35)',
    },
    cancelTagButtonText: { color: 'rgba(248, 113, 113, 0.98)' },
    modalOverlay: { backgroundColor: tokens.shadow.modal },
    driverProfileModal: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    driverAvatar: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.accent.glowMid,
    },
    driverName: { color: tokens.text.primary },
    driverRating: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    driverRatingEmpty: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    driverDistance: { color: tokens.accent.primary },
  };
}

function buildPassengerSearchingMapLightSurfaces(tokens: LhThemeTokens): PassengerSearchingMapLightSurfaces {
  return {
    container: { backgroundColor: tokens.bg.glassMuted },
    webFallback: { backgroundColor: tokens.bg.glassMuted },
    carPriceTag: { backgroundColor: tokens.bg.glass },
    carPriceText: { color: tokens.accent.primary },
    driverCountBadge: { backgroundColor: tokens.bg.glass },
    infoBanner: { backgroundColor: tokens.bg.glass },
  };
}

function buildPassengerSearchingPhaseLightSurfaces(
  tokens: LhThemeTokens,
): PassengerSearchingPhaseLightSurfaces {
  return {
    backBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    cancelBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: 'rgba(248, 113, 113, 0.35)',
    },
    routeText: { color: tokens.text.primary },
    shareButton: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    shareButtonText: { color: tokens.accent.primary },
    liveIndicator: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    liveDot: { backgroundColor: tokens.accent.primary },
    liveText: { color: tokens.accent.primary },
  };
}

function buildPassengerOfferCardLightSurfaces(tokens: LhThemeTokens): PassengerOfferCardLightSurfaces {
  return {
    card: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
    },
    cardBest: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
      borderTopColor: tokens.accent.glowMid,
      borderLeftColor: tokens.accent.glowLow,
      shadowColor: tokens.accent.primary,
    },
    bestBadge: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.accent.glowMid,
      borderTopColor: tokens.accent.glowMid,
    },
    bestText: { color: tokens.text.primary },
    avatarPlaceholder: {
      backgroundColor: tokens.accent.glowMid,
      borderColor: tokens.accent.glowMid,
    },
    avatarLetter: { color: tokens.text.inverse },
    onlineDot: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.bg.canvas,
    },
    driverName: { color: tokens.text.primary },
    ratingText: { color: tokens.text.primary },
    priceBox: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.cardTopCyan,
    },
    priceAmount: { color: tokens.accent.primary },
    bottomRow: { borderTopColor: tokens.border.card },
    dismissBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    acceptBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    acceptText: { color: tokens.text.inverse },
  };
}

function buildPassengerDashboardLightSurfaces(tokens: LhThemeTokens): PassengerDashboardLightSurfaces {
  return {
    matchBackBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    matchLogoutBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    container: { backgroundColor: tokens.bg.canvas },
    tripShell: { backgroundColor: tokens.bg.canvas },
    matchCockpitShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.borderColors.cockpitPanel,
      borderTopColor: tokens.borderColors.cockpitPanelTop,
      borderLeftColor: tokens.borderColors.cockpitPanelLeft,
      shadowColor: tokens.shadow.ambient,
      shadowOpacity: 0.12,
      elevation: 6,
    },
    searchingCockpitShell: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.borderColors.cockpitPanel,
      borderTopColor: tokens.borderColors.cockpitPanelTop,
      borderLeftColor: tokens.borderColors.cockpitPanelLeft,
      shadowColor: tokens.shadow.ambient,
      shadowOpacity: 0.12,
      elevation: 6,
    },
    matchPhaseStep: { color: tokens.accent.primary },
    destinationBox: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    destinationBoxText: { color: tokens.text.primary },
    passengerRouteCtaLabel: { color: tokens.text.muted },
    passengerIdleSendOfferBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    passengerIdleSendOfferBtnText: { color: tokens.text.inverse },
  };
}

function buildQuickMatchLightSurfaces(tokens: LhThemeTokens): QuickMatchLightSurfaces {
  return {
    modalRoot: { backgroundColor: tokens.bg.canvas },
    headerRow: { borderBottomColor: tokens.border.default },
    headerIconOrb: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    guardianChip: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    guardianChipText: { color: tokens.accent.primary },
    headerTitle: { color: tokens.text.primary },
    glassCard: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    statusChip: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    statusChipText: { color: tokens.accent.primary },
    routeLabel: { color: tokens.text.primary },
    routeConnector: { backgroundColor: tokens.border.default },
    routeMetaText: { color: tokens.accent.primary },
    title: { color: tokens.text.primary },
    secondaryBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    secondaryBtnText: { color: tokens.text.primary },
    cancelBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: 'rgba(248, 113, 113, 0.35)',
    },
    cancelBtnText: { color: tokens.status.error },
    inlineError: { color: tokens.status.error },
    dot: { backgroundColor: tokens.border.default },
    dotActive: { backgroundColor: tokens.accent.primary },
  };
}

function buildPassengerRoutePickerLightSurfaces(tokens: LhThemeTokens): PassengerRoutePickerLightSurfaces {
  return {
    floatingPanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      shadowColor: tokens.shadow.ambient,
    },
    pickupFloatingPanel: { borderTopColor: tokens.accent.glowLow },
    changeAreaBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.accent.glowMid,
    },
    changeAreaBtnText: { color: tokens.text.primary },
    mapVerifyHintCard: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.accent.glowMid,
      borderTopColor: tokens.accent.glowMid,
      shadowColor: tokens.accent.primary,
    },
    mapVerifyHintTitle: { color: tokens.accent.primary },
    mapVerifyHintBody: { color: tokens.text.muted },
    mapHintTitle: { color: tokens.text.primary },
    mapHintMinimal: { color: tokens.text.primary },
    mapConfirmBtnWrap: { borderColor: tokens.border.default },
    mapConfirmBtnText: { color: tokens.text.inverse },
    pickupUseLocationBtnGlass: { backgroundColor: tokens.bg.glassMuted },
    pickupUseLocationIconRing: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    pickupUseLocationBtnText: { color: tokens.text.primary },
    pickupUseLocationBtnSub: { color: tokens.text.muted },
    destinationMapPickBtnGlass: { backgroundColor: tokens.bg.glassMuted },
    destinationMapPickIconRing: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    destinationMapPickBtnText: { color: tokens.text.primary },
    destinationMapPickBtnSub: { color: tokens.text.muted },
    pickupSaveTitle: { color: tokens.accent.primary },
    pickupSaveBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.accent.glowMid,
    },
    pickupSaveChipBtn: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.accent.glowLow,
    },
    pickupSaveChipText: { color: tokens.text.primary },
    pickupSaveBtnText: { color: tokens.text.primary },
    savedQuickCardPremium: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
      shadowColor: tokens.accent.primary,
    },
    savedQuickCardTitle: { color: tokens.accent.primary },
    routeRecentSectionTitle: { color: tokens.accent.primary },
    destinationSearchFlowHint: { color: tokens.text.muted },
    destinationHeroTitleStep: {
      color: tokens.text.primary,
      textShadowColor: 'transparent',
    },
    pickupHeroTitle: {
      color: tokens.text.primary,
      textShadowColor: 'transparent',
    },
    pickupRouteSubtitle: { color: tokens.text.muted },
    routeRecentCard: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
      shadowColor: tokens.shadow.ambient,
    },
    routeRecentCardTitle: { color: tokens.text.primary },
    routeRecentIconRing: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    routeRecentSourceBadge: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    routeRecentSourceBadgeText: { color: tokens.text.muted },
    destinationMapSearchChipOverlay: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.accent.glowMid,
    },
    priceModalPayOptionCardCash: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    priceOfferPaymentWarnCard: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    priceOfferPaymentWarnTitle: { color: tokens.text.primary },
    priceOfferPaymentWarnBody: { color: tokens.text.muted },
  };
}

export function usePassengerTheme() {
  const { tokens, resolvedTheme } = useTheme();
  const isScopeLight =
    isLightThemeScreenEnabled('passenger') && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isScopeLight ? tokens : buildThemeTokens('dark')),
    [isScopeLight, tokens],
  );

  const ui = useMemo<PassengerUiColors>(() => {
    if (!isScopeLight) return PASSENGER_UI_DARK;
    return {
      accent: effectiveTokens.accent.primary,
      textMuted: effectiveTokens.text.muted,
      textSoft: effectiveTokens.text.primary,
      activity: effectiveTokens.accent.primary,
      dangerIcon: 'rgba(248,113,113,0.92)',
      modalCloseIcon: effectiveTokens.text.muted,
      avatarIcon: effectiveTokens.text.inverse,
      acceptText: effectiveTokens.text.inverse,
      dropoffDot: 'rgba(248,140,148,0.78)',
      routeArrow: effectiveTokens.text.muted,
      liveText: effectiveTokens.accent.primary,
      toastAccent: effectiveTokens.accent.primary,
    };
  }, [isScopeLight, effectiveTokens]);

  const waitingSurfaces = useMemo(
    () => (isScopeLight ? buildPassengerWaitingLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const searchingSurfaces = useMemo(
    () => (isScopeLight ? buildPassengerSearchingMapLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const searchingPhaseSurfaces = useMemo(
    () => (isScopeLight ? buildPassengerSearchingPhaseLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const offerCardSurfaces = useMemo(
    () => (isScopeLight ? buildPassengerOfferCardLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const dashboardSurfaces = useMemo(
    () => (isScopeLight ? buildPassengerDashboardLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const routePickerSurfaces = useMemo(
    () => (isScopeLight ? buildPassengerRoutePickerLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  const quickMatchSurfaces = useMemo(
    () => (isScopeLight ? buildQuickMatchLightSurfaces(effectiveTokens) : null),
    [isScopeLight, effectiveTokens],
  );

  return {
    tokens: effectiveTokens,
    isScopeLight,
    ui,
    waitingSurfaces,
    searchingSurfaces,
    searchingPhaseSurfaces,
    offerCardSurfaces,
    dashboardSurfaces,
    routePickerSurfaces,
    quickMatchSurfaces,
  };
}
