import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize } from '../constants/Colors';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export default function Logo({ size = 'medium', showText = true }: LogoProps) {
  const sizes = {
    small: { icon: 40, text: 16 },
    medium: { icon: 80, text: 32 },
    large: { icon: 120, text: 48 },
  };

  const currentSize = sizes[size];

  return (
    <View style={styles.container}>
      {/* Konsept 3: Pin + Leylek */}
      <View style={[styles.logoContainer, { width: currentSize.icon, height: currentSize.icon }]}>
        <View style={[styles.pin, { width: currentSize.icon * 0.8, height: currentSize.icon }]}>
          <Ionicons name="location" size={currentSize.icon * 0.6} color={Colors.primary} />
          {/* Leylek silueti - basit icon kullanıyoruz */}
          <View style={styles.birdContainer}>
            <Ionicons name="airplane" size={currentSize.icon * 0.35} color="#FFF" style={styles.bird} />
          </View>
        </View>
      </View>
      
      {showText && (
        <Text style={[styles.logoText, { fontSize: currentSize.text }]}>Leylek TAG</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pin: {
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  birdContainer: {
    position: 'absolute',
    top: '35%',
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 4,
  },
  bird: {
    transform: [{ rotate: '45deg' }],
  },
  logoText: {
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 8,
    letterSpacing: 1,
  },
});
