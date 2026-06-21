# 08 — Shared Icon System

**Version:** Shared Icon System v1.0 — **FROZEN**  
**Sprint:** B5.2 — Brand Geometry Freeze  
**Scope:** Logo + marker shared tokens  
**Master:** `frontend/assets/images/leylek-logo-premium.png`

---

## 1. Purpose

Single numeric system binding logo (`@512`) and markers (`@48`) so all LeylekTAG icons read as **one family** derived from master DNA.

---

## 2. Corner radius

| Context | @ master | Scale rule | Locked |
|---------|----------|------------|--------|
| Logo implicit corners | 2–4 px @512 | proportional | ✅ |
| Marker body corners | 2–4 px @48 | fixed | ✅ |
| Car body rx | 4 px @48 | — | ✅ |
| Wheel | full circle | — | ✅ |
| App icon squircle | OS-defined | — | n/a |

**Formula:** `marker.radius = max(2, round(logo.radius × 48/512))`

| Token | Logo @512 | Marker @48 |
|-------|-----------|------------|
| `radius.sm` | 2 px | 2 px |
| `radius.md` | 3 px | 3 px |
| `radius.lg` | 4 px | 4 px |

---

## 3. Stroke width

| Token | Logo @512 | Marker @48 | Use |
|-------|-----------|------------|-----|
| `stroke.primary` | 11 px | 2.2 px | Arc, marker edge |
| `stroke.secondary` | 5.5 px | 1.5 px | Arc inner, trust ring |
| `stroke.detail` | 4 px | 2 px | Wing sweep, figure lines |
| `stroke.hairline` | — | 1.5 px | Offline strike only |

**Minimum readable stroke @16 px logo:** 1.5 px equivalent.

**Rule:** Stroke widths scale together — never change one token without updating scale table.

---

## 4. Glow (halo)

| Token | Value | Logo | Marker |
|-------|-------|------|--------|
| `glow.color` | `#00D4AA` | arc secondary only | halo fill |
| `glow.opacity.dark` | 14–22% | 26% arc secondary | 18% circle |
| `glow.opacity.light` | 10–16% | reduced | 12% circle |
| `glow.radius.marker` | 18–20 px @48 | — | ✅ |
| `glow.blur` | **0** — no CSS/SVG blur filter | ✅ | ✅ |

**Philosophy:** Glow is **flat opacity circle** — premium, not neon. Logo arc secondary stroke simulates depth without blur.

---

## 5. Shadow

| Surface | Shadow | Rule |
|---------|--------|------|
| Logo symbol | **None** in master | Flat on Void Black |
| Marker map PNG | 1 px drop @ 40% black optional | Baked in export only |
| Watermark | None | Opacity only |
| App icon | OS shadow only | No custom shadow in asset |

**Forbidden:** Long drop shadows, glow filters, 3D emboss on logo.

---

## 6. Accent ratio

| Token | Definition | Locked value |
|-------|------------|--------------|
| `accent.color` | Meridian Cyan | `#00D4AA` |
| `accent.logo.r` | Eye radius @512 | 5.5 px |
| `accent.marker.r` | Center dot @48 | 1.5–2.5 px |
| `accent.logo.body` | eye Ø : head width | **1 : 6.5** |
| `accent.marker.body` | dot Ø : core Ø | **1 : 8** |

**Rule:** Accent is always **circular dot** — never star, jewel, or lens flare.

---

## 7. Negative space

| Token | Target | Measure |
|-------|--------|---------|
| `space.logo.interior` | ≥30% canvas inside arc | Area between bird and arc |
| `space.logo.margin` | 10% outer | §06 safe area |
| `space.marker.padding` | 4 px min from artboard edge | Content inset |
| `space.marker.figure` | 40% empty inside core circle | Not filled solid |

**Philosophy:** Premium = silence. Dense fills read as toy UI.

---

## 8. Padding

| Context | Padding | Locked |
|---------|---------|--------|
| Symbol in 512 canvas | 51 px (10%) | ✅ |
| Symbol in 1024 app icon | 256 px (25%) — optical center offset | ✅ |
| Symbol in 432 adaptive fg | 54 px (12.5%) | ✅ |
| Marker in 48 artboard | 4 px min | ✅ |
| Wordmark lockup (future) | 16 px gap symbol→text | spec |

---

## 9. Optical balance

| Principle | Application |
|-----------|-------------|
| Beak right-weight | Symbol shifts +12 px optical X vs math center |
| Leg down-weight | Symbol shifts +22 px optical Y |
| Arc thick-bottom | Visual gravity bottom — splash/icon center slightly up |
| Marker anchor down | Optical center (24, 26) not (24, 24) |
| Flag destination | Flag flies right — pole anchors left of center |

**Golden rule:** When centering in UI, use **optical center**, not bounding-box center.

---

## 10. Color tokens (shared)

| Token | Hex | Logo role | Marker role |
|-------|-----|-----------|-------------|
| `color.meridian` | `#00D4AA` | Eye, arc primary | Dot, arc fragment, halo |
| `color.trustWhite` | `#F5F7FA` | Silhouette, arc secondary | Stroke, figure |
| `color.depthSlate` | `#1A2332` | Light mode silhouette | Core fill |
| `color.voidBlack` | `#0D1117` | Dark ground | — |
| `color.warmResolve` | `#C8E6D0` | — | Trust overlay |
| `color.offline` | `#94A3B8` | — | Offline desaturate |

**Migration note:** Legacy `#22D3EE` → `#00D4AA` on export; hue shift not new brand.

---

## 11. Typography pairing (icons only)

| Surface | Pairing |
|---------|---------|
| Website header | Symbol 64 px + "LeylekTAG" system UI 28 px semibold |
| Marker label | System 11 px max (cluster only) |
| Logo | **No text inside symbol** |

---

## 12. Cross-reference matrix

| Shared token | Logo doc | Marker doc |
|--------------|----------|------------|
| Grid 8/4 | `06` §1 | `07` §1 |
| Stroke scale | `06` §3 | `07` + this doc §3 |
| Accent dot | `06` §7 | `07` per-type |
| Arc language | `06` §6 | QM, pickup ring |
| Safe area | `06` §2 | Marker halo |

---

## 13. Amendment log

| Version | Date | Change |
|---------|------|--------|
| v1.0 FROZEN | 2026-06-21 | B5.2 initial lock |

---

**Parent:** `06_LOGO_GEOMETRY_CONSTITUTION.md`, `07_MARKER_GEOMETRY_CONSTITUTION.md`  
**Next:** `09_EXPORT_SYSTEM.md`
