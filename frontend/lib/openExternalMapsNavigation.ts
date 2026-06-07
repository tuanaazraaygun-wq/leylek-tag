import { Linking, Platform } from 'react-native';

export type ExternalMapsProvider = 'google' | 'apple';

function googleMapsWebUrl(latitude: number, longitude: number): string {
  const q = `${latitude},${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;
}

function nativeUrlFor(
  provider: ExternalMapsProvider,
  latitude: number,
  longitude: number,
): string | null {
  const q = `${latitude},${longitude}`;
  if (provider === 'apple') {
    if (Platform.OS !== 'ios') return null;
    return `http://maps.apple.com/?daddr=${encodeURIComponent(q)}&dirflg=d`;
  }
  if (Platform.OS === 'android') {
    return `google.navigation:q=${encodeURIComponent(q)}&mode=d`;
  }
  return `comgooglemaps://?daddr=${encodeURIComponent(q)}&directionsmode=driving`;
}

/** Dış harita navigasyonu — trip state / iç nav dokunulmaz. */
export async function openExternalMapsNavigation(
  provider: ExternalMapsProvider,
  latitude: number,
  longitude: number,
  _label?: string,
): Promise<boolean> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.warn('[external_maps] invalid coords', { latitude, longitude });
    return false;
  }

  const webUrl = googleMapsWebUrl(latitude, longitude);

  if (provider === 'apple') {
    const appleUrl = nativeUrlFor('apple', latitude, longitude);
    if (!appleUrl) return false;
    try {
      await Linking.openURL(appleUrl);
      return true;
    } catch (err) {
      console.warn('[external_maps] apple open failed', err);
      return false;
    }
  }

  const nativeUrl = nativeUrlFor('google', latitude, longitude);
  try {
    if (nativeUrl) {
      let canNative = false;
      try {
        canNative = await Linking.canOpenURL(nativeUrl);
      } catch {
        canNative = false;
      }
      if (canNative) {
        await Linking.openURL(nativeUrl);
        return true;
      }
    }
    await Linking.openURL(webUrl);
    return true;
  } catch (err) {
    console.warn('[external_maps] google native failed, trying web', err);
    try {
      await Linking.openURL(webUrl);
      return true;
    } catch (webErr) {
      console.warn('[external_maps] web fallback failed', webErr);
      return false;
    }
  }
}
