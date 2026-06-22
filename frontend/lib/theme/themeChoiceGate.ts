/**
 * Theme choice flow gate — B3-3.
 * No-op when themeChoiceEnabled is false.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { themeChoiceEnabled } from '../featureFlags';
import { themeChoiceDoneKey } from './themeStorage';
import type { ThemeMode } from './types';

export const THEME_CHOICE_DONE_LOCAL_KEY = 'lh_theme_choice_done_local';

export function resolveThemeChoiceDoneKey(userId?: string | null): string {
  const uid = String(userId ?? '').trim();
  return uid ? themeChoiceDoneKey(uid) : THEME_CHOICE_DONE_LOCAL_KEY;
}

export async function shouldShowThemeChoice(userId?: string | null): Promise<boolean> {
  if (!themeChoiceEnabled) return false;
  try {
    const raw = await AsyncStorage.getItem(resolveThemeChoiceDoneKey(userId));
    return raw !== 'true';
  } catch {
    return true;
  }
}

export async function markThemeChoiceDone(userId?: string | null): Promise<void> {
  await AsyncStorage.setItem(resolveThemeChoiceDoneKey(userId), 'true');
}

export async function maybeNavigateToThemeChoice(
  userId: string | null | undefined,
  setScreen: (screen: 'theme-choice' | 'role-select') => void,
): Promise<boolean> {
  const show = await shouldShowThemeChoice(userId);
  if (!show) return false;
  setScreen('theme-choice');
  return true;
}

/** Post-auth landing — theme education first (once), else role-select. No role-select flash. */
export async function navigateToPostAuthLanding(
  userId: string | null | undefined,
  setScreen: (screen: 'theme-choice' | 'role-select') => void,
): Promise<void> {
  if (userId && themeChoiceEnabled) {
    const navigated = await maybeNavigateToThemeChoice(userId, setScreen);
    if (navigated) return;
  }
  setScreen('role-select');
}

/** Continue CTA — theme already applied on card tap; persist one-time done flag only. */
export async function finishThemeChoiceOnContinue(userId?: string | null | undefined): Promise<void> {
  await markThemeChoiceDone(userId);
}

/** @deprecated Prefer tap-to-apply + finishThemeChoiceOnContinue on Continue. */
export async function completeThemeChoice(
  userId: string | null | undefined,
  mode: ThemeMode,
  setTheme: (mode: ThemeMode) => Promise<void>,
): Promise<void> {
  await setTheme(mode);
  await markThemeChoiceDone(userId);
}
