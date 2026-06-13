import { Platform } from 'react-native';
import { PREMIUM_AUTH_CYAN, PREMIUM_NAVY_DEEP } from './color';

/**
 * LDS elevation presets — iOS shadow + Android elevation pairs.
 */
export const LDS_ELEVATION = {
  flat: Platform.select({
    ios: {},
    android: { elevation: 0 },
    default: {},
  }),
  chip: Platform.select({
    ios: {
      shadowColor: PREMIUM_NAVY_DEEP,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
  panel: Platform.select({
    ios: {
      shadowColor: PREMIUM_NAVY_DEEP,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
    },
    android: { elevation: 8 },
    default: {},
  }),
  cockpit: Platform.select({
    ios: {
      shadowColor: '#01050c',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.42,
      shadowRadius: 26,
    },
    android: { elevation: 11 },
    default: {},
  }),
  cta: Platform.select({
    ios: {
      shadowColor: PREMIUM_AUTH_CYAN,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.15,
      shadowRadius: 18,
    },
    android: { elevation: 13 },
    default: {},
  }),
} as const;

export type LdsElevationToken = keyof typeof LDS_ELEVATION;
