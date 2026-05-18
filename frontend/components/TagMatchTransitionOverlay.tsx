import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Normal TAG eşleşme — gösterim süresi (fade-out başlamadan önce tam opaklık). */
export const TAG_MATCH_TRANSITION_HOLD_MS = 3000;

const FADE_IN_MS = 420;
const FADE_OUT_MS = 440;

type Props = {
  /** false olduğunda içerik fade-out ile kapanır; iş mantığı üzerinde touch için pointerEvents kapatılır. */
  active: boolean;
};

/** Premium “Eşleşme sağlanıyor” tam ekran katmanı — yalnızca görsel; harita/state altında çalışmaya devam eder. */
export default function TagMatchTransitionOverlay({ active }: Props) {
  const gid = useId().replace(/:/g, '');
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const [renderLayer, setRenderLayer] = useState(active);

  useEffect(() => {
    if (active) {
      setRenderLayer(true);
      opacity.setValue(0);
      scale.setValue(0.94);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 78,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (renderLayer) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRenderLayer(false);
      });
    }
  }, [active, opacity, scale, renderLayer]);

  const ringRotate = useRef(new Animated.Value(0)).current;
  const ringRotateReverse = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const checkGlow = useRef(new Animated.Value(0.55)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (!renderLayer) return;

    const spin = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const spinRev = Animated.loop(
      Animated.timing(ringRotateReverse, {
        toValue: 1,
        duration: 32000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(checkGlow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(checkGlow, {
          toValue: 0.5,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerX, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    spin.start();
    spinRev.start();
    pulse.start();
    glow.start();
    shimmer.start();

    return () => {
      spin.stop();
      spinRev.stop();
      pulse.stop();
      glow.stop();
      shimmer.stop();
    };
  }, [renderLayer, ringRotate, ringRotateReverse, ringPulse, checkGlow, shimmerX]);

  const rotateInterpolate = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotateReverseInterpolate = ringRotateReverse.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const particleAnim = useParticleField(renderLayer);

  if (!renderLayer) return null;

  const touchBlock = active;
  return (
    <Animated.View
      pointerEvents={touchBlock ? 'auto' : 'none'}
      style={[styles.root, { opacity, transform: [{ scale }] }]}
    >
      <LinearGradient
        colors={['#08111F', '#0B1220', '#101A2B']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={['rgba(34,211,238,0.08)', 'transparent', 'rgba(8,17,31,0.35)']}
        locations={[0, 0.48, 1]}
        style={[StyleSheet.absoluteFillObject, { opacity: 0.95 }]}
        pointerEvents="none"
      />

      {particleAnim}

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [{ translateX: shimmerX.interpolate({ inputRange: [-1, 1], outputRange: [-SCREEN_W * 0.5, SCREEN_W * 0.5] }) }],
            opacity: 0.12,
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(34,211,238,0.18)', 'rgba(30,58,95,0.12)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: SCREEN_W * 0.55 }}
        />
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.titleWhite}>Eşleşme</Text>
          <Svg width={Math.min(SCREEN_W - 48, 280)} height={40}>
            <Defs>
              <SvgLinearGradient id={`titleGrad-${gid}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#22D3EE" />
                <Stop offset="0.55" stopColor="#7DD3FC" />
                <Stop offset="1" stopColor="rgba(241,245,249,0.94)" />
              </SvgLinearGradient>
            </Defs>
            <SvgText
              fill={`url(#titleGrad-${gid})`}
              fontSize={28}
              fontWeight="800"
              x="0"
              y="32"
            >
              sağlanıyor!
            </SvgText>
          </Svg>
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.ringsWrap}>
            <Animated.View
              style={{
                transform: [{ rotate: rotateReverseInterpolate }, { scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }],
              }}
            >
              <RainbowRings gid={`${gid}-outer`} variant="outer" />
            </Animated.View>
            <Animated.View
              style={[
                styles.ringsInner,
                {
                  transform: [{ rotate: rotateInterpolate }, { scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] }) }],
                },
              ]}
            >
              <RainbowRings gid={`${gid}-inner`} variant="inner" />
            </Animated.View>

            <Animated.View style={[styles.checkWrap, { shadowOpacity: checkGlow }]}>
              <LinearGradient
                colors={['rgba(34,211,238,0.22)', 'rgba(30,58,95,0.35)', 'rgba(8,17,31,0.6)']}
                style={styles.checkGlowGrad}
              />
              <View style={styles.checkInner}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
            </Animated.View>
          </View>
        </View>

        <Text style={styles.footer}>İyi yolculuklar!</Text>
      </View>
    </Animated.View>
  );
}

function RainbowRings({ gid, variant }: { gid: string; variant: 'outer' | 'inner' }) {
  const dim = variant === 'outer' ? 300 : 260;
  const cx = dim / 2;
  const cy = dim / 2;
  const a = `ringGradA-${gid}`;
  const b = `ringGradB-${gid}`;
  const outer = variant === 'outer';
  return (
    <Svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
      <Defs>
        <SvgLinearGradient id={a} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#22D3EE" />
          <Stop offset="0.35" stopColor="#1E3A5F" />
          <Stop offset="0.55" stopColor="#38BDF8" />
          <Stop offset="0.8" stopColor="#0EA5E9" />
          <Stop offset="1" stopColor="rgba(15,118,223,0.85)" />
        </SvgLinearGradient>
        <SvgLinearGradient id={b} x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="rgba(56,189,248,0.75)" />
          <Stop offset="0.35" stopColor="#1E3A5F" />
          <Stop offset="0.65" stopColor="#22D3EE" />
          <Stop offset="1" stopColor="rgba(16,26,43,0.9)" />
        </SvgLinearGradient>
      </Defs>
      <G opacity={outer ? 0.88 : 0.95}>
        <Circle
          cx={cx}
          cy={cy}
          r={outer ? cx - 12 : cx - 14}
          stroke={`url(#${a})`}
          strokeWidth={outer ? 6 : 5}
          strokeDasharray={outer ? '26 20' : '22 18'}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={outer ? cx - 36 : cx - 38}
          stroke={`url(#${b})`}
          strokeWidth={outer ? 5 : 4}
          strokeDasharray={outer ? '18 16' : '16 14'}
          fill="none"
          opacity={0.92}
        />
        {!outer ? (
          <Circle
            cx={cx}
            cy={cy}
            r={cx - 58}
            stroke={`url(#${a})`}
            strokeWidth={3}
            strokeDasharray="12 10"
            fill="none"
            opacity={0.85}
          />
        ) : null}
      </G>
    </Svg>
  );
}

function useParticleField(active: boolean) {
  const nodes = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        key: i,
        left: 12 + ((i * 53) % Math.max(40, SCREEN_W - 40)),
        top: SCREEN_H * 0.06 + ((i * 71) % Math.max(80, SCREEN_H * 0.55)),
        delay: (i * 180) % 2400,
        scale: 0.6 + ((i * 7) % 10) / 25,
      })),
    [],
  );

  const anims = useMemo(
    () => Array.from({ length: 36 }, () => new Animated.Value(0.15)),
    [],
  );

  useEffect(() => {
    if (!active) return;
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(nodes[i].delay % 1200),
          Animated.timing(v, {
            toValue: 0.95,
            duration: 1600 + (i % 5) * 120,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.12,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, anims, nodes]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {nodes.map((n, i) => {
        const palette = [
          '#22D3EE',
          'rgba(34,211,238,0.55)',
          '#38BDF8',
          'rgba(56,189,248,0.45)',
          'rgba(186,201,222,0.35)',
        ];
        const c = palette[i % palette.length];
        return (
          <Animated.View
            key={n.key}
            style={[
              styles.spark,
              {
                left: n.left,
                top: n.top,
                backgroundColor: c,
                opacity: anims[i],
                transform: [
                  {
                    scale: anims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [n.scale * 0.7, n.scale * 1.4],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: SCREEN_W,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleWhite: {
    color: 'rgba(243,248,255,0.94)',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  heroBlock: {
    width: Math.min(SCREEN_W - 24, 360),
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ringsInner: {
    position: 'absolute',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkWrap: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 12,
    zIndex: 10,
  },
  checkGlowGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 38,
  },
  checkInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(8,17,31,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: '#1E3A5F',
    borderTopColor: 'rgba(34,211,238,0.35)',
  },
  checkMark: {
    color: 'rgba(34,211,238,0.98)',
    fontSize: 30,
    fontWeight: '900',
    marginTop: -2,
  },
  footer: {
    marginTop: 28,
    color: 'rgba(186,201,222,0.88)',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  spark: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
