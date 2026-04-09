import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/Colors';
import {
  shouldShowLeylekZekaFab,
  useLeylekZekaChrome,
} from '../contexts/LeylekZekaChromeContext';
import { useLeylekZeka } from '../hooks/useLeylekZeka';
import {
  getContextualPillLine,
  getMiniHintPool,
  pickNextSequential,
} from '../lib/leylekZekaUxCopy';

const LeylekZekaChat = React.lazy(() => import('./LeylekZekaChat'));

/** Premium mascot tile: yumuşak köşe (daire değil, sert kare de değil) */
const FAB_SIZE = 68;
const LOGO_SIZE = 44;
const FAB_CORNER = 23;
const EDGE_PAD = 10;
const POS_KEY = 'leylek_zeka_fab_rb_v1';
/** UX tuning — açıklama: frontend/docs/LEYLEK_ZEKA_UX_TUNING.md */
const BOUNCE_GAP_MIN_MS = 16000;
const BOUNCE_GAP_MAX_MS = 24000;
/** Bağlamsal pill: her N bounce’ta bir (büyüt = daha seyrek). */
const CONTEXTUAL_PILL_EVERY_N_BOUNCES = 3;
/** Varsayılan konum: alttan biraz yukarı (CTA ile çakışmayı azaltır). */
const FAB_DEFAULT_EXTRA_BOTTOM_PX = 14;
/** Varsayılan konum: sağdan hafif içeri (köşe/CTA). */
const FAB_DEFAULT_EXTRA_RIGHT_PX = 4;
const BOUNCE_DIP_PX = -6;
const PILL_FADE_IN_MS = 300;
const PILL_HOLD_MS = 2200;
const PILL_FADE_OUT_MS = 300;
const PILL_ENTER_OFFSET_PX = 5;
const PILL_EXIT_DRIFT_PX = -6;
const IDLE_CHECK_MS = 8000;
const IDLE_AFTER_MIN_MS = 20000;
const IDLE_AFTER_MAX_MS = 30000;
const IDLE_COOLDOWN_MS = 90000;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function nextBounceGapMs(): number {
  const span = BOUNCE_GAP_MAX_MS - BOUNCE_GAP_MIN_MS + 1;
  return BOUNCE_GAP_MIN_MS + Math.floor(Math.random() * span);
}

function nextIdleThresholdMs(): number {
  return IDLE_AFTER_MIN_MS + Math.random() * (IDLE_AFTER_MAX_MS - IDLE_AFTER_MIN_MS);
}

type GlowVariant = 'normal' | 'attention' | 'idle';

const LeylekZekaWidget = memo(function LeylekZekaWidget() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { homeFlowScreen, flowHint } = useLeylekZekaChrome();
  const [open, setOpen] = useState(false);
  const { messages, isTyping, error, sendMessage, clearError, lastReplySource } = useLeylekZeka();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const { width: winW, height: winH } = Dimensions.get('window');

  const [pillLabel, setPillLabel] = useState("Leylek'e sor");
  const [glowVariant, setGlowVariant] = useState<GlowVariant>('normal');
  const [idleHintText, setIdleHintText] = useState('');

  const bounceCycleRef = useRef(0);
  const homeRef = useRef(homeFlowScreen);
  const hintRef = useRef(flowHint);
  homeRef.current = homeFlowScreen;
  hintRef.current = flowHint;

  const lastInteractionRef = useRef(Date.now());
  const idleCooldownUntilRef = useRef(0);
  const idleThresholdRef = useRef(nextIdleThresholdMs());
  const lastMiniHintRef = useRef<string | null>(null);
  const idleAnimRunningRef = useRef(false);

  const idleHintOpacity = useRef(new Animated.Value(0)).current;

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setGlowVariant((g) => (g === 'idle' ? 'normal' : g));
  }, []);

  const defaultPos = useMemo(() => {
    const r = Math.max(insets.right, EDGE_PAD) + Spacing.sm + FAB_DEFAULT_EXTRA_RIGHT_PX;
    const b = Math.max(insets.bottom, EDGE_PAD) + Spacing.md + FAB_DEFAULT_EXTRA_BOTTOM_PX;
    return { r, b };
  }, [insets.bottom, insets.right]);

  const [pos, setPos] = useState(defaultPos);
  const posLatest = useRef(pos);
  const rightAnim = useRef(new Animated.Value(defaultPos.r)).current;
  const isSnapping = useRef(false);
  useEffect(() => {
    posLatest.current = pos;
  }, [pos]);

  useEffect(() => {
    if (!isSnapping.current) {
      rightAnim.setValue(pos.r);
    }
  }, [pos.r, rightAnim]);

  const clampPos = useCallback(
    (r: number, b: number) => {
      const w = Dimensions.get('window').width;
      const h = Dimensions.get('window').height;
      const minR = insets.right + EDGE_PAD;
      const minB = insets.bottom + EDGE_PAD;
      const maxR = w - FAB_SIZE - insets.left - EDGE_PAD;
      const maxB = h - FAB_SIZE - insets.top - EDGE_PAD;
      return { r: clamp(r, minR, maxR), b: clamp(b, minB, maxB) };
    },
    [insets.bottom, insets.left, insets.right, insets.top],
  );

  useEffect(() => {
    setPos((p) => clampPos(p.r, p.b));
  }, [clampPos, winW, winH]);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (!cancelled) setReduceMotion(Boolean(v));
    });
    const sub =
      'addEventListener' in AccessibilityInfo
        ? AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
            setReduceMotion(Boolean(v));
          })
        : undefined;
    return () => {
      cancelled = true;
      if (sub && 'remove' in sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, () => setKeyboardUp(true));
    const hide = Keyboard.addListener(hideEv, () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(POS_KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const j = JSON.parse(raw) as { r?: number; b?: number };
        if (typeof j.r === 'number' && typeof j.b === 'number') {
          setPos(clampPos(j.r, j.b));
        }
      } catch {
        /* ignore */
      }
    });
    return () => {
      alive = false;
    };
  }, [clampPos]);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setPos((p) => clampPos(p.r, p.b));
    });
    return () => sub.remove();
  }, [clampPos]);

  const persistPos = useCallback(() => {
    const { r, b } = posLatest.current;
    void AsyncStorage.setItem(POS_KEY, JSON.stringify({ r, b })).catch(() => {});
  }, []);

  const dragStart = useRef({ r: 0, b: 0, x0: 0, y0: 0 });

  const runEdgeSnapAndPersist = useCallback(() => {
    markInteraction();
    const w = Dimensions.get('window').width;
    const r0 = posLatest.current.r;
    const b0 = posLatest.current.b;
    const minR = insets.right + EDGE_PAD;
    const maxR = w - FAB_SIZE - insets.left - EDGE_PAD;
    const fabCenterX = w - r0 - FAB_SIZE / 2;
    const targetR = fabCenterX < w / 2 ? maxR : minR;

    if (Math.abs(targetR - r0) < 2) {
      persistPos();
      return;
    }

    isSnapping.current = true;
    rightAnim.setValue(r0);
    Animated.spring(rightAnim, {
      toValue: targetR,
      useNativeDriver: false,
      friction: 9,
      tension: 68,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 0.5,
    }).start(({ finished }) => {
      isSnapping.current = false;
      if (!finished) {
        rightAnim.setValue(posLatest.current.r);
        return;
      }
      const next = { r: targetR, b: b0 };
      posLatest.current = next;
      setPos(next);
      rightAnim.setValue(targetR);
      persistPos();
    });
  }, [insets.left, insets.right, markInteraction, persistPos, rightAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderGrant: (e) => {
          markInteraction();
          dragStart.current = {
            r: posLatest.current.r,
            b: posLatest.current.b,
            x0: e.nativeEvent.pageX,
            y0: e.nativeEvent.pageY,
          };
        },
        onPanResponderMove: (e) => {
          const dx = e.nativeEvent.pageX - dragStart.current.x0;
          const dy = e.nativeEvent.pageY - dragStart.current.y0;
          const next = clampPos(dragStart.current.r - dx, dragStart.current.b - dy);
          posLatest.current = next;
          rightAnim.setValue(next.r);
          setPos(next);
        },
        onPanResponderRelease: runEdgeSnapAndPersist,
        onPanResponderTerminate: runEdgeSnapAndPersist,
      }),
    [clampPos, markInteraction, rightAnim, runEdgeSnapAndPersist],
  );

  /** “Breath” + tilt + ayrı kanat flutter (translateY / micro pulse) — asla 360° spin yok */
  const breathe = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillTranslateY = useRef(new Animated.Value(PILL_ENTER_OFFSET_PX)).current;

  const showChrome = shouldShowLeylekZekaFab({ pathname, homeFlowScreen, flowHint });
  const showFab = showChrome && !open && !keyboardUp;

  const showFabRef = useRef(showFab);
  const reduceMotionRef = useRef(reduceMotion);
  showFabRef.current = showFab;
  reduceMotionRef.current = reduceMotion;

  const fabGlowStyle = useMemo(() => {
    if (glowVariant === 'idle') {
      return {
        shadowOpacity: Platform.OS === 'ios' ? 0.34 : undefined,
        elevation: Platform.OS === 'android' ? 10 : undefined,
        borderColor: 'rgba(63, 169, 245, 0.58)',
      } as const;
    }
    if (glowVariant === 'attention') {
      return {
        shadowOpacity: Platform.OS === 'ios' ? 0.42 : undefined,
        elevation: Platform.OS === 'android' ? 13 : undefined,
        borderColor: 'rgba(63, 169, 245, 0.65)',
      } as const;
    }
    return {
      shadowOpacity: Platform.OS === 'ios' ? 0.35 : undefined,
      elevation: Platform.OS === 'android' ? 12 : undefined,
      borderColor: 'rgba(63, 169, 245, 0.55)',
    } as const;
  }, [glowVariant]);

  useEffect(() => {
    if (reduceMotion || !showFab) {
      breathe.setValue(0);
      tilt.setValue(0);
      flutter.setValue(0);
      return;
    }
    breathe.setValue(0);
    tilt.setValue(0);
    flutter.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathe, {
            toValue: 1,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(tilt, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathe, {
            toValue: 0,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(tilt, {
            toValue: 0,
            duration: 2400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, flutter, reduceMotion, showFab, tilt]);

  /** Daha hafif periyot: dikey mikro hareket + ince pulse (kanat çırpışı) */
  useEffect(() => {
    if (reduceMotion || !showFab) {
      flutter.setValue(0);
      return;
    }
    flutter.setValue(0);
    const wingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flutter, {
          toValue: 1,
          duration: 1050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flutter, {
          toValue: 0,
          duration: 1050,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    wingLoop.start();
    return () => wingLoop.stop();
  }, [flutter, reduceMotion, showFab]);

  useEffect(() => {
    if (reduceMotion || !showFab) {
      pillOpacity.setValue(0);
      pillTranslateY.setValue(PILL_ENTER_OFFSET_PX);
      floatY.setValue(0);
      idleHintOpacity.setValue(0);
      return;
    }

    let cancelled = false;
    let running: Animated.CompositeAnimation | null = null;
    let attentionTimer: ReturnType<typeof setTimeout> | null = null;

    const pickPillCopy = () => {
      bounceCycleRef.current += 1;
      const ctx = getContextualPillLine(homeRef.current ?? null, hintRef.current);
      const useCtx =
        ctx && bounceCycleRef.current % CONTEXTUAL_PILL_EVERY_N_BOUNCES === 0;
      setPillLabel(useCtx ? ctx : "Leylek'e sor");
      if (attentionTimer) clearTimeout(attentionTimer);
      setGlowVariant('attention');
      attentionTimer = setTimeout(() => {
        setGlowVariant((g) => (g === 'attention' ? 'normal' : g));
        attentionTimer = null;
      }, 650);
    };

    const buildCycle = (gapMs: number) =>
      Animated.sequence([
        Animated.delay(gapMs),
        Animated.parallel([
          Animated.timing(pillOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(pillTranslateY, {
            toValue: PILL_ENTER_OFFSET_PX,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(floatY, {
              toValue: BOUNCE_DIP_PX,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(floatY, {
              toValue: 0,
              duration: 420,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pillOpacity, {
              toValue: 1,
              duration: PILL_FADE_IN_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(pillTranslateY, {
              toValue: 0,
              duration: PILL_FADE_IN_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(PILL_HOLD_MS),
        Animated.parallel([
          Animated.timing(pillOpacity, {
            toValue: 0,
            duration: PILL_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(pillTranslateY, {
            toValue: PILL_EXIT_DRIFT_PX,
            duration: PILL_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]);

    const runNext = () => {
      if (cancelled) return;
      pickPillCopy();
      const anim = buildCycle(nextBounceGapMs());
      running = anim;
      anim.start(({ finished }) => {
        running = null;
        if (
          finished &&
          !cancelled &&
          showFabRef.current &&
          !reduceMotionRef.current
        ) {
          runNext();
        }
      });
    };

    runNext();

    return () => {
      cancelled = true;
      running?.stop?.();
      if (attentionTimer) clearTimeout(attentionTimer);
    };
  }, [floatY, pillOpacity, pillTranslateY, reduceMotion, showFab]);

  useEffect(() => {
    if (reduceMotion || !showFab) return;

    const tick = () => {
      if (!showFabRef.current || reduceMotionRef.current) return;
      if (idleAnimRunningRef.current) return;
      const now = Date.now();
      if (now < idleCooldownUntilRef.current) return;
      const idleFor = now - lastInteractionRef.current;
      if (idleFor < idleThresholdRef.current) return;

      const pool = getMiniHintPool(homeRef.current ?? null, hintRef.current);
      if (!pool.length) {
        idleThresholdRef.current = nextIdleThresholdMs();
        return;
      }

      const line = pickNextSequential(pool, lastMiniHintRef.current);
      lastMiniHintRef.current = line;
      setIdleHintText(line);
      idleAnimRunningRef.current = true;
      idleCooldownUntilRef.current = now + IDLE_COOLDOWN_MS;
      idleThresholdRef.current = nextIdleThresholdMs();
      setGlowVariant('idle');

      idleHintOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(idleHintOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2800),
        Animated.timing(idleHintOpacity, {
          toValue: 0,
          duration: 340,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        idleAnimRunningRef.current = false;
        if (finished) {
          setGlowVariant('normal');
          setIdleHintText('');
        }
      });
    };

    const id = setInterval(tick, IDLE_CHECK_MS);
    return () => clearInterval(id);
  }, [idleHintOpacity, reduceMotion, showFab]);

  const logoScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.048],
  });
  const logoTilt = tilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2.4deg', '2.4deg'],
  });
  /** Kanat çırpışı: çok hafif yukarı-aşağı (px) — sakin maskot */
  const logoLift = flutter.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -2],
  });
  /** Mikro pulse — düşük genlik, premium his */
  const flutterPulse = flutter.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.009],
  });
  const logoScaleCombined = Animated.multiply(logoScale, flutterPulse);

  const onOpen = useCallback(() => {
    markInteraction();
    setOpen(true);
  }, [markInteraction]);
  const onClose = useCallback(() => setOpen(false), []);

  const contextualForA11y = getContextualPillLine(homeFlowScreen ?? null, flowHint);

  return (
    <>
      {showFab ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.anchor,
              {
                right: rightAnim,
                bottom: pos.b,
                transform: [{ translateY: floatY }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Animated.View
              style={[
                styles.pillWrap,
                {
                  opacity: pillOpacity,
                  transform: [{ translateY: pillTranslateY }],
                },
              ]}
              pointerEvents="none"
            >
              <View style={styles.pill}>
                <Text style={styles.pillText} numberOfLines={2}>
                  {pillLabel}
                </Text>
              </View>
            </Animated.View>

            <Pressable
              onPress={onOpen}
              onPressIn={markInteraction}
              style={({ pressed }) => [
                styles.fab,
                fabGlowStyle,
                pressed && styles.fabPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Leylek Zeka"
              accessibilityHint={
                contextualForA11y
                  ? `${contextualForA11y} Sohbeti açmak için dokunun.`
                  : 'Uygulama içi yardım için dokunun.'
              }
            >
              <Animated.View
                style={[
                  styles.logoStage,
                  reduceMotion
                    ? undefined
                    : {
                        transform: [
                          { translateY: logoLift },
                          { scale: logoScaleCombined },
                          { rotate: logoTilt },
                        ],
                      },
                ]}
              >
                <Image
                  source={require('../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </Animated.View>
            </Pressable>

            {idleHintText ? (
              <Animated.View
                style={[styles.idleHintWrap, { opacity: idleHintOpacity }]}
                pointerEvents="none"
              >
                <Text style={styles.idleHintText} numberOfLines={3}>
                  {idleHintText}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      ) : null}

      {open ? (
        <React.Suspense fallback={null}>
          <LeylekZekaChat
            visible={open}
            onClose={onClose}
            messages={messages}
            isTyping={isTyping}
            error={error}
            onSend={sendMessage}
            onClearError={clearError}
            lastReplySource={lastReplySource}
          />
        </React.Suspense>
      ) : null}
    </>
  );
});

export default LeylekZekaWidget;

const GLOW = Colors.primary;

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
  },
  pillWrap: {
    marginRight: Spacing.sm,
    maxWidth: 200,
    alignSelf: 'center',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.45)',
    ...Platform.select({
      ios: {
        shadowColor: GLOW,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  pillText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.gray800,
    letterSpacing: 0.15,
    lineHeight: 16,
  },
  idleHintWrap: {
    position: 'absolute',
    right: 0,
    top: FAB_SIZE + 6,
    maxWidth: 220,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.28)',
  },
  idleHintText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.gray600,
    lineHeight: 15,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_CORNER,
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(63, 169, 245, 0.42)',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  fabPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.96 }],
  },
  logoStage: {
    width: LOGO_SIZE + 4,
    height: LOGO_SIZE + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
