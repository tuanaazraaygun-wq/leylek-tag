/**
 * Küçük UI sesleri — expo-av ile bundle WAV + LSX dedupe gates (B4-2).
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
import {
  driverOfferSessionGate,
  driverOfferToneCooldownGate,
  feedbackErrorCooldownGate,
  matchChimeCooldownGate,
  paymentConfirmedCooldownGate,
  qrScanSonicGate,
  quickMatchOpsCooldownGate,
  quickMatchOpsSessionGate,
  SONIC_DEDUPE_MS,
  uiTapCooldownGate,
} from '../lib/lsx/sonicDedupe';
import { registerSonicProductionHandlers } from '../lib/lsx/sonicController';
import { getPersistedUserRaw } from '../lib/sessionToken';

const SOUND_URLS = {
  tap: 'https://assets.mixkit.co/active_storage/sfx/1109/1109-preview.mp3',
  button: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
  /** Yumuşak bildirim (eşleşme); bundle yoksa bu URI kullanılır */
  matchChime: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
} as const;

const MATCH_CHIME_VOLUME = 0.46;

const DRIVER_OFFER_SOUND_SOURCES = {
  classic: require('../assets/sounds/driver-offer-classic.wav'),
  urgent: require('../assets/sounds/driver-offer-urgent.wav'),
  fallback: require('../assets/sounds/leylektag-luxury-tone.wav'),
} as const;

let matchChimeLoadPromise: Promise<Audio.Sound | null> | null = null;

let driverOfferSound: Audio.Sound | null = null;
let driverOfferLoadPromise: Promise<Audio.Sound | null> | null = null;
let driverOfferLoadedKind: DriverOfferSoundType | 'fallback' | null = null;

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

/**
 * @deprecated B4-2 — zero call sites; Mixkit URI off-brand. Removed in B4-4 orchestrator.
 */
export async function playDigitClickSound(): Promise<void> {
  await playUri(SOUND_URLS.tap, 0.65);
}

/**
 * @deprecated B4-2 — zero call sites; Mixkit URI off-brand. Removed in B4-4 orchestrator.
 */
export async function playButtonSound(): Promise<void> {
  await playUri(SOUND_URLS.button, 0.7);
}

/**
 * @deprecated B4-2 — zero call sites; use playUiTapSound for LSX ui.cta.press.
 */
export async function playRoleScreenSound(): Promise<void> {
  await playUri(SOUND_URLS.button, 0.42);
}

async function ensureMatchChimeLoaded(): Promise<Audio.Sound | null> {
  if (Platform.OS === 'web') return null;
  if (!matchChimeLoadPromise) {
    matchChimeLoadPromise = (async (): Promise<Audio.Sound | null> => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/match-chime.wav'),
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
  if (matchChimeCooldownGate.isCoolingDown()) return;
  try {
    await loadSounds();
    const sound = await ensureMatchChimeLoaded();
    if (!sound) return;
    matchChimeCooldownGate.markFired();
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

  if (!opts?.bypassCooldown && driverOfferToneCooldownGate.isCoolingDown()) {
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
      driverOfferToneCooldownGate.markFired();
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

/** RC-P0-2B — loop controller burst durdurma (QM ephemeral + normal cached pozisyon) */
export async function stopOfferAlertBurstPlayback(): Promise<void> {
  if (qmOpsAlertSound) {
    const qm = qmOpsAlertSound;
    qmOpsAlertSound = null;
    try {
      await qm.stopAsync();
      await qm.unloadAsync();
    } catch {
      /* ignore */
    }
  }
  if (driverOfferSound) {
    try {
      await driverOfferSound.stopAsync();
      await driverOfferSound.setPositionAsync(0);
    } catch {
      /* ignore */
    }
  }
}

/** RC-P0-2B — normal teklif alarm burst (max playMs, sonra dur) */
export async function playDriverOfferAlertBurst(playMs = 2000): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  try {
    await loadSounds();
    await stopOfferAlertBurstPlayback();
    const userId = await resolveDriverOfferUserId();
    const kind = userId ? await getDriverOfferSoundPreference(userId) : DEFAULT_DRIVER_OFFER_SOUND;
    const volume = userId ? await getDriverOfferSoundVolume(userId) : DEFAULT_DRIVER_OFFER_VOLUME;
    const sound = await ensureDriverOfferSoundLoaded(kind);
    if (!sound) return;
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        void sound.stopAsync().then(() => sound.setPositionAsync(0)).catch(() => {}).finally(resolve);
      }, playMs);
    });
  } catch (e) {
    if (__DEV__) console.warn('playDriverOfferAlertBurst', e);
  }
}

let qmOpsAlertSound: Audio.Sound | null = null;

const QUICK_MATCH_OPS_VOLUME = 0.62;
const QUICK_MATCH_OPS_SOUND_SOURCE = require('../assets/sounds/quick-match-driver-ops.wav');

/** RC-P0-2B — Quick Match ops alarm burst (max playMs) */
export async function playQuickMatchOfferAlertBurst(playMs = 2000): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  try {
    await loadSounds();
    await stopOfferAlertBurstPlayback();
    const { sound } = await Audio.Sound.createAsync(QUICK_MATCH_OPS_SOUND_SOURCE, {
      shouldPlay: false,
      volume: QUICK_MATCH_OPS_VOLUME,
      isLooping: false,
    });
    qmOpsAlertSound = sound;
    await sound.setPositionAsync(0);
    await sound.playAsync();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        void sound
          .stopAsync()
          .then(() => sound.unloadAsync())
          .catch(() => {})
          .finally(() => {
            if (qmOpsAlertSound === sound) {
              qmOpsAlertSound = null;
            }
            resolve();
          });
      }, playMs);
    });
  } catch (e) {
    if (__DEV__) console.warn('playQuickMatchOfferAlertBurst', e);
  }
}

/** Kabul / eşleşme — teklif alarm playback'ini durdur (chimed/baseline korunur) */
export async function stopDriverOfferAlarmPlayback(): Promise<void> {
  driverOfferToneCooldownGate.reset();
  await stopOfferAlertBurstPlayback();
  await unloadDriverOfferSoundInternal();
}

/** DriverDashboard unmount — ses nesnesini boşalt (chimed/baseline korunur) */
export async function unloadDriverNewOfferLuxuryTone(): Promise<void> {
  await stopDriverOfferAlarmPlayback();
}

// ── Sürücü teklif sesi — modül seviyesi dedupe (socket / push / poll) ──

function markDriverOfferChimedAndPlay(tagKey: string): void {
  if (!driverOfferSessionGate.tryMarkChimed(tagKey)) return;
  /* RC-P0-2B: playback — offerSoundController visibility sync (push/socket dedupe only) */
}

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

/**
 * Socket, dispatch-pending, foreground push — poll baseline ile bloklanmaz.
 * App background/inactive ise playDriverNewOfferLuxuryTone no-op.
 */
export function notifyDriverNewOfferSoundFromRealtimeOffer(
  tagKey: string | null | undefined,
): void {
  const id = String(tagKey || '').trim();
  if (!id) return;
  if (driverOfferSessionGate.chimedIds.has(id)) return;
  markDriverOfferChimedAndPlay(id);
}

/**
 * Foreground FCM / Expo push — realtime path ile aynı.
 */
export function notifyDriverNewOfferSoundFromForegroundPush(tagKey: string | null | undefined): void {
  notifyDriverNewOfferSoundFromRealtimeOffer(tagKey);
}

/** driver/requests poll sonrası — ilk poll resume baseline; sonraki poll yeni tag */
export function finalizeDriverOfferPollSound(orderedTagIds: string[]): void {
  const uniq = [
    ...new Set(
      orderedTagIds
        .map((x) => String(x ?? '').trim())
        .filter((tid) => Boolean(tid)),
    ),
  ];
  if (!driverOfferSessionGate.hydrated) {
    const initialIds = new Set(uniq);
    for (const tid of initialIds) {
      driverOfferSessionGate.baselineIds.add(tid);
    }
    driverOfferSessionGate.hydrated = true;

    for (const pid of driverOfferSessionGate.pendingRealtimeIds) {
      markDriverOfferChimedAndPlay(pid);
    }
    driverOfferSessionGate.pendingRealtimeIds.clear();
    return;
  }
  let anyNew = false;
  for (const tid of uniq) {
    if (!tid || driverOfferSessionGate.chimedIds.has(tid)) continue;
    driverOfferSessionGate.chimedIds.add(tid);
    anyNew = true;
  }
  if (anyNew) {
    /* RC-P0-2B: loop via offerSoundController sync — no one-shot here */
  }
}

/** Oturum kapanışı / logout (opsiyonel) */
export function resetDriverOfferSoundGate(): void {
  driverOfferSessionGate.reset();
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

// ── Quick Match sürücü daveti — operasyon çağrısı (dispatch teklif yolundan ayrı) ──

async function playQuickMatchDriverOpsCall(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  if (!quickMatchOpsCooldownGate.tryPass()) {
    return;
  }

  try {
    await loadSounds();
    const { sound } = await Audio.Sound.createAsync(QUICK_MATCH_OPS_SOUND_SOURCE, {
      shouldPlay: false,
      volume: QUICK_MATCH_OPS_VOLUME,
      isLooping: false,
    });
    await sound.setPositionAsync(0);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('playQuickMatchDriverOpsCall', e);
  }
}

/**
 * Quick Match — yeni sürücü daveti (foreground). Aynı invite_id tekrar çalmaz.
 * App background/inactive ise playQuickMatchDriverOpsCall no-op.
 */
export function notifyQuickMatchDriverOpsSoundFromInvite(inviteId: string): void {
  if (!quickMatchOpsSessionGate.tryMarkChimed(inviteId)) return;
  /* RC-P0-2B: loop via offerSoundController — session dedupe only */
}

/** Oturum kapanışı / QM driver session disable */
export function resetQuickMatchDriverOpsSoundGate(): void {
  quickMatchOpsSessionGate.reset();
}

// ── QR tarama — kısa onay / yumuşak uyarı ──

const QR_SCAN_SUCCESS_VOLUME = 0.5;
const QR_SCAN_ERROR_VOLUME = 0.48;

const QR_SCAN_SUCCESS_SOURCE = require('../assets/sounds/qr-scan-success.wav');
const QR_SCAN_ERROR_SOURCE = require('../assets/sounds/qr-scan-error.wav');

async function playQrScanToneOnce(source: number, volume: number, kind: 'success' | 'error'): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  if (!qrScanSonicGate.tryPass(kind)) return;

  try {
    await loadSounds();
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: false,
      volume,
      isLooping: false,
    });
    await sound.setPositionAsync(0);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    if (__DEV__) console.warn(`playQrScan${kind === 'success' ? 'Success' : 'Error'}Sound`, e);
  }
}

/** QR okuma geçerli — kısa onay blip */
export async function playQrScanSuccessSound(): Promise<void> {
  await playQrScanToneOnce(QR_SCAN_SUCCESS_SOURCE, QR_SCAN_SUCCESS_VOLUME, 'success');
}

/** QR okuma hatalı — yumuşak uyarı */
export async function playQrScanErrorSound(): Promise<void> {
  await playQrScanToneOnce(QR_SCAN_ERROR_SOURCE, QR_SCAN_ERROR_VOLUME, 'error');
}

// ── Ödeme / katkı onayı ──

const PAYMENT_CONFIRMED_VOLUME = 0.52;

const PAYMENT_CONFIRMED_SOURCE = require('../assets/sounds/payment-confirmed.wav');

/** Ödeme veya katkı onayı başarılı — güven / handshake tonu */
export async function playPaymentConfirmedSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  if (!paymentConfirmedCooldownGate.tryPass()) return;

  try {
    await loadSounds();
    const { sound } = await Audio.Sound.createAsync(PAYMENT_CONFIRMED_SOURCE, {
      shouldPlay: false,
      volume: PAYMENT_CONFIRMED_VOLUME,
      isLooping: false,
    });
    await sound.setPositionAsync(0);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('playPaymentConfirmedSound', e);
  }
}

// ── Kritik işlem hatası — yumuşak uyarı ──

const FEEDBACK_ERROR_VOLUME = 0.5;

const FEEDBACK_ERROR_SOURCE = require('../assets/sounds/feedback-error.wav');

/** Form / API işlemi başarısız — kritik geri bildirim */
export async function playFeedbackErrorSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  if (!feedbackErrorCooldownGate.tryPass()) return;

  try {
    await loadSounds();
    const { sound } = await Audio.Sound.createAsync(FEEDBACK_ERROR_SOURCE, {
      shouldPlay: false,
      volume: FEEDBACK_ERROR_VOLUME,
      isLooping: false,
    });
    await sound.setPositionAsync(0);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('playFeedbackErrorSound', e);
  }
}

// ── CTA micro tap — LSDS sonic.ui.tap ──

const UI_TAP_VOLUME = 0.4;

const UI_TAP_SOURCE = require('../assets/sounds/ui-tap.wav');

/** Birincil CTA dokunuşu — kısa micro click (global tap değil) */
export async function playUiTapSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  if (!uiTapCooldownGate.tryPass()) return;

  try {
    await loadSounds();
    const { sound } = await Audio.Sound.createAsync(UI_TAP_SOURCE, {
      shouldPlay: false,
      volume: UI_TAP_VOLUME,
      isLooping: false,
    });
    await sound.setPositionAsync(0);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('playUiTapSound', e);
  }
}

/** B4-2 — LSX registry sonic dispatch (flags OFF → no-op). */
export { playLsxSonicEvent } from '../lib/lsx/sonicController';

/** Re-export dedupe constants for tests / future orchestrator. */
export { SONIC_DEDUPE_MS };

registerSonicProductionHandlers({
  playMatchChimeSound,
  playDriverNewOfferLuxuryTone,
  playUiTapSound,
  playQrScanSuccessSound,
  playQrScanErrorSound,
  playPaymentConfirmedSound,
  playFeedbackErrorSound,
});
