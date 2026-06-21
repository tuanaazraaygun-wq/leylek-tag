/**
 * Settings hub integration stub — B3-5.
 * No UI in B3-2; exposes a stable contract for future settings-hub.tsx wiring.
 */

import type { ThemeMode } from './types';

export type ThemeSettingsBridge = {
  getThemeMode: () => ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isHydrated: () => boolean;
};

export function createThemeSettingsBridge(deps: ThemeSettingsBridge): ThemeSettingsBridge {
  return deps;
}
