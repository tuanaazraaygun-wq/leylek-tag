# Area 6 — iOS AppIcon Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

iOS icon **premium kuş ailesi (A)** kullanıyor — Android'e göre doğru canonical yönde. Risk: squircle clip, 1024 gereksinimi, EAS prebuild cache ve App Store icon tutarlılığı.

---

## Mevcut durum

### app.json icon

```json
"icon": "./assets/images/leylek-logo-premium.png",
"ios": {
  "icon": "./assets/ios.premium.logo.png",
  ...
}
```

| Key | Asset | Not |
|-----|-------|-----|
| `expo.icon` | `leylek-logo-premium.png` | Fallback / genel |
| `expo.ios.icon` | `ios.premium.logo.png` | iOS-specific override ✅ |

**iOS override var:** Evet — `ios.premium.logo.png` ayrı dosya (muhtemelen 1024 optimize).

### EAS build davranışı

- EAS `eas.json` profilleri `frontend/` kökünden build alır.
- `expo prebuild` iOS `Images.xcassets/AppIcon.appiconset` üretir.
- Icon kaynağı: `app.json` → `ios.icon` öncelikli.
- **Risk:** Build cache eski AppIcon; `buildNumber` artışı icon değişikliğini garanti etmez.

### 1024 icon gereksinimi

| Gereksinim | Mevcut | Durum |
|------------|--------|-------|
| App Store Connect 1024×1024 | `ios.premium.logo.png` | ✅ Dosya mevcut |
| Alpha channel | Apple yasak (2024+) | ⚠️ Doğrulanmalı P7 |
| Squircle safe | İnce bacak/arc | ⚠️ P1 risk |
| Marketing icon = device icon | Aynı aile | ✅ vs Android ❌ |

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `frontend/assets/ios.premium.logo.png` | iOS 1024 master |
| `frontend/assets/images/leylek-logo-premium.png` | Expo default / splash |
| `frontend/app.json` | Icon config |
| `frontend/eas.json` | Build profiles (varsa) |

---

## iOS özel override

- `expo.ios.icon` → `ios.premium.logo.png` — **korunmalı** (ayrı optimize path).
- P8'de evolution export doğrudan bu dosyaya map edilir.
- `supportsTablet: true` — iPad icon aynı set'ten scale.

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| IOS-01 | iOS (A) ≠ Android (B) | P0 (platform) |
| IOS-02 | Squircle ince detay clip | P1 |
| IOS-03 | 29 px settings icon test yok | P1 |
| IOS-04 | Alpha channel App Store compliance | P1 |
| IOS-05 | `expo.icon` vs `ios.icon` duplicate maintenance | P2 |
| IOS-06 | Dark/light alternate icon yok | P3 |

---

## App Store icon riski

| Risk | Etki |
|------|------|
| Icon rejection (alpha) | Submit blocker |
| Icon ≠ in-app splash | Kullanıcı güven kaybı |
| Screenshot eski icon | Store vitrin tutarsızlığı |
| TestFlight vs Production icon farkı | QA karışıklığı |

**Mitigasyon:** P8 sonrası App Store screenshot refresh planı (`website/public/store/*.png` vitrin ayrı).

---

## Marka riski

- iOS doğru aile — evrimde **aşırı değişiklik** rebrand algısı yaratır.
- Squircle clip → leylek bacak kaybı → siluet zayıflar.

---

## Teknik risk

- EAS credentials + native project regenerate.
- Xcode AppIcon.appiconset manuel edit prebuild'de kaybolur.
- iOS 18 tinted home screen — alternatif asset (gelecek).

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `frontend/assets/ios.premium.logo.png` | P8 |
| `frontend/assets/images/leylek-logo-premium.png` | P8 (expo.icon sync) |
| `frontend/ios/**/AppIcon.appiconset/*` | P8 post-prebuild |
| `frontend/app.json` | P8 (path only) |

---

## Kesinlikle dokunulmamalı (P1)

- `bundleIdentifier`: `com.leylektag.app`
- `infoPlist` permission strings
- `GoogleService-Info.plist`

---

## Önerilen üretim stratejisi

1. P5: Tier S/L 1024 export — squircle simülasyon (design-lab).
2. P7: Alpha channel strip verify.
3. P7: 29, 40, 60, 76, 83.5, 1024 ladder test.
4. P8: `ios.premium.logo.png` swap → `eas build --platform ios` → TestFlight QA.
5. Android unify sonrası yan yana cihaz fotoğrafı.

---

## Rollback planı

1. Restore `ios.premium.logo.png` from `_backup-pre-evolution/`.
2. EAS rebuild önceki `buildNumber`.
3. App Store Connect'te önceki build promote (varsa).
4. TestFlight eski build dağıtımı.

---

## QA kriterleri

| Test | Pass |
|------|------|
| 1024 no alpha | Apple guideline |
| Squircle sim 1024 | Gaga/bacak safe |
| 29 px settings | Tanınır |
| iPad 76/83.5 | OK |
| iOS vs Android photo | Aynı aile |
| Blind ≥85% | LeylekTAG |

---

## Production migration sırası

1. design-lab 1024 export + squircle QA (P5)
2. `ios.premium.logo.png` swap (P8)
3. `expo prebuild` iOS (P8)
4. TestFlight internal QA (P8)
5. App Store submit + screenshot update (post-P8)

---

**İlişkili:** `APP_ICON_SYSTEM_SPEC.md`, `ANDROID_ADAPTIVE_ANALYSIS.md`
