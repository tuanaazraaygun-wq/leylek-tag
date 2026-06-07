/**
 * Küçük UI sesleri — expo-av ile uzak URI (APK / tüm platformlar).
 * index.tsx bu modülü import eder; dosya yoksa EAS bundle patlıyordu.
 */
import { Platform, AppState } from 'react-native';
import { Audio } from 'expo-av';
import {
  DEFAULT_DRIVER_OFFER_SOUND,
  DEFAULT_DRIVER_OFFER_VOLUME,
  getDriverOfferSoundPreference,
  getDriverOfferSoundVolume,
  type DriverOfferSoundType,
} from '../lib/driverOfferSoundPrefs';
import { getPersistedUserRaw } from '../lib/sessionToken';

const SOUND_URLS = {
  tap: 'https://assets.mixkit.co/active_storage/sfx/1109/1109-preview.mp3',
  button: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
  /** Yumuşak bildirim (eşleşme); bundle yoksa bu URI kullanılır */
  matchChime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
} as const;

const MATCH_CHIME_VOLUME = 0.46;
const MATCH_CHIME_DEBOUNCE_MS = 2800;

/** Sürücü — yeni TAG / istek ön planda bildirim (cooldown) */
const DRIVER_NEW_OFFER_COOLDOWN_MS = 1000;

const DRIVER_OFFER_SOUND_SOURCES = {
  classic: require('../assets/sounds/driver-offer-classic.wav'),
  urgent: require('../assets/sounds/driver-offer-urgent.wav'),
  fallback: require('../assets/sounds/leylektag-luxury-tone.wav'),
} as const;

let matchChimeLoadPromise: Promise<Audio.Sound | null> | null = null;
let lastMatchChimeAt = 0;

let driverOfferSound: Audio.Sound | null = null;
let driverOfferLoadPromise: Promise<Audio.Sound | null> | null = null;
let driverOfferLoadedKind: DriverOfferSoundType | 'fallback' | null = null;
let lastDriverOfferLuxuryAt = 0;

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

async function resolveDriverOfferUserId(): Promise<string | null> {
  try {
    const raw = await getPersistedUserRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    const uid = String(parsed?.id || '').trim();
    return uid || null;
  } catch {
    return null;
  }
}

async function createDriverOfferSound(kind: DriverOfferSoundType): Promise<Audio.Sound | null> {
  const primarySource = DRIVER_OFFER_SOUND_SOURCES[kind];
  try {
    const { sound } = await Audio.Sound.createAsync(primarySource, {
      shouldPlay: false,
      volume: DEFAULT_DRIVER_OFFER_VOLUME,
      isLooping: false,
    });
    return sound;
  } catch (e) {
    if (__DEV__) console.warn(`utils/sound driver-offer ${kind} wav`, e);
    try {
      const { sound } = await Audio.Sound.createAsync(DRIVER_OFFER_SOUND_SOURCES.fallback, {
        shouldPlay: false,
        volume: DEFAULT_DRIVER_OFFER_VOLUME,
        isLooping: false,
      });
      return sound;
    } catch (e2) {
      if (__DEV__) console.warn('utils/sound driver-offer fallback wav', e2);
      return null;
    }
  }
}

async function unloadDriverOfferSoundInternal(): Promise<void> {
  driverOfferLoadPromise = null;
  driverOfferLoadedKind = null;
  const sound = driverOfferSound;
  driverOfferSound = null;
  if (!sound) return;
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    /* ignore */
  }
}

async function ensureDriverOfferSoundLoaded(kind: DriverOfferSoundType): Promise<Audio.Sound | null> {
  if (Platform.OS === 'web') return null;
  if (driverOfferLoadedKind === kind && driverOfferSound) {
    return driverOfferSound;
  }

  await unloadDriverOfferSoundInternal();

  if (!driverOfferLoadPromise) {
    driverOfferLoadPromise = (async (): Promise<Audio.Sound | null> => {
      try {
        await loadSounds();
        const sound = await createDriverOfferSound(kind);
        if (!sound) {
          driverOfferLoadPromise = null;
          return null;
        }
        driverOfferSound = sound;
        driverOfferLoadedKind = kind;
        return sound;
      } catch (e) {
        if (__DEV__) console.warn('ensureDriverOfferSoundLoaded', e);
        driverOfferLoadPromise = null;
        return null;
      }
    })();
  }

  return driverOfferLoadPromise;
}

async function playDriverOfferToneOnce(
  kind: DriverOfferSoundType,
  volume: number,
  opts?: { bypassCooldown?: boolean; useCache?: boolean },
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;

  const now = Date.now();
  if (!opts?.bypassCooldown && now - lastDriverOfferLuxuryAt < DRIVER_NEW_OFFER_COOLDOWN_MS) {
    return;
  }

  try {
    await loadSounds();

    if (opts?.useCache === false) {
      let sound: Audio.Sound | null = null;
      try {
        sound = await createDriverOfferSound(kind);
      } catch {
        sound = null;
      }
      if (!sound) return;
      await sound.setVolumeAsync(volume);
      await sound.setPositionAsync(0);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound?.unloadAsync().catch(() => {});
        }
      });
      return;
    }

    const sound = await ensureDriverOfferSoundLoaded(kind);
    if (!sound) return;
    if (!opts?.bypassCooldown) {
      lastDriverOfferLuxuryAt = now;
    }
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (e) {
    if (__DEV__) console.warn('playDriverOfferToneOnce', e);
  }
}

/**
 * Sürücü paneli — yeni talep/teklif (foreground). Çift tetik ve çakışma için cooldown.
 * Ses türü ve seviye AsyncStorage tercihlerinden okunur.
 */
export async function playDriverNewOfferLuxuryTone(): Promise<void> {
  const userId = await resolveDriverOfferUserId();
  const kind = userId ? await getDriverOfferSoundPreference(userId) : DEFAULT_DRIVER_OFFER_SOUND;
  const volume = userId ? await getDriverOfferSoundVolume(userId) : DEFAULT_DRIVER_OFFER_VOLUME;
  await playDriverOfferToneOnce(kind, volume, { useCache: true });
}

export type PreviewDriverOfferSoundOptions = {
  userId?: string;
  type?: DriverOfferSoundType;
  volume?: number;
};

/**
 * Ayarlar ekranı — seçilen sesi önizler.
 * Cooldown ve seenIds bypass; gerçek teklif akışını etkilemez.
 */
export async function previewDriverOfferSound(options?: PreviewDriverOfferSoundOptions): Promise<void> {
  const userId = options?.userId ?? (await resolveDriverOfferUserId());
  const kind =
    options?.type ??
    (userId ? await getDriverOfferSoundPreference(userId) : DEFAULT_DRIVER_OFFER_SOUND);
  const volume =
    options?.volume ??
    (userId ? await getDriverOfferSoundVolume(userId) : DEFAULT_DRIVER_OFFER_VOLUME);
  await playDriverOfferToneOnce(kind, volume, { bypassCooldown: true, useCache: false });
}

/** Tercih kaydedildiğinde önbelleği temizle */
export async function invalidateDriverOfferSoundCache(): Promise<void> {
  await unloadDriverNewOfferLuxuryTone();
}

/** DriverDashboard unmount — ses nesnesini boşalt (seenIds korunur) */
export async function unloadDriverNewOfferLuxuryTone(): Promise<void> {
  lastDriverOfferLuxuryAt = 0;
  await unloadDriverOfferSoundInternal();
}

// ── Sürücü teklif sesi — modül seviyesi dedupe (socket / push / poll) ──

const driverOfferSoundSeenIds = new Set<string>();
/** İlk poll öncesi socket/dispatch — hidrasyon sonrası tek chime */
const driverOfferSoundPendingIds = new Set<string>();
let driverOfferSoundHydrated = false;

export function parseDriverOfferTagFromPushData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const tagId = String(d.tag_id ?? '').trim();
  if (!tagId) return null;
  const t = String(d.type ?? '')
    .trim()
    .toLowerCase();
  const detail = String(d.detail_type ?? '')
    .trim()
    .toLowerCase();
  const offerTypes = new Set(['offer', 'new_offer', 'new_ride_request']);
  if (offerTypes.has(t) || offerTypes.has(detail)) return tagId;
  return null;
}

async function isPersistedDriverUser(): Promise<boolean> {
  try {
    const raw = await getPersistedUserRaw();
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { role?: string };
    return String(parsed?.role ?? '')
      .trim()
      .toLowerCase() === 'driver';
  } catch {
    return false;
  }
}

/** Socket / dispatch — poll hidrasyonu bitene kadar bekler (mevcut DriverDashboard davranışı) */
export function notifyDriverNewOfferSoundIfNeeded(tagKey: string | null | undefined): void {
  const id = String(tagKey || '').trim();
  if (!id) return;
  if (driverOfferSoundSeenIds.has(id)) return;
  if (!driverOfferSoundHydrated) {
    driverOfferSoundPendingIds.add(id);
    return;
  }
  driverOfferSoundSeenIds.add(id);
  void playDriverNewOfferLuxuryTone();
}

/**
 * Foreground FCM / Expo push — hidrasyon beklemeden çalar (dashboard mount değilken de).
 * App background/inactive ise playDriverNewOfferLuxuryTone zaten no-op.
 */
export function notifyDriverNewOfferSoundFromForegroundPush(tagKey: string | null | undefined): void {
  const id = String(tagKey || '').trim();
  if (!id) return;
  if (driverOfferSoundSeenIds.has(id)) return;
  driverOfferSoundSeenIds.add(id);
  driverOfferSoundPendingIds.delete(id);
  void playDriverNewOfferLuxuryTone();
}

/** driver/requests poll sonrası — ilk poll mevcut teklifleri sessiz işaretler */
export function finalizeDriverOfferPollSound(orderedTagIds: string[]): void {
  const uniq = [
    ...new Set(
      orderedTagIds
        .map((x) => String(x ?? '').trim())
        .filter((tid) => Boolean(tid)),
    ),
  ];
  if (!driverOfferSoundHydrated) {
    const initialIds = new Set(uniq);
    for (const tid of initialIds) {
      driverOfferSoundSeenIds.add(tid);
    }
    for (const tid of initialIds) {
      driverOfferSoundPendingIds.delete(tid);
    }
    driverOfferSoundHydrated = true;

    if (driverOfferSoundPendingIds.size > 0) {
      void playDriverNewOfferLuxuryTone();
      for (const pid of driverOfferSoundPendingIds) {
        driverOfferSoundSeenIds.add(pid);
      }
      driverOfferSoundPendingIds.clear();
    }
    return;
  }
  let anyNew = false;
  for (const tid of uniq) {
    if (!tid || driverOfferSoundSeenIds.has(tid)) continue;
    driverOfferSoundSeenIds.add(tid);
    anyNew = true;
  }
  if (anyNew) {
    void playDriverNewOfferLuxuryTone();
  }
}

/** Oturum kapanışı / logout (opsiyonel) */
export function resetDriverOfferSoundGate(): void {
  driverOfferSoundSeenIds.clear();
  driverOfferSoundPendingIds.clear();
  driverOfferSoundHydrated = false;
}

/** NotificationContext — foreground teklif push */
export async function tryPlayDriverOfferSoundFromPushData(data: unknown): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  const tagId = parseDriverOfferTagFromPushData(data);
  if (!tagId) return;
  if (!(await isPersistedDriverUser())) return;
  notifyDriverNewOfferSoundFromForegroundPush(tagId);
}
