/**
 * Settings hub integration — B3-5 bridge over ThemeProvider.
 */

import { useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeMode } from './types';

export type ThemeSettingsBridge = {
  getThemeMode: () => ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isHydrated: () => boolean;
};

export function createThemeSettingsBridge(deps: ThemeSettingsBridge): ThemeSettingsBridge {
  return deps;
}

export function useThemeSettingsBridge(): ThemeSettingsBridge {
  const { themeMode, setTheme, hydrated } = useTheme();

  return useMemo(
    () =>
      createThemeSettingsBridge({
        getThemeMode: () => themeMode,
        setThemeMode: setTheme,
        isHydrated: () => hydrated,
      }),
    [themeMode, setTheme, hydrated],
  );
}
