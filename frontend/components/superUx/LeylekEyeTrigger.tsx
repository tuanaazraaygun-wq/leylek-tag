import React, { memo } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PREMIUM_BORDER_SLATE,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
} from '../auth/premiumAuthStyles';

const TRIGGER_SIZE = 42;

export type LeylekEyeTriggerProps = {
  onPress: () => void;
};

/** Sürücü kokpit header — Leylek Zeka chat trigger (bubble yok, yalnızca göz). */
function LeylekEyeTrigger({ onPress }: LeylekEyeTriggerProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Leylek Zeka"
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
    >
      <LinearGradient
        colors={[PREMIUM_NAVY_DEEP, PREMIUM_NAVY_CARD, 'rgba(16, 26, 43, 0.94)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.grad}
      >
        <View style={styles.ring} pointerEvents="none">
          <Image
            source={require('../../assets/images/leylek-zeka-eye.png')}
            style={styles.eyeMark}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default memo(LeylekEyeTrigger);

const styles = StyleSheet.create({
  wrap: {
    width: TRIGGER_SIZE,
    height: TRIGGER_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34, 211, 238, 0.38)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(34, 211, 238, 0.22)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  wrapPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  grad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PREMIUM_BORDER_SLATE,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  eyeMark: {
    width: 26,
    height: 26,
  },
});
