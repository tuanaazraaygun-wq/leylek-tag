/**
 * Sprint 5A-1 — Call Sonic V2 foundation.
 * Idempotent expo-av loop/stinger controller; NOT wired to CallScreenV2 yet.
 * InCallManager ringback/ringtone remain production path until 5A-2.
 */
import { AppState, Platform } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import {
  callBusyStingerGate,
  callConnectedStingerGate,
  callDeclinedStingerGate,
  callEndedStingerGate,
  callLoopRestartGate,
  callOfflineStingerGate,
  callTimeoutStingerGate,
} from './lsx/sonicDedupe';
import {
  CALL_SONIC_SOURCES,
  CALL_SONIC_VOLUMES,
  loadCallSonicAudioMode,
  loadOfferAlertAudioMode,
  resolveCallIncomingLoopVolume,
  type CallSonicStingerKind,
} from '../utils/sound';

export type CallSonicLoopKind = 'outgoing' | 'incoming';

export type CallSonicLoopOptions = {
  callId?: string | null;
};

type LoopState = {
  kind: CallSonicLoopKind;
  callId: string;
  sound: Audio.Sound;
};

class CallSonicController {
  private loopState: LoopState | null = null;
  private stingerSound: Audio.Sound | null = null;
  private preloadPromise: Promise<void> | null = null;
  private generation = 0;

  private isActiveForeground(): boolean {
    if (Platform.OS === 'web') return false;
    return AppState.currentState === 'active';
  }

  private normalizeCallId(callId?: string | null): string {
    return String(callId || '').trim() || 'anonymous';
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

  private async stopStingerPlayback(): Promise<void> {
    const s = this.stingerSound;
    this.stingerSound = null;
    await this.unloadSound(s);
  }

  /** Warm audio mode + decode placeholder assets (no playback). */
  async preload(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!this.preloadPromise) {
      this.preloadPromise = (async () => {
        try {
          await loadCallSonicAudioMode();
          const warmSources = [
            CALL_SONIC_SOURCES.ringback,
            CALL_SONIC_SOURCES.incoming,
            CALL_SONIC_SOURCES.connected,
          ];
          for (const source of warmSources) {
            const { sound } = await Audio.Sound.createAsync(source, {
              shouldPlay: false,
              volume: 0,
              isLooping: false,
            });
            await sound.unloadAsync();
          }
        } catch (e) {
          this.preloadPromise = null;
          if (__DEV__) console.warn('callSonicController.preload', e);
        }
      })();
    }
    await this.preloadPromise;
  }

  private loopSource(kind: CallSonicLoopKind): number {
    return kind === 'outgoing' ? CALL_SONIC_SOURCES.ringback : CALL_SONIC_SOURCES.incoming;
  }

  private loopVolume(kind: CallSonicLoopKind): number {
    if (kind === 'incoming') return resolveCallIncomingLoopVolume();
    return CALL_SONIC_VOLUMES.ringback;
  }

  private stingerSource(kind: CallSonicStingerKind): number {
    return CALL_SONIC_SOURCES[kind];
  }

  private stingerVolume(kind: CallSonicStingerKind): number {
    return CALL_SONIC_VOLUMES[kind];
  }

  private stingerGate(kind: CallSonicStingerKind) {
    switch (kind) {
      case 'connected':
        return callConnectedStingerGate;
      case 'declined':
        return callDeclinedStingerGate;
      case 'busy':
        return callBusyStingerGate;
      case 'timeout':
        return callTimeoutStingerGate;
      case 'offline':
        return callOfflineStingerGate;
      case 'ended':
        return callEndedStingerGate;
      default:
        return callEndedStingerGate;
    }
  }

  private async startLoop(kind: CallSonicLoopKind, options?: CallSonicLoopOptions): Promise<void> {
    if (!this.isActiveForeground()) return;

    const callId = this.normalizeCallId(options?.callId);
    const current = this.loopState;
    if (current && current.kind === kind && current.callId === callId) {
      return;
    }

    if (!callLoopRestartGate.tryPass() && current?.kind === kind) {
      return;
    }

    await this.stopLoop();

    const gen = ++this.generation;

    try {
      if (kind === 'incoming') {
        await loadOfferAlertAudioMode();
      } else {
        await loadCallSonicAudioMode();
      }
      const { sound } = await Audio.Sound.createAsync(this.loopSource(kind), {
        shouldPlay: false,
        volume: this.loopVolume(kind),
        isLooping: true,
      });
      if (gen !== this.generation) {
        await this.unloadSound(sound);
        return;
      }
      this.loopState = { kind, callId, sound };
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (e) {
      if (__DEV__) console.warn(`callSonicController.startLoop.${kind}`, e);
    }
  }

  async playOutgoingRingbackLoop(options?: CallSonicLoopOptions): Promise<void> {
    await this.startLoop('outgoing', options);
  }

  async playIncomingRingLoop(options?: CallSonicLoopOptions): Promise<void> {
    await this.startLoop('incoming', options);
  }

  async stopLoop(): Promise<void> {
    this.generation += 1;
    const state = this.loopState;
    this.loopState = null;
    if (!state) return;
    await this.unloadSound(state.sound);
  }

  private async playStinger(kind: CallSonicStingerKind): Promise<void> {
    if (!this.isActiveForeground()) return;

    const gate = this.stingerGate(kind);
    if (!gate.tryPass()) return;

    await this.stopStingerPlayback();

    try {
      await loadCallSonicAudioMode();
      const { sound } = await Audio.Sound.createAsync(this.stingerSource(kind), {
        shouldPlay: false,
        volume: this.stingerVolume(kind),
        isLooping: false,
      });
      this.stingerSound = sound;
      await sound.setPositionAsync(0);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          if (this.stingerSound === sound) {
            this.stingerSound = null;
          }
          void sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      this.stingerSound = null;
      if (__DEV__) console.warn(`callSonicController.playStinger.${kind}`, e);
    }
  }

  async playConnectedStinger(): Promise<void> {
    await this.playStinger('connected');
  }

  async playRejectedStinger(): Promise<void> {
    await this.playStinger('declined');
  }

  async playDeclinedStinger(): Promise<void> {
    await this.playRejectedStinger();
  }

  async playBusyStinger(): Promise<void> {
    await this.playStinger('busy');
  }

  async playTimeoutStinger(): Promise<void> {
    await this.playStinger('timeout');
  }

  async playOfflineStinger(): Promise<void> {
    await this.playStinger('offline');
  }

  async playEndedStinger(): Promise<void> {
    await this.playStinger('ended');
  }

  async playDisconnectedStinger(): Promise<void> {
    await this.playEndedStinger();
  }

  async stopAll(): Promise<void> {
    await Promise.all([this.stopLoop(), this.stopStingerPlayback()]);
  }

  /** Full teardown — call on call UI unmount (future 5A-2). */
  async cleanup(): Promise<void> {
    await this.stopAll();
    this.preloadPromise = null;
    this.generation = 0;
    callLoopRestartGate.reset();
  }
}

export const callSonicController = new CallSonicController();

export const preloadCallSonic = (): Promise<void> => callSonicController.preload();
export const playCallOutgoingRingbackLoop = (options?: CallSonicLoopOptions): Promise<void> =>
  callSonicController.playOutgoingRingbackLoop(options);
export const playCallIncomingRingLoop = (options?: CallSonicLoopOptions): Promise<void> =>
  callSonicController.playIncomingRingLoop(options);
export const playCallConnectedStinger = (): Promise<void> => callSonicController.playConnectedStinger();
export const playCallRejectedStinger = (): Promise<void> => callSonicController.playRejectedStinger();
export const playCallDeclinedStinger = (): Promise<void> => callSonicController.playDeclinedStinger();
export const playCallBusyStinger = (): Promise<void> => callSonicController.playBusyStinger();
export const playCallTimeoutStinger = (): Promise<void> => callSonicController.playTimeoutStinger();
export const playCallOfflineStinger = (): Promise<void> => callSonicController.playOfflineStinger();
export const playCallEndedStinger = (): Promise<void> => callSonicController.playEndedStinger();
export const playCallDisconnectedStinger = (): Promise<void> =>
  callSonicController.playDisconnectedStinger();
export const stopCallSonicLoop = (): Promise<void> => callSonicController.stopLoop();
export const stopAllCallSonic = (): Promise<void> => callSonicController.stopAll();
export const cleanupCallSonic = (): Promise<void> => callSonicController.cleanup();
