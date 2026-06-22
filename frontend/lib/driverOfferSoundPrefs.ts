import AsyncStorage from '@react-native-async-storage/async-storage';

export type DriverOfferSoundType = 'classic' | 'urgent';

export const DEFAULT_DRIVER_OFFER_SOUND: DriverOfferSoundType = 'classic';
export const DEFAULT_DRIVER_OFFER_VOLUME = 0.9;

const MIN_VOLUME = 0;
const MAX_VOLUME = 1;

export function driverOfferSoundPreferenceKey(userId: string): string {
  return `driver_offer_sound_preference_${userId}`;
}

export function driverOfferSoundVolumeKey(userId: string): string {
  return `driver_offer_sound_volume_${userId}`;
}

function normalizeSoundType(raw: string | null): DriverOfferSoundType {
  if (raw === 'urgent') return 'urgent';
  return DEFAULT_DRIVER_OFFER_SOUND;
}

function normalizeVolume(raw: string | null): number {
  if (raw == null || raw === '') return DEFAULT_DRIVER_OFFER_VOLUME;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_DRIVER_OFFER_VOLUME;
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, parsed));
}

export async function getDriverOfferSoundPreference(userId: string): Promise<DriverOfferSoundType> {
  const uid = String(userId || '').trim();
  if (!uid) return DEFAULT_DRIVER_OFFER_SOUND;
  try {
    const raw = await AsyncStorage.getItem(driverOfferSoundPreferenceKey(uid));
    return normalizeSoundType(raw);
  } catch {
    return DEFAULT_DRIVER_OFFER_SOUND;
  }
}

export async function setDriverOfferSoundPreference(
  userId: string,
  preference: DriverOfferSoundType,
): Promise<void> {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const next = preference === 'urgent' ? 'urgent' : DEFAULT_DRIVER_OFFER_SOUND;
  await AsyncStorage.setItem(driverOfferSoundPreferenceKey(uid), next);
}

export async function getDriverOfferSoundVolume(userId: string): Promise<number> {
  const uid = String(userId || '').trim();
  if (!uid) return DEFAULT_DRIVER_OFFER_VOLUME;
  try {
    const raw = await AsyncStorage.getItem(driverOfferSoundVolumeKey(uid));
    return normalizeVolume(raw);
  } catch {
    return DEFAULT_DRIVER_OFFER_VOLUME;
  }
}

export async function setDriverOfferSoundVolume(userId: string, volume: number): Promise<number> {
  const uid = String(userId || '').trim();
  const normalized = normalizeVolume(String(volume));
  if (!uid) return normalized;
  await AsyncStorage.setItem(driverOfferSoundVolumeKey(uid), String(normalized));
  return normalized;
}
