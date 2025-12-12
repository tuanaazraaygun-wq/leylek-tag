import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
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
      {/* Modern Minimal Uçan Leylek Logosu */}
      <View style={[styles.logoContainer, { width: currentSize.icon, height: currentSize.icon }]}>
        <Svg
          width={currentSize.icon}
          height={currentSize.icon}
          viewBox="0 0 100 100"
          fill="none"
        >
          <G>
            {/* Ana Leylek Gövdesi - Minimal Tek Çizgi Stil */}
            {/* Gövde (Body) */}
            <Path
              d="M 50 45 Q 48 50 47 55 Q 46 60 45 65"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Baş ve Gaga (Head & Beak) */}
            <Path
              d="M 50 45 Q 52 42 54 40 L 62 35"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Sol Kanat (Left Wing - Yukarı açık) */}
            <Path
              d="M 50 48 Q 35 38 25 35 Q 20 33 15 34"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Sağ Kanat (Right Wing - Yukarı açık) */}
            <Path
              d="M 50 48 Q 65 38 75 35 Q 80 33 85 34"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Kuyruk (Tail) */}
            <Path
              d="M 45 65 Q 42 68 40 70"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Bacaklar (Legs - hafif arkaya) */}
            <Path
              d="M 46 62 L 44 72 M 48 63 L 50 72"
              stroke={Colors.primary}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Göz (Eye - minimal nokta) */}
            <Path
              d="M 53 40 L 53 40"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
            />
            
            {/* Kanat Detayları (Wing feathers - minimal) */}
            <Path
              d="M 35 38 L 32 40 M 30 37 L 27 39"
              stroke={Colors.primary}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
            <Path
              d="M 65 38 L 68 40 M 70 37 L 73 39"
              stroke={Colors.primary}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
          </G>
        </Svg>
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
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
