import {
  PREMIUM_NAVY_DEEP,
  PREMIUM_ROLE_FOREGROUND_SIDE_VIGNETTE,
} from './color';

/** Deep navy cockpit base — role / premium screens */
export const LDS_GRADIENT_COCKPIT_BASE = [
  '#020608',
  PREMIUM_NAVY_DEEP,
  '#081018',
] as const;

export const LDS_GRADIENT_COCKPIT_BASE_LOCATIONS = [0, 0.52, 1] as const;

/** Vertical top haze + bottom depth */
export const LDS_GRADIENT_COCKPIT_TOP_HAZE = [
  'rgba(34,211,238,0.025)',
  'transparent',
  'rgba(0,0,0,0.32)',
] as const;

export const LDS_GRADIENT_COCKPIT_TOP_HAZE_LOCATIONS = [0, 0.32, 1] as const;

/** Horizontal side vignette */
export const LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE = [
  ...PREMIUM_ROLE_FOREGROUND_SIDE_VIGNETTE,
] as const;

export const LDS_GRADIENT_COCKPIT_SIDE_VIGNETTE_LOCATIONS = [0, 0.5, 1] as const;

/** Panel glass sheen (cockpit shell) */
export const LDS_GRADIENT_GLASS_SHEEN_PANEL = [
  'rgba(255,255,255,0.055)',
  'rgba(255,255,255,0)',
  'rgba(34,211,238,0.02)',
] as const;

export const LDS_GRADIENT_GLASS_SHEEN_PANEL_LOCATIONS = [0, 0.22, 1] as const;

/** Header / title glass wash */
export const LDS_GRADIENT_GLASS_SHEEN_HEADER = [
  'rgba(34,211,238,0.12)',
  'rgba(8,17,31,0)',
  'rgba(34,211,238,0.07)',
] as const;

export const LDS_GRADIENT_GLASS_SHEEN_HEADER_LOCATIONS = [0, 0.52, 1] as const;

/** Selected card inner glow — vertical */
export const LDS_GRADIENT_SELECTION_GLOW_VERTICAL = [
  'rgba(34,211,238,0.22)',
  'rgba(34,211,238,0.08)',
  'rgba(8,17,31,0)',
] as const;

export const LDS_GRADIENT_SELECTION_GLOW_VERTICAL_LOCATIONS = [0, 0.38, 1] as const;

/** Selected card inner glow — horizontal wash */
export const LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL = [
  'rgba(34,211,238,0.1)',
  'transparent',
] as const;

export const LDS_GRADIENT_SELECTION_GLOW_HORIZONTAL_LOCATIONS = [0, 1] as const;
