# B4 — Haptic Event Matrix

**Sprint:** B4 Analysis  
**Spec source:** `HAPTIC_DNA.md`, `LSX_HAPTIC_LANGUAGE.md`  
**Production API:** `frontend/utils/touchHaptics.ts`, direct `expo-haptics` in components

---

## Central registry (today)

| Export | Pattern | iOS | Android fallback | Usage breadth |
|--------|---------|-----|------------------|---------------|
| `keyCharHaptic` | P1 selection | selectionAsync | vibrate 10ms API35+ | OTP/PIN/register forms |
| `tapButtonHaptic` | P2 confirm-lite | impact Medium→Light | vibrate 22ms API35+ | LiveMap, modals, auth CTAs |
| `roleScreenHaptic` | alias tap | same | same | Role select only |

**Missing:** Semantic registry (`haptic.success`, `haptic.lock`, `haptic.warning`, `haptic.error`, `haptic.double`, `haptic.remote`).

---

## Event matrix

| LSX event | v4 token | Pattern | Production | File(s) | Wired |
|-----------|----------|---------|------------|---------|-------|
| Boot | T0 | — | — | — | ✅ intentional |
| UI tap / CTA | `haptic.selection` | P1 | tapButtonHaptic | widespread | ⚠️ partial |
| Role continue | P1 | tapButtonHaptic + roleScreenHaptic | index role flow | ✅ |
| OTP/PIN key | P1 | keyCharHaptic | index auth | ✅ |
| Theme choice | P1 | selectionAsync | ThemeChoiceScreen | ✅ |
| Theme settings | P1 | selectionAsync | ThemeSettingsSegment | ✅ |
| Driver offer classic | `haptic.medium` | P2 | — | — | ❌ |
| Driver offer urgent | `haptic.double` | P3 | — | — | ❌ |
| Quick match invite | `haptic.medium` | P2 | — | — | ❌ |
| Match success | `haptic.success` | P6 +16ms | — | — | ❌ |
| QR scan decode | `haptic.light` | P1 | — | scanner | ❌ |
| QR verify lock | `haptic.lock` | P4 | — | — | ❌ |
| QR remote ack | `haptic.remote` | P5 | — | — | ❌ |
| QR error | `haptic.warning` | T5 | — | — | ❌ |
| Payment confirmed | `haptic.success` | P6 +24ms | — | index payment | ❌ |
| Feedback error | `haptic.error` | T6 | — | — | ❌ |
| Trust accept | `haptic.success` | P6 | — | — | ❌ |
| QR trip-end complete | ad-hoc | raw Vibration pattern | QRTripEndModal | ⚠️ not LSX |
| Muhabbet QR scan | ad-hoc | `[0,70,55,90]` | MuhabbetTripQrScanModal | ⚠️ |
| Trust/video call | looping | `[0,650,300,650]` repeat | CallScreenV2 | ⚠️ separate domain |
| Chat bubble | vibrate 200ms | ChatBubble | ⚠️ |
| CreateListing success | notification Success | CreateListingModal | out of B4 scope |

---

## Platform notes

### Android 15+ (API 35+)

`touchHaptics.ts` bypasses expo-haptics → `Vibration.vibrate(ms)` for reliability.

**B4-3:** Extend fallback table for P4–P6 patterns (multi-pulse).

### iOS silent mode

Haptics **not** blocked by mute switch — Tier A confirm must use haptic when sonic disabled.

---

## Spam / dedupe rules (target)

| Event | Min interval | Coalesce |
|-------|--------------|----------|
| tapButtonHaptic | none (per tap) | — |
| haptic.success | 800 ms | same eventId |
| haptic.lock | 400 ms | per scan session |
| haptic.error | 1200 ms | match feedback.error sonic |
| haptic.double (urgent offer) | 1000 ms | per tagId |

---

## Trust call interference

| Source | Pattern | B4 rule |
|--------|---------|---------|
| Incoming trust call | Loop vibration | **Suspend LSX haptics** while call active |
| QR scan during call | — | Light only; no lock pattern |
| Offer during call | — | Defer or medium only |

---

## Theme relation

Haptic intensity **independent** of B3 light/dark. No token branching on theme.

---

## B4-3 deliverable shape

```typescript
// Target API (design only)
export type LsxHapticToken =
  | 'haptic.selection' | 'haptic.medium' | 'haptic.double'
  | 'haptic.lock' | 'haptic.remote'
  | 'haptic.success' | 'haptic.warning' | 'haptic.error';

export async function fireHaptic(token: LsxHapticToken, opts?: { eventId?: string }): Promise<void>;
```

Implementation maps token → iOS API + Android fallback per `HAPTIC_DNA.md` §4.

---

**Parent:** `B4_LSX_BINDING_MATRIX.md`, `B4_RISK_REGISTER.md`
