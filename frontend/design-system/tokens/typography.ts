import type { TextStyle } from 'react-native';

/**
 * LDS typography scale — Apple-like hierarchy, 4px line-height snap where practical.
 */
export const LDS_TYPOGRAPHY = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0,
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  cta: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0,
  },
  step: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
} as const satisfies Record<string, TextStyle>;

export type LdsTypographyVariant = keyof typeof LDS_TYPOGRAPHY;
