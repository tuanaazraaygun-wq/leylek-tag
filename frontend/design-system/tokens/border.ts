import { StyleSheet } from 'react-native';
import {
  PREMIUM_BORDER_SLATE,
  PREMIUM_ROLE_CARD_BORDER,
  PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
} from './color';

/** Standard hairline + 1 used across premium surfaces */
export const LDS_BORDER_WIDTH = {
  hairline: StyleSheet.hairlineWidth,
  standard: StyleSheet.hairlineWidth + 1,
  emphasis: 2,
} as const;

export const LDS_BORDER_COLOR = {
  slate: PREMIUM_BORDER_SLATE,
  card: PREMIUM_ROLE_CARD_BORDER,
  cardTopCyan: 'rgba(34,211,238,0.2)',
  cardLeftCyan: 'rgba(34,211,238,0.08)',
  cockpitEdge: PREMIUM_ROLE_COCKPIT_CYAN_EDGE,
  cockpitPanel: 'rgba(26,48,78,0.55)',
  cockpitPanelTop: 'rgba(34,211,238,0.22)',
  cockpitPanelLeft: 'rgba(34,211,238,0.08)',
  glassInnerRim: 'rgba(255,255,255,0.06)',
  glassInnerRimTop: 'rgba(255,255,255,0.12)',
  selected: 'rgba(34,211,238,0.58)',
  selectedTop: 'rgba(34,211,238,0.42)',
} as const;

export type LdsBorderWidthToken = keyof typeof LDS_BORDER_WIDTH;
export type LdsBorderColorToken = keyof typeof LDS_BORDER_COLOR;
