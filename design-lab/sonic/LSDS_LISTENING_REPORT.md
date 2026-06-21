# LSDS Listening Report

**Repo:** `D:\dev\leylek-tag`  
**Branch:** `working-final`  
**Scope:** `design-lab/sonic/output/wav/` only  
**Status:** Pre-promotion listening pack — no production wiring  
**Generated:** 2026-06-20  

---

## 1. Inventory — 20 WAV files

All files: **mono PCM, 16-bit, 44.1 kHz**  
Path prefix: `design-lab/sonic/output/wav/`

| # | File | Token | Duration | Size |
|---|------|-------|----------|------|
| 1 | `brand_signature_v1.wav` | `sonic.brand.signature` | 0.900 s | 79 KB |
| 2 | `brand_signature_v2.wav` | `sonic.brand.signature` | 0.915 s | 81 KB |
| 3 | `brand_signature_v3.wav` | `sonic.brand.signature` | 0.905 s | 80 KB |
| 4 | `driver_offer_classic_v1.wav` | `sonic.driver.offer.classic` | 0.800 s | 71 KB |
| 5 | `driver_offer_classic_v2.wav` | `sonic.driver.offer.classic` | 0.801 s | 71 KB |
| 6 | `driver_offer_classic_v3.wav` | `sonic.driver.offer.classic` | 0.783 s | 69 KB |
| 7 | `driver_offer_urgent_v1.wav` | `sonic.driver.offer.urgent` | 0.920 s | 81 KB |
| 8 | `driver_offer_urgent_v2.wav` | `sonic.driver.offer.urgent` | 0.935 s | 83 KB |
| 9 | `driver_offer_urgent_v3.wav` | `sonic.driver.offer.urgent` | 0.925 s | 82 KB |
| 10 | `quick_match_ops_v1.wav` | `sonic.quickMatch.driver.opsCall` | 0.980 s | 86 KB |
| 11 | `quick_match_ops_v2.wav` | `sonic.quickMatch.driver.opsCall` | 0.995 s | 88 KB |
| 12 | `quick_match_ops_v3.wav` | `sonic.quickMatch.driver.opsCall` | 0.985 s | 87 KB |
| 13 | `match_success_v1.wav` | `sonic.match.success` | 1.200 s | 106 KB |
| 14 | `match_success_v2.wav` | `sonic.match.success` | 1.198 s | 106 KB |
| 15 | `match_success_v3.wav` | `sonic.match.success` | 1.170 s | 103 KB |
| 16 | `qr_success_v1.wav` | `sonic.qr.success` | 0.240 s | 21 KB |
| 17 | `qr_error_v1.wav` | `sonic.qr.error` | 0.470 s | 42 KB |
| 18 | `payment_confirmed_v1.wav` | `sonic.payment.confirmed` | 0.810 s | 71 KB |
| 19 | `feedback_error_v1.wav` | `sonic.feedback.error` | 0.530 s | 47 KB |
| 20 | `ui_tap_v1.wav` | `sonic.ui.tap` | 0.065 s | 6 KB |

**Spec edge notes (synthesis, not listening):**

- `quick_match_ops_v1/v3` — 0.980 / 0.985 s (spec floor 1.0 s); v2 at 0.995 s is closest to floor.
- `qr_success_v1` — 0.240 s (spec floor 0.25 s); acceptable micro-blip.
- `driver_offer_classic_v3` — shortest in family (0.783 s); verify it still feels “complete” on phone speaker.

---

## 2. v1 / v2 / v3 comparison (five tokens)

Synthetic differences from `generate_sonic_v1.py` + `SONIC_GENOME.md`. Use this while A/B/C listening.

### `sonic.brand.signature`

| | v1 | v2 | v3 |
|---|----|----|-----|
| Phase gap | 280 ms | **295 ms** (+15) | 285 ms |
| 2nd harmonic | 0.125 | **0.10** (softer sheen) | 0.125 |
| Phase 2 pitch | E4 | E4 | E4 **+0.2% detune** |
| Duration | 0.900 s | 0.915 s | 0.905 s |
| Listen for | Reference “Leylek opens” | More space between notes; less glass | Subtle shimmer on second note |

**Lean (pre-listen):** v1 canonical; if v1 feels bright, try **v2**.

---

### `sonic.driver.offer.classic`

| | v1 | v2 | v3 |
|---|----|----|-----|
| Phase gap | 240 ms | **255 ms** | 245 ms |
| Release scale | 100% | **92%** | **88%** (shortest tail) |
| Duration | 0.800 s | 0.801 s | **0.783 s** |
| Listen for | Balanced dispatch ping | Slightly slower, calmer | Snappiest; may feel clipped on small speaker |

**Lean (pre-listen):** **v1** for production parity with current calm offer; **v2** if team wants more separation from urgent.

---

### `sonic.driver.offer.urgent`

| | v1 | v2 | v3 |
|---|----|----|-----|
| Phase gap | **180 ms** (tightest) | 195 ms | 185 ms |
| Phase 2 | F4 + h3 0.04 | F4 + h3 **0.05** | F4 **detuned** + h3 0.045 |
| Release | 260 ms (all) | 260 ms | 260 ms |
| Duration | 0.920 s | 0.935 s | 0.925 s |
| Listen for | Max attention without alarm | Slightly more “comms edge” on note 2 | Middle ground + micro detune |

**Lean (pre-listen):** **v1** — widest gap vs classic (180 vs 240 ms); clearest urgent identity.

---

### `sonic.quickMatch.driver.opsCall`

| | v1 | v2 | v3 |
|---|----|----|-----|
| Phase gap | 220 ms | **235 ms** | 225 ms |
| Phase 2 timbre | A4 + E4 blend | **+ detuned A4 partial** (comms shimmer) | Detuned A4 + E4 |
| Duration | 0.980 s | **0.995 s** | 0.985 s |
| Listen for | Clean operational two-step | Futuristic “channel open” | Between v1 and v2 |

**Lean (pre-listen):** **v2** — matches “operational call” brief; v1 if v2 feels too busy in car cabin.

---

### `sonic.match.success`

| | v1 | v2 | v3 |
|---|----|----|-----|
| Phase gap | 350 ms | **365 ms** | 355 ms |
| Release scale | **100%** (longest) | 95% | **90%** (shortest) |
| Duration | **1.200 s** | 1.198 s | **1.170 s** |
| Listen for | Warmest resolve | Slightly tighter | Less emotional tail; faster return to UI |

**Lean (pre-listen):** **v1** — longest resolve; avoid childish by checking it doesn’t feel “celebratory fanfare” on phone.

---

### Single-candidate tokens (no v2/v3 in this batch)

| Token | File | Compare against |
|-------|------|-----------------|
| `sonic.qr.success` | `qr_success_v1.wav` | Must be clearly shorter/softer than offer classic |
| `sonic.qr.error` | `qr_error_v1.wav` | Must differ from `feedback_error` (shorter, same family) |
| `sonic.payment.confirmed` | `payment_confirmed_v1.wav` | Trustworthy; not identical to match success |
| `sonic.feedback.error` | `feedback_error_v1.wav` | Slightly longer tail than QR error |
| `sonic.ui.tap` | `ui_tap_v1.wav` | Must not fatigue after 10 rapid taps |

---

## 3. Phone speaker listening checklist

**Setup (5 min)**

- [ ] Transfer `design-lab/sonic/output/wav/` to phone (AirDrop / USB / cloud — do **not** copy to `frontend/assets/sounds`).
- [ ] Volume: **70%** system media volume; repeat critical tokens at **40%** and **90%**.
- [ ] Disable Bluetooth; use **bottom speaker** first.
- [ ] Optional second pass: single **car Bluetooth** sample for driver tokens only.

**Player order (blind optional)**

Play each family v1 → v2 → v3 back-to-back with 2 s silence between.

**Per-token checks**

| Token | Pass criteria | Fail signals |
|-------|---------------|--------------|
| brand_signature | Premium, memorable, not startup jingle | Cheap beep, too long, too loud |
| driver_offer_classic | Noticeable, calm, not annoying on 3 repeats | Taxi horn, alarm, harsh high end |
| driver_offer_urgent | Clearly more present than classic; still calm | Harsh, panic, same as classic |
| quick_match_ops | “Ops desk” / professional; distinct from offer | Game sound, siren, identical to urgent |
| match_success | Warm closure; shared journey | Childish, casino win, too long |
| qr_success | Instant confirm; unobtrusive | Could be confused with notification |
| qr_error | Soft caution; invites retry | Angry buzz, punishing |
| payment_confirmed | Trust / handshake | Same as match (too celebratory) |
| feedback_error | Clear failure; not scary | Same as qr_error (too similar) |
| ui_tap | Clean micro click ×10 rapid | Ringing, loud, fatiguing |

**Cross-family discrimination (critical)**

- [ ] classic vs urgent vs quick_match_ops — **three clearly different** in <2 s each
- [ ] match_success vs payment_confirmed — **different emotional weight**
- [ ] qr_success vs qr_error vs feedback_error — **error pair distinct from success**
- [ ] ui_tap vs qr_success — tap must be **much shorter**

**Scoring sheet (copy per listener)**

```
Token: _______________  Winner: v1 / v2 / v3 / v1-only
Phone speaker @70%:  Pass / Fail
At 40% volume:       Audible Y/N
3× repeat annoyance:  None / Mild / Reject
Notes: _______________________________
```

**Minimum listeners:** 2 (product + driver-facing engineer recommended).

---

## 4. Production candidacy table

**Current production assets** (reference only — unchanged):

| Production file | Status in repo |
|-----------------|----------------|
| `frontend/assets/sounds/leylektag-luxury-tone.wav` | Exists |
| `frontend/assets/sounds/driver-offer-classic.wav` | Exists |
| `frontend/assets/sounds/driver-offer-urgent.wav` | Exists |
| `frontend/assets/sounds/match-chime.mp3` | **Missing** (code references it) |

| LSDS token | Listening candidate(s) | Production target (future) | Candidacy | Pre-listen pick | Blockers |
|------------|------------------------|------------------------------|-----------|-----------------|----------|
| `sonic.brand.signature` | v1, v2, v3 | `leylektag-luxury-tone.wav` | **A** | v1 | A/B vs existing luxury tone on device |
| `sonic.driver.offer.classic` | v1, v2, v3 | `driver-offer-classic.wav` | **A** | v1 | Must beat current WAV in blind test |
| `sonic.driver.offer.urgent` | v1, v2, v3 | `driver-offer-urgent.wav` | **A** | v1 | Must be distinct from classic on speaker |
| `sonic.quickMatch.driver.opsCall` | v1, v2, v3 | *new file* (no prod asset) | **A+** | v2 | No prod sound today; highest QM value |
| `sonic.match.success` | v1, v2, v3 | `match-chime.mp3` (missing) | **A+** | v1 | Fills missing asset gap |
| `sonic.qr.success` | v1 only | *new* | **B** | v1 | No prod sound; wire after QR UX review |
| `sonic.qr.error` | v1 only | *new* | **B** | v1 | Must differ from feedback_error in listen |
| `sonic.payment.confirmed` | v1 only | *new* | **B** | v1 | No prod sound today |
| `sonic.feedback.error` | v1 only | *new* | **C** | v1 | Lower priority; haptic-only today |
| `sonic.ui.tap` | v1 only | *new* (tap currently no-op in app) | **C** | v1 | App `playTapSound` is empty — product decision |

**Candidacy legend**

- **A+** — High value, no or broken production asset; promote after listen sign-off.
- **A** — Direct replacement candidate; requires blind test vs current production WAV.
- **B** — New capability; promote with feature wiring (QR / payment).
- **C** — Design-lab ready; promote only when product enables UI/error sounds.

---

## 5. Recommended listening session script (~15 min)

1. **Warm-up:** `brand_signature` v1 → v2 → v3  
2. **Driver stack:** `driver_offer_classic` v1/v2/v3 → `driver_offer_urgent` v1/v2/v3 → `quick_match_ops` v1/v2/v3  
3. **Resolve:** `match_success` v1/v2/v3 → `payment_confirmed` v1  
4. **Micro:** `qr_success` v1 → `qr_error` v1 → `feedback_error` v1 → `ui_tap` v1 ×10  
5. **Discrimination replay:** winner of classic, urgent, QM back-to-back  
6. **Fill scoring sheet;** record winner filenames in section 6 below.

---

## 6. Listening decisions (fill after session)

| Token | Selected file | Listener 1 | Listener 2 | Date |
|-------|---------------|------------|------------|------|
| brand_signature | | | | |
| driver_offer_classic | | | | |
| driver_offer_urgent | | | | |
| quick_match_ops | | | | |
| match_success | | | | |
| qr_success | | v1 (only) | | |
| qr_error | | v1 (only) | | |
| payment_confirmed | | v1 (only) | | |
| feedback_error | | v1 (only) | | |
| ui_tap | | v1 (only) | | |

---

## 7. Out of scope (confirmed)

- No files copied to `frontend/assets/sounds/`
- No changes to `frontend/`, `backend/`, or app code
- No `git add` / `git commit`

**Regenerate WAVs:** `py -3 design-lab/sonic/generate_sonic_v1.py`
