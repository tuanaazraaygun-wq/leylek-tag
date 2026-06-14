import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import {
  LDS_MOTION_DURATION,
  LDS_MOTION_TRANSFORM,
} from '../tokens/motion';

const SELECTION_MS = LDS_MOTION_DURATION.standard;
const PRESS_MS = LDS_MOTION_DURATION.instant;

type UseSelectionMotionOptions = {
  selected: boolean;
};

export function useSelectionMotion({ selected }: UseSelectionMotionOptions) {
  const selection = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(selected ? LDS_MOTION_TRANSFORM.selectionScale : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(selection, {
        toValue: selected ? 1 : 0,
        duration: SELECTION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: selected ? LDS_MOTION_TRANSFORM.selectionScale : 1,
        duration: SELECTION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, selected, selection]);

  const onPressIn = useCallback(() => {
    const target = (selected ? LDS_MOTION_TRANSFORM.selectionScale : 1) * LDS_MOTION_TRANSFORM.pressScale;
    Animated.timing(scale, {
      toValue: target,
      duration: PRESS_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [scale, selected]);

  const onPressOut = useCallback(() => {
    Animated.timing(scale, {
      toValue: selected ? LDS_MOTION_TRANSFORM.selectionScale : 1,
      duration: PRESS_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [scale, selected]);

  const glowOpacity = selection.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const borderRingOpacity = selection.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.55, 1],
  });

  return {
    scale,
    glowOpacity,
    borderRingOpacity,
    onPressIn,
    onPressOut,
  };
}
