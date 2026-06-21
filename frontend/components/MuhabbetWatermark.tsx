import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * Leylek Teklif Sende sekmeleri — B5.2 watermark asset (12% opacity baked in SVG export).
 */
export default function MuhabbetWatermark() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image source={require('../assets/images/leylek-watermark.png')} style={styles.img} resizeMode="contain" />
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
    opacity: 1,
  },
});
