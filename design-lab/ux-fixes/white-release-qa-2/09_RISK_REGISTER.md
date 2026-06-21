# 09 — Risk Register (WHITE-RELEASE-QA-2)

| ID | Risk | Finding | Likelihood | Impact | Mitigation |
|----|------|---------|------------|--------|------------|
| R1 | Widening solo match card breaks deck maxWidth on tablets | #1 | Low | Low | Cap with `MATCH_DECK_MAX_WIDTH`; test 440dp+ |
| R2 | Sticky QM footer overlaps keyboard on small devices | #2 | Medium | Medium | `KeyboardAvoidingView` on footer only; test address edit flows |
| R3 | Light field intel cells look flat vs dark “HUD” brand | #3 | Medium | Low | Keep teal accent on values; user test driver cohort |
| R4 | LeylekEye SVG perf on low-end Android (multiple instances) | #4 | Low | Medium | `motionProfile="guardian"` in header; reduce motion flag |
| R5 | Removing LeylekEyeTrigger breaks driver chat entry | #4 | Low | High | Preserve same `onPress` → `openLeylekZekaFromMapDriver` |
| R6 | Shortening match transition feels abrupt | #5 | Medium | Medium | Crossfade scrim instead of hard cut; A/B 1.5s vs 3s |
| R7 | QM optimistic tag desync if API fails | #5 | Medium | High | Roll back optimistic tag on error; keep loading state |
| R8 | OSRM defer delays route line appearance | #5 | Low | Low | Show straight-line fallback or spinner on polyline slot |
| R9 | Nav arrow light resize shifts perceived bearing | #6 | Low | Medium | Scale wrapper only; do not change anchor or rotation |
| R10 | `tracksViewChanges=false` revives Android blank PNG pins | #5 | Medium | Medium | Match DriverOfferScreen pattern; test accept on 3 Android devices |
| R11 | Partial light chat shell — mixed dark/light regression | #4 | Medium | Medium | Ship QA-2G as single PR; no half-migrated chat |
| R12 | Speech toggle restyle breaks accessibility switch | #4 | Low | Medium | Keep `accessibilityRole="switch"` + state labels |
| R13 | Dark theme regression from shared style refactor | All | Medium | High | Gate all changes behind `isScopeLight` / `chromeTone`; dark snapshot CI |
| R14 | Touch target shrink on compact QM stepper | #2 | Low | Medium | Min 44×44 on primary actions; stepper can go 40 only with padding |
| R15 | Guardian slot eye duplicates FAB on passenger match | #1/#4 | Low | Low | Either slot eye OR floating FAB — not both visible |
| R16 | Map overlay removal exposes uninitialized map flash | #5 | Medium | Medium | Fade overlay opacity with `mapTilesReady`; don’t instant hide |
| R17 | Huawei blank map without GMS guard | #5 | Low | High | Add probe before mount; fallback message (existing waiting screen pattern) |
| R18 | Font scale 1.3 breaks field intel collapsed height | #3 | Medium | Low | Use `minHeight` not `maxHeight` or allow vertical scroll in HUD |
| R19 | Backend/socket touched accidentally in perf sprint | #5 | Low | Critical | Code review gate: no `backend/`, no socket handlers |
| R20 | Yerime Al re-enabled by mistake | #1 | Low | Medium | Keep `RENDER_PROXY_MATCH_CARD=false`; explicit PR checklist |

---

## Regression test gates (every patch)

### Automated / manual smoke

- [ ] Dark theme screenshot diff — driver cockpit, passenger match, QM modal, chat
- [ ] Normal TAG accept — driver map mounts
- [ ] Quick Match accept — driver map mounts
- [ ] Driver nav immersive — arrow rotates with bearing
- [ ] Passenger match — Yerime Al absent

### Device matrix (minimum)

| Device class | OS | Required |
|--------------|-----|----------|
| Small phone | Android 12+ | ✓ |
| Mid phone | Android 13+ | ✓ |
| iPhone SE class | iOS 16+ | ✓ |
| Large phone | Either | ✓ |

### Rollback triggers

- Map crash on accept → revert QA-2B/QA-2I first
- Chat open crash after eye swap → revert QA-2F
- QM session submit failure → revert QA-2C (layout only) before QA-2J

---

## Out of scope (do not patch in this release track)

- Payment / QR finish parity (separate UX-P0-QR track)
- Backend quick match `passenger_payment_method` (already shipped)
- Marker PNG assets (WHITE-FINAL-1C shipped scale/chrome)
- Route polyline algorithm / OSRM provider swap
- Camera follow / GPS accuracy tuning

---

## Sign-off checklist

| Role | Item |
|------|------|
| Frontend | All patches gated `isScopeLight` / feature flags |
| QA | APK matrix from `01_DEVICE_FINDINGS.md` complete |
| Product | Yerime Al remains hidden |
| Release | No untracked production diffs; design-lab docs only for QA-2A |
