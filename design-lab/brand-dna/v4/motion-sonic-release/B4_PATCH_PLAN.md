# B4 — Patch Plan

**Sprint:** B4 Analysis → Implementation roadmap  
**Principle:** Production-safe incremental patches; no big-bang rewrite  
**Theme rule:** B3 flags stay OFF; LSX patches must not alter business logic

---

## Patch sequence overview

| Patch | Name | Risk | Production touch |
|-------|------|------|------------------|
| **B4-1** | Motion/Sonic/Haptic manifest | Low | New `frontend/lib/lsx/` only |
| **B4-2** | Sound controller cleanup | Medium | `sound.ts` refactor + dead code removal |
| **B4-3** | Haptic token registry | Low | `touchHaptics.ts` + new registry |
| **B4-4** | Event binding map | Medium | Orchestrator + selective call-site migration |
| **B4-5** | QR / payment / trust sync | **High** | Socket ack paths, modals, LiveMap |
| **B4-6** | QA + release gate | Low | Tests, flags, docs |

---

## B4-1 — Manifest (safest first)

**Goal:** Single source of truth for tokens without changing runtime behaviour.

**Deliverables:**

```
frontend/lib/lsx/
  manifest.ts          // eventId → { motion, sonic, haptic, timing, tier }
  types.ts
  flags.ts             // EXPO_PUBLIC_FEATURE_LSX_* default false
  index.ts
```

**Tasks:**

1. Map `v4.motion.*` → `LDS_MOTION_*` aliases
2. Map LSDS tokens → existing `sound.ts` function names
3. Map haptic tokens → future `fireHaptic` enum
4. Export read-only manifest consumed by docs + tests
5. **Zero call-site changes**

**Exit criteria:**

- Typecheck pass
- Manifest matches `B4_LSX_BINDING_MATRIX.md`
- Feature flag `EXPO_PUBLIC_FEATURE_LSX=false` (default)

---

## B4-2 — Sound controller cleanup

**Goal:** Reduce `sound.ts` monolith; remove dead Mixkit paths; fix AppState gaps.

**Tasks:**

1. Split: `audioSession.ts`, `sonicRegistry.ts`, `sonicDedupe.ts`, `sonicPlayback.ts`
2. Remove or `@deprecated` `playDigitClickSound`, `playButtonSound`, `playRoleScreenSound`
3. Preload pool for QR success/error + ui.tap (avoid createAsync per tap)
4. Add AppState guard to `playMatchChimeSound`
5. Optional: promote LSDS v2 WAV winners (listen pass sign-off)
6. Keep public export surface stable (re-export from `sound.ts`)

**Do not:**

- Change dedupe timing without QA
- Change volumes without LSDS sign-off

**Exit criteria:**

- All existing sonic QA paths pass
- No Mixkit in production call graph
- Bundle size delta documented

---

## B4-3 — Haptic token registry

**Goal:** Semantic haptics beyond tapButtonHaptic.

**Tasks:**

1. Add `frontend/lib/lsx/hapticController.ts`
2. Implement P1–P6 patterns per `HAPTIC_DNA.md`
3. Android API35+ multi-pulse fallback for lock/success
4. Dedupe map by eventId
5. `fireHaptic('haptic.success', { eventId: tagId })`

**Exit criteria:**

- Unit-test pattern timing (mock Haptics)
- No global auto-wire yet

---

## B4-4 — Event binding map

**Goal:** Replace scattered direct `play*` calls with orchestrator.

**Tasks:**

1. `fireLsxEvent(eventId, options)` — reads manifest, respects flags
2. Migrate **reference paths first:**
   - `role.continue` (already triad — wrap only)
   - `match.confirmed` (consolidate 5 index call sites)
   - `ui.cta.press` on primary CTAs only
3. Do **not** wire global dashboard taps (avoid R-B4-04)
4. Add `LsxSessionGuard` hook stub for trust call (no-op until B4-5)

**Exit criteria:**

- Match dedupe unified
- Role flow unchanged perceptually
- Flag OFF → identical to pre-B4 behaviour

---

## B4-5 — QR / payment / trust sync (highest risk)

**Goal:** Close P0 gaps: remote ack, payment haptic, trust call guard.

**Tasks:**

1. Generate/promote `sonic.qr.remoteAck` asset (design-lab → bundle)
2. Wire driver socket boarding event → `fireLsxEvent('qr.remote.ack')`
3. Payment success → sonic + haptic + optional checkDraw motion
4. QR scan → viewfinder flash + light haptic (chrome only, not camera)
5. `LsxSessionGuard`: suppress LSX haptics during CallScreenV2 active
6. Align QRTripEndModal raw Vibration → `haptic.lock`

**Do not:**

- Change QR API, scanner permissions, or trust WebRTC
- Modify camera preview overlay colours (B3 rule)

**Exit criteria:**

- Driver hears/feels ack ≤200ms after passenger scan (socket path)
- Trust call QA: no vibration collision
- QR regression QA pass

---

## B4-6 — QA + release gate

**Goal:** Ship LSX with rollback flags.

**Tasks:**

1. Execute `B4_QA_PLAN.md` matrix
2. Device matrix: iOS silent switch, Android 14/15, low-end
3. Dark + white theme spot check (sensory identical)
4. Document `B4_RELEASE_GATE.md` sign-off
5. Optional analytics: lsx_event_fired counters

---

## Dependency graph

```
B4-1 manifest
   ├─► B4-2 sound cleanup
   ├─► B4-3 haptic registry
   └─► B4-4 orchestrator
          └─► B4-5 QR/trust sync
                 └─► B4-6 QA gate
```

---

## Safest first patch

**B4-1 only** — new files, zero runtime change, validates token naming before any user-facing delta.

---

## Files expected to change (by patch)

| Patch | Primary files |
|-------|---------------|
| B4-1 | `frontend/lib/lsx/*` |
| B4-2 | `frontend/utils/sound.ts`, new lib/lsx sonic modules |
| B4-3 | `frontend/utils/touchHaptics.ts`, `lib/lsx/hapticController.ts` |
| B4-4 | `frontend/app/index.tsx`, `DriverOfferScreen.tsx` (orchestrator calls) |
| B4-5 | `LiveMapView.tsx`, QR modals, socket handlers in index, `CallScreenV2` guard |
| B4-6 | docs, optional `__tests__/lsx/` |

---

**Parent:** `B4_MOTION_SONIC_MASTER_ANALYSIS.md`
