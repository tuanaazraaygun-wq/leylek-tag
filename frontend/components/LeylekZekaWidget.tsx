import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  type PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import { usePathname, useSegments } from 'expo-router';
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

/** Sürükleme sınırları — sol/üst (FAB sol üst köşesi) */
const BOUNDS_MIN_X = 10;
const BOUNDS_MAX_X_RIGHT_INSET = 80;
const BOUNDS_MIN_Y = 80;
const BOUNDS_MAX_Y_BOTTOM_INSET = 120;

function windowSizeFallback(): { w: number; h: number } {
  try {
    const d = Dimensions.get('window');
    if (Number.isFinite(d.width) && d.width > 0 && Number.isFinite(d.height) && d.height > 0) {
      return { w: d.width, h: d.height };
    }
  } catch {
    /* ignore */
  }
  return { w: 400, h: 800 };
}

function rbToLT(r: number, b: number, w: number, h: number): { x: number; y: number } {
  return { x: w - r - FAB_SIZE, y: h - b - FAB_SIZE };
}

function ltToRB(x: number, y: number, w: number, h: number): { r: number; b: number } {
  return { r: w - x - FAB_SIZE, b: h - y - FAB_SIZE };
}

function clampFabXY(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const maxX = w - BOUNDS_MAX_X_RIGHT_INSET;
  const maxY = h - BOUNDS_MAX_Y_BOTTOM_INSET;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return { x: BOUNDS_MIN_X, y: BOUNDS_MIN_Y };
  }
  return {
    x: clamp(x, BOUNDS_MIN_X, maxX),
    y: clamp(y, BOUNDS_MIN_Y, maxY),
  };
}

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
  const segments = useSegments();
  const { homeFlowScreen, flowHint, leylekZekaChatOpen, setLeylekZekaChatOpen } = useLeylekZekaChrome();
  const {
    messages,
    isTyping,
    error,
    sendMessage,
    clearError,
    lastReplySource,
    pendingLearning,
    approvePendingLearning,
    cancelPendingLearning,
  } = useLeylekZeka();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();

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

  const initialFab = useMemo(() => {
    const w = winW > 0 ? winW : windowSizeFallback().w;
    const h = winH > 0 ? winH : windowSizeFallback().h;
    const lt = rbToLT(defaultPos.r, defaultPos.b, w, h);
    const c = clampFabXY(lt.x, lt.y, w, h);
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) {
      return { x: 20, y: 120 };
    }
    return c;
  }, [defaultPos.r, defaultPos.b, winW, winH]);

  const fabPos = useRef(new Animated.ValueXY({ x: 20, y: 120 })).current;
  const fabLTRef = useRef({ x: 20, y: 120 });
  const gestureStartRef = useRef({ x: 0, y: 0 });
  const posLatest = useRef(
    ltToRB(20, 120, winW > 0 ? winW : windowSizeFallback().w, winH > 0 ? winH : windowSizeFallback().h),
  );
  const springAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const fabMountedRef = useRef(true);

  /** Kök _layout zaten GestureHandlerRootView — pencere boyutu: yalnızca window (onLayout ile çakışma yok). */
  const getEffectiveSize = useCallback(() => {
    const w = winW > 0 && Number.isFinite(winW) ? winW : windowSizeFallback().w;
    const h = winH > 0 && Number.isFinite(winH) ? winH : windowSizeFallback().h;
    return { w, h };
  }, [winW, winH]);

  useLayoutEffect(() => {
    if (!fabMountedRef.current) return;
    const { w, h } = getEffectiveSize();
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    const c = clampFabXY(initialFab.x, initialFab.y, w, h);
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
    fabPos.setValue(c);
    fabLTRef.current = { x: c.x, y: c.y };
    posLatest.current = ltToRB(c.x, c.y, w, h);
  }, [fabPos, getEffectiveSize, initialFab.x, initialFab.y]);

  useEffect(() => {
    const { w, h } = getEffectiveSize();
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    const c = clampFabXY(fabLTRef.current.x, fabLTRef.current.y, w, h);
    fabPos.setValue(c);
    fabLTRef.current = c;
    posLatest.current = ltToRB(c.x, c.y, w, h);
  }, [winW, winH, fabPos, getEffectiveSize]);

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
        if (typeof j.r === 'number' && typeof j.b === 'number' && Number.isFinite(j.r) && Number.isFinite(j.b)) {
          const dim = Dimensions.get('window');
          const w = dim.width > 0 ? dim.width : windowSizeFallback().w;
          const h = dim.height > 0 ? dim.height : windowSizeFallback().h;
          const lt = rbToLT(j.r, j.b, w, h);
          const c = clampFabXY(lt.x, lt.y, w, h);
          if (!fabMountedRef.current) return;
          fabPos.setValue(c);
          fabLTRef.current = c;
          posLatest.current = ltToRB(c.x, c.y, w, h);
        }
      } catch {
        /* ignore corrupt storage */
      }
    });
    return () => {
      alive = false;
    };
  }, [fabPos]);

  const persistPos = useCallback(() => {
    const { r, b } = posLatest.current;
    void AsyncStorage.setItem(POS_KEY, JSON.stringify({ r, b })).catch(() => {});
  }, []);

  const onFabGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      try {
        if (!fabMountedRef.current) return;
        if (!e?.nativeEvent) return;
        const tx = e.nativeEvent.translationX;
        const ty = e.nativeEvent.translationY;
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
        const { w, h } = getEffectiveSize();
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        const sx = gestureStartRef.current.x;
        const sy = gestureStartRef.current.y;
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
        const rawX = sx + tx;
        const rawY = sy + ty;
        if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return;
        const next = clampFabXY(rawX, rawY, w, h);
        fabPos.setValue(next);
        fabLTRef.current = next;
      } catch {
        /* gesture race */
      }
    },
    [fabPos, getEffectiveSize],
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      try {
        if (!event?.nativeEvent) return;
        if (event.nativeEvent.state === undefined) return;
        const st = event.nativeEvent.state;
        if (st === State.BEGAN) {
          springAnimRef.current?.stop?.();
          gestureStartRef.current = { ...fabLTRef.current };
          return;
        }
        if (st !== State.END && st !== State.CANCELLED && st !== State.FAILED) return;
        if (!fabMountedRef.current) return;
        const tx = event.nativeEvent.translationX;
        const ty = event.nativeEvent.translationY;
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
        const { w, h } = getEffectiveSize();
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        const x = gestureStartRef.current.x + tx;
        const y = gestureStartRef.current.y + ty;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const c = clampFabXY(x, y, w, h);
        fabLTRef.current = c;
        const centerX = c.x + FAB_SIZE / 2;
        const targetLeft = centerX < w / 2 ? BOUNDS_MIN_X : w - BOUNDS_MAX_X_RIGHT_INSET;
        const targetTop = clamp(c.y, BOUNDS_MIN_Y, h - BOUNDS_MAX_Y_BOTTOM_INSET);
        markInteraction();
        springAnimRef.current = Animated.spring(fabPos, {
          toValue: { x: targetLeft, y: targetTop },
          useNativeDriver: true,
          friction: 9,
          tension: 68,
          restDisplacementThreshold: 0.5,
          restSpeedThreshold: 0.5,
        });
        springAnimRef.current.start(({ finished }) => {
          if (!fabMountedRef.current) return;
          springAnimRef.current = null;
          if (!finished) return;
          fabLTRef.current = { x: targetLeft, y: targetTop };
          posLatest.current = ltToRB(targetLeft, targetTop, w, h);
          persistPos();
        });
      } catch {
        /* handler race */
      }
    },
    [fabPos, getEffectiveSize, markInteraction, persistPos],
  );

  useEffect(() => {
    fabMountedRef.current = true;
    return () => {
      fabMountedRef.current = false;
      springAnimRef.current?.stop?.();
      springAnimRef.current = null;
    };
  }, []);

  /** “Breath” + tilt + ayrı kanat flutter (translateY / micro pulse) — asla 360° spin yok */
  const breathe = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillTranslateY = useRef(new Animated.Value(PILL_ENTER_OFFSET_PX)).current;

  const showChrome = shouldShowLeylekZekaFab({ pathname, segments, homeFlowScreen, flowHint });
  const showFab = showChrome && !leylekZekaChatOpen && !keyboardUp;

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
    setLeylekZekaChatOpen(true);
  }, [markInteraction, setLeylekZekaChatOpen]);
  const onClose = useCallback(() => setLeylekZekaChatOpen(false), [setLeylekZekaChatOpen]);

  const contextualForA11y = getContextualPillLine(homeFlowScreen ?? null, flowHint);

  return (
    <>
      {showFab ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <PanGestureHandler
              enabled={true}
              shouldCancelWhenOutside={false}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOffsetX={[-10, 10]}
              activeOffsetY={[-10, 10]}
              onGestureEvent={onFabGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
            >
            <Animated.View
              collapsable={false}
              pointerEvents="box-none"
              style={[
                styles.anchor,
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: [{ translateX: fabPos.x }, { translateY: fabPos.y }],
                },
              ]}
            >
              <Animated.View
                pointerEvents="box-none"
                style={[
                  styles.pillRow,
                  {
                    transform: [{ translateY: floatY }],
                  },
                ]}
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
            </Animated.View>
            </PanGestureHandler>
        </View>
      ) : null}

      {leylekZekaChatOpen ? (
        <React.Suspense fallback={null}>
          <LeylekZekaChat
            visible={leylekZekaChatOpen}
            onClose={onClose}
            messages={messages}
            isTyping={isTyping}
            error={error}
            onSend={sendMessage}
            onClearError={clearError}
            lastReplySource={lastReplySource}
            pendingLearning={pendingLearning}
            onApproveLearning={approvePendingLearning}
            onCancelLearning={cancelPendingLearning}
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
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
