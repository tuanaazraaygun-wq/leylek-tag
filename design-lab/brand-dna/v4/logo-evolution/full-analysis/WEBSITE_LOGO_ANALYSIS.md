# Area 7 — Website Logo Analysis

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only production scan  
**Date:** 2026-06-21

---

## Executive summary

Website **üç logo ailesini** aynı anda kullanıyor: navbar/favicon (B wireframe), hero/OG (C wordmark), Leylek Zeka (A premium). Merkezi path `website/lib/branding-assets.ts` — evolution P8'de bu mapping güncellenir.

---

## Mevcut durum — yüzey envanteri

| Yüzey | Bileşen / config | Asset | Aile |
|-------|------------------|-------|------|
| Navbar | `navbar.tsx` → `BrandingImage` | `BRANDING_PATHS.logoMark` | B |
| Footer | `footer.tsx` | logoMark + logoHorizontal | B + C |
| Favicon | `app/layout.tsx` metadata.icons | `leylektag-icon.png` | B |
| Apple touch | layout metadata | `leylektag-icon.png` | B |
| PWA 192/512 | layout metadata | `leylektag-icon.png` | B |
| OG image | openGraph.images | `feature-graphic.png` | C |
| Twitter card | twitter.images | `feature-graphic.png` | C |
| Hero | `hero-horizontal-logo.tsx` | `feature-graphic.png` | C |
| Leylek Zeka | `leylek-zeka-mark.tsx` | premium PNG → icon fallback | A → B |
| Store vitrin | `STORE_SCREENSHOTS` | UI mockups | iç mark |
| Branding fallback | `LEGACY_FALLBACK_ICON` | `/app-icon.png` | legacy |

### themeColor

`viewport.themeColor: "#0072FF"` — logo cyan genom (`#00D4AA`) dışı (P2).

---

## Kullanılan mevcut dosyalar

| Dosya | Rol |
|-------|-----|
| `website/lib/branding-assets.ts` | Merkezi path SSOT |
| `website/app/layout.tsx` | Metadata icons + OG |
| `website/components/navbar.tsx` | Header mark |
| `website/components/footer.tsx` | Footer mark |
| `website/components/hero-horizontal-logo.tsx` | Hero wordmark |
| `website/components/branding-image.tsx` | Multi-source fallback |
| `website/components/leylek-zeka-mark.tsx` | AI mark |
| `website/public/store/leylektag-icon.png` | Favicon/navbar |
| `website/public/store/feature-graphic.png` | Hero/OG |
| `website/public/store/leylek-logo-premium.png` | Zeka primary |
| `website/public/app-icon.png` | Legacy fallback |
| `website/public/logo-leylek.svg` | Orphan |
| `website/public/branding/leylektag-icon.png` | Duplicate |
| `website/public/branding/feature-graphic.png` | Duplicate |

---

## Navbar

- `logoMark` → `/store/leylektag-icon.png` (~50–58 px tile).
- Cyan/violet gradient glow wrapper (navbar) — violet constitution ihlali (P1).
- Fallback chain: `logoMark` → `logoMarkPngFallback` → `LEGACY_FALLBACK_ICON`.

**Evrim:** M1/S tier kuş DNA icon; violet glow retire.

---

## Footer

- Mark: `logoMark` (B).
- Horizontal: `logoHorizontal` → `feature-graphic.png` (C).
- Mixed family — bilinçli (symbol + wordmark) ama symbol B olmamalı.

---

## Favicon / PWA

```typescript
// branding-assets.ts
favicon: "/store/leylektag-icon.png",
icon192: "/store/leylektag-icon.png",
icon512: "/store/leylektag-icon.png",
appleTouch: "/store/leylektag-icon.png",
```

**Sorun:** Mobil app icon (A) ≠ web favicon (B) — P0.

---

## Apple touch icon

- Aynı `leylektag-icon.png` — 180×180 önerilen; mevcut dosya boyutu P7'de verify.

---

## OG image

- `feature-graphic.png` — 1200×630 metadata; wide marketing kompozit (C).
- **OK** marketing lane — evrimde refine, replace değil revolution.
- Alt text: "Leylek TAG" ✅

---

## Hero

- `hero-horizontal-logo.tsx` — `feature-graphic.png`.
- Violet blur: `from-cyan-400/15 via-transparent to-violet-400/15` — **constitution ihlali**.
- Evrim: cyan-only ambient; aynı lockup geometry refine.

---

## Store icon

- `website/public/store/leylektag-icon.png` — download page, store links.
- `website/public/app-icon.png` — legacy.

---

## Branding fallback

```typescript
export const LEGACY_FALLBACK_ICON = "/app-icon.png";
```

- Navbar/footer `BrandingImage` son çare.
- `app-icon.png` eski marka — fallback chain güncellenmeli (P8).

---

## Eski assetler

| Asset | Durum | Aksiyon |
|-------|-------|---------|
| `logo-leylek.svg` | Orphan | Retire P8 |
| `app-icon.png` | Fallback only | Replace veya retire |
| `branding/leylektag-icon.png` | Duplicate | Consolidate |
| `branding/feature-graphic.png` | Duplicate | Consolidate |
| `_backup-old-vitrin/*` | Archive | Dokunma |

---

## Hangi dosyalar değişmeli (P8)

| Dosya | Değişiklik |
|-------|------------|
| `website/public/store/leylektag-icon.png` | M0/M1 tier swap |
| `website/lib/branding-assets.ts` | Path + yeni favicon ladder (opsiyonel) |
| `website/public/store/leylek-logo-premium.png` | L-tier sync frontend ile |
| `website/public/store/feature-graphic.png` | Refined lockup (P8-1 marketing) |
| `website/components/hero-horizontal-logo.tsx` | Violet blur kaldır (minimal CSS) |
| `website/app/layout.tsx` | themeColor token (opsiyonel) |

---

## Hangi dosyalar kalmalı

| Dosya | Gerekçe |
|-------|---------|
| `feature-graphic.png` konsepti | Wordmark + hero marketing lane |
| `branding-assets.ts` yapısı | SSOT pattern iyi |
| `BrandingImage` fallback pattern | Resiliency |
| Store screenshot PNG'leri | UI vitrin — ayrı refresh cycle |
| `leylek-zeka-mark.tsx` fallback logic | Korunur; primary asset değişir |

---

## Sorunlar

| ID | Sorun | Severity |
|----|-------|----------|
| WEB-01 | Favicon (B) ≠ app (A) | P0 |
| WEB-02 | Navbar arc-only — leylek zayıf | P1 |
| WEB-03 | Violet hero blur | P1 |
| WEB-04 | Duplicate branding/ store copies | P2 |
| WEB-05 | themeColor genom drift | P2 |
| WEB-06 | `logo-leylek.svg` orphan | P3 |
| WEB-07 | OG metadata width vs actual crop | P2 |

---

## Marka riski

- Web ziyaretçisi mobil indirince farklı icon görür → güven kaybı.
- Violet ambient → AI/cyberpunk algısı (yasak).

---

## Teknik risk

- Next.js metadata cache — favicon değişikliği CDN cache.
- `BrandingImage` client fallback — flash of wrong icon.
- Hardcoded `/store/` paths — `branding-assets.ts` üzerinden yönetiliyor ✅

---

## Önerilen üretim stratejisi

1. P1 patch: Website logo mapping raporu (bu belge) + path matrix JSON (design-lab).
2. P4: M0/M1 web favicon exports.
3. P8: `leylektag-icon.png` swap; `branding-assets.ts` favicon ladder.
4. P8: Hero violet CSS retire (minimal diff).
5. P8: `feature-graphic.png` marketing refine (L-tier lockup).

---

## Rollback planı

- Restore `website/public/store/*.png` from backup.
- Revert `branding-assets.ts` + `hero-horizontal-logo.tsx`.
- CDN cache purge (opsiyonel).

---

## QA kriterleri

| Test | Pass |
|------|------|
| Navbar 32/64 px | M1/S okunur |
| Favicon 16 tab | M0 |
| OG preview | feature-graphic loads |
| Leylek Zeka tile | Premium primary |
| Mobile add-to-home | PWA icon = favicon |
| Lighthouse PWA | icons valid |

---

## Production migration sırası

1. `leylektag-icon.png` + metadata icons (P8)
2. `leylek-logo-premium.png` web copy sync (P8)
3. `feature-graphic.png` marketing (P8-1)
4. Hero CSS violet retire (P8)
5. Orphan `logo-leylek.svg` retire (P8)
6. Duplicate `branding/` consolidate (P8-2)

---

**İlişkili:** `WEBSITE_LOGO_MAPPING.md` (önerilen ilk patch çıktısı)
