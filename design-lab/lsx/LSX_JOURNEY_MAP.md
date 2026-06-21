# LSX Journey Map

**Version:** LSX v1.0  
**Format per journey:** Current → Problems → LSX tokens → Timing → Expected feeling → Event pipeline table

Event pipeline columns: **EVENT → Motion → Haptic → Sound → Visual State → State Transition → Completion**

---

## App Boot

### Current Experience
Native splash hidden immediately (`_layout.tsx`); no `loadSounds` or brand token on boot. First ~500 ms silent until role/login paints.

### Problems
- No presence; user does not feel “inside LeylekTAG”
- Visual may appear before sensory anchor

### LSX Target
| Field | Spec |
|-------|------|
| Motion | `lsx.motion.presence.pulse` on logo 220 ms |
| Sound | `lsx.sound.presence.boot` *(LSDS v3)* 220–320 ms |
| Haptic | None (T4) |
| Timing | T4 — motion frame 0, sound +40 ms |
| Expected feeling | “Sistem açıldı — premium, sessiz güven” |

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | State Transition | Completion |
|-------|--------|--------|-------|--------------|------------------|------------|
| `boot.jsReady` | presence.pulse | — | brand.boot | Logo + chrome | splash→app shell | idle ready |

---

## Login

### Current Experience
Form submit → navigation; haptic on some buttons (`tapButtonHaptic`); no success sensory.

### Problems
Silent success; dead submit taps if no haptic path

### LSX Target
Tier B: motion crossfade + light haptic on successful auth only; no sound (public spaces).

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `login.cta` | click.press | light | — | Button | idle→loading | — |
| `login.success` | fade 200ms | light | — | Form | login→role/dashboard | route visible |

---

## Role Select

### Current Experience
Rich visuals (`RoleSelectScreen`, heroes); `roleScreenHaptic` on role/vehicle; `playUiTapSound` on continue only.

### Problems
Selection feels good visually; non-continue taps silent

### LSX Target
Reference Tier B pattern for all selection cards.

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `role.select` | hero scale 200ms | selection | — | Hero highlight | idle→selected | — |
| `role.continue` | click.press | selection | ui.tap | CTA | role→vehicle/dashboard | nav start |

---

## Vehicle Select

Same as role select — hero + continue triad.

---

## Passenger Dashboard

### Current Experience
Map-centric; searching states; most taps `playTapSound` no-op; match mode cards visual only.

### Problems
Dead UI on majority taps; waiting flat

### LSX Target
Tier C breathe while searching; Tier B on send-offer CTA only.

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `dashboard.waiting` | waiting.breathe | — | — | Search UI | — | offer arrives |
| `dashboard.cta` | click.press | light | ui.tap | CTA | idle→action | per action |

---

## Driver Dashboard

### Current Experience
Requests list; socket/poll offer sound; chat/map; online state visual.

### Problems
New request row lacks motion ingress; online toggle weak

### LSX Target
`relay.ingress` on each new request row with offer sound triad.

---

## Driver Online

### Current Experience
State toggle; minimal feedback.

### LSX Target
`lsx.motion.online.glow` + `haptic.light` — no sound.

---

## Driver Offer

### Current Experience
LSDS classic/urgent WAV via `playDriverNewOfferLuxuryTone`; cooldown 1 s; no haptic; no row motion.

### Problems
Sounds like phone notification; not “yeni görev”; not operasyon merkezi

### LSX Target
| Field | Spec |
|-------|------|
| Motion | `relay.ingress` on new row 260 ms |
| Haptic | medium (urgent: double) |
| Sound | LSDS offer v3 relay character |
| Timing | T1 |
| Expected feeling | “Yeni görev geldi — sakin otorite” |

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `driver.offer.new` | relay.ingress | medium | driver.offer | List | idle→new row | row stable |

---

## Quick Match

### Current Experience
`notifyQuickMatchDriverOpsSoundFromInvite`; distinct from offer; no motion/haptic.

### LSX Target
Relay ingress + ops sound + medium haptic; visual banner sync.

---

## Match Success

### Current Experience
`playMatchChimeSound` both roles; debounce 2.8 s; no motion/haptic constitution.

### Problems
“Fena değil” but no “journey başladı” emotion

### LSX Target
`pulse.journey` 480 ms + success haptic + match resolve sound; brief hold before UI unlock.

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `match.confirmed` | pulse.journey | success | match.success | Map chrome | matched→active | hold 480ms |

---

## Journey Waiting

Passenger waiting for driver / driver en route — Tier C motion breathe only; intentional silence.

---

## Driver Arrival

Proximity boarding banner (`driverBoardingNearBanner`); visual only.

### LSX Target
Subtle chip pulse + light haptic once when banner appears (not repeating).

---

## QR Boarding (detailed example)

### Current Experience
- **Passenger** scans in `BoardingScanModal` → `playQrScanSuccessSound` → API → modal may close via `onVerified`
- **Driver** shows `DriverBoardingQRModal` → on passenger success socket `onBoardingConfirmed` closes modal — **no sound, no haptic, no success animation**

### Problems
1. Driver: “Okudu mu?” — critical confirmation gap  
2. Passenger: lock feeling weak at 0.50 vol / 275 ms  
3. No verify→lock→complete pipeline  
4. Asymmetric sensory  

### LSX Target Tokens
| Channel | Token |
|---------|-------|
| Motion (passenger) | scan.viewfinderFlash → lock.ringClose |
| Motion (driver remote) | lock.ringClose → dismiss.sheet |
| Haptic | lock (passenger), remote (driver) |
| Sound | qr.scan.tick → qr.success (passenger); qr.remoteAck (driver) |
| Timing | T1 local, T3 remote |

### Animation Timing
| Phase | Duration |
|-------|----------|
| Scan decode flash | 100 ms |
| Lock ring close | 320 ms |
| Success hold | 350–500 ms |
| Modal dismiss | 280 ms |

### Expected Feeling
**Passenger:** “Kilitlendi — doğru kod.”  
**Driver:** “Yolcu bindi — sistem onayladı.” (same moment, remote triad)

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `qr.boarding.scan` | viewfinderFlash | light | qr.scan.tick | Camera | scanning→decode | verify API |
| `qr.boarding.lock.local` | ringClose | lock | qr.success | Verified UI | scan→verified | hold 350ms |
| `qr.boarding.ack.remote` | ringClose | remote | qr.remoteAck | Driver chip “Doğrulandı” | waiting→confirmed | dismiss 500ms |
| `journey.started` | pulse.journey (micro) | success | match micro variant | Map status | matched→in_progress | ride UI |

---

## Journey Started

State: `boarding_confirmed_at` set; chat may lock.

### LSX Target
Single micro triad on both devices when status → `in_progress` (if not merged with boarding ack).

---

## Payment

### Current Experience
`playPaymentConfirmedSound` on passenger trip end complete + driver transfer approve; weak visual lock.

### Problems
Can feel same as match; modal flows overlap QR end

### LSX Target
Shorter lock gesture + checkDraw; T1; distinguish from match (shorter, no pulse).

### Event Pipeline

| EVENT | Motion | Haptic | Sound | Visual State | Transition | Completion |
|-------|--------|--------|-------|--------------|------------|------------|
| `payment.confirmed` | lock + checkDraw | success | payment.confirmed | Checkmark | pay→done | sheet close |

---

## Journey Complete (QR Trip End)

### Current Experience
Passenger scans driver QR in `QRTripEndModal` → success sound → **stays on payment step**; driver shows QR silently.

### Problems
Modal open after success; driver no remote ack; payment step breaks closure

### LSX Target
verify→lock→complete; auto-advance or dismiss per product flow; driver T3 on `complete-qr` success.

---

## Rating

### Current Experience
Modal after QR dismiss; silent open/submit.

### LSX Target
Soft presence motion on open; micro success on submit (Tier B, no loud sound).

---

## Trust

### Current Experience
Trusted network flows; minimal sensory.

### LSX Target
`success.checkDraw` + trust micro sound on accept; ingress on invite received.

---

## Leylek Zeka

### Current Experience
Strong motion (orb breathe, flutter); chat haptics partial.

### LSX Target
Do not add sound spam; open = light haptic; confirm actions = Tier B only.

---

## Logout

### Current Experience
Return role select; optional silent.

### LSX Target
Optional descending presence motion 180 ms; no sound.

---

## Master Journey Rhythm

```
Boot → Login → Role → Dashboard → [Offer loop] → Match → Board QR → Ride → End QR → Pay → Rate → Trust/Logout
  ↑ presence     ↑ dead UI fix      ↑ relay      ↑ pulse   ↑ remote ack      ↑ lock
```

---

## Cross-Reference

- Maps: `LSX_HEATMAP.md`, `LSX_SILENCE_REPORT.md`, `LSX_REMOTE_CONFIRMATION.md`  
- Tokens: `LSX_EVENT_MATRIX.md`, `LSX_MOTION_LANGUAGE.md`, `LSX_HAPTIC_LANGUAGE.md`  
- Principles: `LSX_CONSTITUTION.md`
