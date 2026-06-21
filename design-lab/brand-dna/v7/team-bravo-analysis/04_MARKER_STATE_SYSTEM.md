# V7.2 — Marker State System

**Team:** BRAVO  
**Scope:** Idle · Selected · Focused · Matched · Journey Active · Searching · Offline · Quick Match · Trusted · Navigation  
**Sources:** `03_MARKER_PRODUCTION_SPEC.md` · V6 map/motion · production component grep

---

## 1. State model overview

```
                    ┌──────────┐
         ┌─────────►│  IDLE    │◄─────────┐
         │          └────┬─────┘          │
         │               │ searching      │ offline clear
         │               ▼                │
         │          ┌──────────┐          │
         │          │ SEARCHING│──────────┤
         │          └────┬─────┘          │
         │               │ match          │
         │               ▼                │
         │          ┌──────────┐     ┌────┴────┐
         │          │ MATCHED  │────►│ OFFLINE │
         │          └────┬─────┘     └─────────┘
         │               │ QM overlay (480ms)
         │               ▼
         │          ┌──────────┐
         │          │ QM LOCK  │ (ephemeral)
         │          └────┬─────┘
         │               │
         │               ▼
         │          ┌──────────┐      ┌──────────┐
         └──────────│ JOURNEY  │◄────►│  TRUSTED │ overlay
                    │ ACTIVE   │      └──────────┘
                    └────┬─────┘
                         │ nav mode
                         ▼
                    ┌──────────┐
                    │ NAVIGATION│ (driver immersive)
                    └──────────┘
```

---

## 2. State definitions & production status

| State | Visual intent | Production | Gap |
|-------|---------------|------------|-----|
| **Idle** | Default entity on map | PNG static + glow wrapper | No arc foot · wrong glow |
| **Selected** | User tapped pin — scale 1.1× + edge brighten | `onPress` → info card only — **no marker state change** | Missing selected grammar |
| **Focused** | Camera centers entity | Camera logic exists — marker unchanged | OK behaviorally |
| **Matched** | Route appears · pickup pulse | Polyline draws — **no pickup flash** | Missing lock flash 320ms |
| **Journey Active** | Cyan route + optional journey glyph | Polyline only — `journey-active.png` **unwired** | Missing MK-11 |
| **Searching** | Orbit pulse on driver/passenger | DriverOffer Ionicons pulse · PNG unwired | MK-19 not implemented |
| **Offline** | 40% opacity + dashed ring | No map fade state | `offline-driver.png` unwired |
| **Quick Match** | Lock ring between nodes 480ms | **No map marker** | CF-11 · jury 38 FAIL |
| **Trusted** | Warm outer ring on entity | UI chip only | MK-15 unwired |
| **Navigation** | Flat rotated vehicle + turn wedge | PNG rotate ✅ · pointer separate dialect | Unify wedge DNA |

---

## 3. Per-entity state matrix

| Entity | Idle | Searching | Matched | Journey | Nav | Trusted | Offline |
|--------|------|-----------|---------|---------|-----|---------|---------|
| **Passenger** | PNG 32px | breathe 2s (spec) | same | visible to driver | hidden post-board | ring overlay | fade |
| **Driver car** | PNG 34px | field Ionicons (Offer) | PNG | PNG + route | flat rotate + pointer | ring overlay | fade |
| **Driver motor** | PNG 30px | same | same | same | same | same | fade |
| **Pickup** | Ionicons pin | — | lock flash | visible | beacon 1.25× | — | — |
| **Destination** | Ionicons flag | — | static | visible | beacon | — | — |
| **Cluster** | count badge | — | — | — | — | — | — |
| **QM** | — | — | lock ring | — | — | — | — |

---

## 4. Transitions (spec vs production)

| Transition | Spec motion | Production | Triad (Charlie) |
|------------|-------------|------------|-----------------|
| Idle → Searching | `waiting.breathe` 2s opacity | Partial pulse on Offer only | — |
| Searching → Matched | `pulse.journey` 480ms + sonic | Route draw only | ⚠️ partial sonic |
| Matched → Pickup lock | Pickup flash 320ms | **None** | — |
| Match → QM | Lock ring 480ms + QM sonic | Sound only | G3 collision risk |
| Boarding → Journey active | Marker role swap | Logic exists · no glyph change | — |
| Journey → Navigation | Entity flat + pointer | Implemented split styles | — |
| Any → Trusted | Warm ring fade in 300ms | Chip animation — not on pin | — |
| Any → Offline | Opacity 40% + dashed arc | **Not implemented** | — |

**Motion tokens:** V6 `06_MOTION_SYSTEM.md` — **not enforced in marker code**.

---

## 5. Selected & focused states

### Recommended (MEX)

| State | Visual | Duration |
|-------|--------|----------|
| Selected | Scale 1.08× · edge stroke +0.5px · glow +4% | Hold until dismiss |
| Focused | Camera pan — marker may add subtle breathe | While centered |

### Production

- LiveMapView `onPress` → `setShowInfoCard(true)` — **marker appearance unchanged**  
- No z-index boost on selected marker  
- Risk: user cannot confirm which pin opened card @ dense clusters

---

## 6. Quick Match state (critical gap)

| Phase | Map behavior (V6) | Production |
|-------|---------------------|------------|
| Invite sent | Lock ring between passenger + driver coords | **Missing** |
| 480ms | Ring collapses → standard entity markers | N/A |
| Sonic | `quick-match-driver-ops.wav` | ✅ sound exists |
| Haptic | QM distinct from offer | G3-3 pending |

**Strategic failure:** QM invisible where ops happen (map) — B5.6 stopped meeting.

---

## 7. Trust state layering

| Layer | Spec | Production |
|-------|------|------------|
| Base entity | Car/motor/passenger PNG | ✅ |
| Trust overlay | MK-15 warm ring @20% | ❌ |
| UI chip | TrustedAddButton | ✅ (EMERGENCY flag may disable) |
| Rule | Map ring OR chip — not competing | Both may appear — clutter risk |

---

## 8. Navigation sub-state (driver)

| Mode | Self marker | Pointer | Route | Other entities |
|------|-------------|---------|-------|----------------|
| Pre-nav | PNG anchor bottom | Hidden | Full route | PNG |
| Immersive nav | Hidden or minimal | `DriverNavDirectionPointer` | Segmented dim/bright/hot | Reduced |
| Post-board passenger | Hidden (passenger view) | — | Dest leg | Driver PNG |

**Inconsistency:** Nav pointer uses `#22D3EE` while entity PNGs use same glow wrapper — neither matches MEX wedge.

---

## 9. Cluster state (unimplemented)

| Spec | MK-20 arc base + integer count |
|------|--------------------------------|
| Production | No cluster marker on map |
| Trigger | >1 entity same cell @ z16–18 |
| Transition | Tap → explode to entities |

---

## 10. State implementation priority (Bravo sprint)

| Priority | State | Blocker |
|----------|-------|---------|
| P0 | Idle chassis (all types) | G2 |
| P0 | Car vs motor form | G2-1 |
| P0 | Pickup vs dest beacons | G2-2 |
| P1 | Searching orbit MK-19 | Driver field |
| P1 | QM lock ring | Strategic |
| P1 | Trusted overlay | Trust map identity |
| P2 | Selected/focused | UX polish |
| P2 | Offline fade | Edge case |
| P2 | Cluster MK-20 | Density markets |

---

## 11. Forbidden transitions

- Bouncing scale on match (mascot energy)  
- Full logo reveal on QM (brand confusion)  
- Red searching heat blob (generic ride-hail)  
- Ionicons → PNG mid-journey without crossfade (dialect flash)

---

**Marker state system analysis — COMPLETE**
