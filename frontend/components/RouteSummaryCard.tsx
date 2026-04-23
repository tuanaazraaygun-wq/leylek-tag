import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';

const ACCENT = '#007AFF';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6E6E73';
const CARD_BG = '#FFFFFF';

const PREMIUM_ENTRANCE = Easing.bezier(0.22, 1, 0.36, 1);
const ENTRANCE_MS = 350;
const PRESS_MS = 120;
const PRESS_EASE = Easing.out(Easing.cubic);
const PULSE_MS = 2500;
const PULSE_EASE = Easing.inOut(Easing.ease);

export type RouteSummaryPayload = {
  match_count: number;
  route: string | null;
  has_group: boolean;
  group_id: string | null;
};

export type RouteSummaryCardProps = {
  apiBaseUrl: string;
  accessToken: string | null | undefined;
  /** Token yoksa istek atılmaz */
  enabled?: boolean;
  onNavigateToGroup: (groupId: string) => void;
  onNavigateToRouteSetup: () => void;
  /** Yatay kenar boşluğu (ScrollView içi ile hizalı) */
  horizontalInset?: number;
};

function ctaLabelFromSummary(s: RouteSummaryPayload | null): string {
  if (!s) return '';
  return s.has_group && s.group_id ? 'Gruba Git →' : 'Keşfet →';
}

export default function RouteSummaryCard({
  apiBaseUrl,
  accessToken,
  enabled = true,
  onNavigateToGroup,
  onNavigateToRouteSetup,
  horizontalInset = 16,
}: RouteSummaryCardProps) {
  const tok = (accessToken || '').trim();
  const [summary, setSummary] = useState<RouteSummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  /** İki katman: cross-fade sırasında setState animasyon ortasında olmaz */
  const [ctaTexts, setCtaTexts] = useState<[string, string]>(['', '']);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressOpacity = useRef(new Animated.Value(1)).current;
  const breatheScale = useRef(new Animated.Value(1)).current;
  const breatheOpacity = useRef(new Animated.Value(1)).current;
  const ctaOp0 = useRef(new Animated.Value(1)).current;
  const ctaOp1 = useRef(new Animated.Value(0)).current;

  const lastCtaRef = useRef<string | null>(null);
  const activeCtaLayerRef = useRef<0 | 1>(0);
  const ctaAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const ctaLabelRef = useRef('');
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const ctaLabel = ctaLabelFromSummary(summary);
  ctaLabelRef.current = ctaLabel;

  useEffect(() => {
    if (!enabled || !tok) {
      setSummary(null);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const base = apiBaseUrl.replace(/\/$/, '');
        const r = await fetch(`${base}/routes/summary`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!alive) return;
        if (!r.ok) {
          setSummary(null);
          return;
        }
        const j = (await r.json()) as RouteSummaryPayload;
        if (!alive) return;
        if (
          typeof j.match_count !== 'number' ||
          typeof j.has_group !== 'boolean' ||
          !('route' in j) ||
          !('group_id' in j)
        ) {
          setSummary(null);
          return;
        }
        setSummary(j);
      } catch {
        if (alive) setSummary(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled, tok, apiBaseUrl]);

  useEffect(() => {
    if (summary === null) {
      opacity.setValue(0);
      translateY.setValue(20);
      scale.setValue(0.96);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(20);
    scale.setValue(0.96);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTRANCE_MS,
        easing: PREMIUM_ENTRANCE,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTRANCE_MS,
        easing: PREMIUM_ENTRANCE,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: ENTRANCE_MS,
        easing: PREMIUM_ENTRANCE,
        useNativeDriver: true,
      }),
    ]).start();
  }, [summary]);

  useEffect(() => {
    if (!summary || summary.match_count <= 0) {
      pulseAnimRef.current?.stop?.();
      pulseAnimRef.current = null;
      breatheScale.setValue(1);
      breatheOpacity.setValue(1);
      return;
    }

    pulseAnimRef.current?.stop?.();
    breatheScale.setValue(1);
    breatheOpacity.setValue(1);

    const half = PULSE_MS / 2;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(breatheScale, {
            toValue: 1.01,
            duration: half,
            easing: PULSE_EASE,
            useNativeDriver: true,
          }),
          Animated.timing(breatheScale, {
            toValue: 1,
            duration: half,
            easing: PULSE_EASE,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(breatheOpacity, {
            toValue: 0.98,
            duration: half,
            easing: PULSE_EASE,
            useNativeDriver: true,
          }),
          Animated.timing(breatheOpacity, {
            toValue: 1,
            duration: half,
            easing: PULSE_EASE,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseAnimRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      breatheScale.setValue(1);
      breatheOpacity.setValue(1);
      pulseAnimRef.current = null;
    };
  }, [summary]);

  useEffect(() => {
    if (!ctaLabel) {
      ctaAnimRef.current?.stop?.();
      ctaAnimRef.current = null;
      lastCtaRef.current = null;
      activeCtaLayerRef.current = 0;
      setCtaTexts(['', '']);
      ctaOp0.setValue(1);
      ctaOp1.setValue(0);
      return;
    }

    if (lastCtaRef.current === null) {
      lastCtaRef.current = ctaLabel;
      activeCtaLayerRef.current = 0;
      setCtaTexts([ctaLabel, ctaLabel]);
      ctaOp0.setValue(1);
      ctaOp1.setValue(0);
      return;
    }

    if (lastCtaRef.current === ctaLabel) return;

    const from = lastCtaRef.current;
    const to = ctaLabel;

    if (ctaAnimRef.current) {
      ctaAnimRef.current.stop();
      ctaAnimRef.current = null;
    }

    const active = activeCtaLayerRef.current;
    const inactive = (1 - active) as 0 | 1;

    setCtaTexts((prev) => {
      const next: [string, string] = [...prev] as [string, string];
      next[active] = from;
      next[inactive] = to;
      return next;
    });

    if (active === 0) {
      ctaOp0.setValue(1);
      ctaOp1.setValue(0);
    } else {
      ctaOp0.setValue(0);
      ctaOp1.setValue(1);
    }

    const fadeOutLayer = active === 0 ? ctaOp0 : ctaOp1;
    const fadeInLayer = active === 0 ? ctaOp1 : ctaOp0;

    const runSequence = () => {
      const anim = Animated.sequence([
        Animated.timing(fadeOutLayer, {
          toValue: 0,
          duration: 80,
          easing: PRESS_EASE,
          useNativeDriver: true,
        }),
        Animated.timing(fadeInLayer, {
          toValue: 1,
          duration: 150,
          easing: PRESS_EASE,
          useNativeDriver: true,
        }),
      ]);
      ctaAnimRef.current = anim;
      anim.start(({ finished }) => {
        if (ctaAnimRef.current === anim) {
          ctaAnimRef.current = null;
        }
        if (finished) {
          lastCtaRef.current = to;
          activeCtaLayerRef.current = inactive;
        }
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(runSequence);
    });
  }, [ctaLabel]);

  const onPressIn = () => {
    Animated.parallel([
      Animated.timing(pressScale, {
        toValue: 0.98,
        duration: PRESS_MS,
        easing: PRESS_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(pressOpacity, {
        toValue: 0.96,
        duration: PRESS_MS,
        easing: PRESS_EASE,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.timing(pressScale, {
        toValue: 1,
        duration: PRESS_MS,
        easing: PRESS_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(pressOpacity, {
        toValue: 1,
        duration: PRESS_MS,
        easing: PRESS_EASE,
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (!enabled || !tok) return null;
  if (loading || summary === null) {
    return null;
  }

  const hasRoute = !!(summary.route && summary.route.trim());
  const mainLine = hasRoute
    ? summary.route!.trim()
    : 'Rota ekle → insanları bul';
  const subLine =
    summary.match_count > 0
      ? `Bugün ${summary.match_count} kişi bu rotada`
      : 'Henüz kimse yok';
  const subEmphasis = summary.match_count > 0;

  const onPressCta = () => {
    if (summary.has_group && summary.group_id) {
      onNavigateToGroup(summary.group_id);
    } else {
      onNavigateToRouteSetup();
    }
  };

  const combinedScale = Animated.multiply(
    Animated.multiply(scale, pressScale),
    breatheScale
  );
  const rootOpacity = Animated.multiply(
    Animated.multiply(opacity, pressOpacity),
    breatheOpacity
  );

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPressCta}
      style={[styles.pressableRoot, { marginHorizontal: horizontalInset }]}
      accessibilityRole="button"
      accessibilityLabel={ctaLabel}
    >
      <Animated.View
        style={[
          styles.shadowWrap,
          {
            opacity: rootOpacity,
            transform: [{ translateY }, { scale: combinedScale }],
          },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Senin Güzergahın</Text>
          {hasRoute ? (
            <View style={styles.mainRow}>
              <Text style={styles.routePin} accessible={false}>
                📍
              </Text>
              <Text style={[styles.main, styles.mainRoute]} numberOfLines={2}>
                {mainLine}
              </Text>
            </View>
          ) : (
            <Text style={[styles.main, styles.mainMuted]} numberOfLines={2}>
              {mainLine}
            </Text>
          )}
          <Text style={[styles.sub, subEmphasis && styles.subEmphasis]}>{subLine}</Text>
          <View style={styles.divider} />
          <View style={styles.ctaSlot}>
            <View style={styles.ctaLayer} pointerEvents="none">
              <Animated.Text style={[styles.ctaText, { opacity: ctaOp0 }]} numberOfLines={1}>
                {ctaTexts[0]}
              </Animated.Text>
            </View>
            <View style={styles.ctaLayer} pointerEvents="none">
              <Animated.Text style={[styles.ctaText, { opacity: ctaOp1 }]} numberOfLines={1}>
                {ctaTexts[1]}
              </Animated.Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableRoot: {
    marginBottom: 18,
  },
  shadowWrap: {
    borderRadius: 20,
    backgroundColor: CARD_BG,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 0,
    paddingVertical: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routePin: {
    fontSize: 17,
    lineHeight: 28,
    marginRight: 8,
    marginTop: 1,
  },
  main: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: TEXT_PRIMARY,
    lineHeight: 28,
    marginBottom: 8,
  },
  mainRoute: {
    flex: 1,
    flexShrink: 1,
    marginBottom: 0,
  },
  mainMuted: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    lineHeight: 22,
  },
  sub: {
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  subEmphasis: {
    fontWeight: '600',
    color: '#3A3A3C',
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEFF4',
    marginTop: 16,
    marginBottom: 12,
  },
  ctaSlot: {
    position: 'relative',
    minHeight: 26,
    minWidth: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  ctaLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '600',
    color: ACCENT,
    letterSpacing: -0.2,
    textAlign: 'center',
    width: '100%',
  },
});
