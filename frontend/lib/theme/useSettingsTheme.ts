/**
 * B3-6c — Settings / Profile / Legal theme gate.
 */

import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../featureFlags';
import { buildThemeTokens } from './buildTheme';
import type { LhThemeTokens } from './types';

export type SettingsThemeScope = 'settings' | 'profile' | 'legal';

export type SettingsHubLightSurfaces = {
  screen: ViewStyle;
  backBtn: ViewStyle;
  row: ViewStyle;
  deleteButton: ViewStyle;
};

export type ProfileLightSurfaces = {
  container: ViewStyle;
  loadingWrap: ViewStyle;
  loadingText: TextStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  card: ViewStyle;
  photo: ViewStyle;
  photoPlaceholder: ViewStyle;
  cameraButton: ViewStyle;
  roleText: TextStyle;
  cardTitle: TextStyle;
  label: TextStyle;
  input: ViewStyle;
  inputDisabled: ViewStyle;
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  statValue: TextStyle;
  statLabel: TextStyle;
  statDivider: ViewStyle;
  verifyCard: ViewStyle;
  verifyTitle: TextStyle;
  verifySubtitle: TextStyle;
  linkItem: ViewStyle;
  linkText: TextStyle;
  dangerItem: ViewStyle;
  dangerText: TextStyle;
  supportCompany: TextStyle;
};

export type LegalRouteLightSurfaces = {
  container: ViewStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  companyInfo: ViewStyle;
  sectionTitle: TextStyle;
  paragraph: TextStyle;
  subTitle: TextStyle;
  companyName: TextStyle;
  companyAddress: TextStyle;
  companyEmail: TextStyle;
  footer: ViewStyle;
  footerText: TextStyle;
};

export type LegalModalLightSurfaces = {
  container: ViewStyle;
  headerGradient: readonly [string, string];
  headerTitle: TextStyle;
  companyName: TextStyle;
  lastUpdated: TextStyle;
  contentText: TextStyle;
  modalOverlay: ViewStyle;
  consentModal: ViewStyle;
  consentHeaderGradient: readonly [string, string];
  consentTitle: TextStyle;
  consentSubtitle: TextStyle;
  consentText: TextStyle;
  linkText: TextStyle;
  checkbox: ViewStyle;
  checkboxChecked: ViewStyle;
  disclaimerBox: ViewStyle;
  consentButtons: ViewStyle;
  declineButton: ViewStyle;
  declineButtonText: TextStyle;
  warningModal: ViewStyle;
  warningIcon: ViewStyle;
  warningTitle: TextStyle;
  warningText: TextStyle;
  warningList: ViewStyle;
  warningListItem: TextStyle;
  warningDeclineBtn: ViewStyle;
  warningDeclineText: TextStyle;
};

export type SettingsUiColors = {
  accent: string;
  textMuted: string;
  rowBorder: string;
};

const SETTINGS_UI_DARK: SettingsUiColors = {
  accent: '#22D3EE',
  textMuted: 'rgba(186,201,222,0.9)',
  rowBorder: 'rgba(30, 58, 95, 0.55)',
};

function buildSettingsHubLightSurfaces(tokens: LhThemeTokens): SettingsHubLightSurfaces {
  return {
    screen: { backgroundColor: tokens.bg.canvas },
    backBtn: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    row: { borderTopColor: tokens.border.card },
    deleteButton: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.status.error,
    },
  };
}

function buildProfileLightSurfaces(tokens: LhThemeTokens): ProfileLightSurfaces {
  return {
    container: { backgroundColor: tokens.bg.canvas },
    loadingWrap: { backgroundColor: tokens.bg.canvas },
    loadingText: { color: tokens.text.muted },
    header: {
      backgroundColor: tokens.bg.elevated,
      borderBottomColor: tokens.accent.glowLow,
    },
    headerTitle: { color: tokens.text.primary },
    card: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.borderColors.cardTopCyan,
      borderLeftColor: tokens.borderColors.cardLeftCyan,
      shadowColor: tokens.shadow.ambient,
    },
    photo: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.accent.glowMid,
    },
    photoPlaceholder: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.accent.glowMid,
    },
    cameraButton: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.accent.glowMid,
    },
    roleText: { color: tokens.text.primary },
    cardTitle: { color: tokens.text.primary },
    label: { color: tokens.text.muted },
    input: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      color: tokens.text.primary,
    },
    inputDisabled: {
      backgroundColor: tokens.bg.glass,
      color: tokens.text.muted,
    },
    primaryButton: {
      backgroundColor: tokens.accent.primary,
      shadowColor: tokens.accent.primary,
    },
    primaryButtonText: { color: tokens.text.inverse },
    statValue: { color: tokens.text.primary },
    statLabel: { color: tokens.text.muted },
    statDivider: { backgroundColor: tokens.border.default },
    verifyCard: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
      borderTopColor: tokens.status.success,
      borderLeftColor: tokens.accent.glowLow,
      shadowColor: tokens.shadow.ambient,
    },
    verifyTitle: { color: tokens.text.primary },
    verifySubtitle: { color: tokens.text.muted },
    linkItem: { borderBottomColor: tokens.border.card },
    linkText: { color: tokens.text.primary },
    dangerItem: {
      backgroundColor: 'rgba(127,29,29,0.10)',
      borderColor: 'rgba(248,113,113,0.35)',
    },
    dangerText: { color: 'rgba(248, 113, 113, 0.98)' },
    supportCompany: { color: tokens.text.muted },
  };
}

function buildLegalRouteLightSurfaces(tokens: LhThemeTokens): LegalRouteLightSurfaces {
  return {
    container: { backgroundColor: tokens.bg.canvas },
    header: { backgroundColor: tokens.bg.elevated },
    headerTitle: { color: tokens.text.primary },
    companyInfo: { backgroundColor: tokens.bg.glassMuted },
    sectionTitle: { color: tokens.status.error },
    paragraph: { color: tokens.text.muted },
    subTitle: { color: tokens.text.primary },
    companyName: { color: tokens.accent.primary },
    companyAddress: { color: tokens.text.muted },
    companyEmail: { color: tokens.text.muted },
    footer: { borderTopColor: tokens.border.card },
    footerText: { color: tokens.text.muted },
  };
}

function buildLegalModalLightSurfaces(tokens: LhThemeTokens): LegalModalLightSurfaces {
  return {
    container: { backgroundColor: tokens.bg.canvas },
    headerGradient: [tokens.bg.elevated, tokens.bg.canvas] as const,
    headerTitle: { color: tokens.text.primary },
    companyName: { color: tokens.accent.primary },
    lastUpdated: { color: tokens.text.muted },
    contentText: { color: tokens.text.primary },
    modalOverlay: { backgroundColor: tokens.shadow.modal },
    consentModal: { backgroundColor: tokens.bg.elevated },
    consentHeaderGradient: [tokens.bg.elevated, tokens.bg.glassMuted] as const,
    consentTitle: { color: tokens.text.primary },
    consentSubtitle: { color: tokens.text.muted },
    consentText: { color: tokens.text.primary },
    linkText: { color: tokens.accent.secondary },
    checkbox: { borderColor: tokens.accent.primary },
    checkboxChecked: { backgroundColor: tokens.accent.primary },
    disclaimerBox: { backgroundColor: 'rgba(245, 158, 11, 0.12)' },
    consentButtons: { borderTopColor: tokens.border.card },
    declineButton: { borderColor: tokens.text.muted },
    declineButtonText: { color: tokens.text.muted },
    warningModal: { backgroundColor: tokens.bg.elevated },
    warningIcon: { backgroundColor: tokens.accent.glowLow },
    warningTitle: { color: tokens.text.primary },
    warningText: { color: tokens.text.muted },
    warningList: { backgroundColor: tokens.accent.glowLow },
    warningListItem: { color: tokens.status.success },
    warningDeclineBtn: { borderColor: tokens.text.muted },
    warningDeclineText: { color: tokens.text.muted },
  };
}

export function useSettingsTheme(scope: SettingsThemeScope) {
  const { tokens, resolvedTheme } = useTheme();
  const isScopeLight = isLightThemeScreenEnabled(scope) && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isScopeLight ? tokens : buildThemeTokens('dark')),
    [isScopeLight, tokens],
  );

  const hubSurfaces = useMemo(
    () => (isScopeLight && scope === 'settings' ? buildSettingsHubLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  const profileSurfaces = useMemo(
    () => (isScopeLight && scope === 'profile' ? buildProfileLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  const legalRouteSurfaces = useMemo(
    () => (isScopeLight && scope === 'legal' ? buildLegalRouteLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  const legalModalSurfaces = useMemo(
    () => (isScopeLight && scope === 'legal' ? buildLegalModalLightSurfaces(effectiveTokens) : null),
    [isScopeLight, scope, effectiveTokens],
  );

  const ui = useMemo<SettingsUiColors>(() => {
    if (!isScopeLight || scope === 'legal') return SETTINGS_UI_DARK;
    return {
      accent: effectiveTokens.accent.primary,
      textMuted: effectiveTokens.text.muted,
      rowBorder: effectiveTokens.border.card,
    };
  }, [isScopeLight, scope, effectiveTokens]);

  const legalUi = useMemo(
    () => ({
      accent: isScopeLight ? effectiveTokens.accent.primary : '#3FA9F5',
      accentSecondary: isScopeLight ? effectiveTokens.accent.secondary : '#2563EB',
      iconOnAccent: isScopeLight ? effectiveTokens.text.inverse : '#FFF',
      headerIcon: isScopeLight ? effectiveTokens.text.primary : '#FFF',
      backIcon: isScopeLight ? effectiveTokens.text.primary : '#fff',
      activity: isScopeLight ? effectiveTokens.accent.primary : '#3FA9F5',
      statusBarStyle: (isScopeLight ? 'dark-content' : 'light-content') as 'dark-content' | 'light-content',
      statusBarBg: isScopeLight ? effectiveTokens.bg.canvas : '#1a1a2e',
    }),
    [isScopeLight, effectiveTokens],
  );

  return {
    tokens: effectiveTokens,
    isScopeLight,
    hubSurfaces,
    profileSurfaces,
    legalRouteSurfaces,
    legalModalSurfaces,
    ui,
    legalUi,
  };
}
