import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Premium splash — kokpit navy + cyan aksan ( zamanlama / onFinish dokunulmaz ) */
const GRAD_TOP = '#08111F';
const GRAD_BOTTOM = '#0B1220';
const ACCENT_CYAN = '#22D3EE';
const TEXT_PRIMARY = 'rgba(243, 248, 255, 0.94)';
const TEXT_SUB = 'rgba(186, 201, 222, 0.88)';
const TEXT_DIM = 'rgba(148, 163, 184, 0.72)';
const GLASS_BORDER = 'rgba(34, 211, 238, 0.14)';
const GLASS_FILL = 'rgba(16, 26, 43, 0.42)';
const CYAN_SHADOW = 'rgba(34, 211, 238, 0.45)';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const hasCalledFinish = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const callFinish = () => {
    if (hasCalledFinish.current) return;
    hasCalledFinish.current = true;
    console.log('🎬 Splash screen bitti, login\'e geçiliyor...');
    onFinishRef.current();
  };

  useEffect(() => {
    console.log('🎬 SplashScreen mount edildi');

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

      setTimeout(() => {
        Animated.timing(taglineAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver,
        }).start();
      }, 450);
    } catch (error) {
      console.log('⚠️ Animasyon hatası:', error);
    }

    const finishTimer = setTimeout(() => {
      callFinish();
    }, 2500);

    const safetyTimer = setTimeout(() => {
      console.log('⚠️ Safety timeout - zorla çıkılıyor');
      callFinish();
    }, 4500);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount tek sefer giriş animasyonu (Animated.Value ref’leri)
  }, []);

  return (
    <LinearGradient colors={[GRAD_TOP, GRAD_BOTTOM]} style={styles.container} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoGlowWrap,
            Platform.OS !== 'web'
              ? {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                }
              : {},
          ]}
        >
          <Image
            source={require('../assets/images/leylek-logo-premium.png')}
            style={styles.logo}
            resizeMode="contain"
            onError={(e) => {
              console.log('⚠️ Splash image yüklenemedi:', e.nativeEvent.error);
              callFinish();
            }}
          />
        </Animated.View>

        <Animated.View style={[styles.glassPlate, Platform.OS !== 'web' ? { opacity: taglineAnim } : {}]}>
          <Text style={styles.headlineSoft} accessibilityRole="header">
            <Text style={styles.headlineLeylek}>Leylek </Text>
            <Text style={styles.headlineTag}>TAG</Text>
          </Text>
          <Text style={styles.mainSubtitle}>Güvenli Yolculuk Paylaşımı</Text>
          <Text style={styles.minorLine}>Güvenli • Ekonomik • Hızlı</Text>
        </Animated.View>
      </View>

      <View style={styles.loadingContainer}>
        <View style={styles.loadingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>

      <View style={styles.legalContainer}>
        <Text style={styles.legalText}>© 2026 Leylek TAG</Text>
        <Text style={styles.legalSubtext}>Tüm hakları saklıdır</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  logoGlowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH - 52,
    maxWidth: SCREEN_WIDTH - 52,
    minHeight: SCREEN_WIDTH * 0.54,
    ...Platform.select({
      ios: {
        shadowColor: CYAN_SHADOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 28,
      },
      android: {
        elevation: 14,
      },
      default: {},
    }),
  },
  logo: {
    width: SCREEN_WIDTH * 0.52,
    height: SCREEN_WIDTH * 0.52,
    maxWidth: SCREEN_WIDTH - 64,
    maxHeight: SCREEN_WIDTH * 0.56,
  },
  glassPlate: {
    marginTop: 28,
    width: '100%',
    maxWidth: 368,
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: GLASS_FILL,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  headlineSoft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  headlineLeylek: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  headlineTag: {
    fontSize: 28,
    fontWeight: '900',
    color: ACCENT_CYAN,
    letterSpacing: 0.6,
  },
  mainSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_SUB,
    letterSpacing: 0.35,
    textAlign: 'center',
    marginTop: 2,
  },
  minorLine: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_DIM,
    marginTop: 10,
    letterSpacing: 0.85,
    textAlign: 'center',
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
    gap: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ACCENT_CYAN,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  dot1: {
    opacity: 0.45,
  },
  dot2: {
    opacity: 0.72,
  },
  dot3: {
    opacity: 1,
  },
  loadingText: {
    fontSize: 11,
    color: TEXT_DIM,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  legalContainer: {
    position: 'absolute',
    bottom: 42,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  legalText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.55)',
    letterSpacing: 0.35,
  },
  legalSubtext: {
    fontSize: 10,
    color: 'rgba(148, 163, 184, 0.38)',
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
