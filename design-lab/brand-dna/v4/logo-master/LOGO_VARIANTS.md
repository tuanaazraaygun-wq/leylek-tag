# LeylekTAG Logo Variant Family

**Version:** Logo Variants v1.0  
**Status:** Analysis only  
**Parent:** `LOGO_CONSTITUTION.md`, `LOGO_GEOMETRY.md`, `LOGO_COLOR_SYSTEM.md`

---

## 1. Varyant Felsefesi

Tüm varyantlar **aynı anchor geometry** — scale ve rotation (≤4°) dışında form değişmez. Varyant = renk, malzeme, simplification tier ve context — yeni logo çizimi değil.

**Hedef sayı:** 12 ana varyant + 4 simplification tier + 3 wordmark lockup = **15 dosya grubu** (master SVG katmanları ile).

---

## 2. Ana Varyant Matrisi (12)

| # | ID | Ad | Form | Renk | Kullanım |
|---|-----|-----|------|------|----------|
| 1 | `logo.primary.dark` | Primary dark | Symbol + wordmark | White+cyan on void | Splash, marketing hero |
| 2 | `logo.primary.light` | Primary light | Symbol + wordmark | Slate+cyan on white | Print light, email |
| 3 | `logo.symbol.dark` | Symbol dark | Symbol only | White+cyan on void | App icon, splash center |
| 4 | `logo.symbol.light` | Symbol light | Symbol only | Slate+cyan on white | Light adaptive |
| 5 | `logo.monochrome.white` | Mono white | Symbol | White on transparent | Watermark dark UI |
| 6 | `logo.monochrome.black` | Mono black | Symbol | Slate on transparent | Print, light watermark |
| 7 | `logo.monochrome.cyan` | Mono cyan | Symbol | Cyan only | Accent marketing |
| 8 | `logo.outline.dark` | Outline | Stroke only | White stroke | Overlay, map chrome |
| 9 | `logo.filled.dark` | Filled | Solid siluet | White fill | Small size robust |
| 10 | `logo.motion.boot` | Motion boot | Animated symbol | Dark + glow | Lottie 550 ms |
| 11 | `logo.motion.lock` | Motion lock | Ring animate | Cyan peak | Lottie 320 ms |
| 12 | `logo.orb.ai` | AI orb | Symbol + halo | Glass air | Leylek Zeka |

---

## 3. Simplification Tier (4)

| Tier | ID | Boyut | Ring | Wing | Kullanım |
|------|-----|-------|------|------|----------|
| M0 | `logo.micro` | 16–20 px | Hide | Hint | Favicon, watch complication |
| M1 | `logo.small` | 24–29 px | Hide | Simplified | Settings icon, notification |
| S | `logo.standard` | 32–64 px | Thin | Full | Widget, navbar |
| F | `logo.full` | 128–512 px | Full | Full | Master, store, billboard |

**Kural:** Tier downgrade = point reduction; metafor değişmez.

---

## 4. Yüzey-Spesifik Varyantlar

### 4.1 App Icon

| Asset | Varyant | Boyut |
|-------|---------|-------|
| iOS icon | `symbol.dark` Tier F | 1024 |
| Android adaptive foreground | `symbol.dark` Tier F | 432 safe |
| Android background | Void flat — **no symbol** | 1080 |
| Legacy icon | `symbol.dark` Tier S | 192 |

### 4.2 Splash

| Asset | Varyant | Not |
|-------|---------|-----|
| Splash center | `symbol.dark` + motion.boot | 16:9 letterbox |
| Splash wordmark | `primary.dark` optional | Stagger +40 ms |

### 4.3 Small Icon / Notification

| Asset | Varyant | Boyut |
|-------|---------|-------|
| Notification icon | `monochrome.white` M0 | 24 dp mono |
| Status bar | M0 | 16–20 |
| Push rich | `symbol.dark` Tier S | 96 |

### 4.4 Watch

| Asset | Varyant |
|-------|---------|
| Watch app icon | `small` M1 |
| Complication | `micro` M0 |
| Notification | `monochrome.white` M0 |

### 4.5 Widget

| Size | Varyant |
|------|---------|
| Small | M0 dot veya `micro` |
| Medium | `standard` S @ 24 px |
| Large | `standard` S @ 32 px |

### 4.6 Website

| Asset | Varyant |
|-------|---------|
| Favicon | `micro` M0/M1 SVG |
| Navbar | `standard` S |
| Hero | `motion.boot` veya `symbol.dark` F |
| Footer | `standard` S |
| OG image | `primary.dark` horizontal |
| Apple touch | `symbol.dark` 180 |

### 4.7 AI Orb

| State | Varyant |
|-------|---------|
| Closed | — |
| Open | `orb.ai` |
| Think | `orb.ai` + pulse |
| Map overlay | `micro` M0 center dot |

### 4.8 Marker (referans — logo değil)

Marker varyantları `MARKER_DNA.md` — logo belgesinde yalnızca **watermark** `monochrome.white` @ 0.15 opacity.

---

## 5. Wordmark Lockups (3)

| ID | Layout | Oran |
|----|--------|------|
| `logo.lockup.horizontal` | Symbol left + LeylekTAG right | 4:1 |
| `logo.lockup.vertical` | Symbol top + wordmark bottom | 1:1.5 |
| `logo.lockup.symbol-only` | — | 1:1 |

**Tipografi:** Geometric sans; Leylek/TAG eşit ağırlık; min width 80 px.

---

## 6. Malzeme Varyantları (fiziksel)

| ID | Malzeme | Varyant base |
|----|---------|--------------|
| `logo.mat` | Mat flat ink | mono.black |
| `logo.emboss` | Deboss symbol | mono — tek renk |
| `logo.metal` | Metal accent dot only | mono + spot cyan |
| `logo.glass` | Frost edge print | outline.dark |
| `logo.vehicle` | High contrast mono | mono.white large |

**Dijital glass:** `orb.ai` only — genel logo glass yasak (trend).

---

## 7. SVG Yapısı (Phase 3 hedef)

```
logo-master.svg
├── layer.ground
├── layer.horizon
├── layer.wing
├── layer.ring
├── layer.accent
├── layer.wordmark (optional)
└── defs.tokens (CSS variables)
```

Export script: varyant = layer visibility + CSS token swap — **12 path set değil**.

---

## 8. PNG Raster Ladder (Phase 3)

| Boyut | Tier | Format |
|-------|------|--------|
| 16, 20, 24, 29, 32, 48 | M0–S | PNG @1x |
| 64, 96, 128, 192, 256, 512, 1024 | S–F | PNG |
| 180 apple-touch | S | PNG |
| 1024 store | F | PNG |

**Kural:** PNG master SVG'den export — elle rasterize yok.

---

## 9. Lottie Varyantları (Phase 4)

| File | Varyant | Süre |
|------|---------|------|
| `logo-boot-presence.lottie` | motion.boot | 550 ms |
| `logo-lock-ring.lottie` | motion.lock | 320 ms |
| `logo-sweep-loading.lottie` | horizon sweep | 1500 loop |

---

## 10. Varyant Sayısı Özeti

| Kategori | Adet |
|----------|------|
| Renk modu (dark/light/mono×3) | 6 |
| Motion | 3 |
| AI orb | 1 |
| Wordmark lockup | 3 |
| Simplification tier | 4 (aynı path) |
| Fiziksel malzeme | 5 |
| **Toplam unique export grubu** | **~15** (+ boyut ladder) |

**Asla:** Her marketing kampanyası için yeni logo; seasonal variant; 3D her yüzey.

---

## 11. Mevcut Production vs Hedef

| Mevcut | Hedef varyant |
|--------|---------------|
| logo-leylek.svg (pin) | Retire → `symbol.dark` |
| leylek-logo-premium.png (kuş) | Retire → `symbol.dark` |
| feature-graphic.png | `lockup.horizontal` |
| icon.png / adaptive | `symbol.dark` Tier F |
| splashscreen_logo.png | `symbol.dark` + motion |
| favicon | `micro` M0 |
| Hero violet wrapper | Retire — flat `primary.dark` |

---

## 12. QA Matrix

Her varyant ship öncesi:

- [ ] Anchor geometry diff = 0
- [ ] Hex match genom
- [ ] Tier ladder 16–1024
- [ ] Monochrome print 15 mm
- [ ] `prefers-reduced-motion` static
- [ ] Red team pin test

---

**Non-goals:** Dosya üretimi yok.
