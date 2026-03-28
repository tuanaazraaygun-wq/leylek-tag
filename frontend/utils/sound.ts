/**
 * Küçük UI sesleri — expo-av ile uzak URI (APK / tüm platformlar).
 * index.tsx bu modülü import eder; dosya yoksa EAS bundle patlıyordu.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

const SOUND_URLS = {
  tap: 'https://assets.mixkit.co/active_storage/sfx/1109/1109-preview.mp3',
  button: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
} as const;

async function playUri(uri: string, volume = 0.7): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('utils/sound playUri', e);
  }
}

/** Uygulama açılışında çağrılır; şu an ön yükleme yok (doğrudan URI yeterli). */
export async function loadSounds(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeAndroid: 1,
    });
  } catch {
    /* ignore */
  }
}

export async function playDigitClickSound(): Promise<void> {
  await playUri(SOUND_URLS.tap, 0.65);
}

export async function playButtonSound(): Promise<void> {
  await playUri(SOUND_URLS.button, 0.7);
}

/** Sadece rol seçim ekranı — giriş / yolcu paneli / harita tıklamaları sessiz. */
export async function playRoleScreenSound(): Promise<void> {
  await playUri(SOUND_URLS.button, 0.42);
}
