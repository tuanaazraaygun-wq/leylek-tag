import { LinearGradient } from 'expo-linear-gradient';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
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
import { usePathname, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, Spacing } from '../constants/Colors';
import {
  shouldShowLeylekZekaFab,
  useLeylekZekaChrome,
} from '../contexts/LeylekZekaChromeContext';
import { useLeylekZeka } from '../hooks/useLeylekZeka';
import {
  getContextualPillLine,
  pickFlowAwareAmbientLine,
  resolveAccentSpans,
  type PremiumOrbAmbientLine,
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
const FAB_BOTTOM_EXTRA_PX = 14;
/** PassengerWaitingScreen harita sol alt (Google watermark üstü) — sadece pre-match bekleme */
const PASSENGER_WAIT_MAP_HEIGHT_RATIO = 0.38;
const PASSENGER_WAIT_HEADER_APPROX_PX = 80;
const PASSENGER_WAIT_ORB_LEFT_PX = 22;
const PASSENGER_WAIT_ORB_TOP_ABOVE_FAB_PX = 12;
const PASSENGER_WAIT_ORB_TOP_MIN_EXTRA_PX = 96;
/** Rol seçimi: Devam Et + footer üstünde (~20–28px CTA üstü boşluk). */
const ROLE_SELECT_BOTTOM_EXTRA_MIN = 188;
const ROLE_SELECT_BOTTOM_EXTRA_MID = 198;
const ROLE_SELECT_BOTTOM_EXTRA_MAX = 208;
const ROLE_SELECT_HEIGHT_SMALL_MAX = 700;
const ROLE_SELECT_HEIGHT_LARGE_MIN = 820;

function roleSelectFabBottomExtra(winHeight: number): number {
  if (!Number.isFinite(winHeight) || winHeight <= 0) return ROLE_SELECT_BOTTOM_EXTRA_MID;
  if (winHeight < ROLE_SELECT_HEIGHT_SMALL_MAX) return ROLE_SELECT_BOTTOM_EXTRA_MIN;
  if (winHeight >= ROLE_SELECT_HEIGHT_LARGE_MIN) return ROLE_SELECT_BOTTOM_EXTRA_MAX;
  return ROLE_SELECT_BOTTOM_EXTRA_MID;
}
const BOUNCE_DIP_PX = -6;
const HINT_FADE_IN_MS = 280;
const HINT_HOLD_MS = 2800;
const HINT_FADE_OUT_MS = 320;
const HINT_ENTER_OFFSET_PX = 6;
const HINT_EXIT_DRIFT_PX = -4;
const AMBIENT_GAP_MIN_MS = 10000;
const AMBIENT_GAP_MAX_MS = 14000;
const AMBIENT_HOLD_AFTER_TYPE_MS = 1800;
const AMBIENT_PRE_NEXT_FADE_MS = 300;
const TYPING_CHAR_MS_MIN = 24;
const TYPING_CHAR_MS_MAX = 38;
const TYPING_START_DELAY_MS = 180;
const BUBBLE_MAX_W = 220;

const ORB_ACCENT_CYAN = 'rgba(34, 211, 238, 0.96)';
const ORB_TEXT_SOFT = 'rgba(224, 246, 255, 0.94)';

function nextAmbientGapMs(): number {
  const span = AMBIENT_GAP_MAX_MS - AMBIENT_GAP_MIN_MS + 1;
  return AMBIENT_GAP_MIN_MS + Math.floor(Math.random() * span);
}

function delayForTypedChar(ch: string, prevCh: string | undefined): number {
  const base = TYPING_CHAR_MS_MIN + Math.floor(Math.random() * (TYPING_CHAR_MS_MAX - TYPING_CHAR_MS_MIN + 1));
  let extra = 0;
  if (prevCh && /[.!?]/.test(prevCh)) {
    extra += 110 + Math.floor(Math.random() * 70);
  } else if (/[.,;:]/.test(ch)) {
    extra += 45 + Math.floor(Math.random() * 35);
  }
  if (ch === ' ') {
    extra += 6 + Math.floor(Math.random() * 14);
  }
  return base + extra;
}

function renderAccentSlices(
  full: string,
  visibleLen: number,
  spans: { start: number; end: number }[],
) {
  const n = Math.min(visibleLen, full.length);
  if (!spans.length || n === 0) {
    return <Text style={styles.orbHintText}>{full.slice(0, n)}</Text>;
  }
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const sp of spans) {
    if (sp.start >= n) break;
    if (pos < sp.start) {
      parts.push(
        <Text key={`w-${pos}`} style={styles.orbHintText}>
          {full.slice(pos, Math.min(sp.start, n))}
        </Text>,
      );
    }
    if (sp.start < n) {
      const accentEnd = Math.min(sp.end, n);
      parts.push(
        <Text key={`a-${sp.start}`} style={styles.orbHintAccent}>
          {full.slice(sp.start, accentEnd)}
        </Text>,
      );
      pos = accentEnd;
    }
  }
  if (pos < n) {
    parts.push(
      <Text key={`w-tail-${pos}`} style={styles.orbHintText}>
        {full.slice(pos, n)}
      </Text>,
    );
  }
  return <Text style={styles.orbHintText}>{parts}</Text>;
}

function OrbBubbleTypingText({
  full,
  visibleLen,
  showCursor,
  cursorOpacity,
  cursorBlinkAnimated = true,
  accentHints,
}: {
  full: string;
  visibleLen: number;
  showCursor: boolean;
  cursorOpacity: Animated.Value;
  cursorBlinkAnimated?: boolean;
  accentHints?: readonly string[];
}) {
  const spans = useMemo(() => resolveAccentSpans(full, accentHints), [full, accentHints]);
  const cursorStyle = useMemo(
    () => ({
      opacity: cursorOpacity,
      color: ORB_ACCENT_CYAN,
      fontWeight: '300' as const,
    }),
    [cursorOpacity],
  );

  return (
    <Text style={styles.orbHintText} numberOfLines={3}>
      {renderAccentSlices(full, visibleLen, spans)}
      {showCursor && visibleLen <= full.length ? (
        cursorBlinkAnimated ? (
          <Animated.Text style={[styles.orbCursor, cursorStyle]}>|</Animated.Text>
        ) : (
          <Text style={[styles.orbCursor, { color: ORB_ACCENT_CYAN, opacity: 1 }]}>|</Text>
        )
      ) : null}
    </Text>
  );
}

type GlowVariant = 'normal' | 'attention' | 'idle';

const LeylekZekaWidget = memo(function LeylekZekaWidget() {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const pathname = usePathname();
  const segments = useSegments();
  const {
    homeFlowScreen,
    flowHint,
    activeTripSuppressPremiumOrb,
    leylekZekaChatOpen,
    setLeylekZekaChatOpen,
    passengerWaitInsight,
  } = useLeylekZekaChrome();
  const { messages, isTyping, error, sendMessage, clearError, lastReplySource } = useLeylekZeka();

  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [ambientFullLine, setAmbientFullLine] = useState('');
  const [ambientAccents, setAmbientAccents] = useState<readonly string[]>([]);
  const [ephemeralFullLine, setEphemeralFullLine] = useState<string | null>(null);
  const [typedVisibleLen, setTypedVisibleLen] = useState(0);
  const [bubbleTypingActive, setBubbleTypingActive] = useState(false);
  const [bubbleHoldCursor, setBubbleHoldCursor] = useState(false);
  const [glowVariant, setGlowVariant] = useState<GlowVariant>('normal');

  const homeRef = useRef(homeFlowScreen);
  const hintRef = useRef(flowHint);
  homeRef.current = homeFlowScreen;
  hintRef.current = flowHint;

  const lastAmbientRef = useRef<string | null>(null);
  const lastOrbHintRef = useRef<string | null>(null);
  const hintAnimRunningRef = useRef(false);
  const proactiveAttemptedTagRef = useRef<string | null>(null);
  const idleCooldownUntilRef = useRef(0);
  const typingRunIdRef = useRef(0);
  const typingTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ambientCycleBusyRef = useRef(false);
  const ambientGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechFullRef = useRef('');

  const markInteraction = useCallback(() => {
    setGlowVariant((g) => (g === 'idle' ? 'normal' : g));
  }, []);

  const breathe = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(1)).current;
  const bubbleTranslateY = useRef(new Animated.Value(0)).current;
  const bubbleBreath = useRef(new Animated.Value(0)).current;
  const cursorBlink = useRef(new Animated.Value(1)).current;

  const showChrome = shouldShowLeylekZekaFab({
    pathname,
    segments,
    homeFlowScreen,
    flowHint,
    activeTripSuppressPremiumOrb,
  });
  const showFab = showChrome && !leylekZekaChatOpen && !keyboardUp;

  const showFabRef = useRef(showFab);
  const reduceMotionRef = useRef(reduceMotion);
  showFabRef.current = showFab;
  reduceMotionRef.current = reduceMotion;

  const bottomInset = useMemo(() => {
    const safe = Math.max(insets.bottom, Spacing.sm);
    if (homeFlowScreen === 'role-select') {
      return safe + roleSelectFabBottomExtra(winH);
    }
    return safe + FAB_BOTTOM_EXTRA_PX;
  }, [homeFlowScreen, insets.bottom, winH]);

  const isPassengerPreMatchWaitOrb =
    flowHint === 'passenger_matching' ||
    (!!passengerWaitInsight?.tagId && flowHint !== 'passenger_offer_waiting');

  const isPassengerWaitMatchingOrb = isPassengerPreMatchWaitOrb;

  const passengerWaitOrbOnMap = useMemo(() => {
    const topMin = insets.top + PASSENGER_WAIT_ORB_TOP_MIN_EXTRA_PX;
    const topMax = winH * 0.5;
    const raw =
      insets.top +
      PASSENGER_WAIT_HEADER_APPROX_PX +
      winH * PASSENGER_WAIT_MAP_HEIGHT_RATIO -
      FAB_SIZE -
      PASSENGER_WAIT_ORB_TOP_ABOVE_FAB_PX;
    return {
      left: PASSENGER_WAIT_ORB_LEFT_PX,
      top: Math.min(topMax, Math.max(topMin, raw)),
    };
  }, [insets.top, winH]);

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

  const speechFull = ephemeralFullLine ?? ambientFullLine;
  const speechAccentHints = ephemeralFullLine ? undefined : ambientAccents;
  speechFullRef.current = speechFull;

  const applyAmbientLine = useCallback((line: PremiumOrbAmbientLine) => {
    lastAmbientRef.current = line.text;
    setAmbientFullLine(line.text);
    setAmbientAccents(line.accents ?? []);
    return line.text;
  }, []);

  const ephemeralFullLineRef = useRef(ephemeralFullLine);
  const bubbleTypingActiveRef = useRef(bubbleTypingActive);
  ephemeralFullLineRef.current = ephemeralFullLine;
  bubbleTypingActiveRef.current = bubbleTypingActive;

  const clearTypingTimeouts = useCallback(() => {
    for (const t of typingTimeoutsRef.current) {
      clearTimeout(t);
    }
    typingTimeoutsRef.current = [];
  }, []);

  const scheduleTypingTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    typingTimeoutsRef.current.push(id);
    return id;
  }, []);

  const runBubbleTyping = useCallback(
    (full: string, onComplete?: () => void) => {
      clearTypingTimeouts();
      const runId = typingRunIdRef.current + 1;
      typingRunIdRef.current = runId;
      setTypedVisibleLen(0);
      setBubbleTypingActive(true);
      setBubbleHoldCursor(false);

      if (reduceMotionRef.current) {
        setTypedVisibleLen(full.length);
        setBubbleTypingActive(false);
        setBubbleHoldCursor(true);
        scheduleTypingTimeout(() => {
          setBubbleHoldCursor(false);
          onComplete?.();
        }, AMBIENT_HOLD_AFTER_TYPE_MS);
        return;
      }

      scheduleTypingTimeout(() => {
        if (typingRunIdRef.current !== runId) return;

        let idx = 0;
        const step = () => {
          if (typingRunIdRef.current !== runId) return;
          idx += 1;
          setTypedVisibleLen(idx);
          if (idx >= full.length) {
            setBubbleTypingActive(false);
            setBubbleHoldCursor(true);
            scheduleTypingTimeout(() => {
              if (typingRunIdRef.current !== runId) return;
              setBubbleHoldCursor(false);
              onComplete?.();
            }, AMBIENT_HOLD_AFTER_TYPE_MS);
            return;
          }
          const ch = full[idx];
          const prev = full[idx - 1];
          scheduleTypingTimeout(step, delayForTypedChar(ch, prev));
        };
        step();
      }, TYPING_START_DELAY_MS);
    },
    [clearTypingTimeouts, scheduleTypingTimeout],
  );

  const resumeAmbientSpeech = useCallback(() => {
    if (ephemeralFullLineRef.current) return;
    runBubbleTyping(ambientFullLine);
  }, [ambientFullLine, runBubbleTyping]);

  const transitionToNextAmbient = useCallback(() => {
    if (!showFabRef.current || ephemeralFullLineRef.current) return;
    if (Date.now() < idleCooldownUntilRef.current) return;

    ambientCycleBusyRef.current = true;
    const picked = pickFlowAwareAmbientLine(
      homeRef.current ?? null,
      hintRef.current,
      lastAmbientRef.current,
    );

    const beginTyping = () => {
      const text = applyAmbientLine(picked);
      runBubbleTyping(text, () => {
        ambientCycleBusyRef.current = false;
      });
    };

    if (reduceMotionRef.current) {
      bubbleOpacity.setValue(1);
      beginTyping();
      return;
    }

    Animated.timing(bubbleOpacity, {
      toValue: 0.2,
      duration: AMBIENT_PRE_NEXT_FADE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        ambientCycleBusyRef.current = false;
        return;
      }
      setTypedVisibleLen(0);
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: HINT_FADE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: fin2 }) => {
        if (!fin2) {
          ambientCycleBusyRef.current = false;
          return;
        }
        beginTyping();
      });
    });
  }, [applyAmbientLine, bubbleOpacity, runBubbleTyping]);

  const scheduleAmbientRotationRef = useRef<() => void>(() => {});

  const scheduleAmbientRotation = useCallback(() => {
    if (ambientGapTimerRef.current) {
      clearTimeout(ambientGapTimerRef.current);
      ambientGapTimerRef.current = null;
    }
    ambientGapTimerRef.current = setTimeout(() => {
      ambientGapTimerRef.current = null;
      if (!showFabRef.current || ephemeralFullLineRef.current || hintAnimRunningRef.current) {
        scheduleAmbientRotationRef.current();
        return;
      }
      if (ambientCycleBusyRef.current || bubbleTypingActiveRef.current) {
        scheduleAmbientRotationRef.current();
        return;
      }
      if (Date.now() < idleCooldownUntilRef.current) {
        scheduleAmbientRotationRef.current();
        return;
      }
      transitionToNextAmbient();
      scheduleAmbientRotationRef.current();
    }, nextAmbientGapMs());
  }, [transitionToNextAmbient]);

  scheduleAmbientRotationRef.current = scheduleAmbientRotation;

  const playOrbHint = useCallback(
    (line: string, glow: GlowVariant = 'attention') => {
      if (!line || !showFabRef.current) return;
      if (hintAnimRunningRef.current) return;
      hintAnimRunningRef.current = true;
      lastOrbHintRef.current = line;
      clearTypingTimeouts();
      typingRunIdRef.current += 1;
      setBubbleHoldCursor(false);
      ephemeralFullLineRef.current = line;
      setEphemeralFullLine(line);
      setGlowVariant(glow);
      bubbleOpacity.setValue(1);
      bubbleTranslateY.setValue(HINT_ENTER_OFFSET_PX);
      runBubbleTyping(line);

      if (reduceMotionRef.current) {
        hintAnimRunningRef.current = false;
        scheduleTypingTimeout(() => {
          ephemeralFullLineRef.current = null;
          setEphemeralFullLine(null);
          setGlowVariant('normal');
          resumeAmbientSpeech();
        }, HINT_HOLD_MS);
        return;
      }

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
            Animated.timing(bubbleOpacity, {
              toValue: 1,
              duration: HINT_FADE_IN_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(bubbleTranslateY, {
              toValue: 0,
              duration: HINT_FADE_IN_MS,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(HINT_HOLD_MS),
        Animated.parallel([
          Animated.timing(bubbleOpacity, {
            toValue: 0.85,
            duration: HINT_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(bubbleTranslateY, {
            toValue: HINT_EXIT_DRIFT_PX,
            duration: HINT_FADE_OUT_MS,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        hintAnimRunningRef.current = false;
        if (finished) {
          clearTypingTimeouts();
          typingRunIdRef.current += 1;
          ephemeralFullLineRef.current = null;
          setEphemeralFullLine(null);
          setGlowVariant('normal');
          bubbleTranslateY.setValue(0);
          bubbleOpacity.setValue(1);
          resumeAmbientSpeech();
        }
      });
    },
    [
      bubbleOpacity,
      bubbleTranslateY,
      clearTypingTimeouts,
      floatY,
      resumeAmbientSpeech,
      runBubbleTyping,
      scheduleTypingTimeout,
    ],
  );

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
    if (!showFab) {
      clearTypingTimeouts();
      typingRunIdRef.current += 1;
      setEphemeralFullLine(null);
      setBubbleTypingActive(false);
      setTypedVisibleLen(0);
      bubbleOpacity.setValue(1);
      bubbleTranslateY.setValue(0);
      if (ambientGapTimerRef.current) {
        clearTimeout(ambientGapTimerRef.current);
        ambientGapTimerRef.current = null;
      }
      return;
    }
    const initial = pickFlowAwareAmbientLine(homeFlowScreen, flowHint, null);
    applyAmbientLine(initial);
    bubbleOpacity.setValue(1);
    ambientCycleBusyRef.current = true;
    runBubbleTyping(initial.text, () => {
      ambientCycleBusyRef.current = false;
    });
    scheduleAmbientRotation();
    return () => {
      if (ambientGapTimerRef.current) {
        clearTimeout(ambientGapTimerRef.current);
        ambientGapTimerRef.current = null;
      }
      clearTypingTimeouts();
    };
  }, [
    applyAmbientLine,
    flowHint,
    homeFlowScreen,
    showFab,
    bubbleOpacity,
    bubbleTranslateY,
    clearTypingTimeouts,
    runBubbleTyping,
    scheduleAmbientRotation,
  ]);

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
    if (reduceMotion || !showFab || homeFlowScreen === 'role-select') {
      bubbleBreath.setValue(0);
      return;
    }
    bubbleBreath.setValue(0);
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleBreath, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(bubbleBreath, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    breathLoop.start();
    return () => breathLoop.stop();
  }, [bubbleBreath, homeFlowScreen, reduceMotion, showFab]);

  useEffect(() => {
    if (reduceMotion || !showFab || homeFlowScreen === 'role-select') {
      cursorBlink.setValue(1);
      return;
    }
    if (!bubbleTypingActive && !bubbleHoldCursor) {
      cursorBlink.setValue(0);
      return;
    }
    cursorBlink.setValue(1);
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, {
          toValue: 0.15,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cursorBlink, {
          toValue: 1,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    blinkLoop.start();
    return () => blinkLoop.stop();
  }, [bubbleHoldCursor, bubbleTypingActive, cursorBlink, homeFlowScreen, reduceMotion, showFab]);

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
      if (cancelled || !showFabRef.current) return;
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

  const isRoleSelectScreen = homeFlowScreen === 'role-select';

  const showBubbleCursor =
    !reduceMotion &&
    (bubbleTypingActive || bubbleHoldCursor) &&
    typedVisibleLen > 0 &&
    typedVisibleLen <= speechFull.length;

  const bubbleShadowOpacity = bubbleBreath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.3],
  });

  const bubbleInner = (
    <Animated.View
      pointerEvents="none"
      style={{
        opacity: bubbleOpacity,
        transform: [{ translateY: bubbleTranslateY }],
      }}
    >
      <View style={styles.orbHintCapsule}>
        <OrbBubbleTypingText
          full={speechFull}
          visibleLen={typedVisibleLen}
          showCursor={showBubbleCursor}
          cursorOpacity={cursorBlink}
          cursorBlinkAnimated={!isRoleSelectScreen}
          accentHints={speechAccentHints}
        />
      </View>
      <View style={styles.orbHintTail} />
    </Animated.View>
  );

  return (
    <>
      {showFab ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View
            pointerEvents="box-none"
            style={[
              isPassengerWaitMatchingOrb ? styles.passengerWaitMapAnchor : styles.centerAnchor,
              isPassengerWaitMatchingOrb
                ? { top: passengerWaitOrbOnMap.top, left: passengerWaitOrbOnMap.left }
                : { bottom: bottomInset },
            ]}
          >
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.fabColumn,
                isPassengerPreMatchWaitOrb ? styles.fabColumnWaitMap : null,
                { transform: [{ translateY: floatY }] },
              ]}
            >
              {speechFull ? (
                isRoleSelectScreen || reduceMotion ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.orbHintGlowWrap,
                      isPassengerPreMatchWaitOrb ? styles.orbHintGlowWrapWaitMap : null,
                    ]}
                  >
                    {bubbleInner}
                  </View>
                ) : (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.orbHintGlowWrap,
                      isPassengerPreMatchWaitOrb ? styles.orbHintGlowWrapWaitMap : null,
                      Platform.OS === 'ios' ? { shadowOpacity: bubbleShadowOpacity } : null,
                    ]}
                  >
                    {bubbleInner}
                  </Animated.View>
                )
              ) : null}

              <View style={styles.fabOrbWrap} pointerEvents="box-none">
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
                <View style={styles.orbAiBadge} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text style={styles.orbAiBadgeText}>AI</Text>
                </View>
              </View>
            </Animated.View>
          </View>
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
  centerAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  passengerWaitMapAnchor: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'flex-start',
  },
  fabColumn: {
    alignItems: 'center',
    maxWidth: BUBBLE_MAX_W,
  },
  fabColumnWaitMap: {
    alignItems: 'flex-start',
  },
  fabOrbWrap: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    position: 'relative',
    overflow: 'visible',
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
  orbAiBadge: {
    position: 'absolute',
    top: -7,
    right: -5,
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 18, 32, 0.92)',
    borderWidth: StyleSheet.hairlineWidth + 0.5,
    borderColor: 'rgba(34, 211, 238, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: ORB_ACCENT_CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 5 },
    }),
  },
  orbAiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: ORB_ACCENT_CYAN,
    letterSpacing: 0.65,
  },
  orbHintGlowWrap: {
    marginBottom: 8,
    maxWidth: BUBBLE_MAX_W,
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: GLOW,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  orbHintGlowWrapWaitMap: {
    alignSelf: 'flex-start',
  },
  orbHintCapsule: {
    maxWidth: BUBBLE_MAX_W,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(8, 18, 32, 0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.32)',
    borderTopColor: 'rgba(34, 211, 238, 0.22)',
  },
  orbHintTail: {
    alignSelf: 'center',
    marginTop: -1,
    width: 10,
    height: 10,
    backgroundColor: 'rgba(8, 18, 32, 0.82)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34, 211, 238, 0.28)',
    transform: [{ rotate: '45deg' }],
    marginBottom: 2,
  },
  orbHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: ORB_TEXT_SOFT,
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 15,
  },
  orbHintAccent: {
    color: ORB_ACCENT_CYAN,
    fontWeight: '700',
  },
  orbCursor: {
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 1,
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
