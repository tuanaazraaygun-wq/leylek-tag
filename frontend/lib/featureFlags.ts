/**
 * Feature flags — env-driven via EAS `env` (see eas.json).
 * Theme flags default ON when unset (local release / Gradle APK).
 * Set EXPO_PUBLIC_FEATURE_*=false to disable explicitly.
 */

function readBoolEnv(name: string, defaultWhenUnset = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultWhenUnset;
  }
  if (value === 'false' || value === '0') return false;
  if (value === 'true' || value === '1') return true;
  return defaultWhenUnset;
}

/** B3-3 — first-run theme choice after OTP + legal (lh_theme_choice_done_${userId}) */
export const themeChoiceEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_THEME_CHOICE', true);

/** B3-4+ — light theme rendering */
export const lightThemeEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LIGHT_THEME', true);

/** B3-5 — settings hub Görünüm segment */
export const themeSettingsEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_THEME_SETTINGS', true);

/** B3-6a — comma list e.g. `auth` or `auth,role`; unset = `*` */
function parseLightThemeScreens(): ReadonlySet<string> {
  const raw = process.env.EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS;
  if (raw === undefined) return new Set(['*']);
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'false' || trimmed === '0') return new Set();
  return new Set(trimmed.split(',').map((s) => s.trim()).filter(Boolean));
}

export const lightThemeScreens = parseLightThemeScreens();

/** True when global light is on and this screen id is listed (or `*`). */
export function isLightThemeScreenEnabled(screenId: string): boolean {
  if (!lightThemeEnabled) return false;
  if (lightThemeScreens.size === 0) return false;
  if (lightThemeScreens.has('*')) return true;
  return lightThemeScreens.has(screenId);
}
