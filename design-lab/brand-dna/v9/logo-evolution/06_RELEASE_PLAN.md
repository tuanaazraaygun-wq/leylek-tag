# 06 — Release Plan

**Sprint:** BRAND-LOGO-EVO-2A (design-lab) → **V2.1 production gate** (future)  
**2A status:** Docs + previews only — **production untouched**

---

## Phase map

```
2A  design-lab previews + guides     ← THIS SPRINT (complete)
2B  product sign-off Preview B       ← gate
2C  master PNG swap (gated)          ← leylek-logo-premium.png
2D  app icon + ios + mipmaps         ← BRAND-APPICON-1C
2E  splash native unify              ← drawable splashscreen_logo
2F  store / website sync             ← marketing copies
```

---

## 2A deliverables ✅

| Artifact | Path |
|----------|------|
| Direction | `01_PREMIUM_DIRECTION.md` |
| Ring | `02_RING_REFINEMENT.md` |
| Material | `03_MATERIAL_GUIDE.md` |
| Background | `04_BACKGROUND_GUIDE.md` |
| Readability | `05_SMALL_SIZE_READABILITY.md` |
| Release plan | `06_RELEASE_PLAN.md` (this file) |
| Preview A/B/C | `previews/preview-a/b/c.png` |
| Comparison | `previews/comparison-grid.png` |
| Readability | `readability/48–192px.png` |
| Generator | `scripts/generate_v9_previews.py` |

---

## 2B — Sign-off gate

- [ ] Preview B chosen (or A/C with rationale)
- [ ] Side-by-side login screenshot approved
- [ ] 48px readability pass (S-01–S-05)
- [ ] Brand: “same logo, evolved” — V-05 ≥4/5
- [ ] Constitution amendment recorded (ring/glow only)

---

## 2C — Master swap (single commit, targeted)

**Pre-backup:**

```
frontend/assets/images/_backup-pre-v2-YYYYMMDD/leylek-logo-premium.png
```

**Replace:**

```
frontend/assets/images/leylek-logo-premium.png  ← from Preview B hi-res export
```

**Do NOT `git add .`**

**Rollback:** restore backup folder

---

## 2D — App icon unify

From `design-lab/brand-dna/v8/app-icon/03_SAFE_APP_ICON_PLAN.md`:

1. Export `adaptive-icon-foreground.png` from Preview B (432 safe, alpha FG)
2. Regenerate `ios.premium.logo.png`
3. `expo prebuild` → `mipmap-*/ic_launcher*`

---

## 2E — Splash native

Replace `drawable-*/splashscreen_logo.png` ×5 with Family A (Preview B), keep `#08111F` BG.

**Do not** change `SplashScreen.tsx` timing / `onFinish`.

---

## Files never touched without explicit sprint

| Path | Sprint |
|------|--------|
| `app.json` | 2D (optional BG hex only) |
| `LoginBrandHeader.tsx` | No change (same require path) |
| Wireframe `favicon.png` | Separate web sprint |

---

## Risk summary

| Risk | Mitigation |
|------|------------|
| “New logo” perception | Preview B IoU ≥98%; blind review |
| APK still wireframe | 2D mandatory with master swap |
| Double glow on splash | Reduce JS halo after PNG glow fix (optional) |
| Prebuild overwrites native | Document + commit res intentionally |

---

**BRAND LOGO EVOLUTION V2 design-lab complete. Production untouched.**
