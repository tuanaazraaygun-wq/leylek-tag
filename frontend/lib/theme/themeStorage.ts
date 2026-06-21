import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResolvedTheme, ThemeMode } from './types';

export const THEME_MODE_STORAGE_KEY = 'lh_theme_mode_v1';
export const THEME_RESOLVED_STORAGE_KEY = 'lh_theme_resolved_v1';

export const DEFAULT_THEME_MODE: ThemeMode = 'dark';
export const HYDRATE_TIMEOUT_MS = 120;

const VALID_MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];

function normalizeThemeMode(raw: string | null): ThemeMode {
  if (raw && (VALID_MODES as readonly string[]).includes(raw)) {
    return raw as ThemeMode;
  }
  return DEFAULT_THEME_MODE;
}

function normalizeResolvedTheme(raw: string | null): ResolvedTheme | null {
  if (raw === 'dark' || raw === 'light') return raw;
  return null;
}

export function themeChoiceDoneKey(userId: string): string {
  return `lh_theme_choice_done_${String(userId || '').trim()}`;
}

export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const raw = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    return normalizeThemeMode(raw);
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  const next = normalizeThemeMode(mode);
  await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, next);
}

export async function getResolvedThemeCache(): Promise<ResolvedTheme | null> {
  try {
    const raw = await AsyncStorage.getItem(THEME_RESOLVED_STORAGE_KEY);
    return normalizeResolvedTheme(raw);
  } catch {
    return null;
  }
}

export async function setResolvedThemeCache(resolved: ResolvedTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_RESOLVED_STORAGE_KEY, resolved);
}

export async function isThemeChoiceDone(userId: string): Promise<boolean> {
  const uid = String(userId || '').trim();
  if (!uid) return false;
  try {
    const raw = await AsyncStorage.getItem(themeChoiceDoneKey(uid));
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function markThemeChoiceDone(userId: string): Promise<void> {
  const uid = String(userId || '').trim();
  if (!uid) return;
  await AsyncStorage.setItem(themeChoiceDoneKey(uid), 'true');
}
