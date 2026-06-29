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
  /** Matched chat inbound — per-tag debounce (Sprint 5B). */
  chatInbound: 2500,
  /** Call Sonic V2 — loop restart guard (5A-1 foundation). */
  callLoop: 500,
  callConnected: 3000,
  callDeclined: 2000,
  callBusy: 5000,
  callTimeout: 3000,
  callOffline: 4000,
  callEnded: 2000,
  /** Journey Sonic V2 foundation (Sprint 5C-0) — not wired to QR modals yet. */
  journeyBoardingScan: 500,
  journeyBoardingRemote: 1200,
  journeyTripEndScan: 500,
  journeyFinish: 2000,
  journeyPayment: 1000,
  journeyPaymentError: 1200,
  journeyForceEnd: 1500,
  journeyQrErrorKind: 800,
  journeyCrossChannel: 300,
  /** Video Trust (Güven Al) invite — per-trust session + cooldown (P0-D). */
  videoTrustCall: 3200,
  /** Force-end counterparty alert — per-tag session + cooldown (P0-D). */
  forceEndAlert: 2000,
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

/** Matched chat inbound — foreground message sonic (Sprint 5B). */
export const chatInboundCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.chatInbound);

/** Call Sonic V2 — one-shot stinger cooldowns (5A-1 foundation). */
export const callConnectedStingerGate = createCooldownGate(SONIC_DEDUPE_MS.callConnected);
export const callDeclinedStingerGate = createCooldownGate(SONIC_DEDUPE_MS.callDeclined);
export const callBusyStingerGate = createCooldownGate(SONIC_DEDUPE_MS.callBusy);
export const callTimeoutStingerGate = createCooldownGate(SONIC_DEDUPE_MS.callTimeout);
export const callOfflineStingerGate = createCooldownGate(SONIC_DEDUPE_MS.callOffline);
export const callEndedStingerGate = createCooldownGate(SONIC_DEDUPE_MS.callEnded);

/** Call loop — prevent rapid loop restart on duplicate start calls. */
export const callLoopRestartGate = createCooldownGate(SONIC_DEDUPE_MS.callLoop);

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

/** Journey boarding scan — local decode/API success blip (5C-0). */
export const journeyBoardingScanGate = createCooldownGate(SONIC_DEDUPE_MS.journeyBoardingScan);

/** Driver remote boarding ack — peer scanned while QR modal open (5C-0). */
export const journeyBoardingRemoteGate = createCooldownGate(SONIC_DEDUPE_MS.journeyBoardingRemote);

/** Trip-end QR decode success — pre-complete-qr (5C-0). */
export const journeyTripEndScanGate = createCooldownGate(SONIC_DEDUPE_MS.journeyTripEndScan);

/** Journey finish sting — post trip complete (5C-0). */
export const journeyFinishGate = createCooldownGate(SONIC_DEDUPE_MS.journeyFinish);

/** Journey payment wrapper — separate instance from production payment gate (5C-0). */
export const journeyPaymentSonicGate = createCooldownGate(SONIC_DEDUPE_MS.journeyPayment);

/** Journey payment failure — separate from QR network errors (5C-0). */
export const journeyPaymentErrorGate = createCooldownGate(SONIC_DEDUPE_MS.journeyPaymentError);

/** Force-end accepted / rejected — shared window (5C-0). */
export type JourneyForceEndKind = 'accepted' | 'rejected';

export const journeyForceEndSonicGate = {
  lastAcceptedAt: 0,
  lastRejectedAt: 0,

  tryPass(kind: JourneyForceEndKind): boolean {
    const now = Date.now();
    const cooldown = SONIC_DEDUPE_MS.journeyForceEnd;
    const lastAt = kind === 'accepted' ? this.lastAcceptedAt : this.lastRejectedAt;
    if (now - lastAt < cooldown) {
      return false;
    }
    if (kind === 'accepted') {
      this.lastAcceptedAt = now;
    } else {
      this.lastRejectedAt = now;
    }
    return true;
  },

  reset() {
    this.lastAcceptedAt = 0;
    this.lastRejectedAt = 0;
  },
};

/** QR error taxonomy — invalid / expired / duplicate / network (5C-0). */
export type JourneyQrErrorKind = 'invalid' | 'expired' | 'duplicate' | 'network';

export const journeyQrErrorKindGate = {
  lastByKind: {} as Partial<Record<JourneyQrErrorKind, number>>,

  tryPass(kind: JourneyQrErrorKind): boolean {
    const now = Date.now();
    const cooldown = SONIC_DEDUPE_MS.journeyQrErrorKind;
    const lastAt = this.lastByKind[kind] ?? 0;
    if (now - lastAt < cooldown) {
      return false;
    }
    this.lastByKind[kind] = now;
    return true;
  },

  reset() {
    this.lastByKind = {};
  },
};

/** Suppress lower-priority journey blips after finish/payment (5C-0). */
export const journeyCrossChannelGate = createCooldownGate(SONIC_DEDUPE_MS.journeyCrossChannel);

/** Journey start — once per tag per app session (5C-0). */
export const journeyStartSessionGate = {
  firedTagIds: new Set<string>(),

  tryPass(tagId?: string | null): boolean {
    const id = String(tagId || '').trim() || '__anonymous__';
    if (this.firedTagIds.has(id)) {
      return false;
    }
    this.firedTagIds.add(id);
    return true;
  },

  reset() {
    this.firedTagIds.clear();
  },
};

/** Journey finish — once per tag per app session (5C-0). */
export const journeyFinishSessionGate = {
  firedTagIds: new Set<string>(),

  tryPass(tagId?: string | null): boolean {
    const id = String(tagId || '').trim() || '__anonymous__';
    if (this.firedTagIds.has(id)) {
      return false;
    }
    this.firedTagIds.add(id);
    return true;
  },

  reset() {
    this.firedTagIds.clear();
  },
};

/** Force-end accepted — once per tag; also suppresses journey finish for that tag (5C-4). */
export const journeyForceEndAcceptedSessionGate = {
  firedTagIds: new Set<string>(),

  tryPass(tagId?: string | null): boolean {
    const id = String(tagId || '').trim() || '__anonymous__';
    if (this.firedTagIds.has(id)) {
      return false;
    }
    this.firedTagIds.add(id);
    return true;
  },

  reset() {
    this.firedTagIds.clear();
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

/** Video Trust invite — per-trust_id session dedupe (socket / recovery). */
export const videoTrustCallSessionGate = {
  chimedTrustIds: new Set<string>(),

  reset() {
    this.chimedTrustIds.clear();
    videoTrustCallCooldownGate.reset();
  },

  tryMarkChimed(trustId: string): boolean {
    const id = String(trustId || '').trim();
    if (!id || this.chimedTrustIds.has(id)) {
      return false;
    }
    this.chimedTrustIds.add(id);
    return true;
  },
};

/** Force-end counterparty alert — per-tag session dedupe (socket / poll / push open). */
export const forceEndAlertSessionGate = {
  chimedTagIds: new Set<string>(),

  reset() {
    this.chimedTagIds.clear();
    forceEndAlertCooldownGate.reset();
  },

  tryMarkChimed(tagId: string): boolean {
    const id = String(tagId || '').trim();
    if (!id || this.chimedTagIds.has(id)) {
      return false;
    }
    this.chimedTagIds.add(id);
    return true;
  },
};

export const videoTrustCallCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.videoTrustCall);
export const forceEndAlertCooldownGate = createCooldownGate(SONIC_DEDUPE_MS.forceEndAlert);

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
