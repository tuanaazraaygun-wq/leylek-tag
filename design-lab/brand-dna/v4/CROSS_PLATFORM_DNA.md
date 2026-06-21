# LeylekTAG Cross-Platform DNA v4

**Version:** Brand DNA v4.0 — Platform Unity Layer  
**Scope:** Analysis & specification only

---

## 1. Cross-Platform Felsefe

iOS, Android, Apple Watch, Web, Desktop, Widget, Notification, CarPlay ve Android Auto **aynı marka dilini** konuşmalı — farklı platform, aynı DNA.

```
                    BRAND DNA v4 CORE
                           │
    ┌──────────┬───────────┼───────────┬──────────┬──────────┐
    ▼          ▼           ▼           ▼          ▼          ▼
   iOS      Android      Watch        Web      Widget    Notification
    │          │           │           │          │          │
    └──────────┴───────────┴───── CarPlay / Auto ──────────┘
                           │
                    Same: Color · Motion · Token · Metafor
                    Adapt: Density · Input · Primary channel
```

---

## 2. Platform Matrix

| Platform | Primary channel | Secondary | Density | Logo variant |
|----------|-----------------|-----------|---------|--------------|
| **iOS** | Motion + Haptic + Sound | Glow | Full | Symbol + adaptive |
| **Android** | Motion + Haptic + Sound | Glow | Full | Adaptive icon |
| **Apple Watch** | Haptic | Complication text | Minimal | Symbol mono |
| **Web** | Motion | Optional sound | Responsive | Symbol + wordmark |
| **Desktop** (future) | Motion | Sound optional | Expanded | Full primary |
| **Widget iOS** | Static + timeline | Tap → app | Glance | Symbol 24 px |
| **Widget Android** | Material You tint | Cyan accent preserve | Glance | Symbol |
| **Notification** | Sound token | Icon symbol | One line | Monochrome symbol |
| **CarPlay** | Voice + minimal UI | Haptic N/A | Driver only | Symbol |
| **Android Auto** | Voice + minimal UI | Same as CarPlay | Driver only | Symbol |

---

## 3. Shared Constants (all platforms)

| Constant | Value | Değişmez |
|----------|-------|----------|
| Meridian Cyan | `#00D4AA` | Evet |
| Depth Slate | `#1A2332` | Evet |
| Trust White | `#F5F7FA` | Evet |
| A3 anchor | 220 Hz | Evet |
| Metafor set | 6 core | Evet |
| Tier A events | Same list | Evet |
| Motion easing | Same bezier | Evet |
| Boot sequence | 550 ms narrative | Evet |

---

## 4. Platform Adaptations

### 4.1 iOS

| Özellik | Spec |
|---------|------|
| Haptic | Full UIKit/expo-haptics registry |
| Sound | AVAudioSession; silent mode respect with haptic fallback |
| Icon | SF Symbol style consistency where system |
| Widget | WidgetKit — journey status |
| Live Activity | Journey ETA + lock state (future) |
| Dynamic Island | Offer ingress mini (future) |

### 4.2 Android

| Özellik | Spec |
|---------|------|
| Haptic | performAndroidHapticsAsync + fallback |
| Sound | Same WAV tokens |
| Icon | Adaptive — safe zone |
| Widget | Glanceable — cyan preserved in Material You |
| Notification channels | Per token type — not one channel |

### 4.3 Apple Watch

Detay: `WATCH_DNA.md`. Haptic-first; sound default off.

### 4.4 Web

Detay: `WEBSITE_DNA.md`. No haptic; motion + optional sound.

### 4.5 Widget

| Size | iOS | Android |
|------|-----|---------|
| Small | ETA or offer badge | Same |
| Medium | Map snapshot + status | Same |
| Large | Journey progress | Same |
| Tap | ui.tap + deep link | Same |
| Refresh | Timeline / WorkManager | No brand boot sound |

### 4.6 Notification

| Tür | Icon | Sound | Motion |
|-----|------|-------|--------|
| Offer | Symbol mono | offer.classic excerpt | N/A |
| Match | Symbol | match excerpt | N/A |
| QR remote | Symbol + lock | remoteAck | N/A |
| Generic marketing | **Separate** — not Tier A token | — | — |

**Kural:** Operational push = brand token; marketing push = separate policy.

### 4.7 CarPlay / Android Auto

| Özellik | Spec |
|---------|------|
| UI | Minimal — ETA, offer accept voice |
| Brand | Symbol in car screen corner |
| Sound | offer + QR tokens — cabin tested |
| Motion | Native car UI — LSX overlay minimal |
| **Scope** | Driver only V4 |

---

## 5. Event → Platform Triad Matrix

| Event | iOS | Android | Watch | Web | Widget | Push |
|-------|-----|---------|-------|-----|--------|------|
| Boot | M+S | M+S | — | M | — | — |
| Offer | M+H+S | M+H+S | H (+S opt) | M | Badge | S |
| Match | M+H+S | M+H+S | H | M | Update | S |
| QR lock | M+H+S | M+H+S | H | M | — | S |
| QR remote | M+H+S | M+H+S | H | — | — | S |
| Waiting | M | M | dot | M | static | — |

M=Motion H=Haptic S=Sound

---

## 6. Latency Budget (all platforms)

| Metrik | Hedef |
|--------|-------|
| Tap → sensory | ≤32 ms |
| Push → notification sound | ≤500 ms |
| Socket → watch haptic | ≤200 ms |
| Boot → presence | ≤250 ms |
| Widget timeline refresh | ≤60 s journey; immediate offer |

---

## 7. Silent / DND / Focus Modes

| Mode | Sound | Haptic | Motion |
|------|-------|--------|--------|
| Silent | Off | Tier A on | On |
| DND | Off | Watch offer only if critical |
| Reduce Motion | On | On | Minimal / off |
| CarPlay driving | On (cabin) | N/A | Native |

---

## 8. Localization (brand)

| Kural | Spec |
|-------|------|
| Sound | Locale-independent — same WAV |
| Motion | Same ms all locales |
| RTL | Mirror ingress direction; glow same |
| Copy | Separate i18n — not DNA doc scope |

---

## 9. Version Sync

| Layer | Version tag |
|-------|-------------|
| Brand DNA | v4.0 |
| Sonic tokens | LSDS v2 → v3 promote |
| Motion tokens | v4.motion.* |
| LSX orchestrator | LSX v1 → v2 (future) |

Platform teams implement **same version** — no iOS on v3 Android on v2.

---

## 10. QA Checklist (cross-platform)

- [ ] Same cyan hex all surfaces
- [ ] Same boot timing narrative
- [ ] Offer triad all mobile platforms
- [ ] QR remote watch + phone sync
- [ ] Notification sound = in-app token excerpt
- [ ] Widget cyan not Material You washed out
- [ ] Web motion bezier match
- [ ] Blind "Bu LeylekTAG" ≥80% all touchpoints

---

## 11. Anti-Patterns

- iOS-only sound design
- Android generic notification sound
- Watch full app clone
- Web different brand colors
- Widget unrelated icon
- CarPlay game UI
- Platform-specific metafor invention

---

## 12. Document Index

| Platform doc | File |
|--------------|------|
| Watch | `WATCH_DNA.md` |
| Web | `WEBSITE_DNA.md` |
| AI | `AI_DNA.md` |
| Core | `BRAND_CONSTITUTION_V4.md` |

**Non-goals:** Platform kod değişikliği yok.
