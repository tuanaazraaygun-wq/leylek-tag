import React from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CockpitBackground, GlassSurface } from '../../design-system/primitives';
import { LDS_BORDER_COLOR, LDS_BORDER_WIDTH } from '../../design-system/tokens/border';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import { LDS_SPACING } from '../../design-system/tokens/spacing';
import { premiumAuthStyles as pa } from './premiumAuthStyles';

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
    <View style={pa.root}>
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
          grayInactive ? ctaStyles.bodyDisabled : ctaStyles.bodyActive,
          gradientStyleOverrides ?? null,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#22D3EE" size="small" />
        ) : (
          <>
            <Text style={[pa.ctaText, labelStyle]}>{label}</Text>
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
  bodyActive: {
    backgroundColor: 'rgba(16,26,43,0.9)',
    borderWidth: LDS_BORDER_WIDTH.emphasis,
    borderColor: LDS_BORDER_COLOR.selected,
    borderTopColor: LDS_BORDER_COLOR.selectedTop,
  },
  bodyDisabled: {
    backgroundColor: 'rgba(8,17,31,0.55)',
    borderWidth: LDS_BORDER_WIDTH.standard,
    borderColor: LDS_BORDER_COLOR.card,
    opacity: 0.72,
  },
});
