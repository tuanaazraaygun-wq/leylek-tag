/**
 * Geçici TestFlight / internal test debug paneli.
 * Production App Store kullanıcılarında kapalı kalır.
 *
 * Açık olduğunda:
 * - __DEV__ === true (Metro / dev client), veya
 * - EXPO_PUBLIC_ENABLE_TESTFLIGHT_DEBUG_PANEL=1 (EAS internal/preview build env)
 */
import Constants from 'expo-constants';

function readTestFlightDebugFlag(): string {
  const extra = Constants.expoConfig?.extra as
    | { enableTestFlightDebugPanel?: string | boolean }
    | undefined;
  const fromExtra = extra?.enableTestFlightDebugPanel;
  if (fromExtra != null && String(fromExtra).trim() !== '') {
    return String(fromExtra).trim().toLowerCase();
  }
  return String(process.env.EXPO_PUBLIC_ENABLE_TESTFLIGHT_DEBUG_PANEL ?? '')
    .trim()
    .toLowerCase();
}

export function isTestFlightDebugPanelEnabled(): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  const flag = readTestFlightDebugFlag();
  return flag === '1' || flag === 'true' || flag === 'yes';
}
