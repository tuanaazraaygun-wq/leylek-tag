import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, FontSize, Spacing } from '../constants/Colors';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showSlogan?: boolean;
}

export default function Logo({ size = 'medium', showText = true, showSlogan = false }: LogoProps) {
  const sizes = {
    small: { icon: 50, text: 18, slogan: 12 },
    medium: { icon: 100, text: 36, slogan: 16 },
    large: { icon: 150, text: 48, slogan: 20 },
  };

  const currentSize = sizes[size];

  return (
    <View style={styles.container}>
      <View style={[styles.logoContainer, { width: currentSize.icon, height: currentSize.icon }]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={{
            width: currentSize.icon,
            height: currentSize.icon,
          }}
          resizeMode="contain"
        />
      </View>
      
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.logoText, { fontSize: currentSize.text }]}>
            Leylek TAG
          </Text>
          {showSlogan && (
            <Text style={[styles.sloganText, { fontSize: currentSize.slogan }]}>
              Yolculuk Eşleştirme
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  logoText: {
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: 1,
  },
  sloganText: {
    fontWeight: '400',
    color: Colors.gray500,
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },
});
