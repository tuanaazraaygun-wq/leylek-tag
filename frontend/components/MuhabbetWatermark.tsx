import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * Leylek Teklif Sende sekmeleri — tek Image, düşük opaklık, etkileşim yok.
 */
export default function MuhabbetWatermark() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image source={require('../assets/images/logo.png')} style={styles.img} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  img: {
    width: '72%',
    maxWidth: 320,
    height: 220,
    opacity: 0.06,
  },
});
