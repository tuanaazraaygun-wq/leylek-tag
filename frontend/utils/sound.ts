/**
 * Küçük UI sesleri — expo-av ile uzak URI (APK / tüm platformlar).
 * index.tsx bu modülü import eder; dosya yoksa EAS bundle patlıyordu.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

const SOUND_URLS = {
  tap: 'https://assets.mixkit.co/active_storage/sfx/1109/1109-preview.mp3',
  button: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
  /** Yumuşak bildirim (eşleşme); bundle yoksa bu URI kullanılır */
  matchChime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
} as const;

const MATCH_CHIME_VOLUME = 0.46;
const MATCH_CHIME_DEBOUNCE_MS = 2800;

let matchChimeLoadPromise: Promise<Audio.Sound | null> | null = null;
let lastMatchChimeAt = 0;

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

async function ensureMatchChimeLoaded(): Promise<Audio.Sound | null> {
  if (Platform.OS === 'web') return null;
  if (!matchChimeLoadPromise) {
    matchChimeLoadPromise = (async (): Promise<Audio.Sound | null> => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../assets/sounds/match-chime.mp3'),
          { shouldPlay: false, volume: MATCH_CHIME_VOLUME, isLooping: false },
        );
        return sound;
      } catch (e) {
        if (__DEV__) console.warn('utils/sound match-chime bundle', e);
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: SOUND_URLS.matchChime },
            { shouldPlay: false, volume: MATCH_CHIME_VOLUME, isLooping: false },
          );
          return sound;
        } catch (e2) {
          if (__DEV__) console.warn('utils/sound match-chime uri', e2);
          matchChimeLoadPromise = null;
          return null;
        }
      }
    })();
  }
  return matchChimeLoadPromise;
}

/**
 * Eşleşme anı — yolcu ve sürücü (ding-dong tarzı, düşük ses).
 * Socket + yerel kabul aynı anda tetiklenirse tek çalma (debounce).
 */
export async function playMatchChimeSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  const now = Date.now();
  if (now - lastMatchChimeAt < MATCH_CHIME_DEBOUNCE_MS) return;
  try {
    await loadSounds();
    const sound = await ensureMatchChimeLoaded();
    if (!sound) return;
    lastMatchChimeAt = now;
    await sound.setVolumeAsync(MATCH_CHIME_VOLUME);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (e) {
    if (__DEV__) console.warn('playMatchChimeSound', e);
  }
}
