# F3 — Orbital Seal · Production Asset Specification

**Finalist:** S18 · Direction C  
**Phase:** 3 — spec only  
**Phase 4 target:** `exports/svg/f3-orbital-seal-master.svg`

---

## 1. Master SVG Geometry

### 1.1 Canvas

| Parametre | Değer |
|-----------|-------|
| viewBox | `0 0 512 512` |
| Symbol bounds | x:120–392, y:120–392 (ring OD) |
| Optical center | (256, 256) |
| Negatif alan | 30% |

### 1.2 Layer paths @512

| Layer | Geometry spec |
|-------|---------------|
| **ring** | Circle/ellipse stroke cx=256 cy=256 r=136; stroke 2.5; open path bottom segment emphasis |
| **horizon-segment** | Arc along ring bottom (220,356)→(292,356) stroke 2.5 — A3 body visual |
| **chevron** | Polyline stroke (236,248)→(256,228)→(276,248) stroke 2.5; ascend right |
| **accent** | Circle cx=256 cy=356 r=6 on horizon midpoint |

### 1.3 Grid anchors

| Nokta | x | y |
|-------|---|---|
| Ring center | 256 | 256 |
| Ring radius | 136 | — |
| Chevron tip | 256 | 228 |
| Accent | 256 | 356 |

### 1.4 Stroke & radius

Ring 2.5 px; chevron 2.5 px; round caps.

### 1.5 Safe area

Ring OD 272px in 512 → 12% pad OK. Chevron inside ring @ squircle.

### 1.6 Small size behaviour

| Tier | Behaviour |
|------|-----------|
| M0 | Ring circle 1px + dot bottom |
| M1 | Ring + chevron simplified V |
| S+ | Full ring + chevron + horizon segment |

---

## 2. Size Ladder (24–256 px)

| px | ring | chevron | horizon seg | accent |
|----|------|---------|-------------|--------|
| **24** | 1px circle | hide | hide | 3px bottom |
| **32** | 1.5px | V 4px | hide | 4px |
| **48** | 2px | chevron | hairline | 5px |
| **64** | 2.5px | full | segment | 6px |
| **96** | 2.5px | full | full | 7px |
| **128** | full | full | full | 7px |
| **256** | full | full | full | 14px |

---

## 3. App Icon

### iOS / Android

| Spec | Value |
|------|-------|
| 1024 | F ring + chevron |
| Red team | vs generic circle apps — chevron mandatory |
| Adaptive safe 80% | Ring OD ≤ 0.80×432 |
| Background | void flat |

### Optical center

(256,256) geometric — chevron optically shifts up 4px for balance in Phase 4.

---

## 4. Splash

| Mode | Spec |
|------|------|
| **Dark** | Ring micro pulse 0.98→1.02; chevron fade in 120ms |
| **Light** | Slate ring; void/white ground |

Lock metaphor early — still calm (no bounce).

---

## 5. Website

| Yüzey | Spec |
|-------|------|
| Header | S @32 — ring small |
| Footer | S |
| Hero | F ring breathe; red team circle apps |

---

## 6. Watch

| px | Spec |
|----|------|
| 44 | M1 ring + dot |
| 20 complication | ring + dot |
| Strong watch read — ring native |

---

## 7. Widget

| Size | px |
|------|-----|
| S | ring 24 |
| M | ring 24 |
| L | ring 32 |

---

## 8. Favicon

| Size | Spec |
|------|------|
| 16 | ring circle + dot — **Uber circle test** |
| 32 | + chevron |
| 48 | full |

Mitigation: chevron @32+ mandatory for differentiation.

---

## 9. QR

| Phase | Logo |
|-------|------|
| Verified | **ringClose native** — best in class |
| Peak @80ms cyan ring full stroke |
| Marker | identical ring anim spec |

---

## 10. AI Orb

Ring expands to glass torus; chevron → core; accent center eye.

---

## 11. Motion rules

| Event | Primary motion |
|-------|----------------|
| Boot | ring scale pulse |
| Match | ring warm opacity |
| Offer | chevron ingress translateY |
| QR | **ringClose** ★ |
| Payment | ring + check |
| Trust | ring warm 360ms |
| AI | ring orbExpand |

---

## 12. Sonic alignment

| Event | Sync |
|-------|------|
| Boot | ring swell = A3 body |
| QR | A4 magnetic perfect |
| Offer | chevron = forward E4 |

---

## 13. Marker genom

Ring timing shared; chevron **logo only** — marker uses role siluet inside state ring overlay (different inner content).

---

## 14. Evolution control (0–100)

| Kriter | Skor |
|--------|------|
| Tanınırlık | **86** |
| Premium | **88** |
| Trust | **92** |
| Longevity | **84** |
| Favicon | **80** |
| Watch | **86** |
| Website | **85** |
| Motion | **94** |
| Marker uyumu | **84** |
| LSDS | **90** |
| LSX | **92** |

**Anlaşılır?** PNG arc tanınır; leylek zayıf — chevron + wordmark gerekli.

---

## 15. Phase 4 manifest

```
exports/svg/f3-orbital-seal-master.svg
exports/png/f3/...
```

**Non-goals:** No files Phase 3.
