# Area 11 — Logo QA Plan

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** QA framework — execution P7  
**Date:** 2026-06-21  
**Parent:** `EVOLUTION_CHECKLIST.md`, `LOGO_EVOLUTION_CONSTITUTION.md` §7

---

## Executive summary

Logo migration QA sistemi **12+ yüzey**, **10 boyut bandı** ve **blind tanınırlık** testlerini kapsar. P1'de plan; P7'de tam execution; P8 öncesi zero P0 gate.

---

## QA organizasyonu

| Faz | Kapsam |
|-----|--------|
| P2–P5 | design-lab export QA |
| P7 | Full matrix execution |
| P8 | Production smoke + regression |
| P8+7d | Post-release audit |

**Araçlar:** Figma/Sketch mock, BrowserStack, fiziksel cihaz, `EVOLUTION_CHECKLIST.md` tick.

---

## Boyut testleri

### 16 px test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-16-01 | Chrome favicon tab | M0 dot+arc okunur |
| QA-16-02 | Safari pinned tab | Keskin, glow yok |
| QA-16-03 | Android notification tray | Mono siluet tanınır |
| QA-16-04 | Red team: Uber pin yan yana | Karışmama |
| QA-16-05 | Export PNG pixel inspect | 1px padding |

### 24 px test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-24-01 | Leylek Zeka widget sm | M1 horizon hint |
| QA-24-02 | Navbar @1x compact | Arc+dot |
| QA-24-03 | Windows taskbar PWA | Net |

### 32 px test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-32-01 | Navbar @2x | S-tier kuş başlar |
| QA-32-02 | iOS spotlight search | Tanınır |
| QA-32-03 | Expo web favicon | Aile A |

---

## Platform testleri

### Android launcher test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-AND-01 | Pixel circle launcher | S-tier safe |
| QA-AND-02 | Samsung squircle | Kesim yok |
| QA-AND-03 | OnePlus themed icon | Mono (varsa) |
| QA-AND-04 | Adaptive FG hash == asset | Sync |
| QA-AND-05 | Legacy 48 dp | OK |

### iOS squircle test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-IOS-01 | iPhone home 1024 downscale | Squircle sim |
| QA-IOS-02 | 29 px settings | Tanınır |
| QA-IOS-03 | iPad 76/83.5 | OK |
| QA-IOS-04 | App Store Connect preview | No alpha |
| QA-IOS-05 | vs Android photo | Aynı aile |

---

## Yüzey testleri

### Splash test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-SPL-01 | Android cold start frame 0 | Aile A |
| QA-SPL-02 | iOS cold start | Aile A |
| QA-SPL-03 | JS splash handoff | Flicker yok |
| QA-SPL-04 | Zemin color match | ΔE minimal |

### Website header test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-WEB-01 | Navbar 320/768/1280 | M1/S okunur |
| QA-WEB-02 | Footer horizontal | C lockup refine |
| QA-WEB-03 | Fallback chain | Same family |
| QA-WEB-04 | Violet glow absent | Cyan only |

### Favicon test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-FAV-01 | leylektag.com tab | M0 |
| QA-FAV-02 | PWA install icon | = app aile |
| QA-FAV-03 | apple-touch-icon | 180 OK |

---

## Özel akış testleri

### QR test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-QR-01 | QR modal — logo yok (mevcut) | OK veya P6 ring spec |
| QA-QR-02 | QR success — sonic+visual sync | ±20ms (P6) |
| QA-QR-03 | QR overlay lock ring | arc DNA |

### Map marker test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-MAP-01 | Logo S-tier @48 vs marker stroke | Token hizası |
| QA-MAP-02 | Leylek Zeka FAB harita | Google WM overlap yok |
| QA-MAP-03 | Marker pin karışmama | Logo ≠ pin form |

---

## Tema testleri

### Dark / light test

| ID | Prosedür | Pass |
|----|----------|------|
| QA-TH-01 | Dark app icon + splash | Void ground |
| QA-TH-02 | Dark web navbar | Kontrast WCAG |
| QA-TH-03 | Light export (gelecek) | Inverse readable |
| QA-TH-04 | OLED black crush | Arc görünür |

---

## Erişilebilirlik

| ID | Test | Pass |
|----|------|------|
| QA-A11Y-01 | Decorative logo `alt=""` / aria-hidden | Web |
| QA-A11Y-02 | Contrast icon vs `#08111F` | ≥3:1 decorative |
| QA-A11Y-03 | Reduce motion — splash logo static option | P6 |
| QA-A11Y-04 | Touch target logo button ≥48dp | Navbar link |

---

## Blind recognition

| ID | Prosedür | Pass |
|----|----------|------|
| QA-BL-01 | n≥20 mevcut kullanıcı, eski vs yeni yan yana | ≥85% "LeylekTAG" |
| QA-BL-02 | Tek başına yeni icon | ≥85% marka |
| QA-BL-03 | "Rebrand oldu mu?" | ≥70% "hayır, aynı" |
| QA-BL-04 | Rakip karıştırma | <10% Uber/Google |

---

## Old / new brand continuity

| ID | Test | Pass |
|----|------|------|
| QA-CO-01 | Siluet IoU overlay | ≥85% |
| QA-CO-02 | Wordmark "Leylek TAG" unchanged | ✅ |
| QA-CO-03 | Accent hue shift only | `#00D4AA` family |
| QA-CO-04 | 3-aile → 1-aile audit | Zero split |

---

## Regression checklist (P8)

| ID | Check |
|----|-------|
| QA-REG-01 | Orphan asset scan — zero dead refs |
| QA-REG-02 | backend `leylek-logo.png` exists |
| QA-REG-03 | `Logo.tsx` resolved |
| QA-REG-04 | Duplicate PNG hash frontend==website |
| QA-REG-05 | app.json paths valid |
| QA-REG-06 | prebuild mipmap hash |

---

## Sorunlar (mevcut — pre-evolution)

Tüm `PRODUCTION_LOGO_AUDIT.md` P0 maddeleri QA-blocker olarak açık.

---

## Marka / teknik risk özeti

| Risk | QA mitigasyonu |
|------|----------------|
| Rebrand algısı | QA-BL-* |
| Platform split | QA-AND/IOS-05 |
| 16px fail | QA-16-* |
| Prebuild stale | QA-REG-06 |

---

## İleride değişebilecek dosyalar

| Dosya | Faz |
|-------|-----|
| `design-lab/.../full-analysis/QA_REPORT_P7.md` | P7 |
| `EVOLUTION_CHECKLIST.md` | P7 status update |

---

## Kesinlikle dokunulmamalı

- QA pass olmadan P8 production swap (gate)

---

## Önerilen üretim stratejisi

1. P1: Bu plan + checklist ID mapping.
2. P4–P5: Boyut QA design-lab'da.
3. P7: Full matrix + blind test.
4. P8: Smoke subset 24h post-release.

---

## Rollback planı

- QA fail → P8 abort; design-lab iterate.
- Post-P8 regression fail → asset restore + hotfix build.

---

## Production migration sırası (QA gate)

```
P7 full pass (zero P0)
    → P8 staging build
    → QA smoke (QA-REG-*)
    → Production promote
    → P8+7d audit
```

---

**İlişkili:** `DNA_FREEZE_GATE.md`, `P1_1_LOGO_EVOLUTION_FULL_ANALYSIS.md`
