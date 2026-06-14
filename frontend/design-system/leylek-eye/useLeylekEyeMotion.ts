import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { LDS_MOTION_DURATION } from '../tokens/motion';

const BREATH_MS = 3200;
const GAZE_HOLD_MS = 1400;
const GAZE_TRAVEL_MS = 900;
const BLINK_CLOSE_MS = 110;
const BLINK_OPEN_MS = 160;
const BLINK_MIN_MS = 3800;
const BLINK_MAX_MS = 7200;
const FOCUS_MS = LDS_MOTION_DURATION.standard;
const GAZE_OFFSET = 11;
const PUPIL_EXTRA_OFFSET = 4;

type UseLeylekEyeMotionOptions = {
  reduceMotion?: boolean;
};

export type LeylekEyeMotion = {
  breathScale: Animated.AnimatedInterpolation<number>;
  lookTranslateX: Animated.AnimatedInterpolation<number>;
  pupilExtraTranslateX: Animated.AnimatedInterpolation<number>;
  eyelidTranslateY: Animated.AnimatedInterpolation<number>;
  rimOpacity: Animated.AnimatedInterpolation<number>;
  containerScale: Animated.AnimatedInterpolation<number>;
  triggerFocus: () => void;
};

export function useLeylekEyeMotion({
  reduceMotion = false,
}: UseLeylekEyeMotionOptions = {}): LeylekEyeMotion {
  const breath = useRef(new Animated.Value(0)).current;
  const look = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const rim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const idleLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const gazeLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const stopIdle = useCallback(() => {
    idleLoopRef.current?.stop();
    idleLoopRef.current = null;
    gazeLoopRef.current?.stop();
    gazeLoopRef.current = null;
    if (blinkTimerRef.current) {
      clearTimeout(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }
  }, []);

  const scheduleBlink = useCallback(() => {
    if (!mountedRef.current || reduceMotion) return;
    const delay =
      BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
    blinkTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 1,
          duration: BLINK_CLOSE_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 0,
          duration: BLINK_OPEN_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        scheduleBlink();
      });
    }, delay);
  }, [blink, reduceMotion]);

  const startIdle = useCallback(() => {
    stopIdle();
    breath.setValue(0);
    look.setValue(0);
    blink.setValue(0);
    rim.setValue(0);
    pressScale.setValue(1);

    if (reduceMotion) return;

    idleLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    idleLoopRef.current.start();

    const gazeRight = Animated.timing(look, {
      toValue: 1,
      duration: GAZE_TRAVEL_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const gazeCenterFromRight = Animated.timing(look, {
      toValue: 0,
      duration: GAZE_TRAVEL_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const gazeLeft = Animated.timing(look, {
      toValue: -1,
      duration: GAZE_TRAVEL_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const gazeCenterFromLeft = Animated.timing(look, {
      toValue: 0,
      duration: GAZE_TRAVEL_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const hold = (ms: number) => Animated.delay(ms);

    gazeLoopRef.current = Animated.loop(
      Animated.sequence([
        hold(GAZE_HOLD_MS),
        gazeRight,
        hold(GAZE_HOLD_MS),
        gazeCenterFromRight,
        hold(GAZE_HOLD_MS * 0.85),
        gazeLeft,
        hold(GAZE_HOLD_MS * 0.75),
        gazeCenterFromLeft,
        hold(GAZE_HOLD_MS),
      ]),
    );
    gazeLoopRef.current.start();
    scheduleBlink();
  }, [
    breath,
    blink,
    look,
    pressScale,
    reduceMotion,
    rim,
    scheduleBlink,
    stopIdle,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    startIdle();
    return () => {
      mountedRef.current = false;
      stopIdle();
    };
  }, [startIdle, stopIdle]);

  const triggerFocus = useCallback(() => {
    gazeLoopRef.current?.stop();
    look.stopAnimation();
    Animated.timing(look, {
      toValue: 0,
      duration: reduceMotion ? 0 : FOCUS_MS * 0.55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !reduceMotion) {
        gazeLoopRef.current?.start();
      }
    });

    Animated.parallel([
      Animated.sequence([
        Animated.timing(pressScale, {
          toValue: 1.03,
          duration: reduceMotion ? 0 : FOCUS_MS * 0.45,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pressScale, {
          toValue: 1,
          duration: reduceMotion ? 0 : FOCUS_MS * 0.55,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(rim, {
          toValue: 1,
          duration: reduceMotion ? 0 : FOCUS_MS * 0.35,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rim, {
          toValue: 0,
          duration: reduceMotion ? 0 : FOCUS_MS * 0.65,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [look, pressScale, reduceMotion, rim]);

  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.018],
  });

  const lookTranslateX = look.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-GAZE_OFFSET, 0, GAZE_OFFSET],
  });

  const pupilExtraTranslateX = look.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-PUPIL_EXTRA_OFFSET, 0, PUPIL_EXTRA_OFFSET],
  });

  const eyelidTranslateY = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 20],
  });

  const rimOpacity = rim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const containerScale = Animated.multiply(breathScale, pressScale);

  return {
    breathScale,
    lookTranslateX,
    pupilExtraTranslateX,
    eyelidTranslateY,
    rimOpacity,
    containerScale,
    triggerFocus,
  };
}
