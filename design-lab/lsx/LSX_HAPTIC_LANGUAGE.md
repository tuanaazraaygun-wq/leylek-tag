# LSX Haptic Language

**Version:** LSX v1.0  
**Scope:** Haptic constitution — analysis only

---

## 1. Principles

1. **Haptic confirms body what eyes see** — never alone on Tier A without visual commit  
2. **Double tap only for urgent offer variant** — not for errors  
3. **Android API 35+ fallback:** `Vibration` short pulse when expo-haptics weak (existing pattern in `touchHaptics.ts`)  
4. **No haptic on boot** — silent mode / public spaces  
5. **Remote ack always has haptic** on receiving device — even if sound muted  

---

## 2. Haptic Token Registry

| Token | iOS | Android primary | Duration feel | Intensity |
|-------|-----|-----------------|---------------|-----------|
| `lsx.haptic.selection` | `selectionAsync` | Light impact | Micro | Low |
| `lsx.haptic.light` | Light impact | Light | Tap | Low |
| `lsx.haptic.medium` | Medium impact | Medium | Confirm | Mid |
| `lsx.haptic.heavy` | Heavy (rare) | Medium→Heavy fallback | Never for offer | High — avoid |
| `lsx.haptic.success` | NotificationSuccess | Success notification | Resolve | Mid |
| `lsx.haptic.warning` | NotificationWarning | Warning | Caution | Mid |
| `lsx.haptic.error` | NotificationError | Error | Fail | Mid |
| `lsx.haptic.double` | Medium + 80 ms + Light | Two Light 80 ms apart | Urgent offer | Mid |
| `lsx.haptic.lock` | Rigid or Medium | Medium + 30 ms Light | QR/payment lock | Mid-high |
| `lsx.haptic.remote` | Medium | Medium + vibrate 50 ms fallback | Remote ack | Mid |

---

## 3. Event → Haptic Map

| Event | Token | Delay from event | Notes |
|-------|-------|------------------|-------|
| App boot | — | — | No haptic |
| Role / vehicle select | `selection` | 0 ms | On release |
| Primary CTA | `light` | 0 ms | With motion press |
| Driver offer classic | `medium` | 0 ms | With sound +0 ms |
| Driver offer urgent | `double` | 0 ms | Second tap +80 ms |
| Quick Match ops | `medium` | 0 ms | Distinct from offer |
| Match success | `success` | +16 ms after motion start | Not at socket before UI |
| QR scan decode (local) | `light` | 0 ms | Scanner role |
| QR verify lock | `lock` | +8 ms | Both roles |
| QR remote ack (driver) | `remote` | 0 ms on socket | **Missing today** |
| Payment confirmed | `success` | +24 ms | Lower priority vs match same session |
| Feedback error | `error` | 0 ms | |
| QR error | `warning` | 0 ms | Softer than feedback error |
| Trust accept | `success` | +16 ms | |
| Logout | — | — | Optional `light` on confirm button only |

---

## 4. Fatigue Policy

| Event | Max rate |
|-------|----------|
| Offer / QM | Existing cooldown (1 s / 2 s) + haptic obeys same gate |
| UI tap | 70 ms anti-double (align with `UI_TAP_ANTI_DOUBLE_FIRE_MS`) |
| QR error | 500 ms cooldown |
| Match | 2800 ms debounce |

---

## 5. Current Production Gap

LSDS constitution lists haptic pairings; **`utils/sound.ts` does not invoke haptics** on offer, match, QR, payment. Haptics are scattered (`tapButtonHaptic`, `Vibration.vibrate` in QR modals only).

LSX v1 target: **single haptic entry** called from triad orchestrator (future).

---

## 6. Timing with Sound & Motion

See `LSX_CONSTITUTION.md` §6 and `LSX_EVENT_MATRIX.md`.

**Default:** Haptic at frame 0, sound transient frame 1–2, motion already running frame 0.
