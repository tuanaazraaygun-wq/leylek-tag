import React, { forwardRef, memo, useCallback, useImperativeHandle } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
} from '../../components/auth/premiumAuthStyles';
import { LDS_COLOR_CTA_RIM } from '../tokens/color';
import { useLeylekEyeMotion } from './useLeylekEyeMotion';

const AnimatedG = Animated.createAnimatedComponent(G);

export const LEYLEK_EYE_HERO_SIZE = 66;
export const LEYLEK_EYE_VIEW_SIZE = 50;

export type LeylekEyeHandle = {
  triggerFocus: () => void;
};

export type LeylekEyeProps = {
  size?: number;
  onPress?: () => void;
  reduceMotion?: boolean;
  accessibilityLabel?: string;
};

const LeylekEyeSvg = function LeylekEyeSvg({
  lookTranslateX,
  lookTranslateY,
  pupilExtraTranslateX,
  eyelidUpperTranslateY,
  eyelidLowerTranslateY,
}: {
  lookTranslateX: Animated.AnimatedInterpolation<number>;
  lookTranslateY: Animated.AnimatedInterpolation<number>;
  pupilExtraTranslateX: Animated.AnimatedInterpolation<number>;
  eyelidUpperTranslateY: Animated.AnimatedInterpolation<number>;
  eyelidLowerTranslateY: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <Svg width={LEYLEK_EYE_VIEW_SIZE} height={LEYLEK_EYE_VIEW_SIZE} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="leylekSclera" cx="44%" cy="40%" rx="56%" ry="52%">
          <Stop offset="0%" stopColor="#E4EDF5" />
          <Stop offset="55%" stopColor="#C8D8E8" />
          <Stop offset="100%" stopColor="#9EB4C8" />
        </RadialGradient>
        <RadialGradient id="leylekIris" cx="40%" cy="38%" rx="58%" ry="58%">
          <Stop offset="0%" stopColor="#67E8F9" />
          <Stop offset="42%" stopColor="#22D3EE" />
          <Stop offset="100%" stopColor="#0E7490" />
        </RadialGradient>
      </Defs>

      {/* Soft eye socket on navy capsule */}
      <Ellipse cx="50" cy="51" rx="44" ry="40" fill="url(#leylekSclera)" />
      <Ellipse
        cx="50"
        cy="51"
        rx="44"
        ry="40"
        fill="none"
        stroke="rgba(34,211,238,0.18)"
        strokeWidth="1"
      />

      <AnimatedG
        transform={[
          { translateX: lookTranslateX },
          { translateY: lookTranslateY },
        ]}
      >
        <Circle cx="50" cy="51" r="20" fill="url(#leylekIris)" />
        <Circle cx="50" cy="51" r="20" fill="none" stroke="rgba(14,116,144,0.35)" strokeWidth="0.85" />
        <AnimatedG transform={[{ translateX: pupilExtraTranslateX }]}>
          <Circle cx="50" cy="51" r="8.8" fill="#071018" />
          <Ellipse cx="43.5" cy="44.5" rx="4" ry="2.6" fill="rgba(255,255,255,0.78)" />
        </AnimatedG>
        <Ellipse cx="57" cy="57" rx="2" ry="1.2" fill="rgba(255,255,255,0.22)" />
      </AnimatedG>

      {/* Static lower crease — warmth */}
      <Path
        d="M 18 58 Q 50 66 82 58"
        fill="none"
        stroke="rgba(34,211,238,0.08)"
        strokeWidth="0.7"
      />

      <AnimatedG transform={[{ translateY: eyelidUpperTranslateY }]}>
        <Path
          d="M 8 50 Q 50 10 92 50 Q 50 58 8 50 Z"
          fill="rgba(8,17,31,0.94)"
        />
        <Path
          d="M 8 50 Q 50 16 92 50"
          fill="none"
          stroke="rgba(34,211,238,0.1)"
          strokeWidth="0.55"
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

  const eyeNode = (
    <Animated.View
      style={[
        styles.eyeScaleWrap,
        { transform: [{ scale: motion.containerScale }] },
      ]}
    >
      <LeylekEyeSvg
        lookTranslateX={motion.lookTranslateX}
        lookTranslateY={motion.lookTranslateY}
        pupilExtraTranslateX={motion.pupilExtraTranslateX}
        eyelidUpperTranslateY={motion.eyelidUpperTranslateY}
        eyelidLowerTranslateY={motion.eyelidLowerTranslateY}
      />
    </Animated.View>
  );

  const capsule = (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: Math.round(size * 0.26) }]}>
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(14, 24, 40, 0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rimPulse,
            {
              borderRadius: Math.round(size * 0.26),
              opacity: motion.rimOpacity,
              borderColor: LDS_COLOR_CTA_RIM,
            },
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
    borderColor: 'rgba(34, 211, 238, 0.32)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34, 211, 238, 0.14)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 7,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  wrapPressed: {
    opacity: 0.94,
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
