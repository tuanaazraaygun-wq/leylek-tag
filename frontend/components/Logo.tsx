import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
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
      {/* PROFESYONEL UÇAN LEYLEK LOGOSU - Twitter/Uber Minimalizmi */}
      <View style={[styles.logoContainer, { width: currentSize.icon, height: currentSize.icon }]}>
        <Svg
          width={currentSize.icon}
          height={currentSize.icon}
          viewBox="0 0 120 120"
          fill="none"
        >
          <G>
            {/* ================== MAIN STORK SILHOUETTE ================== */}
            
            {/* BAŞ & UZUN GAGA - Leylek karakteristiği */}
            <Path
              d="M 65 45 L 80 38"
              stroke={Colors.primary}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            
            {/* Baş yuvarlak geçiş */}
            <Path
              d="M 65 45 Q 63 43 60 42"
              stroke={Colors.primary}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* BOYUN & GÖVDE - Tek akışkan çizgi */}
            <Path
              d="M 60 42 Q 58 46 58 52 Q 58 58 56 64"
              stroke={Colors.primary}
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* KUYRUK - Hafif aşağı */}
            <Path
              d="M 56 64 Q 52 68 48 70"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* ================== KANATLAR - V ŞEKLİNDE YUKARI ================== */}
            
            {/* SOL KANAT - Yukarı doğru açık */}
            <Path
              d="M 58 50 Q 40 42 25 38 Q 18 36 12 38"
              stroke={Colors.primary}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            
            {/* Sol kanat detay (tüy etkisi) */}
            <Path
              d="M 40 42 L 36 44 M 30 40 L 26 42"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* SAĞ KANAT - Yukarı doğru açık */}
            <Path
              d="M 58 50 Q 76 42 91 38 Q 98 36 104 38"
              stroke={Colors.primary}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            
            {/* Sağ kanat detay (tüy etkisi) */}
            <Path
              d="M 76 42 L 80 44 M 86 40 L 90 42"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* ================== DETAYLAR ================== */}
            
            {/* GÖZ - Minimal nokta */}
            <Circle
              cx="64"
              cy="43"
              r="1.5"
              fill={Colors.primary}
            />
            
            {/* BACAKLAR - İnce, arkaya doğru */}
            <Path
              d="M 56 62 L 54 72"
              stroke={Colors.primary}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.8"
            />
            <Path
              d="M 58 63 L 60 72"
              stroke={Colors.primary}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.8"
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
