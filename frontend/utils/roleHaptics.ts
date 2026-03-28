/**
 * Haptic feedback for the role-selection screen (same feel as other primary taps).
 */
import { tapButtonHaptic } from './touchHaptics';

export async function roleScreenHaptic(): Promise<void> {
  await tapButtonHaptic();
}
