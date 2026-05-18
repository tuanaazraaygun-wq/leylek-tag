import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Spacing } from '../constants/Colors';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showSlogan?: boolean;
}

export default function Logo({ size = 'medium', showText = true, showSlogan = false }: LogoProps) {
  const sizes = {
    small: { box: 50, slogan: 12 },
    medium: { box: 100, slogan: 16 },
    large: { box: 150, slogan: 20 },
  };

  const currentSize = sizes[size];

  return (
    <View style={styles.container}>
      <View
        style={[styles.logoPad, { width: currentSize.box, height: currentSize.box }]}
      >
        <Image
          source={require('../assets/images/leylek-logo-premium.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {showText && showSlogan && (
        <View style={styles.textContainer}>
          <Text style={[styles.sloganText, { fontSize: currentSize.slogan }]}>
            Yolculuk Eşleştirme
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPad: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  sloganText: {
    fontWeight: '400',
    color: Colors.gray500,
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },
});
