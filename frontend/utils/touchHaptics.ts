/**
 * Haptics: iOS + Android (eski sürümlerde Soft bazen sessiz kalıyor; Medium/Light öncelikli).
 * Android 15+ bazı cihazlarda expo-haptics etkisiz kalabiliyor; son çare kısa Vibration.
 */
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

function androidVibrateFallback(ms: number): void {
  try {
    if (Platform.OS !== 'android') return;
    // Kısa süre: çoğu motor için anlamlı tik; pattern yerine tek pulse daha tutarlı
    Vibration.vibrate(ms);
  } catch {
    /* yok say */
  }
}

/** Android 15+ (API 35+): expo-haptics bazı cihazlarda sessiz; klasik Vibrator daha tutarlı. */
function androidUseClassicVibrate(): boolean {
  if (Platform.OS !== 'android') return false;
  const v = Platform.Version;
  const api = typeof v === 'number' ? v : parseInt(String(v), 10);
  return !Number.isNaN(api) && api >= 35;
}

const ANDROID_BUTTON_STYLES: Haptics.ImpactFeedbackStyle[] = [
  Haptics.ImpactFeedbackStyle.Medium,
  Haptics.ImpactFeedbackStyle.Light,
  Haptics.ImpactFeedbackStyle.Heavy,
  Haptics.ImpactFeedbackStyle.Rigid,
];

const IOS_BUTTON_STYLES: Haptics.ImpactFeedbackStyle[] = [
  Haptics.ImpactFeedbackStyle.Medium,
  Haptics.ImpactFeedbackStyle.Light,
  Haptics.ImpactFeedbackStyle.Soft,
];

/** Klavye / OTP / PIN — ince tik. */
export async function keyCharHaptic(): Promise<void> {
  if (androidUseClassicVibrate()) {
    androidVibrateFallback(10);
    return;
  }
  try {
    await Haptics.selectionAsync();
    return;
  } catch {
    /* selection bazı cihazlarda yok */
  }
  for (const style of ANDROID_BUTTON_STYLES) {
    try {
      await Haptics.impactAsync(style);
      return;
    } catch {
      /* next */
    }
  }
  androidVibrateFallback(12);
}

/** Buton, chip, birincil dokunuşlar — Android’de belirgin titreşim. */
export async function tapButtonHaptic(): Promise<void> {
  if (androidUseClassicVibrate()) {
    androidVibrateFallback(22);
    return;
  }
  const order = Platform.OS === 'android' ? ANDROID_BUTTON_STYLES : IOS_BUTTON_STYLES;
  for (const style of order) {
    try {
      await Haptics.impactAsync(style);
      return;
    } catch {
      /* next */
    }
  }
  androidVibrateFallback(18);
}
