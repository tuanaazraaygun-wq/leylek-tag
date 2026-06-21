# LSX — Leylek Sensory Experience System

**Version:** LSX v1.0  
**Status:** Experience Architecture (analysis only)  
**Scope:** `design-lab/lsx/` — no production changes  
**Supersedes (conceptually):** LSDS as sound-only layer → LSX unified sensory layer

---

## 1. Definition

**LSX** is LeylekTAG’s unified sensory language. It binds:

| Layer | Role |
|-------|------|
| **Sound** | Semantic audio tokens (`lsx.sound.*`) |
| **Motion** | UI kinetic tokens (`lsx.motion.*`) |
| **Haptic** | Tactile tokens (`lsx.haptic.*`) |
| **Timing** | Orchestration rules (frame-relative order) |
| **Visual State** | Surface/phase transitions |
| **Journey Rhythm** | When silence is intentional vs missing |

LSDS remains the **sonic generator and token registry**. LSX is the **experience orchestration layer** that decides *when* and *with what* LSDS tokens fire alongside motion and haptic.

---

## 2. North Star

> **Goal is not more sound. Goal is: “The app is alive.”**

User must feel within **200 ms** that LeylekTAG responded — through at least **two synchronized channels** (e.g. motion + haptic, or motion + sound), never sound alone on critical journey beats.

---

## 3. Design Philosophy

| Principle | Meaning |
|-----------|---------|
| **Operational premium** | Dispatch desk clarity, not taxi alarm or game fanfare |
| **Minimal repetition** | Same gesture family; fatigue-tested (3× / 10× where applicable) |
| **Presence before noise** | Boot and idle = calm; milestones = defined triads |
| **Reciprocity** | Remote party actions must ack on both devices |
| **Closure** | Every confirm event ends with Completion (visual + sensory) |
| **Silence is designed** | Empty beats are documented; accidental silence is a bug |

**Not:** Apple/Tesla/DJI copy. **Yes:** their *logic* — state-linked, short, multimodal, one character.

---

## 4. LSX Triad Model

Every **Tier A** (journey-critical) event uses a **Triad**:

```
Frame 0:   Motion lead-in begins (4–16 ms)
Frame 0–8: Haptic attack (if any)
Frame 8–24: Sound transient (if any)
Frame 24–120: Motion peak + sound body
Frame 120+: Visual state commit + release
```

**Tier B** (UI affordance): Motion + Haptic OR Motion + Micro-sound.  
**Tier C** (ambient): Motion only or silence.

---

## 5. Token Namespaces

| Prefix | Example | Owner doc |
|--------|---------|-----------|
| `lsx.sound.*` | `lsx.sound.offer.relay` | LSDS / sonic v3 |
| `lsx.motion.*` | `lsx.motion.lock.ringClose` | `LSX_MOTION_LANGUAGE.md` |
| `lsx.haptic.*` | `lsx.haptic.medium.single` | `LSX_HAPTIC_LANGUAGE.md` |
| `lsx.visual.*` | `lsx.visual.phase.qrVerified` | `LSX_JOURNEY_MAP.md` |
| `lsx.timing.*` | `lsx.timing.triad.standard` | §6 below |

---

## 6. Timing Constitution (summary)

Full matrix: `LSX_EVENT_MATRIX.md`

| Pattern | Order | Use |
|---------|-------|-----|
| **T1 Standard Triad** | Motion → Haptic (+0 ms) → Sound (+8 ms) → Visual commit (+80 ms) | Offer, match, QR lock |
| **T2 Micro Confirm** | Haptic (+0) → Motion (+4) → Sound (+12) | UI tap, scan tick |
| **T3 Remote Echo** | Socket/state (+0) → Motion (+0) → Haptic (+16) → Sound (+24) | Driver hears passenger QR |
| **T4 Presence** | Motion (+0) → Sound (+40 ms) → no haptic | Boot (silent mode friendly) |
| **T5 Caution** | Haptic warning (+0) → Sound (+20) → Motion shake subtle (+40) | Error, QR fail |

**Frame budget:** 60 fps assumed → 16.67 ms/frame. All delays round to nearest frame.

**Rule:** Sound never leads motion on Tier A events (feels late/laggy otherwise).

---

## 7. Presence Map (system “I am here”)

| Moment | Current | LSX v1 target |
|--------|---------|---------------|
| App boot (JS ready) | Silent ~500 ms | `lsx.sound.presence.boot` + logo pulse |
| Role select visible | Visual only | Ambient motion loop (existing) + optional micro presence |
| Driver goes online | UI state change | `lsx.motion.online.glow` + light haptic |
| Socket connected | None user-visible | Subtle chrome pulse (Tier C) |
| Active journey | Map + chrome | Guardian dot breathe (exists) — sync to journey rhythm |
| Leylek Zeka orb | Motion rich | LSX subset on open/confirm only |
| Logout / session end | Abrupt | Short presence release (descending gesture) |

See `LSX_HEATMAP.md` and `LSX_SILENCE_REPORT.md`.

---

## 8. Tier Classification

| Tier | Events | Triad required |
|------|--------|----------------|
| **A** | Offer, QM, match, QR lock, payment confirm, remote ack | Yes |
| **B** | Primary CTA, role continue, trust accept | Motion + one channel |
| **C** | Scroll, map pan, list tap | Motion optional |
| **D** | Background poll, socket heartbeat | Silent by design |

---

## 9. Governance

- **Chief Sonic Architect:** LSDS token quality, WAV generation  
- **Chief Motion Designer:** `lsx.motion.*` curves and durations  
- **Chief UX Architect:** Journey maps, confirmation closure  
- **Chief Mobile Engineer:** Triad wiring feasibility (expo-av, reanimated, haptics)  
- **Chief Product Architect:** Tier priorities, fatigue policy  

Changes to Tier A timing require LSX version bump.

---

## 10. Relationship to LSDS

```
LSDS (sound DNA)  ──►  lsx.sound.* tokens
                              │
LSX Orchestrator  ◄──  lsx.motion.* + lsx.haptic.* + timing
                              │
                         Journey Event Bus (future)
                              │
                         Production UI (unchanged in this patch)
```

This document does not authorize production wiring.

---

## 11. Non-Goals (LSX v1.0 analysis patch)

- No code, commit, asset, or WAV changes  
- No QR/payment/dispatch/socket/Redis/Quick Match logic changes  
- No new loops or continuous soundscapes  

---

## 12. Document Index

| File | Contents |
|------|----------|
| `LSX_JOURNEY_MAP.md` | Per-journey experience tables |
| `LSX_HEATMAP.md` | Top 20 moments + emotion curve |
| `LSX_SILENCE_REPORT.md` | Silence + dead UI maps |
| `LSX_MOTION_LANGUAGE.md` | Motion DNA |
| `LSX_HAPTIC_LANGUAGE.md` | Haptic constitution |
| `LSX_EVENT_MATRIX.md` | Master event matrix |
| `LSX_REMOTE_CONFIRMATION.md` | Two-device confirmation |
| `LSX_PRODUCT_GUIDE.md` | Product-facing summary |
