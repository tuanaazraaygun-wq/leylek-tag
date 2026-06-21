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

  return { tokens: effectiveTokens, isAuthLight, lightSurfaces };
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
  const scrollBottomPad = Math.max(insets.bottom, 12);
  const kbOffset = Platform.OS === 'ios' ? insets.top + 6 : 0;

  const layerStyle = parentStyles.loginLayerAboveClouds as Record<string, unknown>;
  const kavStyle = parentStyles.loginKavFlex as Record<string, unknown>;
  const scrollStyle = parentStyles.loginAuthScroll as Record<string, unknown>;
  const scrollContentStyle = parentStyles.loginAuthScrollContent as Record<string, unknown>;

  return (
    <View style={[pa.root, lightSurfaces?.root]}>
      <CockpitBackground />

      <SafeAreaView style={pa.safe} edges={['top', 'left', 'right']}>
        <View style={[layerStyle, pa.flexOne]}>
          <KeyboardAvoidingView style={kavStyle} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled keyboardVerticalOffset={kbOffset}>
            <ScrollView
              style={scrollStyle}
              contentContainerStyle={[
                scrollContentStyle as object,
                {
                  paddingTop: isCompact ? 4 : 8,
                  paddingBottom: scrollBottomPad + 16,
                  paddingHorizontal: padH,
                  flexGrow: 1,
                  minHeight: Math.max(winH - insets.top - 8, 480),
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
  const { tokens } = useAuthTheme();
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
