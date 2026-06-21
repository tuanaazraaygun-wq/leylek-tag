/**
 * B4-2 — Central sonic dedupe gates (shared by sound.ts + future LSX orchestrator).
 * Timing values must match pre-B4-2 production behaviour.
 */

/** Cooldown constants — single SSOT for sonic debounce intervals. */
export const SONIC_DEDUPE_MS = {
  match: 2800,
  driverOffer: 1000,
  quickMatchOps: 2000,
  qrScan: 500,
  paymentConfirmed: 1000,
  feedbackError: 1200,
  uiTap: 70,
} as const;

export type CooldownGate = {
  /** Returns false if still within cooldown window (does not consume). */
  isCoolingDown(): boolean;
  /** Mark successful fire — call after playback is confirmed. */
  markFired(): void;
  /** Atomic check-and-mark when fire happens immediately. */
  tryPass(): boolean;
  reset(): void;
  peekLastAt(): number;
};

export function createCooldownGate(cooldownMs: number): CooldownGate {
  let lastAt = 0;
  return {
    isCoolingDown() {
      return Date.now() - lastAt < cooldownMs;
    },
    markFired() {
      lastAt = Date.now();
    },
    tryPass() {
      const now = Date.now();
      if (now - lastAt < cooldownMs) {
        return false;
      }
      lastAt = now;
      return true;
    },
    reset() {
      lastAt = 0;
    },
    peekLastAt() {
      return lastAt;
    },
  };
}

/** Match chime — global cooldown (socket + local accept). */
export const matchChimeCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.match);

/** Driver offer tone — time-based cooldown between plays. */
export const driverOfferToneCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.driverOffer);

/** Quick Match ops call — time-based cooldown. */
export const quickMatchOpsCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.quickMatchOps);

/** Payment confirmed — time-based cooldown. */
export const paymentConfirmedCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.paymentConfirmed);

/** Feedback / API error — time-based cooldown. */
export const feedbackErrorCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.feedbackError);

/** UI tap micro click — anti double-fire. */
export const uiTapCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.uiTap);

/** QR scan — cross-kind guard (success vs error share window). */
export type QrScanKind = 'success' | 'error';

export const qrScanSonicGate = {
  lastSuccessAt: 0,
  lastErrorAt: 0,

  tryPass(kind: QrScanKind): boolean {
    const now = Date.now();
    const cooldown = SONIC_DEDUPE_MS.qrScan;
    const lastAt = kind === 'success' ? this.lastSuccessAt : this.lastErrorAt;
    if (now - lastAt < cooldown) {
      return false;
    }
    if (now - this.lastSuccessAt < cooldown && kind === 'error') {
      return false;
    }
    if (now - this.lastErrorAt < cooldown && kind === 'success') {
      return false;
    }
    if (kind === 'success') {
      this.lastSuccessAt = now;
    } else {
      this.lastErrorAt = now;
    }
    return true;
  },
};

/** Driver offer — per-tag session dedupe (socket / push / poll). */
export const driverOfferSessionGate = {
  chimedIds: new Set<string>(),
  baselineIds: new Set<string>(),
  pendingRealtimeIds: new Set<string>(),
  hydrated: false,

  reset() {
    this.chimedIds.clear();
    this.baselineIds.clear();
    this.pendingRealtimeIds.clear();
    this.hydrated = false;
  },

  tryMarkChimed(tagKey: string): boolean {
    const id = String(tagKey || '').trim();
    if (!id || this.chimedIds.has(id)) {
      return false;
    }
    this.chimedIds.add(id);
    this.pendingRealtimeIds.delete(id);
    return true;
  },
};

/** Quick Match — per-invite session dedupe. */
export const quickMatchOpsSessionGate = {
  chimedInviteIds: new Set<string>(),

  reset() {
    this.chimedInviteIds.clear();
    quickMatchOpsCooldownGate.reset();
  },

  tryMarkChimed(inviteId: string): boolean {
    const id = String(inviteId || '').trim();
    if (!id || this.chimedInviteIds.has(id)) {
      return false;
    }
    this.chimedInviteIds.add(id);
    return true;
  },
};
