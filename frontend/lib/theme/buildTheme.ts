/**
 * Runtime theme token builder.
 * Dark tokens sourced from premiumAuthStyles — must match production colors exactly.
 * Light tokens defined for B3-4; unused while lightThemeEnabled is false.
 */

import { lightThemeEnabled } from '../featureFlags';
import type { ColorSchemeName } from 'react-native';
import type { LhThemeTokens, ResolvedTheme, ThemeMode } from './types';
import { resolveThemeTokens } from './themeTokenResolver';

export function buildThemeTokens(resolved: ResolvedTheme): LhThemeTokens {
  return resolveThemeTokens(resolved);
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemScheme: ColorSchemeName | null | undefined,
): ResolvedTheme {
  if (!lightThemeEnabled) {
    return 'dark';
  }
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (systemScheme === 'light') return 'light';
  return 'dark';
}

export { DARK_SEMANTIC_TOKENS as DARK_TOKENS, LIGHT_SEMANTIC_TOKENS as LIGHT_TOKENS } from './semanticTokens';
