import { Easing } from 'react-native';

/**
 * LDS motion language — shared durations & curves (presentation layer).
 */
export const LDS_MOTION_DURATION = {
  instant: 120,
  standard: 280,
  enter: 420,
  exit: 280,
  emphasis: 520,
} as const;

export const LDS_MOTION_EASING = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  standard: Easing.inOut(Easing.quad),
} as const;

export const LDS_MOTION_SPRING = {
  default: { friction: 8, tension: 78 },
} as const;

export const LDS_MOTION_TRANSFORM = {
  pressScale: 0.98,
  enterTranslateY: 12,
  pressOpacity: 0.92,
  dimOpacity: 0.58,
} as const;

export type LdsMotionDurationToken = keyof typeof LDS_MOTION_DURATION;
