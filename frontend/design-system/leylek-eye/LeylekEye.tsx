import React, { forwardRef, memo, useCallback, useImperativeHandle } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_NAVY_CARD,
} from '../../components/auth/premiumAuthStyles';
import { LDS_COLOR_CTA_RIM } from '../tokens/color';
import { useLeylekEyeMotion, type LeylekEyeMotionProfile } from './useLeylekEyeMotion';

const AnimatedG = Animated.createAnimatedComponent(G);

export const LEYLEK_EYE_HERO_SIZE = 66;
export const LEYLEK_EYE_ROLE_SELECT_SIZE = 49;
export const LEYLEK_EYE_VIEW_SIZE = 50;

export type LeylekEyeChromeTone = 'default' | 'subtle';
export type LeylekEyeThemeVariant = 'dark' | 'light';

function resolveEyeViewSize(capsuleSize: number): number {
  return Math.round(capsuleSize * (LEYLEK_EYE_VIEW_SIZE / LEYLEK_EYE_HERO_SIZE));
}

export type LeylekEyeHandle = {
  triggerFocus: () => void;
};

export type LeylekEyeProps = {
  size?: number;
  chromeTone?: LeylekEyeChromeTone;
  themeVariant?: LeylekEyeThemeVariant;
  motionProfile?: LeylekEyeMotionProfile;
  onPress?: () => void;
  reduceMotion?: boolean;
  accessibilityLabel?: string;
};

const LeylekEyeSvg = function LeylekEyeSvg({
  viewSize,
  lookTranslateX,
  lookTranslateY,
  pupilExtraTranslateX,
  eyelidUpperTranslateY,
  eyelidLowerTranslateY,
}: {
  viewSize: number;
  lookTranslateX: Animated.AnimatedInterpolation<number>;
  lookTranslateY: Animated.AnimatedInterpolation<number>;
  pupilExtraTranslateX: Animated.AnimatedInterpolation<number>;
  eyelidUpperTranslateY: Animated.AnimatedInterpolation<number>;
  eyelidLowerTranslateY: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Svg width={viewSize} height={viewSize} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="leylekSclera" cx="46%" cy="42%" rx="58%" ry="54%">
          <Stop offset="0%" stopColor="#A8BDD0" />
          <Stop offset="48%" stopColor="#7A94AA" />
          <Stop offset="100%" stopColor="#4A6278" />
        </RadialGradient>
        <RadialGradient id="leylekIris" cx="38%" cy="36%" rx="62%" ry="62%">
          <Stop offset="0%" stopColor="#38BDD4" />
          <Stop offset="38%" stopColor="#149CB4" />
          <Stop offset="72%" stopColor="#0A7088" />
          <Stop offset="100%" stopColor="#064E60" />
        </RadialGradient>
        <RadialGradient id="leylekIrisRing" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="72%" stopColor="transparent" />
          <Stop offset="88%" stopColor="rgba(6,78,96,0.55)" />
          <Stop offset="100%" stopColor="rgba(4,52,64,0.75)" />
        </RadialGradient>
        <SvgLinearGradient id="leylekSocketShade" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="rgba(8,17,31,0)" />
          <Stop offset="100%" stopColor="rgba(8,17,31,0.35)" />
        </SvgLinearGradient>
      </Defs>

      <Ellipse cx="50" cy="52" rx="45" ry="41" fill="url(#leylekSocketShade)" />

      <Ellipse cx="50" cy="51" rx="44" ry="40" fill="url(#leylekSclera)" />
      <Ellipse
        cx="50"
        cy="51"
        rx="44"
        ry="40"
        fill="none"
        stroke="rgba(34,211,238,0.12)"
        strokeWidth="0.85"
      />

      <AnimatedG
        transform={[
          { translateX: lookTranslateX },
          { translateY: lookTranslateY },
        ]}
      >
        <Circle cx="50" cy="51" r="20" fill="url(#leylekIris)" />
        <Circle cx="50" cy="51" r="20" fill="url(#leylekIrisRing)" />
        <Circle cx="50" cy="51" r="20" fill="none" stroke="rgba(4,52,64,0.45)" strokeWidth="0.9" />
        <AnimatedG transform={[{ translateX: pupilExtraTranslateX }]}>
          <Circle cx="50" cy="51" r="8.4" fill="#030810" />
          <Ellipse cx="43.8" cy="44.8" rx="3.2" ry="2.1" fill="rgba(255,255,255,0.55)" />
        </AnimatedG>
        <Ellipse cx="57.2" cy="57" rx="1.8" ry="1.1" fill="rgba(255,255,255,0.16)" />
      </AnimatedG>

      <Path
        d="M 18 58 Q 50 66 82 58"
        fill="none"
        stroke="rgba(34,211,238,0.06)"
        strokeWidth="0.65"
      />

      <AnimatedG transform={[{ translateY: eyelidUpperTranslateY }]}>
        <Path
          d="M 8 50 Q 50 10 92 50 Q 50 58 8 50 Z"
          fill="rgba(8,17,31,0.94)"
        />
        <Path
          d="M 8 50 Q 50 16 92 50"
          fill="none"
          stroke="rgba(34,211,238,0.08)"
          strokeWidth="0.5"
        />
      </AnimatedG>

      <AnimatedG transform={[{ translateY: eyelidLowerTranslateY }]}>
        <Path
          d="M 12 62 Q 50 72 88 62 L 88 100 L 12 100 Z"
          fill="rgba(8,17,31,0.88)"
        />
      </AnimatedG>
    </Svg>
  );
};

const LeylekEye = forwardRef<LeylekEyeHandle, LeylekEyeProps>(function LeylekEye(
  {
    size = LEYLEK_EYE_HERO_SIZE,
    chromeTone = 'default',
    themeVariant = 'dark',
    motionProfile = 'fab',
    onPress,
    reduceMotion = false,
    accessibilityLabel = 'Leylek Zeka',
  },
  ref,
) {
  const motion = useLeylekEyeMotion({ reduceMotion, motionProfile });
  const capsuleRadius = Math.round(size * 0.26);
  const innerRimRadius = Math.max(10, Math.round(size * 0.21));
  const viewSize = resolveEyeViewSize(size);
  const isSubtleChrome = chromeTone === 'subtle';
  const isLightTheme = themeVariant === 'light';

  useImperativeHandle(ref, () => ({
    triggerFocus: motion.triggerFocus,
  }), [motion.triggerFocus]);

  const handlePress = useCallback(() => {
    motion.triggerFocus();
    onPress?.();
  }, [motion.triggerFocus, onPress]);

  const eyeNode = (
    <Animated.View
      style={[
        styles.eyeScaleWrap,
        { transform: [{ scale: motion.containerScale }] },
      ]}
    >
      <LeylekEyeSvg
        viewSize={viewSize}
        lookTranslateX={motion.lookTranslateX}
        lookTranslateY={motion.lookTranslateY}
        pupilExtraTranslateX={motion.pupilExtraTranslateX}
        eyelidUpperTranslateY={motion.eyelidUpperTranslateY}
        eyelidLowerTranslateY={motion.eyelidLowerTranslateY}
      />
    </Animated.View>
  );

  const capsule = (
    <View
      style={[
        styles.wrap,
        isSubtleChrome && styles.wrapSubtle,
        isLightTheme && styles.wrapLight,
        isLightTheme && isSubtleChrome && styles.wrapLightSubtle,
        { width: size, height: size, borderRadius: capsuleRadius },
      ]}
    >
      <LinearGradient
        colors={
          isLightTheme
            ? (['#FFFFFF', '#F4F7FB', '#EEF2F7'] as const)
            : (['rgba(18,32,52,0.98)', PREMIUM_NAVY_CARD, 'rgba(8,14,24,0.97)'] as const)
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.grad}
      >
        <LinearGradient
          colors={
            isLightTheme
              ? (['rgba(255,255,255,0.92)', 'rgba(0,212,170,0.06)', 'transparent'] as const)
              : (['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)', 'transparent'] as const)
          }
          locations={[0, 0.35, 0.72]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 0.55 }}
          pointerEvents="none"
          style={[styles.glassSheen, { borderRadius: capsuleRadius }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rimPulse,
            {
              borderRadius: capsuleRadius,
              opacity: motion.rimOpacity,
              borderColor: isLightTheme ? 'rgba(0,212,170,0.28)' : LDS_COLOR_CTA_RIM,
            },
          ]}
        />
        <View
          style={[
            styles.glassInnerRim,
            isLightTheme && styles.glassInnerRimLight,
            { borderRadius: innerRimRadius },
          ]}
        />
        <View style={styles.eyeWell}>{eyeNode}</View>
      </LinearGradient>
    </View>
  );

  if (!onPress) {
    return capsule;
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={({ pressed }) => [pressed && styles.wrapPressed]}
    >
      {capsule}
    </Pressable>
  );
});

export default memo(LeylekEye);

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34, 211, 238, 0.26)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34, 211, 238, 0.12)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 9,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  wrapSubtle: {
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    borderColor: 'rgba(34, 211, 238, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34, 211, 238, 0.08)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  wrapLight: {
    borderColor: 'rgba(0, 212, 170, 0.32)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(15, 23, 42, 0.12)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  wrapLightSubtle: {
    borderColor: 'rgba(0, 212, 170, 0.24)',
  },
  wrapPressed: {
    opacity: 0.94,
  },
  grad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  glassInnerRim: {
    ...StyleSheet.absoluteFillObject,
    margin: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
    borderTopColor: 'rgba(255,255,255,0.12)',
    pointerEvents: 'none',
  },
  glassInnerRimLight: {
    borderColor: 'rgba(15,23,42,0.08)',
    borderTopColor: 'rgba(255,255,255,0.72)',
  },
  rimPulse: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth + 1,
  },
  eyeWell: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  eyeScaleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
