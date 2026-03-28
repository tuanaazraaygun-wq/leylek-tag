/**
 * Haptics: iOS + Android (eski sürümlerde Soft bazen sessiz kalıyor; Medium/Light öncelikli).
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

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
}

/** Buton, chip, birincil dokunuşlar — Android’de belirgin titreşim. */
export async function tapButtonHaptic(): Promise<void> {
  const order = Platform.OS === 'android' ? ANDROID_BUTTON_STYLES : IOS_BUTTON_STYLES;
  for (const style of order) {
    try {
      await Haptics.impactAsync(style);
      return;
    } catch {
      /* next */
    }
  }
}
