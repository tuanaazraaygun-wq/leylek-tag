import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G, Circle, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';
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
      {/* GERÇEKÇİ & EFEKTLİ UÇAN LEYLEK LOGOSU */}
      <View style={[styles.logoContainer, { width: currentSize.icon, height: currentSize.icon }]}>
        <Svg
          width={currentSize.icon}
          height={currentSize.icon}
          viewBox="0 0 140 140"
          fill="none"
        >
          <Defs>
            {/* Gradient - Mavi tonları */}
            <LinearGradient id="storkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#4AB8FF" stopOpacity="1" />
              <Stop offset="50%" stopColor={Colors.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor="#2E8BC0" stopOpacity="1" />
            </LinearGradient>
            
            {/* Gölge gradient */}
            <LinearGradient id="shadowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          
          <G>
            {/* =============== GÖLGE (ALT KATMAN) =============== */}
            <Ellipse
              cx="70"
              cy="75"
              rx="45"
              ry="8"
              fill="url(#shadowGradient)"
              opacity="0.2"
            />
            
            {/* =============== ANA GÖVDE =============== */}
            
            {/* Gövde - Dolu şekil */}
            <Path
              d="M 65 48 Q 64 52 64 58 Q 64 65 62 72 Q 61 75 60 78"
              fill="url(#storkGradient)"
              stroke={Colors.primary}
              strokeWidth="1"
            />
            
            {/* =============== BAŞ VE GAGA =============== */}
            
            {/* Baş - Yuvarlak */}
            <Circle
              cx="68"
              cy="46"
              r="6"
              fill="url(#storkGradient)"
              stroke={Colors.primary}
              strokeWidth="1.5"
            />
            
            {/* Uzun gaga - Leylek karakteristiği */}
            <Path
              d="M 73 45 L 92 40"
              stroke="#FF6B35"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <Path
              d="M 73 47 L 91 42"
              stroke="#FF8855"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
            
            {/* Göz */}
            <Circle
              cx="70"
              cy="45"
              r="2"
              fill="#1B1B1E"
            />
            <Circle
              cx="70.5"
              cy="44.5"
              r="0.8"
              fill="#FFFFFF"
            />
            
            {/* =============== KANATLAR - GERÇEKÇİ TÜY YAPISI =============== */}
            
            {/* SOL KANAT - Ana yapı */}
            <Path
              d="M 64 55 Q 45 48 28 45 Q 18 43 10 46"
              fill="url(#storkGradient)"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Sol kanat tüy detayları */}
            <Path
              d="M 50 50 L 46 52 M 40 48 L 36 50 M 30 46 L 26 48 M 20 45 L 16 47"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            <Path
              d="M 48 51 L 44 54 M 38 49 L 34 52 M 28 47 L 24 50"
              stroke="#2E8BC0"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
            
            {/* Sol kanat üst katman (parlak alan) */}
            <Path
              d="M 60 54 Q 50 51 40 49"
              stroke="#4AB8FF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* SAĞ KANAT - Ana yapı */}
            <Path
              d="M 64 55 Q 83 48 100 45 Q 110 43 118 46"
              fill="url(#storkGradient)"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Sağ kanat tüy detayları */}
            <Path
              d="M 78 50 L 82 52 M 88 48 L 92 50 M 98 46 L 102 48 M 108 45 L 112 47"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            <Path
              d="M 80 51 L 84 54 M 90 49 L 94 52 M 100 47 L 104 50"
              stroke="#2E8BC0"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
            
            {/* Sağ kanat üst katman (parlak alan) */}
            <Path
              d="M 68 54 Q 78 51 88 49"
              stroke="#4AB8FF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* =============== KUYRUK - DETAYLI =============== */}
            <Path
              d="M 60 78 Q 55 82 50 84 L 48 85"
              stroke={Colors.primary}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M 60 79 Q 56 81 52 83"
              stroke="#2E8BC0"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* Kuyruk tüyleri */}
            <Path
              d="M 54 82 L 51 85 M 52 83 L 49 86"
              stroke={Colors.primary}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
            
            {/* =============== BACAKLAR - UZUN VE İNCE =============== */}
            
            {/* Sol bacak */}
            <Path
              d="M 62 75 L 60 92 M 60 92 L 58 94 M 60 92 L 62 94"
              stroke="#FF6B35"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Sağ bacak */}
            <Path
              d="M 65 76 L 67 92 M 67 92 L 65 94 M 67 92 L 69 94"
              stroke="#FF6B35"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* =============== EK DETAYLAR =============== */}
            
            {/* Boyun detayı */}
            <Path
              d="M 66 48 Q 65 52 65 56"
              stroke="#4AB8FF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.5"
            />
            
            {/* Işık efekti (highlight) */}
            <Circle
              cx="66"
              cy="58"
              r="3"
              fill="#FFFFFF"
              opacity="0.3"
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
