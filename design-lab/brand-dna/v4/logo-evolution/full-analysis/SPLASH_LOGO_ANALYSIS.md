# Area 8 — Splash Logo Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

Splash **çift kimlik** üretiyor: native Android flash pin (B), JS splash kuş (A). Kullanıcı ilk ~200 ms farklı marka görür. Motion zengin JS splash ile native minimal flash uyumsuz.

---

## Mevcut durum — katman haritası

```
App launch
    │
    ├─► Native splash (Expo / Android res)
    │       app.json: leylek-logo-premium.png (A) — config
    │       Android drawable: splashscreen_logo.png (B pin) — ACTUAL
    │
    ├─► ExpoSplashScreen.hideAsync() — _layout.tsx
    │
    └─► JS SplashScreen.tsx (~2.5s)
            leylek-logo-premium.png (A)
            breathe / ring / halo motion
            → Login
```

---

## Kullanılan mevcut dosyalar

| Dosya | Katman | Aile |
|-------|--------|------|
| `frontend/app.json` splash.image | Native config | A (config) |
| `frontend/assets/images/leylek-logo-premium.png` | JS + config | A |
| `frontend/android/.../drawable-*dpi/splashscreen_logo.png` | Native Android | B |
| `frontend/android/.../drawable/ic_launcher_background.xml` | Splash composite | B ref |
| `frontend/components/SplashScreen.tsx` | JS splash | A |
| `frontend/app/_layout.tsx` | hideAsync timing | — |

### Zemin renkleri

| Katman | Renk |
|--------|------|
| app.json splash.backgroundColor | `#08111F` |
| SplashScreen.tsx gradient | `#08111F` → `#0B1220` |
| Genom hedef | `#0D1117` unify (P3) |

---

## Native splash

- **iOS:** Expo splash plugin — `leylek-logo-premium.png` (config ile uyumlu olmalı).
- **Android:** `splashscreen_logo.png` ×5 DPI — **pin türevi (B)** — config ile **uyumsuz**.

---

## JS splash

`SplashScreen.tsx`:
- Logo box: `SHORT_EDGE * 0.34`, max 168 px.
- Asset: `leylek-logo-premium.png`.
- Motion: scale 0.8→1, ringBreath, ambientGlow, halo, shimmer.
- Süre: ~2.5s → `onFinish()` login.
- **Dokunulmaz:** timing/onFinish (user rule — splash timing).

---

## Android splashscreen_logo

| DPI | Path |
|-----|------|
| mdpi | `drawable-mdpi/splashscreen_logo.png` |
| hdpi | `drawable-hdpi/splashscreen_logo.png` |
| xhdpi | `drawable-xhdpi/splashscreen_logo.png` |
| xxhdpi | `drawable-xxhdpi/splashscreen_logo.png` |
| xxxhdpi | `drawable-xxxhdpi/splashscreen_logo.png` |

**Sorun:** Prebuild/manuel pin asset — premium PNG ile senkron değil.

---

## iOS splash

- `app.json` splash → premium PNG.
- Native storyboard splash (prebuild) — asset hash P7 verify.
- JS splash üstüne bindirir — native flash kısa.

---

## Login sonrası splash

- JS splash biter → `LoginScreen` → `LoginBrandHeader` premium PNG.
- **Tutarlı aile (A)** login'de ✅.
- Driver KYC: text-only header — logo yok (OK).

---

## Motion splash

| Öğe | Token hedefi | Mevcut |
|-----|--------------|--------|
| Breathe | `lsx.motion.presence.pulse` ≤550ms | ringBreath + scale |
| Glow max | 0.25 | ambientGlow animasyonlu |
| Lock ring | `lsx.motion.lock.ringClose` | ringBreath (yakın) |

**P6:** Motion spec sync — logo geometry dasharray-ready olmalı.

---

## Dark / light splash

- `userInterfaceStyle: automatic` — splash her zaman dark navy.
- Light splash planı yok — dark-only OK (brand).
- Evolution: zemin `#08111F` → `#0D1117` subtle unify.

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| SPL-01 | Android native (B) ≠ JS (A) | P0 |
| SPL-02 | app.json vs res/ stale | P1 |
| SPL-03 | Zemin token drift | P2 |
| SPL-04 | Native flash motion yok; JS çok zengin | P2 (algı) |
| SPL-05 | L-tier PNG küçük native box'ta scale blur | P2 |

---

## Marka riski

- İlk izlenim çift kimlik — premium algı zayıflar.
- Pin flash → "harita uygulaması" yanlış kategorizasyon.

---

## Teknik risk

- `expo prebuild --clean` splash drawable regenerate.
- `SplashScreen.tsx` timing değiştirmeden asset-only swap (P8 kuralı).
- Edge-to-edge Android 15 splash inset.

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `frontend/android/.../splashscreen_logo.png` ×5 | P8 |
| `frontend/assets/images/leylek-logo-premium.png` | P8 (L-tier) |
| `frontend/app.json` splash.backgroundColor | P8 |
| `frontend/components/SplashScreen.tsx` | **Yalnızca asset path** (P8); motion P6 ayrı |

---

## Kesinlikle dokunulmamalı (P1 / P8 kısıt)

- `SplashScreen.tsx` `onFinish` timing akışı
- Splash süresi (~2.5s) business logic
- `_layout.tsx` hideAsync sırası

---

## Önerilen üretim stratejisi

1. P5: L-tier splash symbol export — 16:9 + 1:1 (design-lab).
2. P8: `splashscreen_logo.png` ladder swap — **pin retire**.
3. P8: prebuild + hash verify.
4. P6: ringBreath ↔ LSX token doc (logic değil spec).
5. Zemin color unify `colors.xml` + app.json.

---

## Rollback planı

1. Restore `splashscreen_logo.png` ×5 + `leylek-logo-premium.png`.
2. Revert `app.json` splash colors.
3. APK önceki versionCode.

---

## QA kriterleri

| Test | Pass |
|------|------|
| Android cold start frame 0 | Kuş ailesi (A) |
| iOS cold start | A |
| JS handoff | Flicker yok |
| 320px short edge | Logo box okunur |
| Dark zemin | Tutarlı |
| Screen record | Native→JS geçiş smooth |

---

## Production migration sırası

1. L-tier splash export QA (P5)
2. `splashscreen_logo.png` Android (P8)
3. `leylek-logo-premium.png` sync (P8)
4. `app.json` + `colors.xml` zemin (P8)
5. iOS native splash verify post-prebuild (P8)
6. Motion token doc (P6 — no prod logic P8)

---

**İlişkili:** `ANDROID_ADAPTIVE_ANALYSIS.md`, `design-lab/lsx/LSX_MOTION_LANGUAGE.md`
