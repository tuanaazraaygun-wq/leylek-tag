# Area 4 — App Icon System Spec

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only analysis + spec  
**Date:** 2026-06-21

---

## Executive summary

iOS ve Android home screen icon'ları **farklı logo ailesi** gösteriyor (P0). Evrim hedefi: tek master'dan tier **S** export; aynı siluet, aynı accent, aynı zemin — mask/squircle davranışına göre safe zone testi.

---

## Mevcut durum

| Platform | Config | Asset | Aile | Tier uyumu |
|----------|--------|-------|------|------------|
| Expo default | `expo.icon` | `leylek-logo-premium.png` | A | L (fazla detay) |
| iOS | `expo.ios.icon` | `ios.premium.logo.png` | A | L |
| Android adaptive FG | `adaptiveIcon.foregroundImage` | `adaptive-icon-foreground.png` | B wireframe | M0/M1 |
| Android adaptive BG | `backgroundColor` | `#08111F` | — | OK |
| Expo web | `web.favicon` | `favicon.png` | B | M0 |
| Notification | `expo-notifications.icon` | `leylek-logo-premium.png` | A | L (mono risk) |

**Kritik:** iOS kuş ≠ Android arc — kullanıcı "farklı uygulama" algısı.

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/app.json` | Icon manifest |
| `frontend/assets/images/leylek-logo-premium.png` | Expo + notification |
| `frontend/assets/ios.premium.logo.png` | iOS 1024 |
| `frontend/assets/images/adaptive-icon-foreground.png` | Android FG |
| `frontend/assets/images/adaptive-icon.png` | Orphan |
| `frontend/assets/images/icon.png` | Orphan |
| `frontend/assets/images/favicon.png` | Expo web |
| `frontend/android/.../mipmap-*/ic_launcher*.png` | Native launcher |
| `website/public/store/leylektag-icon.png` | Web store icon |

---

## Tek master'dan üretim

```
leylek-symbol-master-v1.svg (P2)
        │
        ├── tier S @ 1024 → ios.premium.logo.png
        ├── tier S @ 432 safe → adaptive-icon-foreground.png
        ├── tier S @ 48–192 → mipmap ladder
        ├── tier M0 @ 24 → notification icon
        └── tier M0 @ 16–32 → favicon
```

**Kural:** `expo.icon`, `expo.ios.icon`, `adaptiveIcon.foregroundImage` aynı tier S ailesinden — farklı scale, farklı tier değil.

---

## Mask / squircle davranışı

| Platform | Mask | Safe zone | Test |
|----------|------|-----------|------|
| iOS | Squircle (system) | ~80% effective | 29 px settings icon |
| Android | Adaptive circle/squircle OEM | 66% center (432/512) | Pixel + Samsung launcher |
| Web PWA | Rounded square | 88% | maskable icon (gelecek) |

**Squircle risk:** Premium kuş bacak/gaga ucu kesilir — S-tier path safe zone içine çekilir.

---

## Safe area

- Android: 432×432 dp foreground, 108 dp padding her kenar @512 canvas.
- iOS: 1024 tam bleed; kritik siluet merkez %80 daire içinde.
- Wing apex hedef: y ≥ 120 @512; gaga x ≤ 400.

---

## Background

| Katman | Renk | Not |
|--------|------|-----|
| Adaptive BG | `#08111F` → unify `#0D1117` | `colors.xml` sync |
| iOS | BG icon içinde gömülü (full bleed PNG) | Zemin PNG'de |
| Notification | Transparent FG; sistem tint | M0 mono siluet |

---

## Foreground

- Tier S: sadeleşmiş kuş + arc; bacak gizli veya minimal.
- Stroke-only değil — flat fill + stroke hybrid @48+.
- Wireframe arc-only (mevcut B) **retire**.

---

## Dark / light

| Mod | Strateji |
|-----|----------|
| Dark (primary) | Void ground + Trust White form |
| Light (gelecek) | Inverse token swap; aynı S-tier path |
| `userInterfaceStyle: automatic` | iOS alternatif icon planı (P5 opsiyonel) |

---

## Store icon vs launcher vs notification

| Tür | Boyut | Tier | Dosya |
|-----|-------|------|-------|
| App Store 1024 | 1024×1024 | L veya S (squircle test) | `ios.premium.logo.png` |
| Play Store 512 | 512×512 | S/L | high-res adaptive |
| Launcher | 48–192 dpi ladder | S | mipmap |
| Settings (iOS 29) | 29×29 @3x | S | ladder |
| Notification | 24×24 dp | M0 mono | plugin icon |
| Shortcut / widget | 48+ | S | — |

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| AI-01 | iOS ≠ Android aile | P0 |
| AI-02 | expo.icon L-tier — küçük launcher scale | P1 |
| AI-03 | mipmap stale vs app.json | P1 |
| AI-04 | Orphan icon.png, adaptive-icon.png | P3 |
| AI-05 | Notification L-tier blob | P1 |

---

## Marka riski

- Platform split → güven kaybı, "sahte uygulama" şikayeti.
- Squircle clip → tanınmayan siluet → yavaş icon recognition.

---

## Teknik risk

- `expo prebuild` mipmap regenerate — manuel `res/` overwrite kaybolur.
- EAS build cache eski icon.
- Android 13 themed icon (monochrome) — M0 export gerekir.

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `frontend/assets/ios.premium.logo.png` | P8 |
| `frontend/assets/images/adaptive-icon-foreground.png` | P8 |
| `frontend/assets/images/leylek-logo-premium.png` | P8 (expo.icon) |
| `frontend/assets/images/favicon.png` | P8 |
| `frontend/android/.../mipmap-*/*` | P8 post-prebuild |
| `frontend/app.json` | P8 (path/tint only) |

---

## Kesinlikle dokunulmamalı (P1)

- `app.json` bundle id, permissions
- Native `AndroidManifest.xml` (P8 ayrı checklist)
- F1 icon export'ları

---

## Önerilen üretim stratejisi

1. P5: Tier S 1024 + 432 safe export (design-lab).
2. Squircle simülasyon script (design-lab).
3. iOS + Android yan yana mock.
4. P8: Asset swap → `npx expo prebuild --clean` → mipmap verify.
5. Notification: ayrı M0 mono export + tint `#00D4AA`.

---

## Rollback planı

1. `_backup-pre-evolution/icons/` restore.
2. `app.json` icon path eski haline.
3. `expo prebuild --clean` + eski mipmap commit.
4. App Store / Play icon revert (store metadata ayrı).

---

## QA kriterleri

| Test | Pass |
|------|------|
| iOS 1024 squircle sim | Bacak/gaga kesilmez |
| Android 432 safe | Tüm S path içinde |
| 29 px iOS settings | Tanınır |
| Launcher yan yana | iOS ≈ Android |
| Notification tray | M0 mono net |
| Blind test | ≥85% LeylekTAG |

---

## Production migration sırası

1. design-lab tier S exports + QA (P5)
2. `ios.premium.logo.png` + `adaptive-icon-foreground.png` swap (P8)
3. `expo prebuild` + mipmap sync (P8)
4. `expo-notifications` M0 icon (P8)
5. `favicon.png` M0 (P8)
6. Store listing screenshot refresh (post-P8)

---

**İlişkili:** `ANDROID_ADAPTIVE_ANALYSIS.md`, `IOS_APPICON_ANALYSIS.md`
