/**
 * Semantic color tokens — base layer without LHIS primitive presets.
 */

import {
  PREMIUM_AUTH_CYAN,
  PREMIUM_AUTH_CTA_GRADIENT,
  PREMIUM_BORDER_SLATE,
  PREMIUM_GLASS_FILL,
  PREMIUM_NAVY_CARD,
  PREMIUM_NAVY_DEEP,
  PREMIUM_NAVY_MID,
  PREMIUM_ROLE_CARD_BG,
  PREMIUM_TEXT_MUTED,
  PREMIUM_TEXT_SOFT,
} from '../../components/auth/premiumAuthStyles';
import {
  LDS_COLOR_CTA_RIM,
  LDS_COLOR_ERROR,
  LDS_COLOR_URGENT,
} from '../../design-system/tokens/color';
import type {
  LhThemeAccentTokens,
  LhThemeBgTokens,
  LhThemeBorderTokens,
  LhThemeGradientTokens,
  LhThemeMapTokens,
  LhThemeShadowTokens,
  LhThemeStatusTokens,
  LhThemeTextTokens,
} from './types';

export type LhSemanticTokenBundle = {
  bg: LhThemeBgTokens;
  text: LhThemeTextTokens;
  border: LhThemeBorderTokens;
  accent: LhThemeAccentTokens;
  status: LhThemeStatusTokens;
  shadow: LhThemeShadowTokens;
  map: LhThemeMapTokens;
  gradient: LhThemeGradientTokens;
};

export const DARK_SEMANTIC_TOKENS: LhSemanticTokenBundle = {
  bg: {
    canvas: PREMIUM_NAVY_DEEP,
    canvasMid: PREMIUM_NAVY_MID,
    card: PREMIUM_NAVY_CARD,
    glass: PREMIUM_GLASS_FILL,
    glassMuted: PREMIUM_ROLE_CARD_BG,
    elevated: PREMIUM_NAVY_CARD,
  },
  text: {
    primary: PREMIUM_TEXT_SOFT,
    muted: PREMIUM_TEXT_MUTED,
    inverse: PREMIUM_NAVY_DEEP,
  },
  border: {
    default: PREMIUM_BORDER_SLATE,
    emphasis: LDS_COLOR_CTA_RIM,
    card: 'rgba(30,58,95,0.6)',
  },
  accent: {
    primary: PREMIUM_AUTH_CYAN,
    primaryHover: '#06B6D4',
    secondary: '#3FA9F5',
    glowLow: 'rgba(34,211,238,0.12)',
    glowMid: 'rgba(34,211,238,0.28)',
    glowHigh: 'rgba(34,211,238,0.45)',
  },
  status: {
    error: LDS_COLOR_ERROR,
    warning: LDS_COLOR_URGENT,
    success: '#34D399',
  },
  shadow: {
    ambient: 'rgba(0,0,0,0.25)',
    modal: 'rgba(0,0,0,0.45)',
  },
  map: {
    overlay: 'rgba(8,17,31,0.92)',
    chrome: 'rgba(11,18,32,0.88)',
  },
  gradient: {
    cockpitBase: [PREMIUM_NAVY_DEEP, PREMIUM_NAVY_MID, PREMIUM_NAVY_CARD],
    cockpitTopHaze: 'rgba(34,211,238,0.06)',
    cockpitSideVignette: 'rgba(0,0,0,0.35)',
    glassSheen: 'rgba(255,255,255,0.04)',
    cta: PREMIUM_AUTH_CTA_GRADIENT,
  },
};

export const LIGHT_SEMANTIC_TOKENS: LhSemanticTokenBundle = {
  bg: {
    canvas: '#F4F7FB',
    canvasMid: '#EEF2F7',
    card: '#FFFFFF',
    glass: 'rgba(255,255,255,0.72)',
    glassMuted: 'rgba(238,242,247,0.88)',
    elevated: '#FFFFFF',
  },
  text: {
    primary: 'rgba(13,17,23,0.92)',
    muted: '#64748B',
    inverse: '#F5F7FA',
  },
  border: {
    default: 'rgba(15,23,42,0.10)',
    emphasis: 'rgba(0,212,170,0.28)',
    card: 'rgba(15,23,42,0.08)',
  },
  accent: {
    primary: '#00D4AA',
    primaryHover: '#00BF9A',
    secondary: '#0EA5E9',
    glowLow: 'rgba(0,212,170,0.10)',
    glowMid: 'rgba(0,212,170,0.16)',
    glowHigh: 'rgba(0,212,170,0.22)',
  },
  status: {
    error: '#DC2626',
    warning: '#D97706',
    success: '#059669',
  },
  shadow: {
    ambient: 'rgba(15,23,42,0.08)',
    modal: 'rgba(15,23,42,0.14)',
  },
  map: {
    overlay: 'rgba(255,255,255,0.92)',
    chrome: 'rgba(244,247,251,0.94)',
  },
  gradient: {
    cockpitBase: ['#F8FAFC', '#F4F7FB', '#EEF2F7'],
    cockpitTopHaze: 'rgba(0,212,170,0.04)',
    cockpitSideVignette: 'rgba(15,23,42,0.03)',
    glassSheen: 'rgba(255,255,255,0.08)',
    cta: ['#00D4AA', '#22D3EE', '#0EA5E9'],
  },
};
