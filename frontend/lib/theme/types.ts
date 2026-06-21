/**
 * LHIS theme types — semantic token shape from lh-theme-tokens.json (B3-1).
 */

import type { ViewStyle } from 'react-native';

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

export type LhGlassSurfaceVariant = 'panel' | 'header' | 'stage' | 'plain';

export type LhGlassSurfacePreset = {
  backgroundColor: string;
  borderColor: string;
  borderTopColor: string;
  borderLeftColor?: string;
  borderRadius: number;
  sheen: readonly string[];
  sheenLocations: readonly number[];
  sheenStart: { x: number; y: number };
  sheenEnd: { x: number; y: number };
};

export type LhGlassSurfacePresets = Record<LhGlassSurfaceVariant, LhGlassSurfacePreset>;

export type LhThemeGradientPresets = {
  cockpitBase: readonly [string, string, string];
  cockpitBaseLocations: readonly [number, number, number];
  cockpitTopHaze: readonly [string, string, string];
  cockpitTopHazeLocations: readonly [number, number, number];
  cockpitSideVignette: readonly [string, string, string];
  cockpitSideVignetteLocations: readonly [number, number, number];
  glassSheenPanel: readonly [string, string, string];
  glassSheenPanelLocations: readonly [number, number, number];
  glassSheenHeader: readonly [string, string, string];
  glassSheenHeaderLocations: readonly [number, number, number];
  selectionGlowVertical: readonly [string, string, string];
  selectionGlowVerticalLocations: readonly [number, number, number];
  selectionGlowHorizontal: readonly [string, ...string[]];
  selectionGlowHorizontalLocations: readonly [number, ...number[]];
};

export type LhThemeSelectionCardPresets = {
  cardBackground: string;
  cardSelectedBackground: string;
  heroBackground: string;
  heroSelectedBackground: string;
  heroBorderBottom: string;
  selectionGlowHorizontalOpacity: number;
};

export type LhThemeElevationPresets = {
  flat: ViewStyle;
  chip: ViewStyle;
  panel: ViewStyle;
  cockpit: ViewStyle;
  cta: ViewStyle;
};

export type LhThemeButtonPresets = {
  bodyActiveBackground: string;
  bodyDisabledBackground: string;
  bodyDisabledOpacity: number;
  labelColor: string;
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
  gradients: LhThemeGradientPresets;
  glassSurface: LhGlassSurfacePresets;
  selectionCard: LhThemeSelectionCardPresets;
  elevation: LhThemeElevationPresets;
  button: LhThemeButtonPresets;
  borderColors: {
    slate: string;
    card: string;
    cardTopCyan: string;
    cardLeftCyan: string;
    cockpitEdge: string;
    cockpitPanel: string;
    cockpitPanelTop: string;
    cockpitPanelLeft: string;
    glassInnerRim: string;
    glassInnerRimTop: string;
    selected: string;
    selectedTop: string;
  };
  borderWidths: {
    hairline: number;
    standard: number;
    emphasis: number;
  };
};
