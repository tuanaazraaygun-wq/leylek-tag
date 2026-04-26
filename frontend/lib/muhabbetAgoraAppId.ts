import Constants from 'expo-constants';
import { AGORA_APP_ID as DEFAULT_AGORA_APP_ID } from './agoraAppId';

type ExtraShape = {
  muhabbetAgoraAppId?: string;
};

export function getMuhabbetAgoraAppId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_MUHABBET_AGORA_APP_ID?.trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as ExtraShape | undefined;
  const fromExtra = extra?.muhabbetAgoraAppId?.trim();
  if (fromExtra) return fromExtra;
  return DEFAULT_AGORA_APP_ID;
}

export const MUHABBET_AGORA_APP_ID = getMuhabbetAgoraAppId();
