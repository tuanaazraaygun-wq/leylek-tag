# F2 — Horizon Stork · Production Asset Specification

**Finalist:** S13 · Direction B  
**Phase:** 3 — spec only  
**Phase 4 target:** `exports/svg/f2-horizon-stork-master.svg`

---

## 1. Master SVG Geometry

### 1.1 Canvas

| Parametre | Değer |
|-----------|-------|
| viewBox | `0 0 512 512` |
| Symbol bounds | x:88–404, y:104–396 |
| Optical center | (256, 252) |
| Negatif alan | 34% (gap active) |

### 1.2 Layer paths @512

| Layer | Geometry spec |
|-------|---------------|
| **horizon-left** | (88,340)→(200,340) stroke 2.5 |
| **horizon-right** | (312,340)→(424,340) stroke 2.5 |
| **gap** | Compound path: wing arc (200,340)→(318,168)→(312,340) + inner cutout boolean → negatif stork siluet between segments |
| **wing** | Upper arc shared with gap outer edge — single stroke 2.5 |
| **ring** (optional Phase 4) | Outer inset 14%; stroke 2; **default off in master** — enable `logo.variant.ring` |
| **accent** | Circle cx=256 cy=268 r=6 @ gap center lower |

### 1.3 Grid anchors

| Nokta | x | y |
|-------|---|---|
| Gap left | 200 | 340 |
| Gap right | 312 | 340 |
| Wing apex | 318 | 168 |
| Accent | 256 | 268 |

### 1.4 Stroke & radius

Same genom as F1: primary 2.5, ring 2.0, round caps/joins.

### 1.5 Safe area

Gap width @512 ≈ 112 px — minimum readable @128; @48 simplified to single horizon + arc.

### 1.6 Small size behaviour

| Tier | Behaviour |
|------|-----------|
| M0 | Arc + single horizon line (gap closed visually) |
| M1 | Split horizon 8px gap hint |
| S | Gap readable negatif |
| F | Full compound gap stork |

**Companion export:** `f2-filled-dark` — solid siluet for ≤24px (no gap dependency).

---

## 2. Size Ladder (24–256 px)

| px | Tier | horizon | gap | wing | ring | accent |
|----|------|---------|-----|------|------|--------|
| **24** | M1/filled | 1 line OR split | hide → use **filled** | arc hint | hide | 3px |
| **32** | S | split 6px | subtle | simplified | hide | 4px |
| **48** | S | split 12px | negatif hint | full upper | opt hair | 5px |
| **64** | F | full split | negatif full | full | opt | 6px |
| **96** | F | full | full | full | opt | 7px |
| **128** | F | full | full | full | opt 1.5px | 7px |
| **256** | F | scale 0.5 master | full | full | opt | 14px |

---

## 3. App Icon

### iOS / Android

| Parametre | Spec |
|-----------|------|
| 1024 primary | F tier full gap |
| 1024 fallback | `f2-filled-dark` for QA |
| Adaptive | Foreground filled M1 @ small preview; F @ store |
| Safe 80% | Gap must not touch edge @48 equivalent |

### Optical center

(256, 252) — gap visual weight center.

### Mask

Squircle: gap negatif @1024 must survive mask — test @48 scaled.

---

## 4. Splash

| Mode | Spec |
|------|------|
| **Dark** | Void gradient ground; F gap breathe opacity 0.92↔1.0 subtle 2s optional pre-handoff |
| **Light** | Trust white; slate symbol; gap = negative space |

Gap içi **never cyan fill**.

---

## 5. Website

| Yüzey | Spec |
|-------|------|
| **Header** | S tier filled @32px — gap hidden |
| **Footer** | S filled |
| **Hero** | F full gap @128+ — showcase negatif; motion boot arc pulse |

---

## 6. Watch

| px | Spec |
|----|------|
| 44 icon | M1 filled — no gap |
| 20 complication | M0 arc only |
| 24 notification | mono filled |

---

## 7. Widget

| Size | Spec |
|------|------|
| Small | dot only or hide |
| Medium | S filled @24 |
| Large | S filled @32 |

---

## 8. Favicon

| Size | Spec |
|------|------|
| 16 | filled M0 blob arc — **not gap** |
| 32 | M1 arc + line |
| 48 | S split hint |

Dual asset: `favicon-filled.ico` + `favicon-outline.svg`.

---

## 9. QR

| Phase | Logo |
|-------|------|
| Overlay | F tier center |
| Verified | Optional outer ring close if `ring` layer enabled; else **arc inward snap** 320ms + accent flash |
| Marker sync | ring if present; else marker ring only |

---

## 10. AI Orb

| State | Behaviour |
|-------|-----------|
| Open | Gap brightness → "eye" abstract |
| Think | Gap opacity pulse 0.7↔1.0 — **sonic silent** |
| Core | Accent or gap center |

---

## 11. Motion rules

| Event | Behaviour |
|-------|-----------|
| **Boot** | Arc pulse; gap opacity subtle; sonic gap 120ms metafor |
| **Match** | Outer arc warm resolve — gap interior unchanged |
| **Offer** | Two horizon segments flash sequential 40ms — relay visual |
| **QR** | ringClose OR arc snap |
| **Payment** | checkDraw |
| **Trust** | gap edge warm ring once |
| **AI** | gap think pulse |

---

## 12. Sonic alignment

| Event | Sync |
|-------|------|
| Boot | gap hold @160ms = sonic gap ★ |
| Offer | dual horizon = two-phase relay ★ |
| QR | A4 lock |
| Payment | handshake close |

---

## 13. Marker genom

| Shared | F2 unique |
|--------|-----------|
| horizon stroke family | gap negatif — marker dolu siluet |
| destination stem rhyme (split horizon) | logo stem yok |
| cyan accent | gap never cyan |

---

## 14. Evolution control (0–100)

| Kriter | Skor |
|--------|------|
| Tanınırlık | **88** |
| Premium | **91** |
| Trust | **86** |
| Longevity | **90** |
| Favicon | **72** |
| Watch | **78** |
| Website | **93** |
| Motion | **86** |
| Marker uyumu | **90** |
| LSDS | **94** |
| LSX | **90** |

**Anlaşılır?** Evet — leylek okuma en yüksek; küçük boyut filled fallback şart.

---

## 15. Phase 4 manifest

```
exports/svg/f2-horizon-stork-master.svg
exports/svg/f2-horizon-stork-filled.svg
exports/png/f2/...
```

**Non-goals:** No files in Phase 3.
