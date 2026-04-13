import { Platform } from 'react-native';

export const isNativeGoogleMapsSupported = () => {
  return Platform.OS === 'android' || Platform.OS === 'ios';
};