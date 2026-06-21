/**
 * Feature flags — env-driven via EAS `env` (see eas.json).
 * Theme release (UX-RELEASE-THEME-1): LIGHT_THEME + THEME_CHOICE + THEME_SETTINGS default OFF when unset.
 */

function readBoolEnv(name: string): boolean {
  const value = process.env[name];
  return value === 'true' || value === '1';
}

/** B3-3 — first-run theme choice screen */
export const themeChoiceEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_THEME_CHOICE');

/** B3-4+ — light theme rendering */
export const lightThemeEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LIGHT_THEME');

/** B3-5 — settings hub Görünüm segment */
export const themeSettingsEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_THEME_SETTINGS');

/** B3-6a — comma list e.g. `auth` or `auth,role`; empty = no per-screen light surfaces */
function parseLightThemeScreens(): ReadonlySet<string> {
  const raw = process.env.EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS?.trim();
  if (!raw) return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export const lightThemeScreens = parseLightThemeScreens();

/** True when global light is on and this screen id is listed (or `*`). */
export function isLightThemeScreenEnabled(screenId: string): boolean {
  if (!lightThemeEnabled) return false;
  if (lightThemeScreens.size === 0) return false;
  if (lightThemeScreens.has('*')) return true;
  return lightThemeScreens.has(screenId);
}
