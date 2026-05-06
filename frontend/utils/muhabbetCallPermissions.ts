/**
 * Muhabbet trip sesli arama — yalnız bu akış için mikrofon izni (TAG Agora’dan ayrı).
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { Audio } from 'expo-av';

export type MuhabbetMicPermissionResult = {
  granted: boolean;
  /** Android: kullanıcı bir daha sorulabilir mi */
  canAskAgain?: boolean;
};

export async function ensureMuhabbetCallMicPermission(): Promise<MuhabbetMicPermissionResult> {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    const granted = r === PermissionsAndroid.RESULTS.GRANTED;
    const canAskAgain = r !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    return { granted, canAskAgain };
  }
  const res = await Audio.requestPermissionsAsync();
  const granted = res.granted === true || res.status === 'granted';
  const canAskAgain = typeof res.canAskAgain === 'boolean' ? res.canAskAgain : undefined;
  return { granted, canAskAgain };
}
