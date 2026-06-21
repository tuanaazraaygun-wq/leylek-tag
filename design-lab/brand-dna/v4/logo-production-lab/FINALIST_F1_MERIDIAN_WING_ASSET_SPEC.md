# F1 — Meridian Wing · Production Asset Specification

**Finalist:** S07 · Direction A  
**Phase:** 3 — spec only (no SVG file)  
**Phase 4 target:** `exports/svg/f1-meridian-wing-master.svg`

---

## 1. Master SVG Geometry

### 1.1 Canvas

| Parametre | Değer |
|-----------|-------|
| viewBox | `0 0 512 512` |
| Symbol bounds | x:82–410, y:96–404 (≈68% width) |
| Optical center | (268, 248) — +2% sağ shift |
| Negatif alan | 32% |

### 1.2 Layer paths (Phase 4 trace brief)

| Layer | Geometry spec @512 |
|-------|-------------------|
| **horizon** | Line (82,340)→(430,340); stroke 2.5; cap round |
| **wing** | Single cubic bezier arc; apex ~(318,168); ascend +2°; stroke 2.5; fill none |
| **ring** | Elliptical stroke path inset 12% wing bbox; rx≈118 ry≈88; center (256,268); stroke 2; dasharray anim-ready |
| **accent** | Circle cx=268 cy=248 r=7 (optik +1px up from math 249) |

### 1.3 Grid anchors (8 px)

| Nokta | x | y |
|-------|---|---|
| H-left | 80 | 340 |
| H-right | 432 | 340 |
| Wing apex | 320 | 168 |
| Ring bottom | 256 | 356 |
| Accent | 268 | 248 |

### 1.4 Stroke & radius

| Öğe | @512 | Join | Cap |
|-----|------|------|-----|
| horizon, wing | 2.5 px | round | round |
| ring | 2.0 px | round | round |
| accent | fill | — | — |

Implicit corner radius on path handles: 2–4 px equivalent.

### 1.5 Safe area

| Context | Padding |
|---------|---------|
| Master symbol in 512 | 12% min (62 px) |
| 1024 icon canvas | Symbol scaled 0.88 center — 56 px pad |
| iOS squircle | Wing apex y≥120, ring bottom y≤392 |

### 1.6 Small size behaviour (tier rules)

| ≤20 px | M0: accent dot + 1px horizon; wing 1 bezier hint; ring **hidden** |
| 24–29 | M1: full horizon + simplified wing 2-bezier; ring hidden |
| 32+ | S: wing full + horizon; ring hairline or hidden until 48 |
| 48+ | S: ring visible 1px |
| 64+ | F: all layers full stroke scale |

---

## 2. Size Ladder (24–256 px export behaviour)

| px | Tier | Visible layers | Stroke (horizon) | Ring | Accent | Notes |
|----|------|----------------|------------------|------|--------|-------|
| **24** | M1 | wing简化 + horizon | 1.5 px | hide | 3 px diam | Arc 2-point |
| **32** | S | wing + horizon | 2.0 px | hide | 4 px | Standard widget |
| **48** | S | all | 2.0 px | 1.5 px hair | 5 px | Ring hint |
| **64** | F | all | 2.5 px | 2.0 px | 6 px | Full standard |
| **96** | F | all | 2.5 px | 2.0 px | 7 px | Navbar large |
| **128** | F | all | 2.5 px | 2.0 px | 7 px | Master preview |
| **256** | F | all | 5.0 px* | 4.0 px* | 14 px* | 2× scale export |

*256 = 512 master scaled 0.5 in viewBox or stroke doubled — Phase 4 script rule: scale transform not stroke inflate.

---

## 3. App Icon

### iOS

| Parametre | Spec |
|-----------|------|
| Export | 1024 PNG from `icon-1024` artboard |
| Mask | iOS squircle QA — no clip at wing apex |
| Layers | ground void + symbol F tier |
| Parallax | No |

### Android

| Parametre | Spec |
|-----------|------|
| Adaptive foreground | 432×432 dp safe — symbol only |
| Adaptive background | `#0D1117` flat — no gradient |
| Legacy 192 | S tier center |

### Optical center

Symbol optical centroid (268,248) → icon canvas (512,512) after 0.88 scale.

### Mask test

Squircle + circle + rounded square — wing apex inside all.

---

## 4. Splash

| Mode | Background | Symbol | Motion |
|------|------------|--------|--------|
| **Dark** | `#0D1117` → `#1A2332` gradient **ground only** | F tier white | presence 550 ms |
| **Light** | `#F5F7FA` flat | Slate symbol | same timing |

Wordmark: optional `primary.dark` +40 ms stagger. Logo position: center or y=66% band (horizon on viewer baseline).

---

## 5. Website

| Yüzey | Size | Variant | Motion |
|-------|------|---------|--------|
| **Header** | 32–40 px height | S tier | Static |
| **Footer** | 28–32 px | S | Static |
| **Hero** | 128–192 px | F | presence.boot on load; reduced-motion → static F |

No violet blur wrapper. Cyan accent on CTA separate from logo.

---

## 6. Watch (ultra küçük)

| Asset | px | Tier | Colours |
|-------|-----|------|---------|
| App icon | 44–50 | M1 | white + cyan dot |
| Complication | 20–24 | M0 | dot + horizon |
| Notification | 24 | M0 mono white | — |

Ring hidden. Haptic-first; sound off.

---

## 7. Widget

| Size | Symbol px | Tier |
|------|-----------|------|
| Small | 0–16 (dot optional) | M0 |
| Medium | 24 | S |
| Large | 32 | S |

Static only. Cyan on status text, not logo fill.

---

## 8. Favicon

| Size | Behaviour |
|------|-----------|
| **16** | M0: accent 4px + horizon 8px wide |
| **32** | M1: horizon full + wing hint |
| **48** | S: wing + horizon; ring hairline |

SVG favicon: `logo.tier.small` default; media query prefers-color-scheme.

---

## 9. QR — logo behaviour

| Phase | Logo |
|-------|------|
| Camera open | Static symbol corner watermark 24px M1 opacity 0.2 |
| Scan | viewfinder on camera — logo static |
| Verified | **ringClose 320 ms** on center overlay symbol F; cyan flash accent+ring |
| Error | logo static; error on viewfinder not logo |

Sync marker `lock.ringClose` frame 0.

---

## 10. AI — Leylek Zeka Orb

| State | Behaviour |
|-------|-----------|
| Closed | — |
| Open | Symbol F scales 1→1.08; ring → glass halo 32px blur cyan 0.20 |
| Think | Accent pulse opacity 0.7↔1.0; ring glow loop |
| Core | Accent dot = abstract eye |
| Dismiss | orb→symbol 300 ms reverse |

No robot face. Orb path = symbol layers + halo group.

---

## 11. Motion rules

| Event | Transform | Glow | Duration |
|-------|-----------|------|----------|
| **Boot** | scale 0.96→1.03→1; opacity 0→1 | 0→0.25→0.08 | 550 ms |
| **Match** | scale 1→1.02→1 | warm chrome not logo | 480 ms |
| **Offer** | relay ingress header symbol if visible | trail optional | 260 ms |
| **QR** | ring dashoffset 100%→0 | lock 0.50 peak @80ms | 320 ms |
| **Payment** | check overlay 360 ms | — | 360 ms |
| **Trust** | ring opacity pulse once | warm 0.20 | 360 ms |
| **AI** | orbExpand | ai glow | 300 ms |

Idle header logo: **static**.

---

## 12. Sonic alignment

| Event | Token | Visual sync point |
|-------|-------|-------------------|
| Boot | presence.boot +40ms | scale peak @160ms = sonic gap |
| QR | qr.success A4 | ring close @80ms |
| Offer | offer classic/urgent | ingress frame 0 |
| Payment | payment.confirmed | checkDraw peak |
| Match | match.success | breathe frame 0 |

---

## 13. Marker genom (same family, not same logo)

| Shared | F1 logo |
|--------|---------|
| stroke 2.5/2 | horizon + wing |
| cyan `#00D4AA` | accent only |
| ring 320ms | `logo.layer.ring` |
| radius 2–4 | ✓ |
| Marker form | car/human/motor — **different path** |

---

## 14. Evolution control (0–100)

| Kriter | Skor | Gerekçe |
|--------|------|---------|
| Tanınırlık | **92** | Kanat+arc mevcut aile; pin yok |
| Premium | **90** | Restraint flat |
| Trust | **88** | Horizon + ring close |
| Longevity | **91** | Geometry timeless |
| Favicon | **85** | M0 dot+line pass |
| Watch | **84** | M1 solid |
| Website | **89** | Hero motion ready |
| Motion | **93** | Full token map |
| Marker uyumu | **92** | Shared genom |
| LSDS | **92** | A3 horizon = body |
| LSX | **91** | T4 boot triad |

**LeylekTAG anında anlaşılır?** Evet — mevcut kullanıcı kanat+halka tanır; pin kaybolduğu için "yenilenmiş" not "değişmiş".

---

## 15. Phase 4 file manifest (planned)

```
exports/svg/f1-meridian-wing-master.svg
exports/png/f1/{24,32,48,64,96,128,256,1024}.png
exports/lottie/f1-boot-presence.json
exports/lottie/f1-lock-ring.json
```

**Non-goals:** Files not created in Phase 3.
