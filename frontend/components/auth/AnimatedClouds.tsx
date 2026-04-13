import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

/**
 * Hafif arka plan dekoru (giriş / kayıt akışları). Dokunmayı engellemez.
 */
export default function AnimatedClouds() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 12000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 12000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const tx = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.blob, styles.b1, { transform: [{ translateX: tx }] }]} />
      <Animated.View style={[styles.blob, styles.b2, { transform: [{ translateX: tx }] }]} />
      <Animated.View style={[styles.blob, styles.b3, { transform: [{ translateX: tx }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(63, 169, 245, 0.12)',
    ...Platform.select({
      android: { elevation: 0 },
      default: {},
    }),
  },
  b1: { width: 220, height: 220, top: '8%', left: '-12%' },
  b2: { width: 180, height: 180, top: '42%', right: '-18%' },
  b3: { width: 260, height: 260, bottom: '-8%', left: '10%' },
});
