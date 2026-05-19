import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Platform,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Premium splash — kokpit navy + cyan aksan ( zamanlama / onFinish dokunulmaz ) */
const GRAD_TOP = '#08111F';
const GRAD_MID = '#0A1524';
const GRAD_BOTTOM = '#0B1220';
const ACCENT_CYAN = '#22D3EE';
const TEXT_PRIMARY = 'rgba(243, 248, 255, 0.94)';
const TEXT_SUB = 'rgba(186, 201, 222, 0.82)';
const TEXT_DIM = 'rgba(148, 163, 184, 0.68)';
const GLASS_BORDER = 'rgba(34, 211, 238, 0.2)';
const GLASS_FILL = 'rgba(16, 26, 43, 0.48)';
const CYAN_SHADOW = 'rgba(34, 211, 238, 0.45)';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const SHORT_EDGE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
  /** Cinematic focal — width-only ~%52 yerine kısa kenara göre; “ikon büyütülmüş” hissini kırar */
  const LOGO_BOX = Math.round(
    Math.min(SHORT_EDGE * 0.34, SCREEN_WIDTH * 0.4, 168),
  );
  const LOADER_TRACK_W = Math.min(312, SCREEN_WIDTH - 40);
  const haloR = Math.round(LOGO_BOX * 0.58);
  const haloOuterR = Math.round(LOGO_BOX * 0.72);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const ambientGlow = useRef(new Animated.Value(0)).current;
  const shimmerPhase = useRef(new Animated.Value(0)).current;
  const dotPulse1 = useRef(new Animated.Value(0)).current;
  const dotPulse2 = useRef(new Animated.Value(0)).current;
  const dotPulse3 = useRef(new Animated.Value(0)).current;
  const loadingBreath = useRef(new Animated.Value(0)).current;
  const floorPulse = useRef(new Animated.Value(0)).current;
  const beamPulse = useRef(new Animated.Value(0)).current;
  const ringBreath = useRef(new Animated.Value(0)).current;
  const trackSheen = useRef(new Animated.Value(0)).current;
  const hasCalledFinish = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const bottomLoaderOffset = useMemo(
    () => Math.max(96, 72 + insets.bottom),
    [insets.bottom],
  );
  const bottomLegalOffset = useMemo(
    () => Math.max(28, 18 + insets.bottom),
    [insets.bottom],
  );

  const callFinish = () => {
    if (hasCalledFinish.current) return;
    hasCalledFinish.current = true;
    console.log('🎬 Splash screen bitti, login\'e geçiliyor...');
    onFinishRef.current();
  };

  useEffect(() => {
    console.log('🎬 SplashScreen mount edildi');

    const useNativeDriver = Platform.OS !== 'web';

    const startDotWave = (v: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(v, {
            toValue: 1,
            duration: 480,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 480,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    const dotLoop1 = startDotWave(dotPulse1, 0);
    const dotLoop2 = startDotWave(dotPulse2, 150);
    const dotLoop3 = startDotWave(dotPulse3, 300);

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerPhase, {
          toValue: 1,
          duration: 1650,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerPhase, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    const ambientLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientGlow, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambientGlow, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingBreath, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(loadingBreath, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const floorLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floorPulse, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floorPulse, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const beamLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(beamPulse, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beamPulse, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringBreath, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringBreath, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const sheenLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(trackSheen, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(trackSheen, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

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

    if (Platform.OS !== 'web') {
      dotLoop1.start();
      dotLoop2.start();
      dotLoop3.start();
      shimmerLoop.start();
      ambientLoop.start();
      breathLoop.start();
      floorLoop.start();
      beamLoop.start();
      ringLoop.start();
      sheenLoop.start();
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
      dotLoop1.stop();
      dotLoop2.stop();
      dotLoop3.stop();
      shimmerLoop.stop();
      ambientLoop.stop();
      breathLoop.stop();
      floorLoop.stop();
      beamLoop.stop();
      ringLoop.stop();
      sheenLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount tek sefer giriş animasyonu (Animated.Value ref’leri)
  }, []);

  const shimmerX = shimmerPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [-LOADER_TRACK_W * 0.5, LOADER_TRACK_W * 1.02],
  });

  const logoAmbientOpacity = ambientGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const ringScale = ringBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });
  const ringOpacity = ringBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.42],
  });

  const dotScale1 = dotPulse1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1.08],
  });
  const dotOpacity1 = dotPulse1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });
  const dotScale2 = dotPulse2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1.08],
  });
  const dotOpacity2 = dotPulse2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });
  const dotScale3 = dotPulse3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1.08],
  });
  const dotOpacity3 = dotPulse3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  const loadingLabelOpacity = loadingBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.76, 1],
  });

  const floorGlowOpacity = floorPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.85],
  });

  const beamOpacity = beamPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.95],
  });

  const trackAmbientOpacity = trackSheen.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <LinearGradient
      colors={[GRAD_TOP, GRAD_MID, GRAD_BOTTOM]}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Cinematic ambient — zemin bloom + üst vignette */}
      <View style={styles.cinematicLayer} pointerEvents="none">
        <LinearGradient
          colors={['rgba(34,211,238,0.07)', 'transparent', 'transparent']}
          locations={[0, 0.35, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.85, y: 0.55 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['transparent', 'rgba(8,17,31,0)', 'rgba(34,211,238,0.06)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View style={[styles.floorBloom, { opacity: floorGlowOpacity }]}>
          <LinearGradient
            colors={['transparent', 'rgba(34,211,238,0.09)', 'rgba(34,211,238,0.03)', 'transparent']}
            locations={[0, 0.35, 0.65, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        {/* Ince “road / radar” cephe çizgisi */}
        <View style={styles.hudHorizon} />
        <Animated.View style={[styles.cyanBeamWrap, { opacity: beamOpacity }]} pointerEvents="none">
          <LinearGradient
            colors={[
              'transparent',
              'rgba(34,211,238,0.06)',
              'rgba(34,211,238,0.14)',
              'rgba(34,211,238,0.06)',
              'transparent',
            ]}
            locations={[0, 0.2, 0.5, 0.8, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cyanBeam}
          />
        </Animated.View>
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoGlowWrap,
            { minHeight: Math.round(LOGO_BOX * 1.06), width: Math.min(SCREEN_WIDTH - 40, 380) },
            Platform.OS !== 'web'
              ? {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                }
              : {},
          ]}
        >
          {/* Dış halo — ayrı katman (glow / image ayrımı) */}
          <Animated.View
            style={[
              styles.logoHaloOuter,
              {
                width: haloOuterR * 2,
                height: haloOuterR * 2,
                borderRadius: haloOuterR,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
                top: '50%',
                left: '50%',
                marginTop: -haloOuterR,
                marginLeft: -haloOuterR,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.logoHaloInner,
              {
                width: haloR * 2,
                height: haloR * 2,
                borderRadius: haloR,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
                top: '50%',
                left: '50%',
                marginTop: -haloR,
                marginLeft: -haloR,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.logoInnerGlow,
              Platform.OS !== 'web'
                ? {
                    opacity: logoAmbientOpacity,
                  }
                : {},
            ]}
          >
            <Image
              source={require('../assets/images/leylek-logo-premium.png')}
              style={{ width: LOGO_BOX, height: LOGO_BOX }}
              resizeMode="contain"
              onError={(e) => {
                console.log('⚠️ Splash image yüklenemedi:', e.nativeEvent.error);
                callFinish();
              }}
            />
          </Animated.View>
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

      <View style={[styles.loadingContainer, { bottom: bottomLoaderOffset }]}>
        <View style={styles.loadingDotsRow}>
          <Animated.View
            style={[
              styles.dot,
              Platform.OS !== 'web'
                ? { opacity: dotOpacity1, transform: [{ scale: dotScale1 }] }
                : {},
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              Platform.OS !== 'web'
                ? { opacity: dotOpacity2, transform: [{ scale: dotScale2 }] }
                : {},
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              Platform.OS !== 'web'
                ? { opacity: dotOpacity3, transform: [{ scale: dotScale3 }] }
                : {},
            ]}
          />
        </View>

        <Animated.View style={[styles.shimmerTrack, { width: LOADER_TRACK_W, opacity: trackAmbientOpacity }]}>
          <LinearGradient
            colors={['rgba(8,17,31,0.65)', 'rgba(16,26,43,0.35)', 'rgba(8,17,31,0.55)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.shimmerTrackInner} />
          <Animated.View style={[styles.shimmerSlide, { transform: [{ translateX: shimmerX }] }]}>
            <LinearGradient
              colors={[
                'transparent',
                'rgba(34,211,238,0.1)',
                'rgba(34,211,238,0.75)',
                '#67E8F9',
                'rgba(34,211,238,0.75)',
                'rgba(34,211,238,0.1)',
                'transparent',
              ]}
              locations={[0, 0.12, 0.32, 0.5, 0.68, 0.88, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.shimmerGrad, { width: LOADER_TRACK_W * 0.58 }]}
            />
          </Animated.View>
        </Animated.View>

        <Animated.Text
          style={[
            styles.loadingText,
            Platform.OS !== 'web' ? { opacity: loadingLabelOpacity } : {},
          ]}
        >
          Yükleniyor
          <Text style={styles.loadingEllipsis}>...</Text>
        </Animated.Text>
      </View>

      <View style={[styles.legalContainer, { bottom: bottomLegalOffset }]}>
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
  cinematicLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  floorBloom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
  },
  hudHorizon: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '42%',
    height: StyleSheet.hairlineWidth + 1.25,
    borderRadius: 2,
    backgroundColor: 'rgba(34,211,238,0.07)',
    opacity: 0.85,
  },
  cyanBeamWrap: {
    position: 'absolute',
    left: '50%',
    marginLeft: -64,
    width: 128,
    top: '14%',
    bottom: '34%',
    alignItems: 'center',
  },
  cyanBeam: {
    width: 72,
    flex: 1,
    borderRadius: 36,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  logoGlowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: CYAN_SHADOW,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  logoHaloOuter: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(34,211,238,0.12)',
    backgroundColor: 'transparent',
  },
  logoHaloInner: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34,211,238,0.22)',
    backgroundColor: 'transparent',
  },
  logoInnerGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  glassPlate: {
    marginTop: 22,
    width: '100%',
    maxWidth: 360,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: GLASS_FILL,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: GLASS_BORDER,
    borderTopColor: 'rgba(34,211,238,0.28)',
    borderLeftColor: 'rgba(34,211,238,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.48,
        shadowRadius: 28,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  headlineSoft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    marginBottom: 6,
    letterSpacing: 0.35,
  },
  headlineLeylek: {
    fontSize: 27,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  headlineTag: {
    fontSize: 27,
    fontWeight: '900',
    color: ACCENT_CYAN,
    letterSpacing: 0.55,
  },
  mainSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SUB,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 21,
  },
  minorLine: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_DIM,
    marginTop: 10,
    letterSpacing: 0.75,
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingDotsRow: {
    flexDirection: 'row',
    gap: 11,
    marginBottom: 16,
    alignItems: 'center',
    height: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT_CYAN,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  shimmerTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: 'rgba(30,58,95,0.65)',
    backgroundColor: 'rgba(8,17,31,0.5)',
  },
  shimmerTrackInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,26,43,0.2)',
  },
  shimmerSlide: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  shimmerGrad: {
    height: 7,
    borderRadius: 4,
  },
  loadingText: {
    fontSize: 11,
    color: TEXT_SUB,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  loadingEllipsis: {
    color: ACCENT_CYAN,
    fontWeight: '900',
    letterSpacing: 0,
  },
  legalContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  legalText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(148, 163, 184, 0.58)',
    letterSpacing: 0.35,
  },
  legalSubtext: {
    fontSize: 10,
    color: 'rgba(148, 163, 184, 0.42)',
    marginTop: 3,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
