import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { LDS_MOTION_DURATION } from '../tokens/motion';

export type LeylekEyeMotionProfile = 'fab' | 'guardian';

type MotionProfileConfig = {
  enableIdleGaze: boolean;
  breathMs: number;
  breathScaleMax: number;
  blinkMinMs: number;
  blinkMaxMs: number;
  blinkCloseMs: number;
  blinkOpenMs: number;
};

const MOTION_PROFILES: Record<LeylekEyeMotionProfile, MotionProfileConfig> = {
  fab: {
    enableIdleGaze: true,
    breathMs: 3400,
    breathScaleMax: 1.016,
    blinkMinMs: 4000,
    blinkMaxMs: 8000,
    blinkCloseMs: 100,
    blinkOpenMs: 200,
  },
  guardian: {
    enableIdleGaze: false,
    breathMs: 4600,
    breathScaleMax: 1.008,
    blinkMinMs: 6500,
    blinkMaxMs: 12000,
    blinkCloseMs: 100,
    blinkOpenMs: 200,
  },
};

const GAZE_HOLD_MS = 900;
const GAZE_TRAVEL_MS = 780;
const FOCUS_MS = LDS_MOTION_DURATION.standard;
const GAZE_OFFSET = 14;
const PUPIL_EXTRA_OFFSET = 6;
const GAZE_Y_OFFSET = 2.5;

/** SVG transform props — native driver unreliable on Android/Hermes */
const SVG_DRIVER = false;

type UseLeylekEyeMotionOptions = {
  reduceMotion?: boolean;
  motionProfile?: LeylekEyeMotionProfile;
};

export type LeylekEyeMotion = {
  breathScale: Animated.AnimatedInterpolation<number>;
  lookTranslateX: Animated.AnimatedInterpolation<number>;
  lookTranslateY: Animated.AnimatedInterpolation<number>;
  pupilExtraTranslateX: Animated.AnimatedInterpolation<number>;
  eyelidUpperTranslateY: Animated.AnimatedInterpolation<number>;
  eyelidLowerTranslateY: Animated.AnimatedInterpolation<number>;
  rimOpacity: Animated.AnimatedInterpolation<number>;
  containerScale: Animated.AnimatedInterpolation<number>;
  triggerFocus: () => void;
};

export function useLeylekEyeMotion({
  reduceMotion = false,
  motionProfile = 'fab',
}: UseLeylekEyeMotionOptions = {}): LeylekEyeMotion {
  const profile = MOTION_PROFILES[motionProfile];

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
      profile.blinkMinMs + Math.random() * (profile.blinkMaxMs - profile.blinkMinMs);
    blinkTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 1,
          duration: profile.blinkCloseMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: SVG_DRIVER,
        }),
        Animated.timing(blink, {
          toValue: 0,
          duration: profile.blinkOpenMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: SVG_DRIVER,
        }),
      ]).start(() => {
        scheduleBlink();
      });
    }, delay);
  }, [blink, profile, reduceMotion]);

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
          duration: profile.breathMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: profile.breathMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    idleLoopRef.current.start();

    if (profile.enableIdleGaze) {
      const gazeRight = Animated.timing(look, {
        toValue: 1,
        duration: GAZE_TRAVEL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: SVG_DRIVER,
      });
      const gazeCenterFromRight = Animated.timing(look, {
        toValue: 0,
        duration: GAZE_TRAVEL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: SVG_DRIVER,
      });
      const gazeLeft = Animated.timing(look, {
        toValue: -1,
        duration: GAZE_TRAVEL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: SVG_DRIVER,
      });
      const gazeCenterFromLeft = Animated.timing(look, {
        toValue: 0,
        duration: GAZE_TRAVEL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: SVG_DRIVER,
      });
      const hold = (ms: number) => Animated.delay(ms);

      gazeLoopRef.current = Animated.loop(
        Animated.sequence([
          hold(GAZE_HOLD_MS),
          gazeRight,
          hold(GAZE_HOLD_MS * 0.85),
          gazeCenterFromRight,
          hold(GAZE_HOLD_MS * 0.7),
          gazeLeft,
          hold(GAZE_HOLD_MS * 0.8),
          gazeCenterFromLeft,
          hold(GAZE_HOLD_MS),
        ]),
      );
      gazeLoopRef.current.start();
    }

    scheduleBlink();
  }, [
    breath,
    blink,
    look,
    pressScale,
    profile,
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
      duration: reduceMotion ? 0 : FOCUS_MS * 0.5,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: SVG_DRIVER,
    }).start(({ finished }) => {
      if (finished && !reduceMotion && profile.enableIdleGaze) {
        gazeLoopRef.current?.start();
      }
    });

    Animated.parallel([
      Animated.sequence([
        Animated.timing(pressScale, {
          toValue: 1.028,
          duration: reduceMotion ? 0 : FOCUS_MS * 0.4,
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
          duration: reduceMotion ? 0 : FOCUS_MS * 0.32,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rim, {
          toValue: 0,
          duration: reduceMotion ? 0 : FOCUS_MS * 0.6,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [look, pressScale, profile.enableIdleGaze, reduceMotion, rim]);

  const breathScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, profile.breathScaleMax],
  });

  const lookTranslateX = look.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-GAZE_OFFSET, 0, GAZE_OFFSET],
  });

  const lookTranslateY = look.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [GAZE_Y_OFFSET * 0.35, 0, -GAZE_Y_OFFSET * 0.25],
  });

  const pupilExtraTranslateX = look.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-PUPIL_EXTRA_OFFSET, 0, PUPIL_EXTRA_OFFSET],
  });

  const eyelidUpperTranslateY = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [-32, 24],
  });

  const eyelidLowerTranslateY = blink.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 8],
  });

  const rimOpacity = rim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.48],
  });

  const containerScale = Animated.multiply(breathScale, pressScale);

  return {
    breathScale,
    lookTranslateX,
    lookTranslateY,
    pupilExtraTranslateX,
    eyelidUpperTranslateY,
    eyelidLowerTranslateY,
    rimOpacity,
    containerScale,
    triggerFocus,
  };
}
