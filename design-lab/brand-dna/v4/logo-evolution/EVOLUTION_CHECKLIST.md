# LeylekTAG Logo Evolution Checklist

**Phase:** P1 framework — P7 full execution  
**Version:** Evolution Checklist v1.0  
**Parent:** `LOGO_EVOLUTION_CONSTITUTION.md`, `EVOLUTION_PRINCIPLES.md`  
**Date:** 2026-06-21

---

## 0. How to use

| Faz | Checklist bölümü |
|-----|------------------|
| P1 DNA Freeze | §1 |
| P2 Geometry | §2 |
| P3 Premium Polish | §3 |
| P4 Micro Icon | §4 |
| P5 App Icon | §5 |
| P6 Motion | §6 |
| P7 QA | §7 (full) |
| P8 Production | §8 |

**Durum kodları:** ☐ pending · ☑ pass · ✗ fail · N/A skip

---

## 1. P1 — DNA Freeze gate

### 1.1 Governance

| ID | Check | Status |
|----|-------|--------|
| P1-G01 | `LOGO_EVOLUTION_CONSTITUTION.md` onaylandı | ☐ |
| P1-G02 | Canonical master = `leylek-logo-premium.png` | ☐ |
| P1-G03 | F1 Meridian Wing production **RED** onaylandı | ☐ |
| P1-G04 | Rebrand / yeni logo scope **RED** onaylandı | ☐ |
| P1-G05 | Never Change listesi stakeholder imzası | ☐ |

### 1.2 Analysis completeness

| ID | Check | Status |
|----|-------|--------|
| P1-A01 | `LOGO_SURFACE_MAP.md` — tüm yüzeyler | ☑ |
| P1-A02 | `PRODUCTION_LOGO_AUDIT.md` — P0 bulgular | ☑ |
| P1-A03 | `CURRENT_DNA_ANALYSIS.md` | ☑ |
| P1-A04 | `COMPETITOR_EVOLUTION_ANALYSIS.md` | ☑ |
| P1-A05 | `EVOLUTION_ROADMAP.md` P1–P8 | ☑ |
| P1-A06 | Production dosyası değiştirilmedi | ☑ |

---

## 2. P2 — Geometry Evolution gate

### 2.1 Master trace

| ID | Check | Status |
|----|-------|--------|
| P2-G01 | Master SVG design-lab'da (production değil) | ☐ |
| P2-G02 | Siluet overlay vs premium PNG IoU ≥85% | ☐ |
| P2-G03 | Profil leylek + orbital arc korundu | ☐ |
| P2-G04 | Gaga profili L-tier path mevcut | ☐ |
| P2-G05 | Kanat sweep yönü değişmedi | ☐ |
| P2-G06 | Negatif alan ≥30% canvas | ☐ |
| P2-G07 | 8px grid snap | ☐ |
| P2-G08 | Optical center +2% kalibrasyon | ☐ |

### 2.2 Yasak geometry

| ID | Check | Status |
|----|-------|--------|
| P2-B01 | F1 formu kullanılmadı | ☐ |
| P2-B02 | Pin teardrop master olmadı | ☐ |
| P2-B03 | Yeni kuş türü / mascot yok | ☐ |
| P2-B04 | Ayna alınmış siluet yok | ☐ |

---

## 3. P3 — Premium Polish gate

### 3.1 Malzeme & renk

| ID | Check | Status |
|----|-------|--------|
| P3-P01 | 3D metal shader kaldırıldı | ☐ |
| P3-P02 | Flat / light emboss L-tier only | ☐ |
| P3-P03 | Accent `#00D4AA` uygulandı | ☐ |
| P3-P04 | Form Trust White `#F5F7FA` | ☐ |
| P3-P05 | Gradient `#67E8F9→#2563EB` yok | ☐ |
| P3-P06 | Violet / AI moru yok | ☐ |
| P3-P07 | Idle glow off (max 0.25 boot) | ☐ |
| P3-P08 | SVG feGaussianBlur yok | ☐ |

### 3.2 Tanınırlık

| ID | Check | Status |
|----|-------|--------|
| P3-R01 | Blind test side-by-side ≥80% "aynı logo" | ☐ |
| P3-R02 | ≥85% "LeylekTAG" recall | ☐ |
| P3-R03 | Zero "farklı marka" yanıtı | ☐ |

---

## 4. P4 — Micro Icon gate

### 4.1 Tier M0 / M1

| ID | Check | Status |
|----|-------|--------|
| P4-M01 | M0: accent dot + arc @16px okunur | ☐ |
| P4-M02 | M1: + horizon @24px okunur | ☐ |
| P4-M03 | PNG ladder 16/20/24/32/48 export | ☐ |
| P4-M04 | Raster shrink kullanılmadı | ☐ |
| P4-M05 | Glow/filter olmadan okunur | ☐ |

### 4.2 Red team

| ID | Check | Status |
|----|-------|--------|
| P4-R01 | Uber pin yan yana — karışmama | ☐ |
| P4-R02 | Google pin yan yana — karışmama | ☐ |
| P4-R03 | Generic arc/antenna algısı ≤15% | ☐ |

---

## 5. P5 — App Icon gate

### 5.1 Platform unify

| ID | Check | Status |
|----|-------|--------|
| P5-A01 | iOS 1024 master tier S ailesi | ☐ |
| P5-A02 | Android adaptive foreground aynı aile | ☐ |
| P5-A03 | iOS icon = Android icon blind test pass | ☐ |
| P5-A04 | Squircle clip — wing apex safe | ☐ |
| P5-A05 | Adaptive safe zone %80 respected | ☐ |
| P5-A06 | Background `#08111F` / `#0D1117` unified | ☐ |
| P5-A07 | 29px iOS settings icon pass | ☐ |
| P5-A08 | 48px notification pass | ☐ |

### 5.2 Website icon

| ID | Check | Status |
|----|-------|--------|
| P5-W01 | favicon = app icon aile | ☐ |
| P5-W02 | icon192/512 = same ladder | ☐ |
| P5-W03 | appleTouch = same | ☐ |

---

## 6. P6 — Motion Integration gate

| ID | Check | Status |
|----|-------|--------|
| P6-M01 | Boot `presence.pulse` ≤550ms | ☐ |
| P6-M02 | Boot scale 0.96→1.03→1.0 | ☐ |
| P6-M03 | Lock `lock.ringClose` 320ms | ☐ |
| P6-M04 | Sonic peak @160ms ±20ms sync | ☐ |
| P6-M05 | Haptic lock sync | ☐ |
| P6-M06 | No bounce/spin/particle | ☐ |
| P6-M07 | LeylekEye iris `#00D4AA` | ☐ |
| P6-M08 | QR verify ring close spec | ☐ |

---

## 7. P7 — Full QA gate

### 7.1 Boyut ladder

| ID | Boyut | Kriter | Status |
|----|-------|--------|--------|
| QA-16 | 16 px | M0 dot+arc tanınır | ☐ |
| QA-24 | 24 px | M1 horizon hint | ☐ |
| QA-29 | 29 px | Tier S settings | ☐ |
| QA-32 | 32 px | Navbar compact | ☐ |
| QA-48 | 48 px | Ring hairline | ☐ |
| QA-64 | 64 px | Zeka tile | ☐ |
| QA-128 | 128 px | Login size | ☐ |
| QA-512 | 512 px | Master detail | ☐ |

### 7.2 Yüzey matrix

| ID | Yüzey | Aile unify | Status |
|----|-------|------------|--------|
| QA-S01 | JS Splash | A | ☐ |
| QA-S02 | Native splash | A | ☐ |
| QA-S03 | Login | A | ☐ |
| QA-S04 | iOS icon | A tier S | ☐ |
| QA-S05 | Android adaptive | A tier S | ☐ |
| QA-S06 | Notification | M0 | ☐ |
| QA-S07 | Website navbar | M1 + wordmark | ☐ |
| QA-S08 | Website hero | C lockup refine | ☐ |
| QA-S09 | Favicon / PWA | M0/M1 | ☐ |
| QA-S10 | OG image | C | ☐ |
| QA-S11 | Leylek Zeka | M tier | ☐ |
| QA-S12 | Watermark | monochrome | ☐ |
| QA-S13 | Backend legal | synced asset | ☐ |

### 7.3 Multimodal

| ID | Check | Status |
|----|-------|--------|
| QA-MM01 | Marker stroke/radius/cyan shared | ☐ |
| QA-MM02 | LSX motion tokens mapped | ☐ |
| QA-MM03 | LSDS v2 boot sync | ☐ |
| QA-MM04 | LHIS login cluster aligned | ☐ |

### 7.4 Accessibility & print

| ID | Check | Status |
|----|-------|--------|
| QA-A11Y01 | Contrast WCAG AA dark | ☐ |
| QA-A11Y02 | Contrast WCAG AA light (if applicable) | ☐ |
| QA-PRT01 | Monochrome 15mm print | ☐ |
| QA-PRT02 | Grayscale watermark 0.12–0.15 opacity | ☐ |

### 7.5 Regression

| ID | Check | Status |
|----|-------|--------|
| QA-REG01 | Orphan assets listed for removal | ☐ |
| QA-REG02 | Duplicate PNG consolidated | ☐ |
| QA-REG03 | logo-leylek.svg retired plan | ☐ |
| QA-REG04 | Logo.tsx dead code plan | ☐ |

---

## 8. P8 — Production Migration gate

### 8.1 Asset swap

| ID | Path | Swapped | Status |
|----|------|---------|--------|
| P8-01 | `frontend/assets/images/leylek-logo-premium.png` | ☐ | ☐ |
| P8-02 | `frontend/assets/ios.premium.logo.png` | ☐ | ☐ |
| P8-03 | `frontend/assets/images/adaptive-icon-foreground.png` | ☐ | ☐ |
| P8-04 | `frontend/android/.../splashscreen_logo.png` ×5 | ☐ | ☐ |
| P8-05 | `frontend/android/.../ic_launcher_foreground.png` | ☐ | ☐ |
| P8-06 | `website/public/store/leylektag-icon.png` | ☐ | ☐ |
| P8-07 | `website/public/store/feature-graphic.png` | ☐ | ☐ |
| P8-08 | `frontend/assets/images/favicon.png` | ☐ | ☐ |
| P8-09 | `backend/static/images/leylek-logo.png` | ☐ | ☐ |

### 8.2 Code / config (minimal)

| ID | Check | Status |
|----|-------|--------|
| P8-C01 | `app.json` paths verified | ☐ |
| P8-C02 | `BRANDING_PATHS` unchanged or updated | ☐ |
| P8-C03 | Violet hero wrapper removed | ☐ |
| P8-C04 | themeColor genom aligned | ☐ |
| P8-C05 | notification tint `#00D4AA` | ☐ |

### 8.3 Post-migration audit

| ID | Check | Status |
|----|-------|--------|
| P8-A01 | `PRODUCTION_LOGO_AUDIT.md` re-run — zero P0 | ☐ |
| P8-A02 | App Store screenshot refresh scheduled | ☐ |
| P8-A03 | Stakeholder evolution comms sent | ☐ |

---

## 9. Constitution compliance (always)

| ID | Rule | Status |
|----|------|--------|
| CON-01 | `evo.silhouette` — profil leylek + arc | ☐ |
| CON-02 | `ban.newBrand` — no new symbol | ☐ |
| CON-03 | `ban.f1Ship` — F1 not in production | ☐ |
| CON-04 | `ban.mapPinMaster` — pin not master | ☐ |
| CON-05 | `ban.glowDependency` — readable without glow | ☐ |
| CON-06 | `ban.platformSplit` — iOS = Android family | ☐ |
| CON-07 | Wordmark "Leylek" + "TAG" unchanged | ☐ |
| CON-08 | `#00D4AA` accent genom | ☐ |

---

## 10. Sign-off sheet (P7 / P8)

| Rol | P7 QA | P8 Ship | Tarih |
|-----|-------|---------|-------|
| Chief Brand Architect | ☐ | ☐ | |
| Chief Identity Designer | ☐ | ☐ | |
| Chief Motion Director | ☐ | ☐ | |
| Engineering Lead | N/A | ☐ | |
| Product Owner | ☐ | ☐ | |

---

**İlişkili belgeler:** `EVOLUTION_ROADMAP.md`, `PRODUCTION_LOGO_AUDIT.md`, `LOGO_EVOLUTION_CONSTITUTION.md`
