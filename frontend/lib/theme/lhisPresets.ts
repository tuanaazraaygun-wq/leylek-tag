/**
 * LHIS primitive presets — dark values are exact LDS token imports (byte-identical when flag OFF).
 */

import { Platform, type ViewStyle } from 'react-native';
import {
  LDS_BORDER_COLOR,
  LDS_BORDER_WIDTH,
} from '../../design-system/tokens/border';
import { LDS_ELEVATION } from '../../design-system/tokens/elevation';
import {
  LDS_GRADIENT_COCKPIT_BASE,
  LDS_GRADIENT_COCKPIT_BASE_LOCATIONS,
  LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE,
  LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE_LOCATIONS,
  LDS_GRADIENT_COCKPIT_TOP_HAZE,
  LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS,
  LDS_GRADIENT_GLASS_SHEEN_HEADER,
  LDS_GRADIENT_GLASS_SHEEN_HEADER_LOCATIONS,
  LDS_GRADIENT_GLASS_SHEEN_PANEL,
  LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
  LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL,
  LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL_LOCATIONS,
  LDS_GRADIENT_SELECTION_GLOW_VERTICAL,
  LDS_GRADIENT_SELECTION_GLOW_VERTICAL_LOCATIONS,
} from '../../design-system/tokens/gradient';
import { LDS_RADIUS } from '../../design-system/tokens/radius';
import type {
  LhGlassSurfacePresets,
  LhThemeElevationPresets,
  LhThemeGradientPresets,
  LhThemeSelectionCardPresets,
  ResolvedTheme,
} from './types';

export const DARK_GRADIENT_PRESETS: LhThemeGradientPresets = {
  cockpitBase: LDS_GRADIENT_COCKPIT_BASE,
  cockpitBaseLocations: LDS_GRADIENT_COCKPIT_BASE_LOCATIONS,
  cockpitTopHaze: LDS_GRADIENT_COCKPIT_TOP_HAZE,
  cockpitTopHazeLocations: LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS,
  cockpitSideVignette: LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE,
  cockpitSideVignetteLocations: LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE_LOCATIONS,
  glassSheenPanel: LDS_GRADIENT_GLASS_SHEEN_PANEL,
  glassSheenPanelLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
  glassSheenHeader: LDS_GRADIENT_GLASS_SHEEN_HEADER,
  glassSheenHeaderLocations: LDS_GRADIENT_GLASS_SHEEN_HEADER_LOCATIONS,
  selectionGlowVertical: LDS_GRADIENT_SELECTION_GLOW_VERTICAL,
  selectionGlowVerticalLocations: LDS_GRADIENT_SELECTION_GLOW_VERTICAL_LOCATIONS,
  selectionGlowHorizontal: LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL,
  selectionGlowHorizontalLocations: LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL_LOCATIONS,
};

export const DARK_GLASS_SURFACE_PRESETS: LhGlassSurfacePresets = {
  panel: {
    backgroundColor: 'rgba(5,11,24,0.44)',
    borderColor: LDS_BORDER_COLOR.cockpitPanel,
    borderTopColor: LDS_BORDER_COLOR.cockpitPanelTop,
    borderLeftColor: LDS_BORDER_COLOR.cockpitPanelLeft,
    borderRadius: 26,
    sheen: LDS_GRADIENT_GLASS_SHEEN_PANEL,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
  header: {
    backgroundColor: 'rgba(8,13,24,0.97)',
    borderColor: 'rgba(30,58,95,0.78)',
    borderTopColor: LDS_BORDER_COLOR.cockpitEdge,
    borderRadius: LDS_RADIUS.lg,
    sheen: LDS_GRADIENT_GLASS_SHEEN_HEADER,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_HEADER_LOCATIONS,
    sheenStart: { x: 0, y: 0 },
    sheenEnd: { x: 1, y: 1 },
  },
  stage: {
    backgroundColor: 'rgba(6,14,26,0.72)',
    borderColor: 'rgba(34,211,238,0.14)',
    borderTopColor: 'rgba(34,211,238,0.22)',
    borderRadius: LDS_RADIUS.lg,
    sheen: LDS_GRADIENT_GLASS_SHEEN_PANEL,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
  plain: {
    backgroundColor: 'rgba(16,26,43,0.87)',
    borderColor: LDS_BORDER_COLOR.card,
    borderTopColor: LDS_BORDER_COLOR.cardTopCyan,
    borderLeftColor: LDS_BORDER_COLOR.cardLeftCyan,
    borderRadius: LDS_RADIUS.cardPrimary,
    sheen: LDS_GRADIENT_GLASS_SHEEN_PANEL,
    sheenLocations: LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
};

export const DARK_SELECTION_CARD_PRESETS: LhThemeSelectionCardPresets = {
  cardBackground: 'rgba(16,26,43,0.87)',
  cardSelectedBackground: 'rgba(10,22,38,0.98)',
  heroBackground: 'rgba(4,10,20,0.55)',
  heroSelectedBackground: 'rgba(34,211,238,0.05)',
  heroBorderBottom: 'rgba(34,211,238,0.1)',
  selectionGlowHorizontalOpacity: 0.65,
};

export const DARK_ELEVATION_PRESETS: LhThemeElevationPresets = LDS_ELEVATION;

const LIGHT_ELEVATION_PRESETS: LhThemeElevationPresets = {
  flat: Platform.select({
    ios: {},
    android: { elevation: 0 },
    default: {},
  }),
  chip: Platform.select({
    ios: {
      shadowColor: 'rgba(15,23,42,0.12)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
    default: {},
  }),
  panel: Platform.select({
    ios: {
      shadowColor: 'rgba(15,23,42,0.10)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 14,
    },
    android: { elevation: 6 },
    default: {},
  }),
  cockpit: Platform.select({
    ios: {
      shadowColor: 'rgba(15,23,42,0.08)',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
    default: {},
  }),
  cta: Platform.select({
    ios: {
      shadowColor: 'rgba(0,212,170,0.18)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 14,
    },
    android: { elevation: 10 },
    default: {},
  }),
};

const LIGHT_GRADIENT_PRESETS: LhThemeGradientPresets = {
  cockpitBase: ['#F8FAFC', '#F4F7FB', '#EEF2F7'],
  cockpitBaseLocations: [0, 0.52, 1],
  cockpitTopHaze: ['rgba(0,212,170,0.04)', 'transparent', 'rgba(15,23,42,0.03)'],
  cockpitTopHazeLocations: [0, 0.32, 1],
  cockpitSideVignette: ['rgba(15,23,42,0.03)', 'transparent', 'rgba(15,23,42,0.03)'],
  cockpitSideVignetteLocations: [0, 0.5, 1],
  glassSheenPanel: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(0,212,170,0.03)'],
  glassSheenPanelLocations: [0, 0.22, 1],
  glassSheenHeader: ['rgba(0,212,170,0.08)', 'rgba(255,255,255,0)', 'rgba(0,212,170,0.05)'],
  glassSheenHeaderLocations: [0, 0.52, 1],
  selectionGlowVertical: ['rgba(0,212,170,0.16)', 'rgba(0,212,170,0.06)', 'rgba(255,255,255,0)'],
  selectionGlowVerticalLocations: [0, 0.38, 1],
  selectionGlowHorizontal: ['rgba(0,212,170,0.08)', 'transparent'],
  selectionGlowHorizontalLocations: [0, 1],
};

const LIGHT_GLASS_SURFACE_PRESETS: LhGlassSurfacePresets = {
  panel: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(15,23,42,0.10)',
    borderTopColor: 'rgba(0,212,170,0.18)',
    borderLeftColor: 'rgba(0,212,170,0.08)',
    borderRadius: 26,
    sheen: LIGHT_GRADIENT_PRESETS.glassSheenPanel,
    sheenLocations: LIGHT_GRADIENT_PRESETS.glassSheenPanelLocations,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(15,23,42,0.10)',
    borderTopColor: 'rgba(0,212,170,0.22)',
    borderRadius: LDS_RADIUS.lg,
    sheen: LIGHT_GRADIENT_PRESETS.glassSheenHeader,
    sheenLocations: LIGHT_GRADIENT_PRESETS.glassSheenHeaderLocations,
    sheenStart: { x: 0, y: 0 },
    sheenEnd: { x: 1, y: 1 },
  },
  stage: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderColor: 'rgba(0,212,170,0.14)',
    borderTopColor: 'rgba(0,212,170,0.22)',
    borderRadius: LDS_RADIUS.lg,
    sheen: LIGHT_GRADIENT_PRESETS.glassSheenPanel,
    sheenLocations: LIGHT_GRADIENT_PRESETS.glassSheenPanelLocations,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
  plain: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(15,23,42,0.08)',
    borderTopColor: 'rgba(0,212,170,0.12)',
    borderLeftColor: 'rgba(0,212,170,0.06)',
    borderRadius: LDS_RADIUS.cardPrimary,
    sheen: LIGHT_GRADIENT_PRESETS.glassSheenPanel,
    sheenLocations: LIGHT_GRADIENT_PRESETS.glassSheenPanelLocations,
    sheenStart: { x: 0.08, y: 0 },
    sheenEnd: { x: 0.55, y: 0.95 },
  },
};

const LIGHT_SELECTION_CARD_PRESETS: LhThemeSelectionCardPresets = {
  cardBackground: '#FFFFFF',
  cardSelectedBackground: 'rgba(244,247,251,0.98)',
  heroBackground: 'rgba(238,242,247,0.88)',
  heroSelectedBackground: 'rgba(0,212,170,0.06)',
  heroBorderBottom: 'rgba(0,212,170,0.12)',
  selectionGlowHorizontalOpacity: 0.55,
};

export function buildLhisPresets(resolved: ResolvedTheme): {
  gradients: LhThemeGradientPresets;
  glassSurface: LhGlassSurfacePresets;
  selectionCard: LhThemeSelectionCardPresets;
  elevation: LhThemeElevationPresets;
  borderColors: typeof LDS_BORDER_COLOR;
  borderWidths: typeof LDS_BORDER_WIDTH;
} {
  if (resolved === 'light') {
    return {
      gradients: LIGHT_GRADIENT_PRESETS,
      glassSurface: LIGHT_GLASS_SURFACE_PRESETS,
      selectionCard: LIGHT_SELECTION_CARD_PRESETS,
      elevation: LIGHT_ELEVATION_PRESETS,
      borderColors: {
        ...LDS_BORDER_COLOR,
        card: 'rgba(15,23,42,0.08)',
        cardTopCyan: 'rgba(0,212,170,0.12)',
        cardLeftCyan: 'rgba(0,212,170,0.06)',
        cockpitEdge: 'rgba(0,212,170,0.22)',
        cockpitPanel: 'rgba(15,23,42,0.10)',
        cockpitPanelTop: 'rgba(0,212,170,0.18)',
        cockpitPanelLeft: 'rgba(0,212,170,0.08)',
        glassInnerRim: 'rgba(15,23,42,0.06)',
        glassInnerRimTop: 'rgba(255,255,255,0.40)',
        selected: 'rgba(0,212,170,0.42)',
        selectedTop: 'rgba(0,212,170,0.28)',
        slate: 'rgba(15,23,42,0.10)',
      },
      borderWidths: LDS_BORDER_WIDTH,
    };
  }

  return {
    gradients: DARK_GRADIENT_PRESETS,
    glassSurface: DARK_GLASS_SURFACE_PRESETS,
    selectionCard: DARK_SELECTION_CARD_PRESETS,
    elevation: DARK_ELEVATION_PRESETS,
    borderColors: LDS_BORDER_COLOR,
    borderWidths: LDS_BORDER_WIDTH,
  };
}

export type LhisPresetBundle = ReturnType<typeof buildLhisPresets>;
