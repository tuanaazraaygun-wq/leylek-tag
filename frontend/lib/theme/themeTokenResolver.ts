/**
 * Theme token resolver — merges semantic + LHIS primitive presets.
 */

import { buildLhisPresets } from './lhisPresets';
import { DARK_SEMANTIC_TOKENS, LIGHT_SEMANTIC_TOKENS } from './semanticTokens';
import type { LhThemeTokens, ResolvedTheme } from './types';

const DARK_BUTTON_PRESETS = {
  bodyActiveBackground: 'rgba(16,26,43,0.9)',
  bodyDisabledBackground: 'rgba(8,17,31,0.55)',
  bodyDisabledOpacity: 0.72,
  labelColor: '#FFFFFF',
} as const;

const LIGHT_BUTTON_PRESETS = {
  bodyActiveBackground: '#FFFFFF',
  bodyDisabledBackground: 'rgba(238,242,247,0.88)',
  bodyDisabledOpacity: 0.72,
  labelColor: '#F5F7FA',
} as const;

function attachPresets(base: typeof DARK_SEMANTIC_TOKENS | typeof LIGHT_SEMANTIC_TOKENS, resolved: ResolvedTheme): LhThemeTokens {
  const lhis = buildLhisPresets(resolved);
  return {
    ...base,
    gradients: lhis.gradients,
    glassSurface: lhis.glassSurface,
    selectionCard: lhis.selectionCard,
    elevation: lhis.elevation,
    borderColors: lhis.borderColors,
    borderWidths: lhis.borderWidths,
    button: resolved === 'light' ? LIGHT_BUTTON_PRESETS : DARK_BUTTON_PRESETS,
  };
}

export function resolveThemeTokens(resolved: ResolvedTheme): LhThemeTokens {
  const base = resolved === 'light' ? LIGHT_SEMANTIC_TOKENS : DARK_SEMANTIC_TOKENS;
  return attachPresets(base, resolved);
}

/** Static dark bundle — identical to resolveThemeTokens('dark') for regression tests. */
export const RESOLVED_DARK_THEME_TOKENS: LhThemeTokens = attachPresets(DARK_SEMANTIC_TOKENS, 'dark');
