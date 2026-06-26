/**
 * B3-6f — QR / Payment / Trust theme gate.
 */

import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../featureFlags';
import { buildThemeTokens } from './buildTheme';
import type { LhThemeTokens } from './types';

export type QrPaymentTrustScope = 'qr' | 'payment' | 'trust';

export type QptUiColors = {
  accent: string;
  textMuted: string;
  textSoft: string;
  closeIcon: string;
  chevron: string;
  activity: string;
  successIcon: string;
  phaseStep: string;
  chipText: string;
  starActive: string;
  starInactive: string;
  selectedIcon: string;
  errorIcon: string;
  successBanner: string;
  headerIcon: string;
};

export type QrModalLightSurfaces = {
  scrim: ViewStyle;
  container: ViewStyle;
  closeBtn: ViewStyle;
  guardianChip: ViewStyle;
  guardianLiveDot: ViewStyle;
  phaseStep: TextStyle;
  permBtn: ViewStyle;
  retryBtn: ViewStyle;
  cameraStage: ViewStyle;
  qrStage: ViewStyle;
  qrIconRing: ViewStyle;
  permissionPanel: ViewStyle;
  scanSuccessTitle: TextStyle;
  remoteSuccessTitle: TextStyle;
};

export type PaymentModalLightSurfaces = {
  scrim: ViewStyle;
  container: ViewStyle;
  closeBtn: ViewStyle;
  guardianChip: ViewStyle;
  guardianLiveDot: ViewStyle;
  phaseStep: TextStyle;
  chooseOption: ViewStyle;
  chooseOptionIconWrap: ViewStyle;
  paymentCard: ViewStyle;
  paymentIconWrap: ViewStyle;
  primaryPayBtn: ViewStyle;
  primaryPayText: TextStyle;
  legacyChip: ViewStyle;
  legacyChipActive: ViewStyle;
  legacyChipTextActive: TextStyle;
  permissionBtnGlass: ViewStyle;
  cancelBtn: ViewStyle;
  fieldCard: ViewStyle;
  fieldValue: TextStyle;
  ibanValue: TextStyle;
  copyBtn: ViewStyle;
  copyBtnText: TextStyle;
  primaryBtn: ViewStyle;
  primaryBtnText: TextStyle;
  secondaryOutlineBtn: ViewStyle;
  secondaryOutlineBtnText: TextStyle;
  disputeBtn: ViewStyle;
  disputeBtnText: TextStyle;
  noteInput: ViewStyle;
  iconRing: ViewStyle;
  boardingPrimaryBtn: ViewStyle;
  boardingPrimaryBtnText: TextStyle;
  boardingSecondaryBtn: ViewStyle;
  backScan: ViewStyle;
  backScanText: TextStyle;
};

export type RatingModalLightSurfaces = {
  scrim: ViewStyle;
  container: ViewStyle;
  phasePanel: ViewStyle;
  submitBtn: ViewStyle;
  skipPanel: ViewStyle;
  successPanel: ViewStyle;
  successStatusChip: ViewStyle;
  continueBtn: ViewStyle;
  starBtn: ViewStyle;
  ratingText: TextStyle;
};

export type TrustHubLightSurfaces = {
  root: ViewStyle;
  header: ViewStyle;
  backBtn: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  actionBanner: ViewStyle;
  actionBannerError: ViewStyle;
  actionBannerSuccess: ViewStyle;
  routeBanner: ViewStyle;
  routeBannerTitle: TextStyle;
  orphanPanel: ViewStyle;
  tdmPendingBanner: ViewStyle;
  tdmHintBanner: ViewStyle;
  errorPanel: ViewStyle;
  emptyPanel: ViewStyle;
  skeletonRow: ViewStyle;
  modalBackdrop: ViewStyle;
  modalCard: ViewStyle;
  stepperBtn: ViewStyle;
  modalCancelBtn: ViewStyle;
  sectionTitle: TextStyle;
  modalTitle: TextStyle;
  notifyOptionText: TextStyle;
  notifyOptionTextSelected: TextStyle;
  modalCancelText: TextStyle;
};

/** Trusted Direct passenger waiting + driver invite glass (light LHS). */
export type TdmModalLightSurfaces = {
  scrim: ViewStyle;
  card: ViewStyle;
  iconOrb: ViewStyle;
  cancelBtn: ViewStyle;
  cancelBtnText: TextStyle;
  pollWarning: ViewStyle;
  primaryBtn: ViewStyle;
  primaryBtnText: TextStyle;
  secondaryBtn: ViewStyle;
  secondaryBtnText: TextStyle;
  countdownChip: ViewStyle;
  contributionValue: TextStyle;
  errorCard: ViewStyle;
};

const QPT_UI_DARK: QptUiColors = {
  accent: '#22D3EE',
  textMuted: 'rgba(186,201,222,0.9)',
  textSoft: 'rgba(243,248,255,0.94)',
  closeIcon: 'rgba(186,201,222,0.82)',
  chevron: 'rgba(186,201,222,0.72)',
  activity: '#22D3EE',
  successIcon: 'rgba(34,211,238,0.95)',
  phaseStep: 'rgba(186, 230, 253, 0.94)',
  chipText: 'rgba(186, 230, 253, 0.92)',
  starActive: 'rgba(34,211,238,0.92)',
  starInactive: 'rgba(186,201,222,0.38)',
  selectedIcon: 'rgba(243,248,255,0.94)',
  errorIcon: 'rgba(252, 165, 165, 0.95)',
  successBanner: 'rgba(52, 211, 153, 0.95)',
  headerIcon: '#FFFFFF',
};

function buildQrModalLightSurfaces(tokens: LhThemeTokens): QrModalLightSurfaces {
  return {
    scrim: { backgroundColor: tokens.shadow.modal },
    container: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    closeBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    guardianChip: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    guardianLiveDot: { backgroundColor: tokens.accent.primary },
    phaseStep: { color: tokens.text.primary },
    permBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.selected,
      borderTopColor: tokens.borderColors.selectedTop,
    },
    retryBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.selected,
      borderTopColor: tokens.borderColors.selectedTop,
    },
    cameraStage: {
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderColor: tokens.border.default,
    },
    qrStage: {
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderColor: tokens.border.default,
    },
    qrIconRing: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    permissionPanel: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    scanSuccessTitle: { color: tokens.text.primary },
    remoteSuccessTitle: { color: tokens.text.primary },
  };
}

function buildPaymentModalLightSurfaces(tokens: LhThemeTokens): PaymentModalLightSurfaces {
  return {
    scrim: { backgroundColor: tokens.shadow.modal },
    container: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    closeBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    guardianChip: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    guardianLiveDot: { backgroundColor: tokens.accent.primary },
    phaseStep: { color: tokens.text.primary },
    chooseOption: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    chooseOptionIconWrap: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    paymentCard: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    paymentIconWrap: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    primaryPayBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.primaryHover,
    },
    primaryPayText: { color: tokens.text.inverse },
    legacyChip: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    legacyChipActive: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.glowMid,
    },
    legacyChipTextActive: { color: tokens.text.inverse },
    permissionBtnGlass: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    cancelBtn: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    fieldCard: {
      backgroundColor: tokens.bg.canvasMid,
      borderColor: tokens.border.default,
      borderTopColor: tokens.border.default,
    },
    fieldValue: { color: tokens.text.primary },
    ibanValue: { color: tokens.text.primary },
    copyBtn: {
      backgroundColor: tokens.bg.canvas,
      borderColor: tokens.border.default,
    },
    copyBtnText: { color: tokens.accent.primary },
    primaryBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.primaryHover,
    },
    primaryBtnText: { color: tokens.text.inverse },
    secondaryOutlineBtn: {
      backgroundColor: tokens.bg.canvas,
      borderColor: tokens.border.default,
    },
    secondaryOutlineBtnText: { color: tokens.text.primary },
    disputeBtn: {
      backgroundColor: tokens.bg.canvas,
      borderColor: 'rgba(220,38,38,0.28)',
    },
    disputeBtnText: { color: tokens.status.error },
    noteInput: {
      backgroundColor: tokens.bg.canvas,
      borderColor: tokens.border.default,
      color: tokens.text.primary,
    },
    iconRing: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    boardingPrimaryBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.primaryHover,
    },
    boardingPrimaryBtnText: { color: tokens.text.inverse },
    boardingSecondaryBtn: {
      backgroundColor: tokens.bg.canvas,
      borderColor: tokens.border.default,
    },
    backScan: {
      backgroundColor: tokens.bg.canvas,
      borderColor: tokens.border.default,
    },
    backScanText: { color: tokens.accent.secondary },
  };
}

function buildRatingModalLightSurfaces(tokens: LhThemeTokens): RatingModalLightSurfaces {
  return {
    scrim: { backgroundColor: tokens.shadow.modal },
    container: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    phasePanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    submitBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.selected,
      borderTopColor: tokens.borderColors.selectedTop,
    },
    skipPanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    successPanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    successStatusChip: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    continueBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.selected,
      borderTopColor: tokens.borderColors.selectedTop,
    },
    starBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    ratingText: { color: tokens.text.primary },
  };
}

function buildTrustHubLightSurfaces(tokens: LhThemeTokens): TrustHubLightSurfaces {
  return {
    root: { backgroundColor: tokens.bg.canvas },
    header: { borderBottomColor: tokens.accent.glowMid },
    backBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    title: { color: tokens.text.primary },
    subtitle: { color: tokens.text.muted },
    actionBanner: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    actionBannerError: {
      backgroundColor: 'rgba(127, 29, 29, 0.10)',
      borderColor: 'rgba(248, 113, 113, 0.35)',
    },
    actionBannerSuccess: {
      backgroundColor: 'rgba(6, 78, 59, 0.12)',
      borderColor: 'rgba(52, 211, 153, 0.28)',
    },
    routeBanner: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    routeBannerTitle: { color: tokens.accent.primary },
    orphanPanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    tdmPendingBanner: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    tdmHintBanner: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    errorPanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    emptyPanel: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    skeletonRow: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    modalBackdrop: { backgroundColor: tokens.shadow.modal },
    modalCard: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    stepperBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    modalCancelBtn: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    sectionTitle: { color: tokens.text.muted },
    modalTitle: { color: tokens.text.primary, fontWeight: '800' },
    notifyOptionText: { color: tokens.text.muted },
    notifyOptionTextSelected: { color: tokens.text.primary, fontWeight: '700' },
    modalCancelText: { color: tokens.text.muted, fontWeight: '700' },
  };
}

function buildTdmModalLightSurfaces(tokens: LhThemeTokens): TdmModalLightSurfaces {
  return {
    scrim: { backgroundColor: tokens.shadow.modal },
    card: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    iconOrb: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    cancelBtn: {
      backgroundColor: 'rgba(127, 29, 29, 0.08)',
      borderColor: 'rgba(220, 38, 38, 0.22)',
    },
    cancelBtnText: { color: tokens.status.error },
    pollWarning: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.28)',
    },
    primaryBtn: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.primaryHover,
    },
    primaryBtnText: { color: tokens.text.inverse },
    secondaryBtn: {
      backgroundColor: tokens.bg.canvas,
      borderColor: tokens.border.default,
    },
    secondaryBtnText: { color: tokens.text.primary },
    countdownChip: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
    },
    contributionValue: { color: tokens.accent.primary },
    errorCard: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: 'rgba(248, 113, 113, 0.35)',
      borderTopColor: 'rgba(248, 113, 113, 0.42)',
    },
  };
}

export function useQrPaymentTrustTheme(scope: QrPaymentTrustScope) {
  const { tokens, resolvedTheme } = useTheme();
  const isScopeLight = isLightThemeScreenEnabled(scope) && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isScopeLight ? tokens : buildThemeTokens('dark')),
    [isScopeLight, tokens],
  );

  const ui = useMemo<QptUiColors>(() => {
    if (!isScopeLight) return QPT_UI_DARK;
    return {
      accent: effectiveTokens.accent.primary,
      textMuted: effectiveTokens.text.muted,
      textSoft: effectiveTokens.text.primary,
      closeIcon: effectiveTokens.text.muted,
      chevron: effectiveTokens.text.muted,
      activity: effectiveTokens.accent.primary,
      successIcon: effectiveTokens.accent.primary,
      phaseStep: effectiveTokens.text.primary,
      chipText: effectiveTokens.text.primary,
      starActive: effectiveTokens.accent.primary,
      starInactive: effectiveTokens.text.muted,
      selectedIcon: effectiveTokens.text.inverse,
      errorIcon: effectiveTokens.status.error,
      successBanner: effectiveTokens.status.success,
      headerIcon: effectiveTokens.text.primary,
    };
  }, [isScopeLight, effectiveTokens]);

  const qrSurfaces = useMemo(
    () => (isScopeLight && scope === 'qr' ? buildQrModalLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  const paymentSurfaces = useMemo(
    () =>
      isScopeLight && scope === 'payment' ? buildPaymentModalLightSurfaces(effectiveTokens) : null,
    [isScopeLight, scope, effectiveTokens],
  );

  const ratingSurfaces = useMemo(
    () =>
      isScopeLight && scope === 'payment' ? buildRatingModalLightSurfaces(effectiveTokens) : null,
    [isScopeLight, scope, effectiveTokens],
  );

  const trustSurfaces = useMemo(
    () => (isScopeLight && scope === 'trust' ? buildTrustHubLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  const tdmModalSurfaces = useMemo(
    () => (isScopeLight && scope === 'trust' ? buildTdmModalLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  return {
    tokens: effectiveTokens,
    isScopeLight,
    ui,
    qrSurfaces,
    paymentSurfaces,
    ratingSurfaces,
    trustSurfaces,
    tdmModalSurfaces,
  };
}
