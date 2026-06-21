# B4 — LSX Binding Matrix

**Sprint:** B4 Analysis  
**Master reference:** `design-lab/lsx/LSX_EVENT_MATRIX.md`, `LSX_CONSTITUTION.md`  
**Timing patterns:** T1 Standard Triad · T2 Micro · T3 Remote · T4 Presence · T5 Caution

---

## Binding schema

Each row defines the **target** LSX contract. Columns: production state as of B4 analysis.

| Col | Meaning |
|-----|---------|
| Motion | v4 motion token or LDS equivalent |
| Sound | LSDS token → `sound.ts` fn |
| Haptic | v4 haptic token → future `fireHaptic` |
| Visual | Surface/state change (theme-agnostic) |
| Theme | Dark/white chrome via B3 — sensory unchanged |
| Trigger | Code path |
| Dedupe | Cross-channel rule |
| Rollback | Flag to disable binding |

---

## Tier A bindings

### `driver.offer.new`

| Field | Value |
|-------|-------|
| Motion | `v4.motion.relay.ingress` 260ms — ❌ |
| Sound | `sonic.driver.offer.*` → `notifyDriverNewOfferSoundFromRealtimeOffer` — ✅ |
| Haptic | `haptic.medium` / `haptic.double` urgent — ❌ |
| Visual | Request row highlight — ⚠️ static |
| Theme | Driver waiting shell (B3 `useDriverTheme`) |
| Trigger | Socket tag, poll `finalizeDriverOfferPollSound`, FCM `NotificationContext` |
| Dedupe | `driverOfferSoundChimedIds` + 1000ms cooldown; **add haptic same tagId** |
| Rollback | `EXPO_PUBLIC_FEATURE_LSX_OFFER=false` (future) |

### `qm.invite.new`

| Field | Value |
|-------|-------|
| Motion | relay.ingress — ❌ |
| Sound | `sonic.quickMatch.driver.opsCall` — ✅ |
| Haptic | `haptic.medium` — ❌ |
| Visual | QM banner — ⚠️ |
| Trigger | `notifyQuickMatchDriverOpsSoundFromInvite` in index |
| Dedupe | `quickMatchOpsChimedInviteIds` + 2s |
| Rollback | LSX QM flag |

### `match.confirmed`

| Field | Value |
|-------|-------|
| Motion | `v4.motion.pulse.journey` 480ms + overlay — ⚠️ overlay only |
| Sound | `sonic.match.success` → `playMatchChimeSound` — ✅ |
| Haptic | `haptic.success` P6 +16ms — ❌ |
| Visual | TagMatchTransitionOverlay + map chrome |
| Theme | Journey/map B3 overlays |
| Trigger | index passenger accept, socket onTagMatched, driver match paths (×5) |
| Dedupe | 2800ms sonic; motion may re-run — **sync single orchestrator** |
| Rollback | disable chime + overlay motion independently |

### `qr.scan.local`

| Field | Value |
|-------|-------|
| Motion | `viewfinderFlash` 100ms — ❌ |
| Sound | optional `scanTick` — ❌ (success/error only today) |
| Haptic | `haptic.light` — ❌ |
| Visual | Scanner frame |
| Trigger | `onBarCodeScanned` in modals |
| Dedupe | 500ms sonic cross-kind |
| Rollback | camera path unchanged — motion on chrome only |

### `qr.verify.lock`

| Field | Value |
|-------|-------|
| Motion | `lock.ringClose` 320ms — ❌ |
| Sound | `sonic.qr.success` — ✅ |
| Haptic | `haptic.lock` P4 — ❌ (vibration elsewhere) |
| Visual | Success beat in QRTripEndModal |
| Trigger | Valid decode → API success |
| Dedupe | Per-scan session |
| Rollback | keep scanner functional if motion off |

### `qr.remote.ack` ⚠️ P0 gap

| Field | Value |
|-------|-------|
| Motion | `remote.ack` 320ms — ❌ |
| Sound | `sonic.qr.remoteAck` — ❌ **asset missing** |
| Haptic | `haptic.remote` P5 — ❌ |
| Visual | Driver “Doğrulandı” chip on LiveMap |
| Trigger | Socket boarding_confirmed / QR verify event on **driver device** |
| Dedupe | Once per tagId verify |
| Rollback | haptic-only fallback if sonic fails |
| Theme | LiveMap chrome (B3) |

### `payment.confirmed`

| Field | Value |
|-------|-------|
| Motion | lock + checkDraw — ❌ |
| Sound | `sonic.payment.confirmed` — ✅ |
| Haptic | `haptic.success` +24ms — ❌ |
| Visual | Rating modal success / sheet close |
| Trigger | index payment submit success |
| Dedupe | 1000ms sonic |
| Rollback | — |

### `feedback.error`

| Field | Value |
|-------|-------|
| Motion | `error.nudge` 180ms — ❌ |
| Sound | `sonic.feedback.error` — ✅ |
| Haptic | `haptic.error` T6 — ❌ |
| Visual | appAlert warning variant |
| Trigger | index, DriverOfferScreen |
| Dedupe | 1200ms sonic |
| Rollback | — |

---

## Tier B bindings

### `ui.cta.press`

| Motion | click.press 90ms — ⚠️ role cards only |
| Sound | ui.tap — ⚠️ selected CTAs |
| Haptic | tapButtonHaptic — ⚠️ |
| Trigger | Role continue, offer send |
| Dedupe | sonic 70ms |
| **Anti-pattern** | `playTapSound = () => {}` on dashboards — dead UI |

### `role.continue`

| Motion | ✅ selection + press |
| Sound | ✅ playUiTapSound |
| Haptic | ✅ roleScreenHaptic |
| **Reference triad** for B4 orchestrator |

### `login.submit`

| Motion | crossfade — ❌ |
| Sound | — intentional silent |
| Haptic | light — ❌ |

### `trust.accept`

| Motion | checkDraw — ❌ |
| Sound | new micro token — ❌ |
| Haptic | success — ❌ |
| Trigger | TrustedNetworkHub, LiveMap chip |

---

## Tier C / D

| Event | Binding |
|-------|---------|
| `waiting.search` | motion breathe only; silent sonic/haptic |
| `boot.ready` | T4 presence motion + boot sonic; no haptic |
| Poll/socket/map | Tier D silent |

---

## Frame timeline template (T1 @ 60fps)

| ms | Motion | Haptic | Sound | Visual |
|----|--------|--------|-------|--------|
| 0 | start | fire | — | pre-state |
| 16–33 | ingress 20–40% | — | attack | — |
| 83 | peak | — | body | highlight |
| 133 | — | — | release | state commit |
| 250+ | settle | — | — | completion UI |

**B4-4:** `fireLsxEvent('match.confirmed', { tagId })` executes this schedule.

---

## Theme × sensory matrix

| B3 theme state | Motion | Sonic | Haptic |
|--------------|--------|-------|--------|
| Dark (default) | unchanged | unchanged | unchanged |
| White (flag ON) | unchanged | unchanged | unchanged |
| User OS reduce motion | shorten/disable loops | unchanged | unchanged |
| User app mute (future) | unchanged | off Tier B; Tier A configurable | on Tier A |

---

## Orchestrator API (B4-1 target)

```typescript
type LsxEventId =
  | 'driver.offer.new' | 'qm.invite.new' | 'match.confirmed'
  | 'qr.scan.local' | 'qr.verify.lock' | 'qr.remote.ack'
  | 'payment.confirmed' | 'feedback.error'
  | 'ui.cta.press' | 'role.continue' | 'trust.accept'
  | 'boot.ready';

interface LsxFireOptions {
  eventId: string;       // dedupe key (tagId, inviteId, …)
  urgency?: 'classic' | 'urgent';
  skipSound?: boolean;
  skipHaptic?: boolean;
  skipMotion?: boolean;
}
```

---

**Parent:** `B4_MOTION_SONIC_MASTER_ANALYSIS.md`  
**Cross-ref:** `B4_SONIC_EVENT_MATRIX.md`, `B4_HAPTIC_EVENT_MATRIX.md`, `B4_MOTION_EVENT_MATRIX.md`
