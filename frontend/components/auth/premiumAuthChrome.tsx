import React from 'react';
import {
  ActivityIndicator,
  Image,
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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PREMIUM_AUTH_CTA_DISABLED_GRADIENT,
  PREMIUM_AUTH_CTA_GRADIENT,
  PREMIUM_SHELL_OVERLAY,
  PREMIUM_SHELL_VIGNETTE_TOP,
  premiumAuthStyles as pa,
} from './premiumAuthStyles';

const LOGIN_BG = require('../../assets/images/login-background.png');

/** Gece şehir görseli + koyu navy overlay (login / OTP ortak). */
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
      <Image source={LOGIN_BG} style={[pa.bgImage, { width: winW, height: winH }]} resizeMode="cover" />
      <LinearGradient
        colors={[...PREMIUM_SHELL_OVERLAY]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[...PREMIUM_SHELL_VIGNETTE_TOP]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.42 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />

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

/** Cam kart kabuğu (iOS/Web blur, Android yarı saydam). */
export function PremiumGlassShell({ children, compactPadding }: { children: React.ReactNode; compactPadding: boolean }) {
  const pd = compactPadding ? 12 : 16;

  if (Platform.OS === 'android') {
    return <View style={[pa.androidGlass, { padding: pd }]}>{children}</View>;
  }

  const intensity = Platform.OS === 'web' ? 46 : 52;
  return (
    <BlurView intensity={intensity} tint="dark" style={pa.blurFrame}>
      <View style={[pa.blurTint, { padding: pd }]}>{children}</View>
    </BlurView>
  );
}

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
        pa.ctaShadow,
        grayInactive ? pa.ctaShadowDisabled : null,
        touchableStyleOverrides ?? null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: muted }}
    >
      <LinearGradient
        colors={
          grayInactive
            ? ([...PREMIUM_AUTH_CTA_DISABLED_GRADIENT] as [string, string, string])
            : ([...PREMIUM_AUTH_CTA_GRADIENT] as [string, string, string])
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.5, 1]}
        style={[
          pa.ctaGradient,
          grayInactive ? pa.ctaGradientDisabledFrame : null,
          gradientStyleOverrides ?? null,
        ]}
      >
        {busy ? (
          <ActivityIndicator color="rgba(243,248,255,0.94)" size="small" />
        ) : (
          <>
            <Text style={[pa.ctaText, labelStyle]}>{label}</Text>
            {trailing ?? null}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
