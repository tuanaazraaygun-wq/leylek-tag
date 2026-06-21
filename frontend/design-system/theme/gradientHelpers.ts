/**
 * Theme-aware gradient helpers — B3-4.
 * Dark output references exact LDS gradient constants via useTheme().tokens.gradients.
 */

import { useTheme } from '../../hooks/useTheme';
import type { LhThemeGradientPresets } from '../../lib/theme/types';

export function useThemeGradients(): LhThemeGradientPresets {
  const { tokens } = useTheme();
  return tokens.gradients;
}
