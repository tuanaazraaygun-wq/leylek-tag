# Area 5 — Android Adaptive Icon Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

Android adaptive icon **wireframe arc ailesi (B)** kullanıyor; iOS **premium kuş (A)**. Native `res/` mipmaps ve splash, `app.json` adaptive config ile senkron riski taşıyor. Prebuild sonrası manuel overwrite kaybolabilir.

---

## Mevcut durum

### app.json bağlantısı

```json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon-foreground.png",
    "backgroundColor": "#08111F"
  }
}
```

### Adaptive foreground / background

| Öğe | Kaynak | Değer |
|-----|--------|-------|
| Foreground (Expo) | `adaptive-icon-foreground.png` | Wireframe arc + dot (B) |
| Background (Expo) | `backgroundColor` | `#08111F` |
| Native FG | `mipmap-*/ic_launcher_foreground.png` | Prebuild türevi |
| Native BG | `@color/iconBackground` | `colors.xml` |
| Adaptive XML | `mipmap-anydpi-v26/ic_launcher.xml` | BG color + FG mipmap |

### splashscreen_logo

| DPI | Path |
|-----|------|
| mdpi–xxxhdpi | `drawable-*dpi/splashscreen_logo.png` (×5) |

**Kritik:** Native splash **pin ailesi** — JS splash (`leylek-logo-premium.png`) ile **farklı aile (P0)**.

`ic_launcher_background.xml` splash bitmap'i de referanslar:

```xml
<bitmap android:gravity="center" android:src="@drawable/splashscreen_logo"/>
```

---

## Mevcut mipmap dosyaları

| Dosya | DPI | Rol |
|-------|-----|-----|
| `mipmap-mdpi/ic_launcher.png` | 48 | Legacy launcher |
| `mipmap-hdpi/ic_launcher.png` | 72 | Legacy |
| `mipmap-xhdpi/ic_launcher.png` | 96 | Legacy |
| `mipmap-xxhdpi/ic_launcher.png` | 144 | Legacy |
| `mipmap-xxxhdpi/ic_launcher.png` | 192 | Legacy |
| `mipmap-*/ic_launcher_round.png` | * | Round legacy |
| `mipmap-*/ic_launcher_foreground.png` | * | Adaptive FG |
| `mipmap-anydpi-v26/ic_launcher.xml` | — | Adaptive manifest |
| `mipmap-anydpi-v26/ic_launcher_round.xml` | — | Round adaptive |

---

## Kullanılan mevcut dosyalar

| Dosya |
|-------|
| `frontend/app.json` |
| `frontend/assets/images/adaptive-icon-foreground.png` |
| `frontend/assets/images/adaptive-icon.png` (orphan) |
| `frontend/android/app/src/main/res/mipmap-*/*` |
| `frontend/android/app/src/main/res/drawable-*dpi/splashscreen_logo.png` |
| `frontend/android/app/src/main/res/drawable/ic_launcher_background.xml` |
| `frontend/android/app/src/main/res/values/colors.xml` |

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| AND-01 | Adaptive FG (B) ≠ iOS icon (A) | P0 |
| AND-02 | Native splash (B) ≠ JS splash (A) | P0 |
| AND-03 | prebuild `res/` stale kalabilir | P1 |
| AND-04 | Manuel mipmap overwrite prebuild'de kaybolur | P1 |
| AND-05 | `adaptive-icon.png` orphan | P3 |
| AND-06 | Themed icon (Android 13+) mono export yok | P2 |
| AND-07 | Zemin `#08111F` vs genom `#0D1117` drift | P2 |

---

## Marka riski

- İlk 200 ms pin, sonra kuş — çift kimlik, düşük güven.
- Farklı launcher icon → kullanıcı iOS arkadaşının telefonuyla karşılaştırır.

---

## Teknik risk

| Risk | Detay |
|------|-------|
| Prebuild overwrite | `npx expo prebuild --clean` tüm `res/` yeniler |
| DPI ladder sync | 5 splash + 5×3 mipmap = 20+ dosya |
| CI/EAS | Cached native dir eski asset |
| Edge-to-edge | `edgeToEdgeEnabled: true` — splash inset |

---

## Prebuild riski

1. Developer `app.json` adaptive path günceller ama prebuild çalıştırmaz → `res/` eski kalır.
2. Developer `res/` manuel düzeltir → sonraki prebuild siler.
3. **Çözüm (P8):** Tek kaynak `assets/` + prebuild checklist + post-prebuild hash verify.

---

## Manuel overwrite riski

- `splashscreen_logo.png` ×5 manuel pin — `app.json` splash premium PNG ile uyumsuz.
- Dokümantasyon: prebuild sonrası **zorunlu** asset hash karşılaştırması.

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `frontend/assets/images/adaptive-icon-foreground.png` | P8 |
| `frontend/android/.../mipmap-*/ic_launcher_foreground.png` | P8 post-prebuild |
| `frontend/android/.../drawable-*dpi/splashscreen_logo.png` | P8 |
| `frontend/android/.../values/colors.xml` | P8 (token unify) |
| `frontend/app.json` | P8 (backgroundColor) |

---

## Kesinlikle dokunulmamalı (P1)

- `AndroidManifest.xml` package name
- Gradle signing config
- Permissions listesi

---

## Önerilen üretim stratejisi

1. P5: Tier S 432-safe foreground export (design-lab).
2. P5: Tier M/L splash symbol — pin retire (design-lab).
3. P8 checklist:
   - Swap `adaptive-icon-foreground.png`
   - `npx expo prebuild --clean`
   - Verify mipmap hash == asset hash
   - Swap `splashscreen_logo.png` ×5 (veya prebuild output)
   - Cihaz test: Pixel + Samsung launcher

---

## Rollback planı

1. Git restore `frontend/android/app/src/main/res/` + `assets/images/adaptive-icon-foreground.png`.
2. Önceki APK/AAB build artifact (EAS version rollback).
3. Play Store staged rollout % → 0% (operasyonel).

---

## QA kriterleri

| Test | Pass |
|------|------|
| Launcher circle mask | S-tier okunur |
| Launcher squircle (Samsung) | Kesim yok |
| Native splash flash | Kuş ailesi (A) |
| JS splash handoff | Aynı aile, zemin match |
| 48 dp legacy icon | Net |
| Prebuild hash | assets == mipmap |

---

## Production migration sırası

1. `adaptive-icon-foreground.png` (P8-1)
2. `expo prebuild --clean` (P8-2)
3. `splashscreen_logo.png` ladder (P8-3)
4. `colors.xml` token (P8-4)
5. Themed mono icon (P8-5, opsiyonel)

---

**İlişkili:** `APP_ICON_SYSTEM_SPEC.md`, `SPLASH_LOGO_ANALYSIS.md`
