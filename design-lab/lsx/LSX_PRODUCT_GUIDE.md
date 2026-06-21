# LSX Product Guide

**Version:** LSX v1.0  
**Audience:** Product, design, engineering leads  
**Status:** Experience patch — analysis only

---

## 1. Executive Summary

LeylekTAG has **working LSDS sounds** but users report the app does not feel **alive**. LSX reframes the problem: sensory feedback is **fragmented** (sound without motion/haptic, silent remote party, dead taps, boot void).

**LSX v1.0** defines a unified language across Sound, Motion, Haptic, Timing, and Visual transition — without changing live QR, payment, dispatch, socket, or Redis logic in this patch.

---

## 2. What Changes Conceptually

| Before (LSDS) | After (LSX) |
|---------------|-------------|
| Sound tokens in isolation | Triads per journey event |
| Actor-only feedback | Remote confirmation required |
| Random haptics | Haptic constitution |
| Animation ad hoc | Motion DNA *Cyan Flow* |
| Silence = default | Silence mapped and designed |

---

## 3. P0 Experience Fixes (product priority)

1. **Brand boot presence** — first 500 ms no longer empty  
2. **Driver offer triad** — relay feel, not notification  
3. **QR remote ack** — driver hears/feels passenger scan  
4. **QR closure** — success → anim → 350–500 ms → modal dismiss  
5. **Match journey pulse** — emotion without fanfare  
6. **Dead UI** — Tier B minimum on all primary taps  

---

## 4. What We Will NOT Do

- Add sound to every interaction  
- Loop ambient music  
- Copy Apple/Tesla/DJI assets  
- Touch backend journey logic in this analysis phase  

---

## 5. Success Metrics (future)

| Metric | Target |
|--------|--------|
| Boot presence perception | ≥80% testers notice “app opened” in blind test |
| Driver boarding remote | Driver confirms “okundu” without asking passenger |
| 3× offer repeat annoyance | None / Mild |
| Primary CTA tap feedback | ≤32 ms to motion or haptic |
| “App feels alive” (1–5) | ≥4.0 post-LSX vs ≤2.5 pre |

---

## 6. Document Map

| Question | Read |
|----------|------|
| What is LSX? | `LSX_CONSTITUTION.md` |
| Per-screen experience | `LSX_JOURNEY_MAP.md` |
| Top 20 moments | `LSX_HEATMAP.md` |
| Where is it silent? | `LSX_SILENCE_REPORT.md` |
| Two-phone flows | `LSX_REMOTE_CONFIRMATION.md` |
| Motion / haptic specs | `LSX_MOTION_LANGUAGE.md`, `LSX_HAPTIC_LANGUAGE.md` |
| Event lookup | `LSX_EVENT_MATRIX.md` |

---

## 7. Implementation Phases (recommendation — not in scope now)

| Phase | Deliverable |
|-------|-------------|
| **LSX 1.1 spec sign-off** | Constitution + journey map approved |
| **LSX 1.2 design-lab** | LSDS v3 tokens + motion storyboard |
| **LSX 1.3 triad pilot** | Boot + driver offer + QR remote (frontend only) |
| **LSX 1.4 rollout** | Remaining journeys + dead UI sweep |

---

## 8. Product Owner Feedback Traceability

| Feedback | LSX response |
|----------|--------------|
| “Canlı değil” | Triads + presence + remote ack |
| Açılış sessiz | `boot.ready` event |
| Offer = bildirim | Relay triad + OS channel strategy |
| Match emotion eksik | `pulse.journey` + longer resolve motion |
| QR belirsiz | Lock pipeline verify→lock→complete |
| Driver QR sessiz | `qr.remote.ack` |
| Modal açık kalıyor | Completion timing in journey map |
| UI tap ince | Tier B motion+haptic mandatory |

---

## 9. Governance Reminder

**Manual listening and device triad tests** required before any production promotion — extends LSDS v2 listening gate to full LSX triads.
