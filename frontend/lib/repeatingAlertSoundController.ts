/**
 * Incoming critical alerts — immediate first play, then repeat until stopped.
 * One interval per key; generation guard prevents stale callbacks.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';

const DEFAULT_INTERVAL_MS = 2000;

export type StartRepeatingAlertSoundOptions = {
  intervalMs?: number;
  /** Default true — play once immediately on start. */
  immediate?: boolean;
};

type LoopEntry = {
  timerId: ReturnType<typeof setInterval>;
  generation: number;
  playFn: () => void | Promise<void>;
  intervalMs: number;
  tickInFlight: boolean;
};

class RepeatingAlertSoundController {
  private loops = new Map<string, LoopEntry>();
  private appStateSubscription: { remove: () => void } | null = null;
  private installed = false;
  private nextGeneration = 0;

  private ensureInstalled(): void {
    if (this.installed) return;
    this.installed = true;
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    if (next !== 'active') {
      this.stopAllInternal();
    }
  };

  private runTick(key: string, entry: LoopEntry): void {
    if (AppState.currentState !== 'active') return;
    if (entry.tickInFlight) return;

    entry.tickInFlight = true;
    void Promise.resolve(entry.playFn())
      .catch(() => {})
      .finally(() => {
        const cur = this.loops.get(key);
        if (cur && cur.generation === entry.generation) {
          cur.tickInFlight = false;
        }
      });
  }

  private clearEntry(key: string): void {
    const entry = this.loops.get(key);
    if (!entry) return;
    clearInterval(entry.timerId);
    this.loops.delete(key);
  }

  private stopAllInternal(): void {
    for (const key of [...this.loops.keys()]) {
      this.clearEntry(key);
    }
  }

  startRepeatingAlertSound(
    key: string,
    playFn: () => void | Promise<void>,
    options?: StartRepeatingAlertSoundOptions,
  ): void {
    if (Platform.OS === 'web') return;
    const id = String(key || '').trim();
    if (!id) return;

    this.ensureInstalled();

    this.clearEntry(id);

    const intervalMs = Math.max(500, options?.intervalMs ?? DEFAULT_INTERVAL_MS);
    const immediate = options?.immediate !== false;
    const generation = ++this.nextGeneration;

    const entry: LoopEntry = {
      timerId: setInterval(() => {
        const cur = this.loops.get(id);
        if (!cur || cur.generation !== generation) return;
        this.runTick(id, cur);
      }, intervalMs),
      generation,
      playFn,
      intervalMs,
      tickInFlight: false,
    };

    this.loops.set(id, entry);

    if (immediate) {
      this.runTick(id, entry);
    }
  }

  stopRepeatingAlertSound(key: string, _reason?: string): void {
    const id = String(key || '').trim();
    if (!id) return;
    this.clearEntry(id);
  }

  stopAllRepeatingAlertSounds(_reason?: string): void {
    this.stopAllInternal();
  }

  isRepeatingAlertActive(key: string): boolean {
    return this.loops.has(String(key || '').trim());
  }

  destroyRepeatingAlertSoundController(): void {
    this.stopAllInternal();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.installed = false;
  }
}

export const repeatingAlertSoundController = new RepeatingAlertSoundController();

export function startRepeatingAlertSound(
  key: string,
  playFn: () => void | Promise<void>,
  options?: StartRepeatingAlertSoundOptions,
): void {
  repeatingAlertSoundController.startRepeatingAlertSound(key, playFn, options);
}

export function stopRepeatingAlertSound(key: string, reason?: string): void {
  repeatingAlertSoundController.stopRepeatingAlertSound(key, reason);
}

export function stopAllRepeatingAlertSounds(reason?: string): void {
  repeatingAlertSoundController.stopAllRepeatingAlertSounds(reason);
}

export function isRepeatingAlertActive(key: string): boolean {
  return repeatingAlertSoundController.isRepeatingAlertActive(key);
}

export function destroyRepeatingAlertSoundController(): void {
  repeatingAlertSoundController.destroyRepeatingAlertSoundController();
}
