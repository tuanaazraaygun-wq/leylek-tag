import React, { forwardRef, memo, useCallback, useImperativeHandle } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
} from '../../components/auth/premiumAuthStyles';
import { LDS_COLOR_CTA_RIM } from '../tokens/color';
import { useLeylekEyeMotion } from './useLeylekEyeMotion';

const AnimatedG = Animated.createAnimatedComponent(G);

export const LEYLEK_EYE_HERO_SIZE = 60;
export const LEYLEK_EYE_VIEW_SIZE = 44;

export type LeylekEyeHandle = {
  triggerFocus: () => void;
};

export type LeylekEyeProps = {
  size?: number;
  onPress?: () => void;
  reduceMotion?: boolean;
  accessibilityLabel?: string;
};

const LeylekEyeSvg = memo(function LeylekEyeSvg({
  lookTranslateX,
  eyelidTranslateY,
}: {
  lookTranslateX: Animated.AnimatedInterpolation<number>;
  eyelidTranslateY: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Svg width={LEYLEK_EYE_VIEW_SIZE} height={LEYLEK_EYE_VIEW_SIZE} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="leylekSclera" cx="42%" cy="38%" rx="55%" ry="55%">
          <Stop offset="0%" stopColor="#F4F8FC" />
          <Stop offset="72%" stopColor="#D8E4EF" />
          <Stop offset="100%" stopColor="#B8C9DA" />
        </RadialGradient>
        <RadialGradient id="leylekIris" cx="38%" cy="36%" rx="60%" ry="60%">
          <Stop offset="0%" stopColor="#5EEAD4" />
          <Stop offset="45%" stopColor="#22D3EE" />
          <Stop offset="100%" stopColor="#0891B2" />
        </RadialGradient>
      </Defs>

      <Circle cx="50" cy="50" r="44" fill="url(#leylekSclera)" />
      <Circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148, 176, 204, 0.22)" strokeWidth="1.2" />

      <AnimatedG translateX={lookTranslateX}>
        <Circle cx="50" cy="50" r="20" fill="url(#leylekIris)" />
        <Circle cx="50" cy="50" r="20" fill="none" stroke="rgba(8, 145, 178, 0.35)" strokeWidth="0.8" />
        <Circle cx="50" cy="50" r="8.5" fill="#0A1628" />
        <Ellipse cx="43" cy="43" rx="4.2" ry="2.8" fill="rgba(255,255,255,0.82)" opacity={0.9} />
        <Ellipse cx="56" cy="56" rx="2" ry="1.2" fill="rgba(255,255,255,0.18)" />
      </AnimatedG>

      <AnimatedG translateY={eyelidTranslateY}>
        <Path
          d="M 6 48 Q 50 8 94 48 Q 50 56 6 48 Z"
          fill="#0B1524"
          opacity={0.97}
        />
        <Path
          d="M 6 48 Q 50 14 94 48"
          fill="none"
          stroke="rgba(34, 211, 238, 0.12)"
          strokeWidth="0.6"
        />
      </AnimatedG>
    </Svg>
  );
});

const LeylekEye = forwardRef<LeylekEyeHandle, LeylekEyeProps>(function LeylekEye(
  {
    size = LEYLEK_EYE_HERO_SIZE,
    onPress,
    reduceMotion = false,
    accessibilityLabel = 'Leylek Zeka',
  },
  ref,
) {
  const motion = useLeylekEyeMotion({ reduceMotion });

  useImperativeHandle(ref, () => ({
    triggerFocus: motion.triggerFocus,
  }), [motion.triggerFocus]);

  const handlePress = useCallback(() => {
    motion.triggerFocus();
    onPress?.();
  }, [motion.triggerFocus, onPress]);

  const innerRing = Math.round(size * 0.78);

  const eyeNode = (
    <Animated.View
      style={[
        styles.eyeScaleWrap,
        { transform: [{ scale: motion.containerScale }] },
      ]}
    >
      <LeylekEyeSvg
        lookTranslateX={motion.lookTranslateX}
        eyelidTranslateY={motion.eyelidTranslateY}
      />
    </Animated.View>
  );

  const capsule = (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: Math.round(size * 0.24) }]}>
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(16, 26, 43, 0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rimPulse,
            {
              borderRadius: Math.round(size * 0.24),
              opacity: motion.rimOpacity,
              borderColor: LDS_COLOR_CTA_RIM,
            },
          ]}
        />
        <View
          style={[
            styles.ring,
            {
              width: innerRing,
              height: innerRing,
              borderRadius: Math.round(innerRing * 0.32),
            },
          ]}
        >
          {eyeNode}
        </View>
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
    borderColor: 'rgba(34, 211, 238, 0.38)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34, 211, 238, 0.18)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  wrapPressed: {
    opacity: 0.92,
  },
  grad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rimPulse: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth + 1,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    backgroundColor: 'rgba(34, 211, 238, 0.06)',
    overflow: 'hidden',
  },
  eyeScaleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
