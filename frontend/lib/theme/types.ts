/**
 * LHIS theme types — semantic token shape from lh-theme-tokens.json (B3-1).
 */

export type ThemeMode = 'dark' | 'light' | 'system';

export type ResolvedTheme = 'dark' | 'light';

export type LhThemeBgTokens = {
  canvas: string;
  canvasMid: string;
  card: string;
  glass: string;
  glassMuted: string;
  elevated: string;
};

export type LhThemeTextTokens = {
  primary: string;
  muted: string;
  inverse: string;
};

export type LhThemeBorderTokens = {
  default: string;
  emphasis: string;
  card: string;
};

export type LhThemeAccentTokens = {
  primary: string;
  primaryHover: string;
  secondary: string;
  glowLow: string;
  glowMid: string;
  glowHigh: string;
};

export type LhThemeStatusTokens = {
  error: string;
  warning: string;
  success: string;
};

export type LhThemeShadowTokens = {
  ambient: string;
  modal: string;
};

export type LhThemeMapTokens = {
  overlay: string;
  chrome: string;
};

export type LhThemeGradientTokens = {
  cockpitBase: readonly [string, string, string];
  cockpitTopHaze: string;
  cockpitSideVignette: string;
  glassSheen: string;
  cta: readonly string[];
};

export type LhThemeTokens = {
  bg: LhThemeBgTokens;
  text: LhThemeTextTokens;
  border: LhThemeBorderTokens;
  accent: LhThemeAccentTokens;
  status: LhThemeStatusTokens;
  shadow: LhThemeShadowTokens;
  map: LhThemeMapTokens;
  gradient: LhThemeGradientTokens;
};
