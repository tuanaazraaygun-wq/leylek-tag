/**
 * Theme-aware shadow / elevation helpers — B3-4.
 */

import { useTheme } from '../../hooks/useTheme';
import type { LhThemeElevationPresets } from '../../lib/theme/types';

export function useThemeShadows(): LhThemeElevationPresets {
  const { tokens } = useTheme();
  return tokens.elevation;
}
