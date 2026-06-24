import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CockpitBackground, GlassSurface } from '../../design-system/primitives';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { useTheme } from '../../hooks/useTheme';
import { isLightThemeScreenEnabled } from '../../lib/featureFlags';
import { buildThemeTokens } from '../../lib/theme/buildTheme';
import { useRoleTheme } from '../../lib/theme/useRoleTheme';
import type { LhThemeTokens } from '../../lib/theme/types';
import { premiumAuthStyles as pa } from './premiumAuthStyles';

export type AuthLightSurfaces = {
  root: ViewStyle;
  phoneLabel: TextStyle;
  otpHint: TextStyle;
  inputShell: ViewStyle;
  inputShellFocused: ViewStyle;
  inputField: TextStyle;
  otpInputField: TextStyle;
  placeholder: string;
  placeholderOtp: string;
  selection: string;
  accent: string;
  checkboxOuter: ViewStyle;
  checkboxFilled: ViewStyle;
  checkboxCheck: string;
  kvkkPlain: TextStyle;
  kvkkLink: TextStyle;
  veyaLine: ViewStyle;
  veyaLabel: TextStyle;
  outlineGlass: ViewStyle;
  outlineLabel: TextStyle;
  forgotText: TextStyle;
  outlineGlassWide: ViewStyle;
  supportLabel: TextStyle;
  otpBackText: TextStyle;
  trustChip: ViewStyle;
  trustChipIconWrap: ViewStyle;
  trustChipIcon: string;
  hintBelowInput: TextStyle;
  cityPickRowPremium: ViewStyle;
  cityPickIconWrap: ViewStyle;
  cityPickHint: TextStyle;
  cityPickValue: TextStyle;
  cityPickPlaceholder: TextStyle;
  authPhonePlusPremium: TextStyle;
  authBottomSheetBackdrop: ViewStyle;
  authCitySheet: ViewStyle;
  authSheetGrab: ViewStyle;
  authSheetTitle: TextStyle;
  authSheetSubtitle: TextStyle;
  authCitySearchRow: ViewStyle;
  authCitySearchInput: TextStyle;
  authCityItem: ViewStyle;
  authCityItemSelected: ViewStyle;
  authCityItemText: TextStyle;
  authCityItemTextSelected: TextStyle;
  authSheetCloseSoft: ViewStyle;
  authSheetCloseSoftText: TextStyle;
  cityEmptyHintPremium: TextStyle;
  iconMuted: string;
  iconMutedSoft: string;
  placeholderSearch: string;
};

export type AuthInputColors = {
  placeholder: string;
  placeholderOtp: string;
  placeholderSearch: string;
  selection: string;
  iconMuted: string;
  iconMutedSoft: string;
};

function buildAuthLightSurfaces(tokens: LhThemeTokens): AuthLightSurfaces {
  return {
    root: { backgroundColor: tokens.bg.canvas },
    phoneLabel: { color: tokens.text.primary },
    otpHint: { color: tokens.text.muted },
    inputShell: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    inputShellFocused: {
      borderColor: tokens.accent.glowHigh,
    },
    inputField: { color: tokens.text.primary },
    otpInputField: { color: tokens.text.primary },
    placeholder: tokens.text.muted,
    placeholderOtp: tokens.text.muted,
    selection: tokens.accent.primary,
    accent: tokens.accent.primary,
    checkboxOuter: { borderColor: tokens.accent.glowMid },
    checkboxFilled: {
      backgroundColor: tokens.accent.primary,
      borderColor: tokens.accent.primary,
    },
    checkboxCheck: tokens.text.inverse,
    kvkkPlain: { color: tokens.text.muted },
    kvkkLink: { color: tokens.accent.secondary },
    veyaLine: { backgroundColor: tokens.border.card },
    veyaLabel: { color: tokens.text.muted },
    outlineGlass: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    outlineLabel: { color: tokens.text.primary },
    forgotText: { color: tokens.text.muted },
    outlineGlassWide: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    supportLabel: { color: tokens.text.primary },
    otpBackText: { color: tokens.text.muted },
    trustChip: { backgroundColor: tokens.bg.glassMuted },
    trustChipIconWrap: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.card,
    },
    trustChipIcon: tokens.text.muted,
    hintBelowInput: { color: tokens.text.muted },
    cityPickRowPremium: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    cityPickIconWrap: {
      backgroundColor: tokens.accent.glowLow,
      borderColor: tokens.border.card,
    },
    cityPickHint: { color: tokens.text.muted },
    cityPickValue: { color: tokens.text.primary },
    cityPickPlaceholder: { color: tokens.text.muted },
    authPhonePlusPremium: { color: tokens.accent.primary },
    authBottomSheetBackdrop: { backgroundColor: tokens.shadow.modal },
    authCitySheet: {
      backgroundColor: tokens.bg.elevated,
      borderColor: tokens.border.default,
    },
    authSheetGrab: { backgroundColor: tokens.border.card },
    authSheetTitle: { color: tokens.text.primary },
    authSheetSubtitle: { color: tokens.text.muted },
    authCitySearchRow: {
      backgroundColor: tokens.bg.glassMuted,
      borderColor: tokens.border.default,
    },
    authCitySearchInput: { color: tokens.text.primary },
    authCityItem: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.card,
    },
    authCityItemSelected: {
      borderColor: tokens.accent.glowHigh,
      backgroundColor: tokens.accent.glowLow,
    },
    authCityItemText: { color: tokens.text.primary },
    authCityItemTextSelected: { color: tokens.accent.primary },
    authSheetCloseSoft: {
      backgroundColor: tokens.bg.glass,
      borderColor: tokens.border.default,
    },
    authSheetCloseSoftText: { color: tokens.text.primary },
    cityEmptyHintPremium: { color: tokens.text.muted },
    iconMuted: tokens.text.muted,
    iconMutedSoft: tokens.text.muted,
    placeholderSearch: tokens.text.muted,
  };
}

/** Auth shell theme — dark unless global + screen flags allow light on `auth`. */
export function useAuthTheme() {
  const { tokens, resolvedTheme } = useTheme();
  const isAuthLight = isLightThemeScreenEnabled('auth') && resolvedTheme === 'light';

  const effectiveTokens = useMemo(
    () => (isAuthLight ? tokens : buildThemeTokens('dark')),
    [isAuthLight, tokens],
  );

  const lightSurfaces = useMemo(
    () => (isAuthLight ? buildAuthLightSurfaces(effectiveTokens) : null),
    [isAuthLight, effectiveTokens],
  );

  const authInput = useMemo<AuthInputColors>(
    () => ({
      placeholder: lightSurfaces?.placeholder ?? 'rgba(148,163,184,0.78)',
      placeholderOtp: lightSurfaces?.placeholderOtp ?? 'rgba(148,163,184,0.55)',
      placeholderSearch: lightSurfaces?.placeholderSearch ?? 'rgba(148,163,184,0.72)',
      selection: lightSurfaces?.selection ?? effectiveTokens.accent.primary,
      iconMuted: lightSurfaces?.iconMuted ?? 'rgba(148,163,184,0.85)',
      iconMutedSoft: lightSurfaces?.iconMutedSoft ?? 'rgba(148,163,184,0.78)',
    }),
    [lightSurfaces, effectiveTokens],
  );

  return { tokens: effectiveTokens, isAuthLight, lightSurfaces, authInput };
}

/** LHIS kokpit zemin — login / OTP / register / forgot ortak shell. */
export function PremiumAuthScreenShell({
  parentStyles,
  children,
}: {
  parentStyles: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { lightSurfaces } = useAuthTheme();
  const padH = Math.min(22, Math.max(14, Math.round(winW * 0.045)));
  const columnW = Math.min(400, winW - padH * 2);
  const isCompact = winH < 660;
  const scrollBottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);
  const kbOffset = Platform.OS === 'ios' ? insets.top + 6 : 0;
  const contentMinHeight = Math.max(winH - insets.top - insets.bottom - 8, 480);

  const layerStyle = parentStyles.loginLayerAboveClouds as Record<string, unknown>;
  const kavStyle = parentStyles.loginKavFlex as Record<string, unknown>;
  const scrollStyle = parentStyles.loginAuthScroll as Record<string, unknown>;
  const scrollContentStyle = parentStyles.loginAuthScrollContent as Record<string, unknown>;

  return (
    <View style={[pa.root, lightSurfaces?.root]}>
      <CockpitBackground />

      <SafeAreaView style={pa.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[layerStyle, pa.flexOne]}>
          <KeyboardAvoidingView style={kavStyle} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled keyboardVerticalOffset={kbOffset}>
            <ScrollView
              style={scrollStyle}
              contentContainerStyle={[
                scrollContentStyle as object,
                {
                  paddingTop: isCompact ? 4 : 8,
                  paddingBottom: scrollBottomPad + (isCompact ? 12 : 20),
                  paddingHorizontal: padH,
                  flexGrow: 1,
                  minHeight: contentMinHeight,
                  alignItems: 'center',
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              <View style={[pa.column, { width: columnW }]}>{children}</View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** LHIS form kartı — login / OTP / register ortak cam kabuk. */
export function PremiumGlassShell({ children, compactPadding }: { children: React.ReactNode; compactPadding: boolean }) {
  const padding = compactPadding ? LDS_SPACING.sm : LDS_SPACING.md;

  return (
    <GlassSurface
      variant="plain"
      borderRadius={LDS_RADIUS.xl}
      style={[glassShellStyles.shell, { padding }]}
    >
      {children}
    </GlassSurface>
  );
}

const glassShellStyles = StyleSheet.create({
  shell: {
    alignSelf: 'stretch',
    marginBottom: LDS_SPACING.sm,
    ...LDS_ELEVATION.flat,
  },
});

export function PremiumGradientCtaButton({
  label,
  disabled,
  busy,
  onPress,
  accessibilityLabel,
  trailing,
  gradientStyleOverrides,
  labelStyle,
  touchableStyleOverrides,
}: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  trailing?: React.ReactNode;
  gradientStyleOverrides?: Record<string, unknown>;
  labelStyle?: StyleProp<TextStyle>;
  /** Dokunmatik gövdesi için ek stil (ör. rol ekranı derin navy gölgesi) */
  touchableStyleOverrides?: Record<string, unknown>;
}) {
  const { tokens: authTokens } = useAuthTheme();
  const { tokens: roleTokens, isRoleLight } = useRoleTheme();
  const tokens = isRoleLight ? roleTokens : authTokens;
  const muted = !!(disabled || busy);
  const grayInactive = !!(disabled && !busy);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={muted}
      onPress={onPress}
      style={[
        ctaStyles.touchable,
        grayInactive ? ctaStyles.touchableDisabled : null,
        touchableStyleOverrides ?? null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: muted }}
    >
      <View
        style={[
          ctaStyles.body,
          {
            backgroundColor: grayInactive
              ? tokens.button.bodyDisabledBackground
              : tokens.button.bodyActiveBackground,
            borderWidth: grayInactive ? tokens.borderWidths.standard : tokens.borderWidths.emphasis,
            borderColor: grayInactive ? tokens.borderColors.card : tokens.borderColors.selected,
            borderTopColor: grayInactive ? tokens.borderColors.card : tokens.borderColors.selectedTop,
            opacity: grayInactive ? tokens.button.bodyDisabledOpacity : 1,
          },
          gradientStyleOverrides ?? null,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={tokens.accent.primary} size="small" />
        ) : (
          <>
            <Text style={[pa.ctaText, { color: tokens.text.primary }, labelStyle]}>{label}</Text>
            {trailing ?? null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const ctaStyles = StyleSheet.create({
  touchable: {
    alignSelf: 'stretch',
    borderRadius: LDS_RADIUS.md,
    ...LDS_ELEVATION.cta,
  },
  touchableDisabled: {
    ...LDS_ELEVATION.flat,
  },
  body: {
    alignSelf: 'stretch',
    borderRadius: LDS_RADIUS.md,
    paddingVertical: Platform.OS === 'ios' ? LDS_SPACING.sm + 2 : LDS_SPACING.sm,
    paddingHorizontal: LDS_SPACING.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: LDS_SPACING.xs,
  },
});
