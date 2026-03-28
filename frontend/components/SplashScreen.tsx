import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tek renk - çok açık mavi/beyaz tonu (leylek arka planı ile aynı)
const BACKGROUND_COLOR = '#FFFFFF';
// Koyu mavi (yazılar için)
const DARK_BLUE = '#1E5F8A';
const PRIMARY_BLUE = '#3FA9F5';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const hasCalledFinish = useRef(false);

  const callFinish = () => {
    if (hasCalledFinish.current) return;
    hasCalledFinish.current = true;
    console.log('🎬 Splash screen bitti, login\'e geçiliyor...');
    onFinish();
  };

  useEffect(() => {
    console.log('🎬 SplashScreen mount edildi');
    
    const useNativeDriver = Platform.OS !== 'web';
    
    try {
      // Logo animasyonu
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

      // "Leylek" yazı animasyonu
      setTimeout(() => {
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver,
        }).start();
      }, 400);

      // Tagline animasyonu
      setTimeout(() => {
        Animated.timing(taglineAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver,
        }).start();
      }, 700);

    } catch (error) {
      console.log('⚠️ Animasyon hatası:', error);
    }

    const finishTimer = setTimeout(() => {
      callFinish();
    }, 2000);

    const safetyTimer = setTimeout(() => {
      console.log('⚠️ Safety timeout - zorla çıkılıyor');
      callFinish();
    }, 3500);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Ana içerik */}
      <View style={styles.content}>
        {/* Leylek Logosu - çerçevesiz */}
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
              callFinish();
            }}
          />
        </Animated.View>

        {/* Leylek TAG Yazısı */}
        <Animated.View style={[
          styles.textContainer, 
          Platform.OS !== 'web' ? { opacity: textFadeAnim } : {}
        ]}>
          <Text style={styles.brandText}>Leylek</Text>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>TAG</Text>
          </View>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[
          styles.taglineContainer,
          Platform.OS !== 'web' ? { opacity: taglineAnim } : {}
        ]}>
          <Text style={styles.taglineText}>Paylaşımlı Yolculuk Platformu</Text>
          <Text style={styles.subtitleText}>Güvenli • Ekonomik • Hızlı</Text>
        </Animated.View>
      </View>

      {/* Yükleniyor göstergesi */}
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>

      {/* Hukuki bilgi */}
      <View style={styles.legalContainer}>
        <Text style={styles.legalText}>© 2026 Leylek Tag</Text>
        <Text style={styles.legalSubtext}>Tüm hakları saklıdır</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    // Arka plan yok, çerçeve yok
  },
  logo: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  brandText: {
    fontSize: 44,
    fontWeight: '800',
    color: DARK_BLUE,
    letterSpacing: 2,
  },
  tagBadge: {
    backgroundColor: DARK_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 4,
  },
  tagText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  taglineText: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_BLUE,
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7C8A',
    marginTop: 6,
    letterSpacing: 1,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY_BLUE,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  loadingText: {
    fontSize: 12,
    color: '#8CA0B3',
    fontWeight: '500',
  },
  legalContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 12,
    fontWeight: '600',
    color: DARK_BLUE,
    opacity: 0.7,
  },
  legalSubtext: {
    fontSize: 10,
    color: '#8CA0B3',
    marginTop: 2,
  },
});
