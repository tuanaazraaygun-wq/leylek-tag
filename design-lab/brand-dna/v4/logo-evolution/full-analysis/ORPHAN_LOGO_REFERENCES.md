# Orphan & Stale Logo References Report

**Phase:** P1-1 — recommended Patch 0 companion  
**Mode:** Read-only inventory  
**Date:** 2026-06-21  
**Parent:** `P1_1_LOGO_EVOLUTION_FULL_ANALYSIS.md` §5

---

## Executive summary

Production ve repo'da **9 orphan/stale** logo referansı tespit edildi. Bunlar evolution öncesi temizlik adayıdır — **P8'e kadar production'da kalabilir** (kırık referans hariç).

---

## Orphan assets (kod referansı yok veya dead)

| Asset | Konum | Durum | P8 aksiyon |
|-------|-------|-------|------------|
| `logo-leylek.svg` | `website/public/` | Orphan | Delete veya archive |
| `Logo.tsx` | `frontend/components/` | Hiç import yok | Remove veya wire to spec |
| `login-brand.png` | `frontend/assets/images/` | require yok | Delete |
| `icon.png` | `frontend/assets/images/` | app.json ref yok | Delete |
| `adaptive-icon.png` | `frontend/assets/images/` | Orphan | Delete |

---

## Duplicate assets

| Asset A | Asset B | Not |
|---------|---------|-----|
| `frontend/.../leylek-logo-premium.png` | `website/public/store/leylek-logo-premium.png` | Hash sync gerekli |
| `website/public/store/leylektag-icon.png` | `website/public/branding/leylektag-icon.png` | Consolidate |
| `website/public/store/feature-graphic.png` | `website/public/branding/feature-graphic.png` | Consolidate |

---

## Stale fallback chain

| Kaynak | Fallback | Sorun |
|--------|----------|-------|
| `navbar.tsx` / `footer.tsx` | `LEGACY_FALLBACK_ICON` → `/app-icon.png` | Eski marka |
| `leylek-zeka-mark.tsx` | premium → `leylektag-icon.png` | A→B fallback |

---

## Broken references (deploy risk)

| Referans | Beklenen dosya | Repo durumu |
|----------|----------------|-------------|
| `backend/templates/landing.html` | `/static/images/leylek-logo.png` | ❌ YOK |
| `backend/templates/kvkk.html` | same | ❌ YOK |
| `backend/templates/gizlilik-politikasi.html` | same | ❌ YOK |
| `backend/templates/kullanim-sartlari.html` | same | ❌ YOK |
| `backend/templates/hesap-silme.html` | same | ❌ YOK |
| `website_files/*.html` | `leylek-logo.png` local | Stale mirror |

**Severity:** P0 — legal sayfalarda broken image.

---

## Native Android stale risk

| Config (`app.json`) | Native (`res/`) | Uyum |
|---------------------|-----------------|------|
| splash: premium PNG | `splashscreen_logo.png` pin | ❌ |
| adaptive: wireframe FG | `ic_launcher_foreground.png` | ⚠️ prebuild bağlı |
| ios.icon: premium | N/A Android | ❌ vs iOS |

---

## Design-lab only (production'a sızmamalı)

| Path | Not |
|------|-----|
| `design-lab/brand-dna/v4/exports/svg/f1-*` | F1 ship red |
| `design-lab/brand-dna/v4/logo-sketch-lab/FINALIST_*` | Sketch lab |

---

## Recommended Patch 0 actions

1. Bu raporu stakeholder ile paylaş.
2. P8 cleanup listesine ID ata.
3. Backend static asset planı P8-4'e ekle.
4. **P1'de production delete yapma.**

---

**İlişkili:** `PRODUCTION_LOGO_AUDIT.md` §4, `WEBSITE_LOGO_PATH_MATRIX.md`
