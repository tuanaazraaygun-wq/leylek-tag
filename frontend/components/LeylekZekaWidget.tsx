import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
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
  getOrbHintPool,
  pickNextSequential,
  pickOrbHintLine,
} from '../lib/leylekZekaUxCopy';
import {
  fetchPassengerAvailabilitySnapshot,
  getGlobalCooldownUntilMs,
  isProactiveOrbEnabled,
  markProactiveShownForTag,
  PROACTIVE_GLOBAL_COOLDOWN_MS,
  PROACTIVE_MIN_WAIT_MS,
  parseInsightCreatedAtMs,
  setGlobalCooldownUntilMs,
  shortenProactiveOrbHint,
  shouldTriggerPassengerProactiveInsight,
  wasProactiveShownForTag,
} from '../lib/leylekZekaProactiveInsight';

const LeylekZekaChat = React.lazy(() => import('./LeylekZekaChat'));

const FAB_SIZE = 68;
const LOGO_SIZE = 44;
const FAB_CORNER = 23;
const EDGE_PAD = 10;
const POS_KEY = 'leylek_zeka_fab_rb_v1';
const BOUNCE_GAP_MIN_MS = 16000;
const BOUNCE_GAP_MAX_MS = 24000;
const CONTEXTUAL_HINT_EVERY_N_BOUNCES = 3;
const FAB_DEFAULT_EXTRA_BOTTOM_PX = 14;
const FAB_DEFAULT_EXTRA_RIGHT_PX = 4;
const BOUNCE_DIP_PX = -6;
const HINT_FADE_IN_MS = 280;
const HINT_HOLD_MS = 2800;
const HINT_FADE_OUT_MS = 320;
const HINT_ENTER_OFFSET_PX = 6;
const HINT_EXIT_DRIFT_PX = -4;
const IDLE_CHECK_MS = 8000;
const IDLE_AFTER_MIN_MS = 20000;
const IDLE_AFTER_MAX_MS = 30000;
const IDLE_COOLDOWN_MS = 90000;

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
  const {
    homeFlowScreen,
    flowHint,
    leylekZekaChatOpen,
    setLeylekZekaChatOpen,
    passengerWaitInsight,
  } = useLeylekZekaChrome();
  const { messages, isTyping, error, sendMessage, clearError, lastReplySource } = useLeylekZeka();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();

  const [orbHintText, setOrbHintText] = useState('');
  const [glowVariant, setGlowVariant] = useState<GlowVariant>('normal');

  const bounceCycleRef = useRef(0);
  const homeRef = useRef(homeFlowScreen);
  const hintRef = useRef(flowHint);
  homeRef.current = homeFlowScreen;
  hintRef.current = flowHint;

  const lastInteractionRef = useRef(Date.now());
  const idleCooldownUntilRef = useRef(0);
  const idleThresholdRef = useRef(nextIdleThresholdMs());
  const lastOrbHintRef = useRef<string | null>(null);
  const hintAnimRunningRef = useRef(false);
  const proactiveAttemptedTagRef = useRef<string | null>(null);

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

  const breathe = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintTranslateY = useRef(new Animated.Value(HINT_ENTER_OFFSET_PX)).current;

  const showChrome = shouldShowLeylekZekaFab({ pathname, segments, homeFlowScreen, flowHint });
  const showFab = showChrome && !leylekZekaChatOpen && !keyboardUp;

  const showFabRef = useRef(showFab);
  const reduceMotionRef = useRef(reduceMotion);
  showFabRef.current = showFab;
  reduceMotionRef.current = reduceMotion;

  const fabGlowStyle = useMemo(() => {
    if (glowVariant === 'idle') {
      return {
        shadowOpacity: Platform.OS === 'ios' ? 0.38 : undefined,
        elevation: Platform.OS === 'android' ? 12 : undefined,
        borderColor: 'rgba(34, 211, 238, 0.62)',
      } as const;
    }
    if (glowVariant === 'attention') {
      return {
        shadowOpacity: Platform.OS === 'ios' ? 0.48 : undefined,
        elevation: Platform.OS === 'android' ? 16 : undefined,
        borderColor: 'rgba(34, 211, 238, 0.72)',
      } as const;
    }
    return {
      shadowOpacity: Platform.OS === 'ios' ? 0.4 : undefined,
      elevation: Platform.OS === 'android' ? 14 : undefined,
      borderColor: 'rgba(34, 211, 238, 0.58)',
    } as const;
  }, [glowVariant]);

  const playOrbHint = useCallback(
    (line: string, glow: GlowVariant = 'attention') => {
      if (!line || reduceMotionRef.current || !showFabRef.current) return;
      if (hintAnimRunningRef.current) return;
      hintAnimRunningRef.current = true;
      lastOrbHintRef.current = line;
      setOrbHintText(line);
      setGlowVariant(glow);
      hintOpacity.setValue(0);
      hintTranslateY.setValue(HINT_ENTER_OFFSET_PX);

      Animated.sequence([
        Animated.parallel([
          Animated.sequence([
            Animated.timing(floatY, {
              toValue: BOUNCE_DIP_PX,
              duration: 260,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(floatY, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(hintOpacity, {
              toValue: 1,
              duration: HINT_FADE_IN_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(hintTranslateY, {
              toValue: 0,
              duration: HINT_FADE_IN_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(HINT_HOLD_MS),
        Animated.parallel([
          Animated.timing(hintOpacity, {
            toValue: 0,
            duration: HINT_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(hintTranslateY, {
            toValue: HINT_EXIT_DRIFT_PX,
            duration: HINT_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        hintAnimRunningRef.current = false;
        if (finished) {
          setOrbHintText('');
          setGlowVariant('normal');
        }
      });
    },
    [floatY, hintOpacity, hintTranslateY],
  );

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
      hintOpacity.setValue(0);
      hintTranslateY.setValue(HINT_ENTER_OFFSET_PX);
      floatY.setValue(0);
      setOrbHintText('');
      return;
    }

    let cancelled = false;
    let gapTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (cancelled || !showFabRef.current || reduceMotionRef.current) return;
      gapTimer = setTimeout(() => {
        gapTimer = null;
        if (cancelled || hintAnimRunningRef.current) {
          scheduleNext();
          return;
        }
        bounceCycleRef.current += 1;
        const line = pickOrbHintLine(
          homeRef.current ?? null,
          hintRef.current,
          lastOrbHintRef.current,
          bounceCycleRef.current,
          CONTEXTUAL_HINT_EVERY_N_BOUNCES,
        );
        playOrbHint(line);
        scheduleNext();
      }, nextBounceGapMs());
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (gapTimer) clearTimeout(gapTimer);
      setOrbHintText('');
      hintOpacity.setValue(0);
    };
  }, [hintOpacity, hintTranslateY, floatY, playOrbHint, reduceMotion, showFab]);

  useEffect(() => {
    if (reduceMotion || !showFab) return;

    const tick = () => {
      if (!showFabRef.current || reduceMotionRef.current) return;
      if (hintAnimRunningRef.current) return;
      const now = Date.now();
      if (now < idleCooldownUntilRef.current) return;
      const idleFor = now - lastInteractionRef.current;
      if (idleFor < idleThresholdRef.current) return;

      const pool = getOrbHintPool(homeRef.current ?? null, hintRef.current);
      if (!pool.length) {
        idleThresholdRef.current = nextIdleThresholdMs();
        return;
      }

      const line = pickNextSequential(pool, lastOrbHintRef.current);
      idleCooldownUntilRef.current = now + IDLE_COOLDOWN_MS;
      idleThresholdRef.current = nextIdleThresholdMs();
      playOrbHint(line, 'idle');
    };

    const id = setInterval(tick, IDLE_CHECK_MS);
    return () => clearInterval(id);
  }, [playOrbHint, reduceMotion, showFab]);

  useEffect(() => {
    if (!isProactiveOrbEnabled()) return;
    if (!showFab || leylekZekaChatOpen) return;
    const insight = passengerWaitInsight;
    if (!insight?.tagId) {
      proactiveAttemptedTagRef.current = null;
      return;
    }

    const tagId = String(insight.tagId).trim();
    if (!tagId) return;
    if (proactiveAttemptedTagRef.current === tagId) return;
    proactiveAttemptedTagRef.current = tagId;

    let cancelled = false;
    let dwellTimer: ReturnType<typeof setTimeout> | null = null;

    const runProactive = async () => {
      if (cancelled || !showFabRef.current || reduceMotionRef.current) return;
      if (!shouldTriggerPassengerProactiveInsight(insight)) return;
      if (hintAnimRunningRef.current) return;
      if (await wasProactiveShownForTag(tagId)) return;
      const globalUntil = await getGlobalCooldownUntilMs();
      if (Date.now() < globalUntil) return;

      const snapshot = await fetchPassengerAvailabilitySnapshot();
      if (cancelled || !snapshot) return;

      const line = shortenProactiveOrbHint(snapshot.message_hint || '');
      if (!line || cancelled) return;
      if (line === lastOrbHintRef.current) return;

      playOrbHint(line, 'attention');
      await markProactiveShownForTag(tagId);
      const until = Date.now() + PROACTIVE_GLOBAL_COOLDOWN_MS;
      idleCooldownUntilRef.current = until;
      await setGlobalCooldownUntilMs(until);
    };

    const createdMs = parseInsightCreatedAtMs(insight.createdAt);
    const now = Date.now();
    const dwellRemain =
      createdMs != null ? Math.max(0, PROACTIVE_MIN_WAIT_MS - (now - createdMs)) : PROACTIVE_MIN_WAIT_MS;

    if (dwellRemain > 0) {
      dwellTimer = setTimeout(() => {
        void runProactive();
      }, dwellRemain);
    } else {
      void runProactive();
    }

    return () => {
      cancelled = true;
      if (dwellTimer) clearTimeout(dwellTimer);
    };
  }, [
    passengerWaitInsight,
    showFab,
    leylekZekaChatOpen,
    playOrbHint,
    reduceMotion,
  ]);

  const logoScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.048],
  });
  const logoTilt = tilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2.4deg', '2.4deg'],
  });
  const logoLift = flutter.interpolate({
    inputRange: [0, 1],
    outputRange: [2, -2],
  });
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
            enabled
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
                style={[styles.fabColumn, { transform: [{ translateY: floatY }] }]}
              >
                <Pressable
                  onPress={onOpen}
                  onPressIn={markInteraction}
                  style={({ pressed }) => [styles.fabOuter, fabGlowStyle, pressed && styles.fabPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Leylek Zeka"
                  accessibilityHint={
                    contextualForA11y
                      ? `${contextualForA11y} Sohbeti açmak için dokunun.`
                      : 'Uygulama içi yardım için dokunun.'
                  }
                >
                  <LinearGradient
                    colors={['#0B1E33', '#123A5C', '#1A5F94', '#22A8D8']}
                    locations={[0, 0.35, 0.72, 1]}
                    start={{ x: 0.15, y: 0.1 }}
                    end={{ x: 0.9, y: 1 }}
                    style={styles.fabGrad}
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
                        source={require('../assets/images/leylek-logo-premium.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                        accessibilityIgnoresInvertColors
                      />
                    </Animated.View>
                  </LinearGradient>
                </Pressable>

                {orbHintText ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.orbHintCapsule,
                      {
                        opacity: hintOpacity,
                        transform: [{ translateY: hintTranslateY }],
                      },
                    ]}
                  >
                    <Text style={styles.orbHintText} numberOfLines={2}>
                      {orbHintText}
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
    alignItems: 'center',
    zIndex: 9999,
  },
  fabColumn: {
    alignItems: 'center',
    maxWidth: 168,
  },
  fabOuter: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_CORNER,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: GLOW,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 18,
      },
      android: {},
    }),
  },
  fabGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.96 }],
  },
  orbHintCapsule: {
    marginTop: 6,
    maxWidth: 156,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(8, 18, 32, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.38)',
    ...Platform.select({
      ios: {
        shadowColor: GLOW,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  orbHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(224, 246, 255, 0.94)',
    textAlign: 'center',
    letterSpacing: 0.12,
    lineHeight: 13,
  },
  logoStage: {
    width: LOGO_SIZE + 4,
    height: LOGO_SIZE + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: LOGO_SIZE - 6,
    height: LOGO_SIZE - 6,
  },
});
