/**
 * RC-P0-2B — Single global driver offer alarm loop (Normal + Quick Match + Trusted Direct).
 * 2s play → 6s pause while offer remains visible; foreground in-app only.
 */
import { AppState, type AppStateStatus } from 'react-native';
import {
  playDriverOfferAlertBurst,
  playQuickMatchOfferAlertBurst,
  playTrustedDirectOfferAlertBurst,
  stopOfferAlertBurstPlayback,
} from '../utils/sound';

export type OfferSoundKind = 'normal' | 'quick_match' | 'trusted_direct';

const PLAY_MS = 2000;
const PAUSE_MS = 6000;

/** trusted_direct > quick_match > normal (effect order still favors QM UI when both visible). */
const KIND_PRIORITY: Record<OfferSoundKind, number> = {
  trusted_direct: 3,
  quick_match: 2,
  normal: 1,
};

type LoopTarget = {
  key: string;
  kind: OfferSoundKind;
};

class OfferSoundController {
  private activeKey: string | null = null;
  private activeKind: OfferSoundKind | null = null;
  private generation = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private cycleInFlight = false;
  private appStateSubscription: { remove: () => void } | null = null;
  private installed = false;
  private lastDesired: { key: string; kind: OfferSoundKind; visible: boolean } | null = null;
  /** Sprint 5A-2 — suspend playback while CallScreenV2 is visible. */
  private suspendedByCallSession = false;
  private suspendedDesired: { key: string; kind: OfferSoundKind; visible: boolean } | null = null;

  private ensureInstalled(): void {
    if (this.installed) return;
    this.installed = true;
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    if (next !== 'active') {
      this.stopOfferLoop('app_background');
      return;
    }
    const desired = this.lastDesired;
    if (desired?.visible && desired.key && desired.kind) {
      void this.startOfferLoop({ key: desired.key, kind: desired.kind });
    }
  };

  /** @deprecated use syncOfferLoop — kept for API parity with audit doc */
  startOfferLoop(target: LoopTarget): void {
    this.syncOfferLoop({ key: target.key, kind: target.kind, visible: true });
  }

  stopOfferLoop(_reason?: string): void {
    this.generation += 1;
    if (this.pauseTimer != null) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.activeKey = null;
    this.activeKind = null;
    this.cycleInFlight = false;
    void stopOfferAlertBurstPlayback();
  }

  /** Clears desired state and stops playback — use on dismiss/logout/unmount. */
  stopAllOfferLoops(reason?: string): void {
    this.lastDesired = { key: '', kind: 'normal', visible: false };
    this.stopOfferLoop(reason ?? 'stop_all');
  }

  /** Stop only when the given key matches active or last desired loop. */
  stopOfferLoopByKey(key: string, reason?: string): void {
    const id = String(key || '').trim();
    if (!id) return;
    if (this.activeKey === id || this.lastDesired?.key === id) {
      this.stopAllOfferLoops(reason ?? 'stop_by_key');
    }
  }

  /** Pause offer alarm while matched-trip call UI is open; resume restores prior loop. */
  pauseForCallSession(): void {
    if (this.suspendedByCallSession) return;
    this.suspendedByCallSession = true;
    this.suspendedDesired = this.lastDesired
      ? { ...this.lastDesired }
      : { key: '', kind: 'normal', visible: false };
    this.stopOfferLoop('call_screen');
  }

  resumeAfterCallSession(): void {
    if (!this.suspendedByCallSession) return;
    this.suspendedByCallSession = false;
    const desired = this.suspendedDesired;
    this.suspendedDesired = null;
    if (desired?.visible && desired.key && desired.kind) {
      this.lastDesired = { key: desired.key, kind: desired.kind, visible: true };
      void this.startOfferLoopInternal({ key: desired.key, kind: desired.kind });
    }
  }

  syncOfferLoop(opts: {
    key: string | null;
    kind: OfferSoundKind | null;
    visible: boolean;
  }): void {
    this.ensureInstalled();

    if (this.suspendedByCallSession) {
      if (opts.visible && opts.key && opts.kind) {
        this.suspendedDesired = { key: opts.key, kind: opts.kind, visible: true };
      } else if (!opts.visible) {
        this.suspendedDesired = { key: '', kind: 'normal', visible: false };
      }
      return;
    }

    if (!opts.visible || !opts.key || !opts.kind) {
      this.lastDesired = { key: '', kind: 'normal', visible: false };
      this.stopOfferLoop('not_visible');
      return;
    }

    this.lastDesired = { key: opts.key, kind: opts.kind, visible: true };

    if (AppState.currentState !== 'active') {
      this.stopOfferLoop('app_background');
      return;
    }

    if (this.activeKey === opts.key && this.activeKind === opts.kind) {
      return;
    }

    if (this.activeKey && this.activeKey !== opts.key) {
      const curPri = this.activeKind ? KIND_PRIORITY[this.activeKind] : 0;
      const nextPri = KIND_PRIORITY[opts.kind];
      if (nextPri < curPri) {
        return;
      }
    }

    void this.startOfferLoopInternal({ key: opts.key, kind: opts.kind });
  }

  private async startOfferLoopInternal(target: LoopTarget): Promise<void> {
    this.stopOfferLoop('restart');
    this.activeKey = target.key;
    this.activeKind = target.kind;
    const gen = this.generation;
    await this.runCycle(gen);
  }

  private async runCycle(gen: number): Promise<void> {
    if (gen !== this.generation || !this.activeKey || !this.activeKind) return;
    if (AppState.currentState !== 'active') return;

    this.cycleInFlight = true;
    try {
      if (this.activeKind === 'quick_match') {
        await playQuickMatchOfferAlertBurst(PLAY_MS);
      } else if (this.activeKind === 'trusted_direct') {
        await playTrustedDirectOfferAlertBurst(PLAY_MS);
      } else {
        await playDriverOfferAlertBurst(PLAY_MS);
      }
    } catch (e) {
      if (__DEV__) console.warn('offerSoundController burst', e);
    } finally {
      if (gen === this.generation) {
        this.cycleInFlight = false;
      }
    }

    if (gen !== this.generation || !this.activeKey) return;
    if (AppState.currentState !== 'active') return;

    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null;
      if (gen !== this.generation || !this.activeKey) return;
      void this.runCycle(gen);
    }, PAUSE_MS);
  }

  destroy(): void {
    this.stopAllOfferLoops('destroy');
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.installed = false;
  }
}

export const offerSoundController = new OfferSoundController();
