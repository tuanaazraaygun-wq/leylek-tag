# 02 — Logo Evolution Production Spec

**Sprint:** B5 — Brand Identity Production  
**Status:** Design-lab spec + SVG assets  
**Primary source:** `frontend/assets/images/leylek-logo-premium.png`  
**Ship decision:** Evolve — do NOT replace with F1 Meridian Wing or pin family

---

## 1. Evolution thesis

> Kullanıcı "başka logo olmuş" demeyecek.  
> Kullanıcı "aynı LeylekTAG, daha premium ve net olmuş" diyecek.

| Preserve | Evolve |
|----------|--------|
| Leylek profil silueti | 3D metal → controlled flat/semi-flat |
| Tek bacak duruş | Metallic gradient → solid Trust White + Meridian accent |
| Orbital arc (açık halka) | Glow bağımlılığı kaldır |
| Kanat sweep çizgisi | Vector-first master |
| Cyan/green accent göz | `#00D4AA` genom kalibrasyonu |
| Premium koyu zemin uyumu | `#0D1117` / `#08111F` harmonize |

| Forbidden |
|-----------|
| F1 Meridian Wing ship |
| Pin teardrop metaforu |
| Arc-only (kuşsuz) logo |
| Generic kuş / maskot |
| Yeni soyut marka |

---

## 2. Vector master requirements

### 2.1 File

| Property | Value |
|----------|-------|
| Master path | `svg/leylek-symbol-master-v1.svg` |
| viewBox | `0 0 512 512` |
| Grid | 8 px snap |
| Layer IDs | `layer.orbitalArc`, `layer.storkBody`, `layer.accentDot` |
| Gradients in SVG | **Forbidden** (flat fills only) |
| Filters / blur | **Forbidden** in master |

### 2.2 Trace limitations (documented)

B5 SVG is **hand-traced approximation** from premium PNG — not automated Bézier trace.

| Limitation | Mitigation |
|------------|------------|
| Wing apex ±5% vs raster | IoU overlay QA before freeze |
| Leg tuck simplification | Acceptable at S-tier and below |
| Crest detail reduced | Preserved at M/L tier only |
| Metallic depth removed | Intentional — flat evolution |

**Pre-freeze gate:** Side-by-side overlay IoU ≥85% (`EVOLUTION_PRINCIPLES.md` P-REC-02).

---

## 3. Geometry rules

### 3.1 Canonical DNA elements

```
┌──────────────────────────────────────┐
│         ╭── orbital arc ──╮          │  ← open gap top-right @ beak
│        ╱    wing sweep      ╲        │
│   ●────────────────────────────      │  ● = accent eye (#00D4AA)
│        ╲   stork body      ╱         │
│         ╰── standing leg ──╯         │
└──────────────────────────────────────┘
```

| Element | Rule |
|---------|------|
| Stork orientation | Profile facing **right** |
| Posture | Standing on **one leg**; other tucked |
| Beak | Long, straight — not cartoon |
| Eye | Single **Meridian Cyan** dot — lock point |
| Wing sweep | Single stroke curve on back — not feather texture |
| Orbital arc | ~270° sweep; **break at top-right**; not closed circle |
| Negatif alan | ≥30% canvas |

### 3.2 Oran tablosu (@512)

| Oran | Target |
|------|--------|
| Symbol W:H | 1:1 |
| Arc center Y | ~62% canvas height |
| Accent dot | Wing-head intersection optically |
| Arc stroke | 10 px master → scale proportional |
| Safe zone (adaptive) | Symbol fits 80% center — apex not clipped |

Reference: `logo-master/LOGO_GEOMETRY.md` §3.

---

## 4. Color system

| Token | Hex | Logo use |
|-------|-----|----------|
| Meridian Cyan | `#00D4AA` | Accent dot, arc primary stroke |
| Trust White | `#F5F7FA` | Stork body (dark mode) |
| Depth Slate | `#1A2332` | Stork body (light mode) |
| Void Black | `#0D1117` | Icon/splash ground primary |
| App ground alt | `#08111F` | Legacy compat — harmonize to Void Black in migration |

**Migration note:** Production uses `#22D3EE` in places — hue shift to `#00D4AA`, not new brand.

---

## 5. Variants

### 5.1 Dark variant (`leylek-symbol-dark.svg`)

| Property | Value |
|----------|-------|
| Ground | `#0D1117` |
| Symbol | Trust White + Meridian accent |
| Use | App icon, splash, login dark, CarPlay |

### 5.2 White / light variant (`leylek-symbol-white.svg`)

| Property | Value |
|----------|-------|
| Ground | `#F5F7FA` |
| Symbol | Depth Slate + Meridian accent |
| Use | White theme, print light, email header |

### 5.3 Small-size variant (`leylek-symbol-small.svg`)

| Tier | Sizes | Content |
|------|-------|---------|
| M0 | 16 px | Arc hint + accent dot + simplified body blob |
| M1 | 24 px | + horizon hint |
| S | 32–48 px | Simplified stork — no crest detail |

**Rule:** Design small-first; never shrink L tier to favicon.

### 5.4 App icon variant (`app-icons/leylek-app-icon-1024.svg`)

| Property | Value |
|----------|-------|
| Canvas | 1024 × 1024 |
| Symbol scale | Centered; 80% safe zone |
| Ground | Void Black |
| iOS | Full bleed squircle clip test required |
| Android | Pair with `#0D1117` adaptive background |

### 5.5 Adaptive foreground (`app-icons/leylek-adaptive-foreground-432.svg`)

| Property | Value |
|----------|-------|
| Canvas | 432 × 432 (transparent bg) |
| Safe zone | 66% center — wing apex inside |
| Replaces | `adaptive-icon-foreground.png` (B family) |

### 5.6 Splash variant (`splash/leylek-splash-1920x1080.svg`)

| Property | Value |
|----------|-------|
| Aspect | 16:9 |
| Symbol | Centered; breathe animation anchor |
| Ground | `#0D1117` |
| Native + JS | **Same symbol** — fixes P0 dual-family splash |

### 5.7 Website header (`website/leylek-header-mark-dark.svg`)

| Property | Value |
|----------|-------|
| Layout | Symbol 64px + "LeylekTAG" wordmark |
| Navbar height | 80px artboard |
| Replaces | `leylektag-icon.png` in navbar |

---

## 6. Leylek Zeka relation

| Surface | Asset | Spec |
|---------|-------|------|
| Chat header | Full symbol @ 40–48px OR eye only | Eye preferred ≤32px |
| Widget FAB | Eye animation (`LeylekEye.tsx`) | Migrate colors to `#00D4AA` |
| Static fallback | `leylek-zeka-eye-v1.svg` | Ring + dot; no full stork |

**Rule:** Leylek Zeka = **intelligence accent** (eye), not duplicate full logo at map scale.

---

## 7. Watermark relation

| Property | Value |
|----------|-------|
| File | `svg/leylek-watermark-v1.svg` |
| Opacity | 12% Trust White |
| Use | Muhabbet content overlay |
| Forbidden | Full-opacity logo on user content |

---

## 8. Export ladder

| Tier | px | Source | Notes |
|------|-----|--------|-------|
| M0 | 16 | `leylek-symbol-small.svg` | Favicon |
| M1 | 24 | `leylek-symbol-small.svg` | Watch complication |
| S | 32 | master (simplified) | Notification |
| S | 48 | master | In-app header |
| M | 128 | dark variant | Login |
| L | 512 | master | Splash, store |
| XL | 1024 | app-icon | App Store |

PNG generation: see `png/README.md`. **Vector master is SSOT.**

---

## 9. Motion / LSX link (future)

| Event | Logo surface | Motion token |
|-------|--------------|--------------|
| Boot | Splash | `brand.boot` — breathe 0.98→1.0 |
| Match | LeylekEye overlay | `match.accept` |
| QR lock | Scanner chrome | arc stroke-dash |

Logo motion does not change static master paths — overlay animations only.

---

## 10. QA gates (pre-migration)

| ID | Test |
|----|------|
| LOGO-Q-01 | 200ms flash recall ≥85% "LeylekTAG" |
| LOGO-Q-02 | Silhouette IoU ≥85% vs premium PNG |
| LOGO-Q-03 | 16px accent dot visible |
| LOGO-Q-04 | iOS squircle clip — no apex cut |
| LOGO-Q-05 | Android adaptive safe zone |
| LOGO-Q-06 | NOT mistaken for F1 arc-only |
| LOGO-Q-07 | NOT mistaken for pin SVG |

---

## 11. B5 deliverables

| Asset | Path | Status |
|-------|------|--------|
| Master | `svg/leylek-symbol-master-v1.svg` | ✅ |
| Dark | `svg/leylek-symbol-dark.svg` | ✅ |
| White | `svg/leylek-symbol-white.svg` | ✅ |
| Small | `svg/leylek-symbol-small.svg` | ✅ |
| App icon | `app-icons/leylek-app-icon-1024.svg` | ✅ |
| Adaptive fg | `app-icons/leylek-adaptive-foreground-432.svg` | ✅ |
| Splash | `splash/leylek-splash-1920x1080.svg` | ✅ |
| Website | `website/leylek-header-mark-dark.svg` | ✅ |
| Zeka eye | `svg/leylek-zeka-eye-v1.svg` | ✅ |
| Watermark | `svg/leylek-watermark-v1.svg` | ✅ |

---

**Parent:** `01_PRODUCTION_IDENTITY_INVENTORY.md`  
**Next:** `03_MARKER_PRODUCTION_SPEC.md`
