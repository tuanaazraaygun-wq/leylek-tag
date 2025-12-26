import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const hasCalledFinish = useRef(false);

  const callFinish = () => {
    if (hasCalledFinish.current) return;
    hasCalledFinish.current = true;
    console.log('🎬 Splash screen bitti, login\'e geçiliyor...');
    onFinish();
  };

  useEffect(() => {
    console.log('🎬 SplashScreen mount edildi');
    
    // Animasyonları başlat - Platform kontrolü ile
    const useNativeDriver = Platform.OS !== 'web';
    
    try {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver,
        }),
      ]).start();

      // Yazı animasyonu
      setTimeout(() => {
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver,
        }).start();
      }, 500);
    } catch (error) {
      console.log('⚠️ Animasyon hatası:', error);
    }

    // 3 saniye sonra çık - BU EN ÖNEMLİ KISIM
    const finishTimer = setTimeout(() => {
      callFinish();
    }, 3000);

    // Güvenlik: 5 saniye sonra zorla çık
    const safetyTimer = setTimeout(() => {
      console.log('⚠️ Safety timeout - zorla çıkılıyor');
      callFinish();
    }, 5000);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

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
          onError={(e) => {
            console.log('⚠️ Splash image yüklenemedi:', e.nativeEvent.error);
            // Image yüklenemezse hemen çık
            callFinish();
          }}
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
