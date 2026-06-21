# Website Logo Path Matrix

**Phase:** P1-1 — recommended Patch 0 companion  
**Mode:** Read-only mapping  
**Date:** 2026-06-21  
**SSOT:** `website/lib/branding-assets.ts`

---

## Path → file → tier mapping

| Key | Public URL | Disk path | Mevcut aile | Hedef tier | P8 değişir? |
|-----|------------|-----------|-------------|------------|-------------|
| `logoMark` | `/store/leylektag-icon.png` | `website/public/store/leylektag-icon.png` | B | M1/S | ✅ |
| `logoMarkPngFallback` | `/store/leylektag-icon.png` | same | B | M1/S | ✅ |
| `logoHorizontal` | `/store/feature-graphic.png` | `website/public/store/feature-graphic.png` | C | C refine | ✅ |
| `logoHorizontalPngFallback` | `/store/leylektag-icon.png` | same | B | M1/S | ✅ |
| `favicon` | `/store/leylektag-icon.png` | same | B | M0 | ✅ |
| `icon192` | `/store/leylektag-icon.png` | same | B | S | ✅ |
| `icon512` | `/store/leylektag-icon.png` | same | B | L | ✅ |
| `appleTouch` | `/store/leylektag-icon.png` | same | B | S | ✅ |
| `ogImage` | `/store/feature-graphic.png` | same | C | C refine | ✅ |
| `LEGACY_FALLBACK_ICON` | `/app-icon.png` | `website/public/app-icon.png` | legacy | M1 veya retire | ✅ |

---

## Component → path consumption

| Component | Paths used | Display size |
|-----------|------------|--------------|
| `navbar.tsx` | logoMark → fallbacks → LEGACY | 50–58 px |
| `footer.tsx` | logoMark, logoHorizontal | mark + wide |
| `app/layout.tsx` | favicon, icon192/512, appleTouch, ogImage | metadata |
| `hero-horizontal-logo.tsx` | logoHorizontal | 560×112 display |
| `leylek-zeka-mark.tsx` | hardcoded premium + logoMark fallback | 18–28 px |
| `branding-image.tsx` | multi-source prop | generic |

---

## Leylek Zeka hardcoded paths (branding-assets dışı)

| Constant | Path | Not |
|----------|------|-----|
| `LOGO_PRIMARY` | `/store/leylek-logo-premium.png` | A — doğru |
| `LOGO_FALLBACK` | `BRANDING_PATHS.logoMark` | B — P8'de aynı aileye çek |

**P8 öneri:** `leylek-zeka-mark.tsx` path'leri `branding-assets.ts`'e taşı (opsiyonel refactor).

---

## Metadata (`app/layout.tsx`)

```typescript
icons.icon → BRANDING_PATHS.icon192, icon512
icons.shortcut → BRANDING_PATHS.favicon
icons.apple → BRANDING_PATHS.appleTouch
openGraph.images → BRANDING_PATHS.ogImage
viewport.themeColor → "#0072FF"  // genom drift — ayrı token
```

---

## Store vitrin (logo içeren, ayrı cycle)

| Constant | Path |
|----------|------|
| `STORE_SCREENSHOTS.*` | `/store/yolcu*.png`, `surucu*.png` |
| `IPAD_SHOWCASE_SCREENSHOTS` | `/store/ipad-showcase/*` |

**Not:** App içi screenshot'lar P8 icon swap sonrası ayrı refresh.

---

## Duplicate branding/ copies

| Primary | Duplicate | Aksiyon |
|---------|-----------|---------|
| `store/leylektag-icon.png` | `branding/leylektag-icon.png` | Single source |
| `store/feature-graphic.png` | `branding/feature-graphic.png` | Single source |

---

## P8 migration order (website only)

1. `leylektag-icon.png` (favicon + navbar)
2. `leylek-logo-premium.png` sync
3. `feature-graphic.png` marketing refine
4. `app-icon.png` fallback update/retire
5. `branding-assets.ts` path additions (favicon ladder opsiyonel)
6. `leylek-zeka-mark.tsx` fallback same-family
7. Hero CSS violet retire

---

## QA cross-check (post-P8)

- [ ] favicon tab = mobile app icon aile
- [ ] OG preview loads
- [ ] Navbar fallback never hits LEGACY
- [ ] Leylek Zeka onError path same family

---

**İlişkili:** `WEBSITE_LOGO_ANALYSIS.md`, `ORPHAN_LOGO_REFERENCES.md`
