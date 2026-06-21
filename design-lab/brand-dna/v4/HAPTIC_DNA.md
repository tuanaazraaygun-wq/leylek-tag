# LeylekTAG Haptic DNA v4

**Version:** Brand DNA v4.0 — Tactile Layer  
**Parent:** LSX_HAPTIC_LANGUAGE, MOTION_HAPTIC_DNA_V3  
**Scope:** Analysis & specification only

---

## 1. Haptic Felsefe

Her titreşim aynı olmamalı. LeylekTAG haptic dili **tier sistemi** ile olay anlamını vücuda taşır — gözün gördüğünü onaylar.

| İlke | V4 tanım |
|------|----------|
| Confirm body | Tier A'da görsel commit olmadan haptic alone yetmez |
| Semantic | Her olay = distinct pattern |
| Family | Tüm tokenlar aynı intensity scale |
| Silent mode ally | Ses kapalı — haptic Tier A devam |
| Boot exception | T4 — boot'ta haptic yok |

---

## 2. Tier Sistemi

### 2.1 Intensity tiers

| Tier | Ad | iOS | Android | Hissi | Kullanım |
|------|-----|-----|---------|-------|----------|
| **T0** | None | — | — | — | Boot, background, Tier D |
| **T1** | Light | Light impact | Light | Micro tap | Scan, AI open, journey start |
| **T2** | Medium | Medium impact | Medium | Confirm | Offer classic, QM, remote |
| **T3** | Strong | Rigid / Heavy (rare) | Medium+ | Lock | QR lock, payment lock |
| **T4** | Success | NotificationSuccess | Success | Resolve | Match, payment, trust |
| **T5** | Warning | NotificationWarning | Warning | Caution | QR error |
| **T6** | Error | NotificationError | Error | Fail | Feedback error |

### 2.2 Pattern tiers (composite)

| Pattern | Ad | Composition | Kullanım |
|---------|-----|-------------|----------|
| **P1** | Selection | T1 once | UI tap, role select |
| **P2** | Confirm | T2 once | Offer classic |
| **P3** | Double | T2 + 80 ms + T1 | Offer urgent |
| **P4** | Lock | T3 + 30 ms + T1 | QR verify, payment |
| **P5** | Remote | T2 + 50 ms vibrate fallback | QR remote ack |
| **P6** | Success delayed | T4 @ +16–24 ms | Match, payment, trust |

---

## 3. Event Token Registry

| Event | Token | Pattern | Delay | Tier |
|-------|-------|---------|-------|------|
| **Boot** | — | T0 | — | T4 Presence |
| **Button / CTA** | `haptic.selection` | P1 | 0 ms | B |
| **Offer classic** | `haptic.medium` | P2 | 0 ms | A |
| **Offer urgent** | `haptic.double` | P3 | 0 ms | A |
| **Quick Match** | `haptic.medium` | P2 | 0 ms | A |
| **Match success** | `haptic.success` | P6 | +16 ms | A |
| **QR scan decode** | `haptic.light` | P1 | 0 ms | B |
| **QR verified (local)** | `haptic.lock` | P4 | +8 ms | A |
| **QR remote ack** | `haptic.remote` | P5 | 0 ms | A |
| **Journey start** | `haptic.light` | P1 | +16 ms | A |
| **Journey end** | `haptic.light` | P1 | 0 ms | B |
| **Payment confirmed** | `haptic.success` | P6 | +24 ms | A |
| **Trust added** | `haptic.success` | P6 | +16 ms | B |
| **AI open** | `haptic.light` | P1 | 0 ms | B |
| **AI response** | — | T0 | — | C |
| **QR error** | `haptic.warning` | T5 | 0 ms | B |
| **Feedback error** | `haptic.error` | T6 | 0 ms | B |
| **Driver online** | `haptic.light` | P1 | 0 ms | B |
| **Watch complication tap** | `haptic.selection` | P1 | 0 ms | B |
| **Watch offer** | `haptic.double` | P3 | 0 ms | A |
| **Widget tap** | `haptic.selection` | P1 | 0 ms | B |
| **Logout confirm** | `haptic.light` | P1 | 0 ms | B |

---

## 4. Platform Mapping

### 4.1 iOS

| Token | API |
|-------|-----|
| T1 | `impactAsync(Light)` |
| T2 | `impactAsync(Medium)` |
| T3 | `impactAsync(Rigid)` |
| T4 | `notificationAsync(Success)` |
| T5 | `notificationAsync(Warning)` |
| T6 | `notificationAsync(Error)` |
| P1 | `selectionAsync()` |

### 4.2 Android

| Token | API |
|-------|-----|
| T1–T3 | `performAndroidHapticsAsync` Light/Medium |
| T4–T6 | Success/Warning/Error notification |
| Fallback | `Vibration.vibrate(50)` pattern when API weak |
| P5 Remote | Medium + 50 ms vibrate |

### 4.3 Apple Watch

| Kural | Spec |
|-------|------|
| Primary feedback | Haptic > sound |
| Offer | P3 double — strong perceptible |
| QR lock | P4 lock |
| Default | P1 selection |
| **No** | Long vibration patterns |

---

## 5. Timing with Motion & Sound

| Pattern | Haptic | Motion | Sound |
|---------|--------|--------|-------|
| T1 Triad | 0 ms | 0 ms (lead) | +8 ms |
| T2 Micro | 0 ms | +4 ms | +12 ms |
| T3 Remote | +16 ms | 0 ms | +24 ms |
| T4 Presence | — | 0 ms | +40 ms |
| T5 Caution | 0 ms | +40 ms | +20 ms |

---

## 6. Fatigue Policy

| Event | Max rate | Notes |
|-------|----------|-------|
| Offer / QM | 1 s / 2 s cooldown | Same as sonic |
| UI tap | 70 ms anti-double | Align UI_TAP_ANTI_DOUBLE |
| QR error | 500 ms | |
| Match | 2800 ms debounce | |
| Watch offer | Same as phone cooldown | |

---

## 7. Semantic Differentiation Matrix

| Olay çifti | Haptic fark |
|------------|-------------|
| Offer vs QM | Aynı P2 — timbre/ses ayrışır |
| Offer classic vs urgent | P2 vs P3 |
| QR lock vs payment | Aynı P4 — visual context ayrışır |
| QR error vs feedback error | T5 vs T6 |
| Match vs payment | P6 delay +16 vs +24 ms |
| Tap vs lock | P1 vs P4 |

---

## 8. Accessibility

| Durum | Davranış |
|-------|----------|
| Reduce Motion ON | Haptic devam; motion azalt |
| System haptic off | Visual + sound compensate Tier A |
| Watch silent | Haptic primary |

---

## 9. Anti-Patterns

- Same vibration for all events
- Heavy haptic on boot
- Haptic without visual on Tier A
- Long vibration (>200 ms continuous)
- Haptic on scroll/list drag
- Double haptic on every tap

---

## 10. Cross-Reference

- Motion: `MOTION_DNA.md`  
- Sonic: `SONIC_DNA.md` § haptic pairing  
- Watch: `WATCH_DNA.md`  
- Constitution: `BRAND_CONSTITUTION_V4.md` § Tier

**Non-goals:** `touchHaptics.ts` değiştirilmedi; orchestrator spec only.
