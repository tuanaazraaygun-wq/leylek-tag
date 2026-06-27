/**
 * Sprint 5C-0 — Journey Sonic V2 foundation.
 * Idempotent expo-av one-shot controller for QR / boarding / trip finish sequencing.
 * NOT wired to BoardingScanModal, QRTripEndModal, or index.tsx until 5C-1+.
 */
import { AppState, Platform } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import {
  journeyBoardingRemoteGate,
  journeyBoardingScanGate,
  journeyCrossChannelGate,
  journeyFinishGate,
  journeyFinishSessionGate,
  journeyForceEndSonicGate,
  journeyPaymentSonicGate,
  journeyPaymentErrorGate,
  journeyQrErrorKindGate,
  journeyStartSessionGate,
  journeyTripEndScanGate,
  type JourneyForceEndKind,
  type JourneyQrErrorKind,
} from './lsx/sonicDedupe';
import {
  JOURNEY_SONIC_SOURCES,
  JOURNEY_SONIC_VOLUMES,
  loadJourneySonicAudioMode,
} from '../utils/sound';

export type { JourneyForceEndKind, JourneyQrErrorKind };

export type JourneySonicOptions = {
  tagId?: string | null;
  scanSessionId?: string | null;
  /** Reserved for 5C-1 call-session ducking. */
  bypassCrossChannel?: boolean;
};

type OneShotKey = keyof typeof JOURNEY_SONIC_SOURCES;

class JourneySonicController {
  private activeSound: Audio.Sound | null = null;
  private preloadPromise: Promise<void> | null = null;
  private generation = 0;

  private isActiveForeground(): boolean {
    if (Platform.OS === 'web') return false;
    return AppState.currentState === 'active';
  }

  private normalizeTagId(tagId?: string | null): string {
    return String(tagId || '').trim() || '__anonymous__';
  }

  private async unloadSound(sound: Audio.Sound | null): Promise<void> {
    if (!sound) return;
    try {
      await sound.stopAsync();
    } catch {
      /* noop */
    }
    try {
      await sound.unloadAsync();
    } catch {
      /* noop */
    }
  }

  private async stopActivePlayback(): Promise<void> {
    const s = this.activeSound;
    this.activeSound = null;
    await this.unloadSound(s);
  }

  private markCrossChannel(): void {
    journeyCrossChannelGate.markFired();
  }

  private isCrossChannelBlocked(options?: JourneySonicOptions): boolean {
    if (options?.bypassCrossChannel) return false;
    return journeyCrossChannelGate.isCoolingDown();
  }

  /** Warm audio mode + decode placeholder assets (no playback). */
  async preload(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!this.preloadPromise) {
      this.preloadPromise = (async () => {
        try {
          await loadJourneySonicAudioMode();
          const warmKeys: OneShotKey[] = [
            'boardingScanSuccess',
            'boardingRemoteAck',
            'journeyStart',
            'tripEndScanSuccess',
            'journeyFinish',
            'paymentSuccess',
            'qrErrorInvalid',
            'paymentError',
          ];
          for (const key of warmKeys) {
            const { sound } = await Audio.Sound.createAsync(JOURNEY_SONIC_SOURCES[key], {
              shouldPlay: false,
              volume: 0,
              isLooping: false,
            });
            await sound.unloadAsync();
          }
        } catch (e) {
          this.preloadPromise = null;
          if (__DEV__) console.warn('journeySonicController.preload', e);
        }
      })();
    }
    await this.preloadPromise;
  }

  private async playOneShot(
    key: OneShotKey,
    volume: number,
    gatePass: () => boolean,
    options?: JourneySonicOptions,
  ): Promise<void> {
    if (!this.isActiveForeground()) return;
    if (this.isCrossChannelBlocked(options)) return;
    if (!gatePass()) return;

    const gen = ++this.generation;
    await this.stopActivePlayback();

    try {
      await loadJourneySonicAudioMode();
      const { sound } = await Audio.Sound.createAsync(JOURNEY_SONIC_SOURCES[key], {
        shouldPlay: false,
        volume,
        isLooping: false,
      });
      if (gen !== this.generation) {
        await this.unloadSound(sound);
        return;
      }
      this.activeSound = sound;
      await sound.setPositionAsync(0);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          if (this.activeSound === sound) {
            this.activeSound = null;
          }
          void sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      if (this.activeSound) {
        this.activeSound = null;
      }
      if (__DEV__) console.warn(`journeySonicController.playOneShot.${key}`, e);
    }
  }

  async playBoardingScanSuccess(options?: JourneySonicOptions): Promise<void> {
    await this.playOneShot(
      'boardingScanSuccess',
      JOURNEY_SONIC_VOLUMES.boardingScanSuccess,
      () => journeyBoardingScanGate.tryPass(),
      options,
    );
  }

  async playBoardingRemoteAck(options?: JourneySonicOptions): Promise<void> {
    await this.playOneShot(
      'boardingRemoteAck',
      JOURNEY_SONIC_VOLUMES.boardingRemoteAck,
      () => journeyBoardingRemoteGate.tryPass(),
      options,
    );
  }

  async playJourneyStart(options?: JourneySonicOptions): Promise<void> {
    const tagId = this.normalizeTagId(options?.tagId);
    await this.playOneShot(
      'journeyStart',
      JOURNEY_SONIC_VOLUMES.journeyStart,
      () => journeyStartSessionGate.tryPass(tagId),
      options,
    );
    this.markCrossChannel();
  }

  async playTripEndScanSuccess(options?: JourneySonicOptions): Promise<void> {
    await this.playOneShot(
      'tripEndScanSuccess',
      JOURNEY_SONIC_VOLUMES.tripEndScanSuccess,
      () => journeyTripEndScanGate.tryPass(),
      options,
    );
  }

  async playJourneyFinish(options?: JourneySonicOptions): Promise<void> {
    const tagId = this.normalizeTagId(options?.tagId);
    await this.playOneShot(
      'journeyFinish',
      JOURNEY_SONIC_VOLUMES.journeyFinish,
      () => journeyFinishSessionGate.tryPass(tagId) && journeyFinishGate.tryPass(),
      options,
    );
    this.markCrossChannel();
  }

  /** Journey-layer payment confirm — separate gate from production playPaymentConfirmedSound. */
  async playPaymentSuccess(options?: JourneySonicOptions): Promise<void> {
    await this.playOneShot(
      'paymentSuccess',
      JOURNEY_SONIC_VOLUMES.paymentSuccess,
      () => journeyPaymentSonicGate.tryPass(),
      options,
    );
    this.markCrossChannel();
  }

  async playQrInvalidError(options?: JourneySonicOptions): Promise<void> {
    await this.playQrErrorKind('invalid', options);
  }

  async playQrExpiredError(options?: JourneySonicOptions): Promise<void> {
    await this.playQrErrorKind('expired', options);
  }

  async playQrDuplicateError(options?: JourneySonicOptions): Promise<void> {
    await this.playQrErrorKind('duplicate', options);
  }

  async playQrNetworkError(options?: JourneySonicOptions): Promise<void> {
    await this.playQrErrorKind('network', options);
  }

  private async playQrErrorKind(kind: JourneyQrErrorKind, options?: JourneySonicOptions): Promise<void> {
    const sourceKey: OneShotKey =
      kind === 'invalid'
        ? 'qrErrorInvalid'
        : kind === 'expired'
          ? 'qrErrorExpired'
          : kind === 'duplicate'
            ? 'qrErrorDuplicate'
            : 'qrErrorNetwork';
    const volumeKey =
      kind === 'invalid'
        ? 'qrErrorInvalid'
        : kind === 'expired'
          ? 'qrErrorExpired'
          : kind === 'duplicate'
            ? 'qrErrorDuplicate'
            : 'qrErrorNetwork';

    await this.playOneShot(
      sourceKey,
      JOURNEY_SONIC_VOLUMES[volumeKey],
      () => journeyQrErrorKindGate.tryPass(kind),
      options,
    );
  }

  async playPaymentError(options?: JourneySonicOptions): Promise<void> {
    await this.playOneShot(
      'paymentError',
      JOURNEY_SONIC_VOLUMES.paymentError,
      () => journeyPaymentErrorGate.tryPass(),
      options,
    );
  }

  async playForceEndAccepted(options?: JourneySonicOptions): Promise<void> {
    await this.playForceEnd('accepted', options);
  }

  async playForceEndRejected(options?: JourneySonicOptions): Promise<void> {
    await this.playForceEnd('rejected', options);
  }

  private async playForceEnd(kind: JourneyForceEndKind, options?: JourneySonicOptions): Promise<void> {
    const sourceKey = kind === 'accepted' ? 'forceEndAccepted' : 'forceEndRejected';
    const volumeKey = kind === 'accepted' ? 'forceEndAccepted' : 'forceEndRejected';
    await this.playOneShot(
      sourceKey,
      JOURNEY_SONIC_VOLUMES[volumeKey],
      () => journeyForceEndSonicGate.tryPass(kind),
      { ...options, bypassCrossChannel: true },
    );
    this.markCrossChannel();
  }

  async stop(): Promise<void> {
    this.generation += 1;
    await this.stopActivePlayback();
  }

  /** Full teardown — call on logout / role reset (future 5C-1 wiring). */
  async cleanup(): Promise<void> {
    await this.stop();
    this.preloadPromise = null;
    journeyBoardingScanGate.reset();
    journeyBoardingRemoteGate.reset();
    journeyTripEndScanGate.reset();
    journeyFinishGate.reset();
    journeyPaymentSonicGate.reset();
    journeyPaymentErrorGate.reset();
    journeyCrossChannelGate.reset();
    journeyStartSessionGate.reset();
    journeyFinishSessionGate.reset();
    journeyForceEndSonicGate.reset();
    journeyQrErrorKindGate.reset();
  }
}

export const journeySonicController = new JourneySonicController();

export const preloadJourneySonic = (): Promise<void> => journeySonicController.preload();
export const playJourneyBoardingScanSuccess = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playBoardingScanSuccess(options);
export const playJourneyBoardingRemoteAck = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playBoardingRemoteAck(options);
export const playJourneyStartSonic = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playJourneyStart(options);
export const playJourneyTripEndScanSuccess = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playTripEndScanSuccess(options);
export const playJourneyFinishSonic = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playJourneyFinish(options);
export const playJourneyPaymentSuccess = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playPaymentSuccess(options);
export const playJourneyQrInvalidError = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playQrInvalidError(options);
export const playJourneyQrExpiredError = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playQrExpiredError(options);
export const playJourneyQrDuplicateError = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playQrDuplicateError(options);
export const playJourneyQrNetworkError = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playQrNetworkError(options);
export const playJourneyPaymentError = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playPaymentError(options);
export const playJourneyForceEndAccepted = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playForceEndAccepted(options);
export const playJourneyForceEndRejected = (options?: JourneySonicOptions): Promise<void> =>
  journeySonicController.playForceEndRejected(options);
export const stopJourneySonic = (): Promise<void> => journeySonicController.stop();
export const cleanupJourneySonic = (): Promise<void> => journeySonicController.cleanup();
