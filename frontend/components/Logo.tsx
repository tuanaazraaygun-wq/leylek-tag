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
      {/* ULTRA GERÇEKÇİ UÇAN LEYLEK LOGOSU - Doğal Kanat Pozisyonu */}
      <View style={[styles.logoContainer, { width: currentSize.icon, height: currentSize.icon }]}>
        <Svg
          width={currentSize.icon}
          height={currentSize.icon}
          viewBox="0 0 160 140"
          fill="none"
        >
          <Defs>
            {/* Ana gövde gradient */}
            <LinearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#4AB8FF" stopOpacity="1" />
              <Stop offset="40%" stopColor={Colors.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor="#2E8BC0" stopOpacity="1" />
            </LinearGradient>
            
            {/* Kanat gradient - daha koyu */}
            <LinearGradient id="wingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#4AB8FF" stopOpacity="0.9" />
              <Stop offset="50%" stopColor={Colors.primary} stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#2E8BC0" stopOpacity="1" />
            </LinearGradient>
            
            {/* Gölge */}
            <LinearGradient id="shadowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          
          <G>
            {/* ==================== GÖLGE ==================== */}
            <Ellipse
              cx="80"
              cy="95"
              rx="40"
              ry="6"
              fill="url(#shadowGrad)"
              opacity="0.3"
            />
            
            {/* ==================== UZUN BOYUN & GÖVDE (Gerçekçi Anatomi) ==================== */}
            
            {/* Gövde - Elips şeklinde gerçekçi */}
            <Ellipse
              cx="75"
              cy="65"
              rx="8"
              ry="14"
              fill="url(#bodyGradient)"
              stroke={Colors.primary}
              strokeWidth="0.5"
            />
            
            {/* Göğüs bölgesi - daha şişkin */}
            <Ellipse
              cx="76"
              cy="60"
              rx="9"
              ry="10"
              fill="url(#bodyGradient)"
              opacity="0.9"
            />
            
            {/* Uzun ince boyun */}
            <Path
              d="M 76 52 Q 77 56 76 60"
              fill="url(#bodyGradient)"
              stroke={Colors.primary}
              strokeWidth="2.5"
            />
            
            {/* Boyun detay çizgisi */}
            <Path
              d="M 77 52 Q 78 56 78 59"
              stroke="#4AB8FF"
              strokeWidth="1"
              opacity="0.5"
            />
            
            {/* ==================== BAŞ & GAGA (Gerçekçi) ==================== */}
            
            {/* Baş - Hafif oval */}
            <Ellipse
              cx="78"
              cy="48"
              rx="5"
              ry="6"
              fill="url(#bodyGradient)"
              stroke={Colors.primary}
              strokeWidth="1"
            />
            
            {/* Uzun leylek gagası - İki parçalı */}
            <Path
              d="M 82 47 L 98 43"
              stroke="#FF6B35"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <Path
              d="M 82 49 L 97 45"
              stroke="#FF8855"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            
            {/* Gaga detayı */}
            <Path
              d="M 82 48 L 87 46"
              stroke="#CC5528"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* Göz - Gerçekçi */}
            <Circle
              cx="80"
              cy="47"
              r="2"
              fill="#1B1B1E"
            />
            <Circle
              cx="80.6"
              cy="46.5"
              r="0.7"
              fill="#FFFFFF"
            />
            
            {/* ==================== KANATLAR - DOĞAL POZİSYON (Daha Dar Açılı) ==================== */}
            
            {/* SOL KANAT - Hafif yukarı ama daha dar */}
            
            {/* Ana kanat kemiği */}
            <Path
              d="M 75 58 Q 60 56 45 55 Q 35 54 28 56"
              fill="url(#wingGradient)"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
            />
            
            {/* Birincil uçuş tüyleri (uzun) */}
            <Path
              d="M 60 56 L 57 60 M 52 55 L 49 59 M 44 55 L 41 59 M 36 55 L 33 59 M 30 56 L 27 60"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            
            {/* İkincil tüyler (kısa) */}
            <Path
              d="M 58 57 L 56 62 M 50 56 L 48 61 M 42 56 L 40 61 M 34 56 L 32 61"
              stroke="#2E8BC0"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* Kanat üst highlight */}
            <Path
              d="M 72 58 Q 62 57 52 56"
              stroke="#4AB8FF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
            
            {/* Omuz bağlantısı */}
            <Path
              d="M 74 58 Q 70 59 68 60"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
            
            {/* SAĞ KANAT - Hafif yukarı ama daha dar */}
            
            {/* Ana kanat kemiği */}
            <Path
              d="M 77 58 Q 92 56 107 55 Q 117 54 124 56"
              fill="url(#wingGradient)"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
            />
            
            {/* Birincil uçuş tüyleri (uzun) */}
            <Path
              d="M 92 56 L 95 60 M 100 55 L 103 59 M 108 55 L 111 59 M 116 55 L 119 59 M 122 56 L 125 60"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            
            {/* İkincil tüyler (kısa) */}
            <Path
              d="M 94 57 L 96 62 M 102 56 L 104 61 M 110 56 L 112 61 M 118 56 L 120 61"
              stroke="#2E8BC0"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.6"
            />
            
            {/* Kanat üst highlight */}
            <Path
              d="M 80 58 Q 90 57 100 56"
              stroke="#4AB8FF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
            
            {/* Omuz bağlantısı */}
            <Path
              d="M 78 58 Q 82 59 84 60"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
            
            {/* ==================== KUYRUK - GERÇEKÇİ AÇILIŞ ==================== */}
            
            {/* Ana kuyruk yapısı */}
            <Path
              d="M 74 78 Q 70 84 67 88"
              fill="url(#wingGradient)"
              stroke={Colors.primary}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            
            {/* Kuyruk tüyleri - yelpaze şeklinde */}
            <Path
              d="M 72 80 L 69 88 M 73 81 L 71 89 M 74 82 L 73 90"
              stroke={Colors.primary}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />
            
            {/* Kuyruk detayları */}
            <Path
              d="M 71 82 L 68 90 M 72 83 L 70 91"
              stroke="#2E8BC0"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.5"
            />
            
            {/* ==================== BACAKLAR - İNCE VE UZUN ==================== */}
            
            {/* Sol bacak */}
            <Path
              d="M 73 78 L 70 95"
              stroke="#FF6B35"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Sol ayak parmakları */}
            <Path
              d="M 70 95 L 68 98 M 70 95 L 70 98 M 70 95 L 72 98"
              stroke="#FF6B35"
              strokeWidth="2"
              strokeLinecap="round"
            />
            
            {/* Sağ bacak */}
            <Path
              d="M 77 78 L 80 95"
              stroke="#FF6B35"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Sağ ayak parmakları */}
            <Path
              d="M 80 95 L 78 98 M 80 95 L 80 98 M 80 95 L 82 98"
              stroke="#FF6B35"
              strokeWidth="2"
              strokeLinecap="round"
            />
            
            {/* Bacak detayı (eklem) */}
            <Path
              d="M 73 86 L 73 87 M 77 86 L 77 87"
              stroke="#CC5528"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            
            {/* ==================== DETAYLAR ==================== */}
            
            {/* Işık efekti - göğüs */}
            <Ellipse
              cx="77"
              cy="62"
              rx="3"
              ry="4"
              fill="#FFFFFF"
              opacity="0.25"
            />
            
            {/* Gövde çizgileri (anatomi) */}
            <Path
              d="M 75 62 Q 76 65 76 68"
              stroke="#2E8BC0"
              strokeWidth="1"
              opacity="0.4"
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
