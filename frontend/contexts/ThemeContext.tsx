/**
 * ThemeProvider — LHIS theme infrastructure (B3-2).
 * Loads/hydrates/persists theme mode; forces dark while lightThemeEnabled is false.
 * No UI components consume this yet — zero visual change in B3-2.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { buildThemeTokens, resolveThemeMode } from '../lib/theme/buildTheme';
import {
  DEFAULT_THEME_MODE,
  HYDRATE_TIMEOUT_MS,
  getThemeMode,
  setResolvedThemeCache,
  setThemeMode as persistThemeMode,
} from '../lib/theme/themeStorage';
import type { LhThemeTokens, ResolvedTheme, ThemeMode } from '../lib/theme/types';

export type ThemeContextValue = {
  themeMode: ThemeMode;
  tokens: LhThemeTokens;
  isDark: boolean;
  isLight: boolean;
  setTheme: (mode: ThemeMode) => Promise<void>;
  systemTheme: ResolvedTheme;
  resolvedTheme: ResolvedTheme;
  hydrated: boolean;
  load: () => Promise<ThemeMode>;
  hydrate: () => Promise<void>;
  persist: (mode: ThemeMode) => Promise<void>;
  changeTheme: (mode: ThemeMode) => Promise<void>;
  getCurrentTheme: () => ThemeMode;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [hydrated, setHydrated] = useState(false);
  const themeModeRef = useRef<ThemeMode>(DEFAULT_THEME_MODE);

  const systemTheme: ResolvedTheme = deviceScheme === 'light' ? 'light' : 'dark';

  const resolvedTheme = useMemo(
    () => resolveThemeMode(themeMode, deviceScheme),
    [themeMode, deviceScheme],
  );

  const tokens = useMemo(() => buildThemeTokens(resolvedTheme), [resolvedTheme]);

  themeModeRef.current = themeMode;

  const persist = useCallback(async (mode: ThemeMode) => {
    await persistThemeMode(mode);
    const resolved = resolveThemeMode(mode, deviceScheme);
    await setResolvedThemeCache(resolved);
  }, [deviceScheme]);

  const load = useCallback(async (): Promise<ThemeMode> => {
    return getThemeMode();
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const mode = await Promise.race([
        getThemeMode(),
        new Promise<ThemeMode>((resolve) => {
          setTimeout(() => resolve(DEFAULT_THEME_MODE), HYDRATE_TIMEOUT_MS);
        }),
      ]);
      setThemeModeState(mode);
      themeModeRef.current = mode;
      await setResolvedThemeCache(resolveThemeMode(mode, deviceScheme));
    } catch {
      setThemeModeState(DEFAULT_THEME_MODE);
      themeModeRef.current = DEFAULT_THEME_MODE;
    } finally {
      setHydrated(true);
    }
  }, [deviceScheme]);

  const changeTheme = useCallback(
    async (mode: ThemeMode) => {
      setThemeModeState(mode);
      themeModeRef.current = mode;
      await persist(mode);
    },
    [persist],
  );

  const setTheme = changeTheme;

  const getCurrentTheme = useCallback((): ThemeMode => themeModeRef.current, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void setResolvedThemeCache(resolvedTheme);
  }, [hydrated, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      tokens,
      isDark: resolvedTheme === 'dark',
      isLight: resolvedTheme === 'light',
      setTheme,
      systemTheme,
      resolvedTheme,
      hydrated,
      load,
      hydrate,
      persist,
      changeTheme,
      getCurrentTheme,
    }),
    [
      themeMode,
      tokens,
      setTheme,
      systemTheme,
      resolvedTheme,
      hydrated,
      load,
      hydrate,
      persist,
      changeTheme,
      getCurrentTheme,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export { ThemeContext };
