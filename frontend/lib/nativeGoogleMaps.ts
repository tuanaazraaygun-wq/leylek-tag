import { Platform } from 'react-native';

/** react-native-maps ile native Google Haritalar kullanılabilir mi (web hariç). */
export function isNativeGoogleMapsSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
