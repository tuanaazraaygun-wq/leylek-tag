/**
 * B3-6b — Role select screen theme gate (mirrors useAuthTheme pattern).
 */

import { useMemo } from 'react';
import { Platform } from 'react-native';
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
  roleStepCircleMuted: ViewStyle;
  roleStepLabel: TextStyle;
  roleStepLabelActive: TextStyle;
  roleStepLabelDone: TextStyle;
  roleStepLabelMuted: TextStyle;
  roleStepHelper: TextStyle;
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
  ctaTouchableEnabled: ViewStyle;
  ctaTouchableDisabled: ViewStyle;
  ctaBodyEnabled: ViewStyle;
  ctaBodyDisabled: ViewStyle;
  iconMuted: string;
  iconChevron: string;
};

/** Light role screen — readable label tiers (slate scale, not washed-out muted). */
const ROLE_LT_LABEL = '#334155';
const ROLE_LT_LABEL_MUTED = '#64748B';
const ROLE_LT_LABEL_DONE = '#0F766E';
const ROLE_LT_DESC = '#475569';

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
      backgroundColor: tokens.bg.elevated,
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
    roleStepCircleText: { color: ROLE_LT_LABEL },
    roleStepCircleTextActive: { color: tokens.text.primary },
    roleStepCircleTextMuted: { color: ROLE_LT_LABEL_MUTED },
    roleStepCircleMuted: { opacity: 1 },
    roleStepLabel: { color: ROLE_LT_LABEL },
    roleStepLabelActive: { color: tokens.text.primary, fontWeight: '900' },
    roleStepLabelDone: { color: ROLE_LT_LABEL_DONE },
    roleStepLabelMuted: { color: ROLE_LT_LABEL_MUTED },
    roleStepHelper: { color: ROLE_LT_LABEL_MUTED },
    roleStepDash: { backgroundColor: tokens.border.card },
    roleCardCompact: {
      backgroundColor: tokens.selectionCard.cardBackground,
      borderColor: tokens.borderColors.card,
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
      shadowColor: tokens.shadow.ambient,
    },
    roleCardLabel: { color: tokens.text.primary },
    roleCardLabelActive: {
      color: tokens.text.primary,
      textShadowColor: tokens.accent.glowMid,
    },
    roleCardDesc: { color: ROLE_LT_DESC },
    roleCardDescActivePassenger: { color: ROLE_LT_LABEL_DONE },
    roleCardDescActiveDriver: { color: ROLE_LT_LABEL_DONE },
    roleCheckBadge: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.accent.primary,
      ...Platform.select({
        ios: {
          shadowColor: tokens.shadow.ambient,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
        default: {},
      }),
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
    roleChangeRoleLabelSecondary: { color: ROLE_LT_DESC },
    ctaBorder: tokens.accent.primary,
    ctaTextShadow: 'transparent',
    ctaTouchableEnabled: Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.10)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
      default: {},
    }) ?? {},
    ctaTouchableDisabled: Platform.select({
      ios: {
        shadowColor: 'rgba(15,23,42,0.06)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      default: {},
    }) ?? {},
    ctaBodyEnabled: {
      backgroundColor: '#FFFFFF',
      borderColor: tokens.accent.primary,
      borderTopColor: tokens.accent.glowHigh,
    },
    ctaBodyDisabled: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.border.default,
    },
    iconMuted: ROLE_LT_DESC,
    iconChevron: ROLE_LT_LABEL,
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
