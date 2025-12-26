import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const hasFinished = useRef(false);

  // Callback'i memoize et
  const handleFinish = useCallback(() => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    console.log('🎬 Splash screen tamamlandı, login sayfasına geçiliyor...');
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    console.log('🎬 Splash screen başlatıldı');
    
    // Logo animasyonu
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Yazı animasyonu (biraz gecikmeyle)
    const textTimer = setTimeout(() => {
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }, 500);

    // 3 saniye sonra giriş sayfasına geç - daha güvenilir
    const finishTimer = setTimeout(handleFinish, 3000);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(finishTimer);
    };
  }, [handleFinish]);

  return (
    <View style={styles.container}>
      {/* Leylek Logosu */}
      <Animated.View 
        style={[
          styles.logoContainer,
          Platform.OS !== 'web' ? {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          } : {}
        ]}
      >
        <Image
          source={require('../assets/images/leylek-splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Leylek Yazısı - Mavi */}
      <Animated.View style={[
        styles.textContainer, 
        Platform.OS !== 'web' ? { opacity: textFadeAnim } : {}
      ]}>
        <Text style={styles.brandText}>Leylek</Text>
      </Animated.View>

      {/* Alt yükleniyor göstergesi */}
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  brandText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#3FA9F5',
    letterSpacing: 4,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3FA9F5',
  },
});
