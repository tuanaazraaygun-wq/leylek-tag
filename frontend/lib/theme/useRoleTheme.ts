/**
 * B3-6b — Role select screen theme gate (mirrors useAuthTheme pattern).
 */

import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../featureFlags';
import { buildThemeTokens } from './buildTheme';
import type { LhThemeTokens } from './types';

export type RoleLightSurfaces = {
  roleSelectBannerInner: ViewStyle;
  roleSelectBannerText: TextStyle;
  roleExitBtn: ViewStyle;
  roleAdminBtn: ViewStyle;
  roleCockpitFrame: ViewStyle;
  roleCockpitInner: ViewStyle;
  cockpitTitleGradient: readonly [string, string, string];
  roleTopTitle: TextStyle;
  roleTopTitleAccent: TextStyle;
  roleUnifiedCockpitShell: ViewStyle;
  roleStepCircle: ViewStyle;
  roleStepCircleActive: ViewStyle;
  roleStepCircleDone: ViewStyle;
  roleStepCircleText: TextStyle;
  roleStepCircleTextActive: TextStyle;
  roleStepCircleTextMuted: TextStyle;
  roleStepLabel: TextStyle;
  roleStepLabelActive: TextStyle;
  roleStepLabelDone: TextStyle;
  roleStepLabelMuted: TextStyle;
  roleStepDash: ViewStyle;
  roleCardCompact: ViewStyle;
  roleCardLabel: TextStyle;
  roleCardLabelActive: TextStyle;
  roleCardDesc: TextStyle;
  roleCardDescActivePassenger: TextStyle;
  roleCardDescActiveDriver: TextStyle;
  roleCheckBadge: ViewStyle;
  roleStatusStripCompact: ViewStyle;
  roleStatusTitleCompactInline: TextStyle;
  roleChangeRolePillSecondary: ViewStyle;
  roleChangeRoleLabelSecondary: TextStyle;
  ctaBorder: string;
  ctaTextShadow: string;
  iconMuted: string;
  iconChevron: string;
};

export type RoleInputColors = {
  accent: string;
  textPrimary: string;
};

function buildRoleLightSurfaces(tokens: LhThemeTokens): RoleLightSurfaces {
  return {
    roleSelectBannerInner: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cockpitPanelTop,
      borderLeftColor: tokens.borderColors.cockpitPanelLeft,
    },
    roleSelectBannerText: { color: tokens.text.primary },
    roleExitBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    roleAdminBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    roleCockpitFrame: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.card,
      borderTopColor: tokens.accent.glowLow,
    },
    roleCockpitInner: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cockpitEdge,
      borderBottomColor: tokens.border.card,
    },
    cockpitTitleGradient: [
      tokens.accent.glowMid,
      'transparent',
      tokens.accent.glowLow,
    ] as const,
    roleTopTitle: { color: tokens.text.primary },
    roleTopTitleAccent: { color: tokens.accent.primary },
    roleUnifiedCockpitShell: {
      backgroundColor: tokens.glassSurface.panel.backgroundColor,
      borderColor: tokens.borderColors.cockpitPanel,
      borderTopColor: tokens.borderColors.cockpitPanelTop,
      borderLeftColor: tokens.borderColors.cockpitPanelLeft,
    },
    roleStepCircle: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.card,
    },
    roleStepCircleActive: {
      borderColor: tokens.accent.glowMid,
      backgroundColor: tokens.accent.glowLow,
    },
    roleStepCircleDone: {
      borderColor: tokens.accent.glowMid,
      backgroundColor: tokens.bg.glass,
    },
    roleStepCircleText: { color: tokens.text.muted },
    roleStepCircleTextActive: { color: tokens.text.primary },
    roleStepCircleTextMuted: { color: tokens.text.muted },
    roleStepLabel: { color: tokens.text.muted },
    roleStepLabelActive: { color: tokens.text.primary },
    roleStepLabelDone: { color: tokens.text.muted },
    roleStepLabelMuted: { color: tokens.text.muted },
    roleStepDash: { backgroundColor: tokens.border.card },
    roleCardCompact: {
      backgroundColor: tokens.selectionCard.cardBackground,
      borderColor: tokens.borderColors.card,
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
    },
    roleCardLabel: { color: tokens.text.primary },
    roleCardLabelActive: {
      color: tokens.text.primary,
      textShadowColor: tokens.accent.glowMid,
    },
    roleCardDesc: { color: tokens.text.muted },
    roleCardDescActivePassenger: { color: tokens.text.muted },
    roleCardDescActiveDriver: { color: tokens.text.muted },
    roleCheckBadge: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    roleStatusStripCompact: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.borderColors.cockpitPanel,
      borderTopColor: tokens.borderColors.cockpitPanelTop,
    },
    roleStatusTitleCompactInline: { color: tokens.text.primary },
    roleChangeRolePillSecondary: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    roleChangeRoleLabelSecondary: { color: tokens.text.muted },
    ctaBorder: tokens.accent.glowMid,
    ctaTextShadow: tokens.shadow.ambient,
    iconMuted: tokens.text.muted,
    iconChevron: tokens.text.muted,
  };
}

/** Role shell theme — dark unless global + screen flags allow light on `role`. */
export function useRoleTheme() {
  const { tokens, resolvedTheme } = useTheme();
  const isRoleLight = isLightThemeScreenEnabled('role') && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isRoleLight ? tokens : buildThemeTokens('dark')),
    [isRoleLight, tokens],
  );

  const lightSurfaces = useMemo(
    () => (isRoleLight ? buildRoleLightSurfaces(effectiveTokens) : null),
    [isRoleLight, effectiveTokens],
  );

  const roleInput = useMemo<RoleInputColors>(
    () => ({
      accent: effectiveTokens.accent.primary,
      textPrimary: effectiveTokens.text.primary,
    }),
    [effectiveTokens],
  );

  return { tokens: effectiveTokens, isRoleLight, lightSurfaces, roleInput };
}
