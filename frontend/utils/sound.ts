/**
 * Küçük UI sesleri — expo-av ile bundle WAV + LSX dedupe gates (B4-2).
 * index.tsx bu modülü import eder; dosya yoksa EAS bundle patlıyordu.
 */
import { Platform, AppState } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
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
  chatInboundCooldownGate,
  forceEndAlertCooldownGate,
  forceEndAlertSessionGate,
  SONIC_DEDUPE_MS,
  uiTapCooldownGate,
  videoTrustCallCooldownGate,
  videoTrustCallSessionGate,
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

const IOS_CRITICAL_ALERT_VOLUME = 0.95;
const IOS_CALL_INCOMING_VOLUME = 1.0;
const IOS_OFFER_ALERT_VOLUME_FLOOR = 0.95;

const VIDEO_TRUST_CALL_VOLUME_BASE = 0.44;
const FORCE_END_ALERT_VOLUME_BASE = 0.4;

function iosAudioModePatch(): {
  interruptionModeIOS?: typeof InterruptionModeIOS.DuckOthers;
} {
  if (Platform.OS !== 'ios') return {};
  return { interruptionModeIOS: InterruptionModeIOS.DuckOthers };
}

function androidAudioModePatch(): {
  interruptionModeAndroid: typeof InterruptionModeAndroid.DuckOthers;
} {
  return { interruptionModeAndroid: InterruptionModeAndroid.DuckOthers };
}

function resolveIosOfferAlertVolume(volume: number): number {
  if (Platform.OS !== 'ios') return volume;
  return Math.max(volume, IOS_OFFER_ALERT_VOLUME_FLOOR);
}

function resolveVideoTrustCallVolume(): number {
  return Platform.OS === 'ios' ? IOS_CRITICAL_ALERT_VOLUME : VIDEO_TRUST_CALL_VOLUME_BASE;
}

function resolveForceEndAlertVolume(): number {
  return Platform.OS === 'ios' ? IOS_CRITICAL_ALERT_VOLUME : FORCE_END_ALERT_VOLUME_BASE;
}

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

/** UI / QR / match — standard ducking for mixed playback. */
export async function loadSounds(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      ...iosAudioModePatch(),
      ...androidAudioModePatch(),
    });
  } catch {
    /* ignore */
  }
}

/** Offer alert bursts — louder, no Android ducking (restored by loadSounds on UI tones). */
export async function loadOfferAlertAudioMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      ...iosAudioModePatch(),
      ...androidAudioModePatch(),
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
  const volume = resolveIosOfferAlertVolume(
    userId ? await getDriverOfferSoundVolume(userId) : DEFAULT_DRIVER_OFFER_VOLUME,
  );
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
  const volume = resolveIosOfferAlertVolume(
    options?.volume ??
      (userId ? await getDriverOfferSoundVolume(userId) : DEFAULT_DRIVER_OFFER_VOLUME),
  );
  await playDriverOfferToneOnce(kind, volume, { bypassCooldown: true, useCache: false });
}

/** Tercih kaydedildiğinde önbelleği temizle */
export async function invalidateDriverOfferSoundCache(): Promise<void> {
  await unloadDriverNewOfferLuxuryTone();
}

/** RC-P0-2B — loop controller burst durdurma (QM/TDM ephemeral + normal cached pozisyon) */
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
  if (tdmOpsAlertSound) {
    const tdm = tdmOpsAlertSound;
    tdmOpsAlertSound = null;
    try {
      await tdm.stopAsync();
      await tdm.unloadAsync();
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
    await loadOfferAlertAudioMode();
    await stopOfferAlertBurstPlayback();
    const userId = await resolveDriverOfferUserId();
    const kind = userId ? await getDriverOfferSoundPreference(userId) : DEFAULT_DRIVER_OFFER_SOUND;
    const volume = resolveIosOfferAlertVolume(
      userId ? await getDriverOfferSoundVolume(userId) : DEFAULT_DRIVER_OFFER_VOLUME,
    );
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
let tdmOpsAlertSound: Audio.Sound | null = null;

const QUICK_MATCH_OPS_VOLUME = 0.9;
const TRUSTED_DIRECT_OPS_VOLUME = 0.92;
const QUICK_MATCH_OPS_SOUND_SOURCE = require('../assets/sounds/quick-match-driver-ops.wav');
/** Future: frontend/assets/sounds/trusted-direct-driver-invite.wav */
const TRUSTED_DIRECT_OPS_SOUND_SOURCE = require('../assets/sounds/driver-offer-urgent.wav');

async function playEphemeralOfferAlertBurst(
  source: number,
  volume: number,
  slot: 'qm' | 'tdm',
  playMs: number,
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  const alertVolume = resolveIosOfferAlertVolume(volume);
  try {
    await loadOfferAlertAudioMode();
    await stopOfferAlertBurstPlayback();
    const { sound } = await Audio.Sound.createAsync(source, {
      shouldPlay: false,
      volume: alertVolume,
      isLooping: false,
    });
    if (slot === 'qm') {
      qmOpsAlertSound = sound;
    } else {
      tdmOpsAlertSound = sound;
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        void sound
          .stopAsync()
          .then(() => sound.unloadAsync())
          .catch(() => {})
          .finally(() => {
            if (slot === 'qm' && qmOpsAlertSound === sound) {
              qmOpsAlertSound = null;
            }
            if (slot === 'tdm' && tdmOpsAlertSound === sound) {
              tdmOpsAlertSound = null;
            }
            resolve();
          });
      }, playMs);
    });
  } catch (e) {
    if (__DEV__) {
      console.warn(slot === 'qm' ? 'playQuickMatchOfferAlertBurst' : 'playTrustedDirectOfferAlertBurst', e);
    }
  }
}

/** RC-P0-2B — Quick Match ops alarm burst (max playMs) */
export async function playQuickMatchOfferAlertBurst(playMs = 2000): Promise<void> {
  await playEphemeralOfferAlertBurst(QUICK_MATCH_OPS_SOUND_SOURCE, QUICK_MATCH_OPS_VOLUME, 'qm', playMs);
}

/** Trusted Direct (Sürücülerim) — urgent tone until dedicated asset ships. */
export async function playTrustedDirectOfferAlertBurst(playMs = 2000): Promise<void> {
  await playEphemeralOfferAlertBurst(
    TRUSTED_DIRECT_OPS_SOUND_SOURCE,
    TRUSTED_DIRECT_OPS_VOLUME,
    'tdm',
    playMs,
  );
}

let tdmOpsPreloadPromise: Promise<void> | null = null;

/** Patch D1 — warm TDM ops asset + audio mode before first invite burst (driver dashboard). */
export async function preloadTrustedDirectOpsSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!tdmOpsPreloadPromise) {
    tdmOpsPreloadPromise = (async () => {
      try {
        await loadOfferAlertAudioMode();
        const { sound } = await Audio.Sound.createAsync(TRUSTED_DIRECT_OPS_SOUND_SOURCE, {
          shouldPlay: false,
          volume: TRUSTED_DIRECT_OPS_VOLUME,
          isLooping: false,
        });
        await sound.unloadAsync();
      } catch (e) {
        tdmOpsPreloadPromise = null;
        if (__DEV__) console.warn('preloadTrustedDirectOpsSound', e);
      }
    })();
  }
  await tdmOpsPreloadPromise;
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

/** Call Sonic V2 foundation — placeholder assets; dedicated WAV in 5A-2 ── */

/** Loop + stinger volumes — tuned for future CallScreenV2 wiring. */
export const CALL_SONIC_VOLUMES = {
  ringback: 0.38,
  incoming: 0.44,
  connected: 0.4,
  declined: 0.32,
  busy: 0.36,
  timeout: 0.34,
  offline: 0.3,
  ended: 0.3,
} as const;

/** iOS incoming ring — full device volume; Android keeps CALL_SONIC_VOLUMES.incoming. */
export function resolveCallIncomingLoopVolume(): number {
  return Platform.OS === 'ios' ? IOS_CALL_INCOMING_VOLUME : CALL_SONIC_VOLUMES.incoming;
}

/**
 * Placeholder sources — map to existing bundle WAV until call-*.wav assets ship.
 * Swap requires in 5A-2 only; controller API stays stable.
 */
export const CALL_SONIC_SOURCES = {
  ringback: require('../assets/sounds/match-chime.wav'),
  incoming: require('../assets/sounds/leylektag-luxury-tone.wav'),
  connected: require('../assets/sounds/match-chime.wav'),
  declined: require('../assets/sounds/feedback-error.wav'),
  busy: require('../assets/sounds/feedback-error.wav'),
  timeout: require('../assets/sounds/ui-tap.wav'),
  offline: require('../assets/sounds/qr-scan-error.wav'),
  ended: require('../assets/sounds/payment-confirmed.wav'),
} as const;

export type CallSonicStingerKind = 'connected' | 'declined' | 'busy' | 'timeout' | 'offline' | 'ended';

/** Call waiting loops — UI tones profile (ducking). InCallManager unchanged until 5A-2. */
export async function loadCallSonicAudioMode(): Promise<void> {
  await loadSounds();
}

// ── Journey Sonic V2 foundation — placeholder assets; dedicated WAV in 5C-1+ ──

/** One-shot volumes for journeySonicController (not wired to QR modals until 5C-1). */
export const JOURNEY_SONIC_VOLUMES = {
  boardingScanSuccess: 0.5,
  boardingRemoteAck: 0.42,
  journeyStart: 0.46,
  tripEndScanSuccess: 0.48,
  journeyFinish: 0.52,
  paymentSuccess: 0.52,
  qrErrorInvalid: 0.48,
  qrErrorExpired: 0.46,
  qrErrorDuplicate: 0.44,
  qrErrorNetwork: 0.48,
  paymentError: 0.5,
  forceEndAccepted: 0.32,
  forceEndRejected: 0.34,
} as const;

/**
 * Placeholder sources — map to existing bundle WAV until journey-*.wav assets ship.
 * Swap requires in 5C-1+ only; controller API stays stable.
 */
export const JOURNEY_SONIC_SOURCES = {
  boardingScanSuccess: require('../assets/sounds/qr-scan-success.wav'),
  boardingRemoteAck: require('../assets/sounds/match-chime.wav'),
  journeyStart: require('../assets/sounds/match-chime.wav'),
  tripEndScanSuccess: require('../assets/sounds/qr-scan-success.wav'),
  journeyFinish: require('../assets/sounds/payment-confirmed.wav'),
  paymentSuccess: require('../assets/sounds/payment-confirmed.wav'),
  qrErrorInvalid: require('../assets/sounds/qr-scan-error.wav'),
  qrErrorExpired: require('../assets/sounds/qr-scan-error.wav'),
  qrErrorDuplicate: require('../assets/sounds/ui-tap.wav'),
  qrErrorNetwork: require('../assets/sounds/feedback-error.wav'),
  paymentError: require('../assets/sounds/feedback-error.wav'),
  forceEndAccepted: require('../assets/sounds/payment-confirmed.wav'),
  forceEndRejected: require('../assets/sounds/feedback-error.wav'),
} as const;

export type JourneyQrErrorKind = 'invalid' | 'expired' | 'duplicate' | 'network';

/** Journey one-shots — same ducking profile as QR/match until 5C-1 wiring. */
export async function loadJourneySonicAudioMode(): Promise<void> {
  await loadSounds();
}

// ── Matched chat inbound — soft message ping (Sprint 5B) ──

const CHAT_INBOUND_VOLUME = 0.48;
const CHAT_INBOUND_FIRST_VOLUME = 0.58;

/** Placeholder until chat-inbound.wav ships — match-chime family. */
const CHAT_INBOUND_SOURCE = require('../assets/sounds/match-chime.wav');

export type PlayChatInboundSoundOptions = {
  /** İlk okunmamış mesaj — match chime cooldown'ını atla. */
  bypassCooldown?: boolean;
};

/** Foreground matched-trip inbound message — cooldown gated. */
export async function playChatInboundSound(options?: PlayChatInboundSoundOptions): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  const bypassCooldown = options?.bypassCooldown === true;
  if (!bypassCooldown && !chatInboundCooldownGate.tryPass()) return;

  try {
    await loadSounds();
    const { sound } = await Audio.Sound.createAsync(CHAT_INBOUND_SOURCE, {
      shouldPlay: false,
      volume: bypassCooldown ? CHAT_INBOUND_FIRST_VOLUME : CHAT_INBOUND_VOLUME,
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
    if (__DEV__) console.warn('playChatInboundSound', e);
  }
}

// ── Video Trust (Güven Al) invite — soft premium 2-stage (P0-D) ──

const VIDEO_TRUST_CALL_SOURCE = require('../assets/sounds/video-trust-call.wav');

let videoTrustCachedSound: Audio.Sound | null = null;
let videoTrustCachedLoadPromise: Promise<Audio.Sound | null> | null = null;

async function ensureVideoTrustCachedSound(): Promise<Audio.Sound | null> {
  if (Platform.OS === 'web') return null;
  if (videoTrustCachedSound) return videoTrustCachedSound;
  if (!videoTrustCachedLoadPromise) {
    videoTrustCachedLoadPromise = (async (): Promise<Audio.Sound | null> => {
      try {
        await loadOfferAlertAudioMode();
        const { sound } = await Audio.Sound.createAsync(VIDEO_TRUST_CALL_SOURCE, {
          shouldPlay: false,
          volume: resolveVideoTrustCallVolume(),
          isLooping: false,
        });
        videoTrustCachedSound = sound;
        return sound;
      } catch (e) {
        videoTrustCachedLoadPromise = null;
        if (__DEV__) console.warn('ensureVideoTrustCachedSound', e);
        return null;
      }
    })();
  }
  return videoTrustCachedLoadPromise;
}

export type PlayVideoTrustCallSoundOptions = {
  trustId?: string | null;
  /** Background notification open — bypasses AppState active guard. */
  fromNotificationOpen?: boolean;
};

async function playVideoTrustCallToneCore(): Promise<void> {
  try {
    await loadOfferAlertAudioMode();
    const sound = await ensureVideoTrustCachedSound();
    if (!sound) return;
    const volume = resolveVideoTrustCallVolume();
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (e) {
    if (__DEV__) console.warn('playVideoTrustCallToneCore', e);
  }
}

/** Trust modal terminal — stop cached repeat playback without unloading asset. */
export async function stopVideoTrustCachedPlayback(): Promise<void> {
  if (Platform.OS === 'web') return;
  const sound = videoTrustCachedSound;
  if (!sound) return;
  try {
    await sound.stopAsync();
    await sound.setPositionAsync(0);
  } catch {
    /* ignore */
  }
}

/** Karşı taraf Güven Al isteği görünür olduğunda — match/QM/TDM/error ailesinden ayrı. */
export async function playVideoTrustCallSound(options?: PlayVideoTrustCallSoundOptions): Promise<void> {
  if (Platform.OS === 'web') return;
  const trustId = String(options?.trustId || '').trim();
  if (!trustId) return;
  if (!options?.fromNotificationOpen && AppState.currentState !== 'active') return;
  if (!videoTrustCallSessionGate.tryMarkChimed(trustId)) return;
  if (!videoTrustCallCooldownGate.tryPass()) return;
  await playVideoTrustCallToneCore();
}

/** Repeat engine tick — session/cooldown bypass while modal open. */
export async function playVideoTrustCallSoundRepeatTick(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  await playVideoTrustCallToneCore();
}

export function resetVideoTrustCallSoundGate(): void {
  videoTrustCallSessionGate.reset();
}

// ── Force-end counterparty alert — short amber warning (P0-D) ──

const FORCE_END_ALERT_SOURCE = require('../assets/sounds/force-end-alert.wav');

let forceEndCachedSound: Audio.Sound | null = null;
let forceEndCachedLoadPromise: Promise<Audio.Sound | null> | null = null;

async function ensureForceEndCachedSound(): Promise<Audio.Sound | null> {
  if (Platform.OS === 'web') return null;
  if (forceEndCachedSound) return forceEndCachedSound;
  if (!forceEndCachedLoadPromise) {
    forceEndCachedLoadPromise = (async (): Promise<Audio.Sound | null> => {
      try {
        await loadOfferAlertAudioMode();
        const { sound } = await Audio.Sound.createAsync(FORCE_END_ALERT_SOURCE, {
          shouldPlay: false,
          volume: resolveForceEndAlertVolume(),
          isLooping: false,
        });
        forceEndCachedSound = sound;
        return sound;
      } catch (e) {
        forceEndCachedLoadPromise = null;
        if (__DEV__) console.warn('ensureForceEndCachedSound', e);
        return null;
      }
    })();
  }
  return forceEndCachedLoadPromise;
}

export type PlayForceEndAlertSoundOptions = {
  tagId?: string | null;
  /** Background notification open — bypasses AppState active guard. */
  fromNotificationOpen?: boolean;
};

export function parseForceEndTagFromPushData(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const tagId = String(d.tag_id ?? '').trim();
  if (!tagId) return null;
  const t = String(d.type ?? '')
    .trim()
    .toLowerCase();
  if (t === 'force_ended' || t === 'force_end_counterparty') return tagId;
  return null;
}

async function playForceEndAlertToneCore(): Promise<void> {
  try {
    await loadOfferAlertAudioMode();
    const sound = await ensureForceEndCachedSound();
    if (!sound) return;
    const volume = resolveForceEndAlertVolume();
    await sound.setVolumeAsync(volume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (e) {
    if (__DEV__) console.warn('playForceEndAlertToneCore', e);
  }
}

/** Karşı taraf force-end uyarısı — error değil, kısa trip-event tonu. */
export async function playForceEndAlertSound(options?: PlayForceEndAlertSoundOptions): Promise<void> {
  if (Platform.OS === 'web') return;
  const tagId = String(options?.tagId || '').trim();
  if (!tagId) return;
  if (!options?.fromNotificationOpen && AppState.currentState !== 'active') return;
  if (!forceEndAlertSessionGate.tryMarkChimed(tagId)) return;
  if (!forceEndAlertCooldownGate.tryPass()) return;
  await playForceEndAlertToneCore();
}

/** Repeat engine tick — session/cooldown bypass while modal open. */
export async function playForceEndAlertSoundRepeatTick(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (AppState.currentState !== 'active') return;
  await playForceEndAlertToneCore();
}

/** Bildirime tıklanınca (arka plan) — modal açılmadan önce force-end tonu. */
export async function tryPlayForceEndAlertFromPushOpen(data: unknown): Promise<void> {
  const tagId = parseForceEndTagFromPushData(data);
  if (!tagId) return;
  await playForceEndAlertSound({ tagId, fromNotificationOpen: true });
}

export function resetForceEndAlertSoundGate(): void {
  forceEndAlertSessionGate.reset();
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
