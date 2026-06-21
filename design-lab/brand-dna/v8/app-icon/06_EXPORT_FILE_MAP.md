# BRAND-APPICON-1C — Export File Map

**Sprint:** BRAND-APPICON-1C-AUDIT  
**Mode:** Read-only analysis  
**Master:** `candidate-r6.png` (1024×1024, R6 −6% ring, glow ×0.5, `#08111F` bg)

---

## Source → production mapping

```
leylek-logo-premium.png (1254×1254, Family A login master)
        │
        │  generate_candidates.py (read-only on production)
        ▼
candidate-r6.png (1024×1024 RGB, #08111F full bleed)  ← lab master
        │
        ├─► [EXPORT A] adaptive-icon-foreground.png     (RGBA transparent FG)
        ├─► [EXPORT B] ios.premium.logo.png             (RGB full bleed = R6)
        └─► [EXPORT C] mipmap ladder                    (via expo prebuild from A)
```

---

## Export A — Android adaptive foreground (P0)

| Field | Value |
|-------|-------|
| **Destination** | `frontend/assets/images/adaptive-icon-foreground.png` |
| **Dimensions** | 1024 × 1024 px (Expo standard; Android safe zone ~66% center) |
| **Color mode** | **RGBA** — transparent outside symbol |
| **Content** | Premium stork + R6 arc only; **no** background fill in PNG |
| **Background color** | Supplied separately via `app.json` + `colors.xml` → `#08111F` |
| **Derived from** | R6 symbol layer before `fit_to_canvas().convert("RGB")` in lab script |
| **Not valid source** | Raw `candidate-r6.png` (RGB full bleed) |

### Lab script gap (1C execute)

Current `generate_candidates.py` line 120: `return canvas.convert("RGB")` — drops alpha and bakes bg.

**Required addition for execute:**

```text
adaptive-icon-foreground-r6.png
  = fit_to_canvas(sym) kept as RGBA
  = transparent canvas + pasted symbol (no BG fill)
  → copy to frontend/assets/images/adaptive-icon-foreground.png
```

---

## Export B — iOS app icon (P0)

| Field | Value |
|-------|-------|
| **Destination** | `frontend/assets/ios.premium.logo.png` |
| **Dimensions** | 1024 × 1024 px |
| **Color mode** | RGB (or RGBA with opaque bg — Apple accepts both) |
| **Content** | Full icon including `#08111F` background |
| **Valid source** | **`candidate-r6.png` direct copy** (after visual QA) |
| **Config ref** | `app.json` → `expo.ios.icon` |

---

## Export C — Android native mipmaps (P0, generated)

Produced by **`npx expo prebuild --platform android`** after Export A is in place.

| Density | Folder | File | Typical FG size |
|---------|--------|------|-----------------|
| mdpi | `mipmap-mdpi/` | `ic_launcher_foreground.png` | 108×108 |
| hdpi | `mipmap-hdpi/` | `ic_launcher_foreground.png` | 162×162 |
| xhdpi | `mipmap-xhdpi/` | `ic_launcher_foreground.png` | 216×216 |
| xxhdpi | `mipmap-xxhdpi/` | `ic_launcher_foreground.png` | 324×324 |
| xxxhdpi | `mipmap-xxxhdpi/` | `ic_launcher_foreground.png` | 432×432 |

Same densities for:

- `ic_launcher.png` (legacy)
- `ic_launcher_round.png`

### Adaptive XML (unchanged — verify only)

| File | Content |
|------|---------|
| `mipmap-anydpi-v26/ic_launcher.xml` | `@color/iconBackground` + `@mipmap/ic_launcher_foreground` |
| `mipmap-anydpi-v26/ic_launcher_round.xml` | Same |

---

## Files explicitly out of scope (1C minimal)

| Path | Current family | Action |
|------|----------------|--------|
| `frontend/assets/images/leylek-logo-premium.png` | A login | **Keep** |
| `frontend/assets/images/favicon.png` | B | Follow-up WEB |
| `frontend/android/.../drawable-*/splashscreen_logo.png` | B wireframe | Follow-up SPLASH-UNIFY |
| `frontend/app.json` | Paths OK | No change unless BG token tweak |
| `expo.plugins.expo-notifications.icon` | premium login | **Keep** |
| `expo.splash.image` | premium login | **Keep** |
| `expo.icon` | premium login | **Keep** (Android ignores for launcher) |

---

## Git staging map (1C execute — no `git add .`)

```bash
git add frontend/assets/images/adaptive-icon-foreground.png
git add frontend/assets/ios.premium.logo.png
git add frontend/android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
git add frontend/android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
git add frontend/android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
git add frontend/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
git add frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
git add frontend/android/app/src/main/res/mipmap-mdpi/ic_launcher.png
git add frontend/android/app/src/main/res/mipmap-hdpi/ic_launcher.png
git add frontend/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
git add frontend/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
git add frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
git add frontend/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
git add frontend/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
git add frontend/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
git add frontend/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
git add frontend/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
# optional backup folder:
git add frontend/assets/images/_backup-pre-appicon-YYYYMMDD/
```

---

## Size preview QA assets (lab — reference only)

| Lab file | Purpose |
|----------|---------|
| `candidates/48px-preview.png` | Launcher legibility gate |
| `candidates/72px-preview.png` | hdpi reference |
| `candidates/96px-preview.png` | xhdpi reference |
| `candidates/192px-preview.png` | xxhdpi reference |
| `candidates/preview-grid.png` | R4/R6/R8 comparison |

Do not copy preview frames to production — they include label chrome.

---

## Dependency order (execute)

1. Generate Export A (RGBA FG) from R6 pipeline  
2. Copy Export B (`candidate-r6.png` → `ios.premium.logo.png`)  
3. Replace `adaptive-icon-foreground.png` with Export A  
4. Run `npx expo prebuild --platform android` → Export C  
5. Review prebuild diff (splash drawables may change — revert if out of scope)  
6. Commit targeted paths only  
7. EAS APK + device QA  

**BRAND-APPICON-1C EXPORT MAP COMPLETE.**
