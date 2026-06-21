/**
 * Feature flags — env-driven, default OFF.
 * B3-2: themeChoiceEnabled + lightThemeEnabled remain false until B3-3+.
 */

function readBoolEnv(name: string): boolean {
  const value = process.env[name];
  return value === 'true' || value === '1';
}

/** B3-3 — first-run theme choice screen */
export const themeChoiceEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_THEME_CHOICE');

/** B3-4+ — light theme rendering */
export const lightThemeEnabled = readBoolEnv('EXPO_PUBLIC_FEATURE_LIGHT_THEME');
