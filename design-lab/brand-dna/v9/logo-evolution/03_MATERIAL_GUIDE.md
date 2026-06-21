# 03 — Material Guide

**Sprint:** BRAND-LOGO-EVO-2A  
**Goal:** Neon → **premium metal / cam** — same logo, better craft

---

## Current production material read

| Layer | Production | Problem |
|-------|------------|---------|
| Stork | Silver gradient + bevel | OK anchor; clip-art era depth |
| Arc | Cyan-blue gradient + **heavy outer glow** | Neon / gaming |
| Edge | Soft anti-alias + bloom | @48px muddy blob |

---

## V2 material stack

### Stork (locked silhouette, improved render)

| Pass | Spec |
|------|------|
| Base fill | Cool silver `#E8EEF4` → `#B8C4D0` (existing family) |
| Specular | Highlight boost **+6% to +12%** on lum >150 only (Preview A→C) |
| Shadow | Micro crush −3% on lum <90 — depth without cartoon |
| Edge | Optional UnsharpMask (Preview B/C): radius 1.2, 90%, threshold 2 |
| Eye | Single cyan dot `#22D3EE` — no glow halo |

### Orbital arc (evolved)

| Pass | Spec |
|------|------|
| Core metal | `#0891B2` → `#22D3EE` gradient (2–3 stops max) |
| Rim highlight | 1px equivalent @512 — `#F5F7FA` @ 35% on top-left arc |
| Inner shadow | `#08111F` @ 15% — **feather ≤2px** |
| Outer glow | **Remove** — replace with tight rim only |
| Glass hint | Subtle top-left specular on arc thickness (Preview C) |

---

## Preview material tiers

| Preview | `metal_boost` | Sharpen | Read |
|---------|---------------|---------|------|
| A | 1.06 | No | Gentle polish |
| B ★ | 1.10 | Yes | Balanced premium |
| C | 1.12 | Yes | Max restraint + clarity |

---

## Forbidden

- Violet / purple tints
- `feGaussianBlur stdDeviation > 3` in export master
- Separate cartoon crown / pin teardrop
- Flat wireframe stroke-only (Family B retire path only for **icons**, not logo evolution)

---

## Vector future (post-V2)

When tracing to SVG:

- Bird: fill-first paths
- Arc: stroke-first + semi-flat fill hybrid @48+
- **No blur filters** in master SVG per constitution
