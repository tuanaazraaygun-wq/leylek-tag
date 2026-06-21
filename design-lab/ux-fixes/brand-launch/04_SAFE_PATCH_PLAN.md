# 04 — Safe Production Patch Plan

**Sprint:** BRAND-LAUNCH-2A (read-only)  
**Constraint:** Logo **evolves** — same premium stork identity; no unrelated brand replacement.  
**Out of scope:** Splash timing, routing, auth, backend.

---

## Patch goals (mapped to bugs)

| Bug | Target outcome |
|-----|----------------|
| Launcher big/misshapen | RGBA adaptive FG, 66% safe zone, regenerate mipmaps |
| Old logo on open | Native `splashscreen_logo` = Family A (match login) |
| Splash/login/launcher family | One tier-S symbol; surface-specific padding only |
| Logo evolves | Re-export from same premium master; tighter ring/inset |

---

## Recommended patch order

### P0 — Android native splash unify (fixes double-logo flash)

**Why first:** Smallest user-visible win; no JS logic change.

| Step | Action |
|------|--------|
| 1 | Export splash symbol from premium master — **same bird as login**, ~60–70% of artboard, transparent PNG |
| 2 | Generate DPI ladder → replace `frontend/android/app/src/main/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/splashscreen_logo.png` |
| 3 | Confirm `values/colors.xml` `splashscreen_background` stays `#08111F` (matches JS) |
| 4 | Optional: run `npx expo prebuild --platform android` and commit only splash drawables |

**Do not change:** `Theme.App.SplashScreen` parent, `MainActivity.kt`, `_layout.tsx` hideAsync (unless product approves timing experiment).

**Files touched:**

- `frontend/android/app/src/main/res/drawable-*/splashscreen_logo.png` (×5)
- Possibly `frontend/assets/images/` — new export source only if stored for reproducibility (not replacing `leylek-logo-premium.png` without approval)

---

### P0 — Android adaptive launcher foreground (fixes icon scale)

| Step | Action |
|------|--------|
| 1 | Export `adaptive-icon-foreground.png` as **1024×1024 RGBA**, symbol in 660px safe circle, transparent exterior |
| 2 | Keep `backgroundColor: "#08111F"` in `app.json` |
| 3 | `npx expo prebuild --platform android` → refresh all `mipmap-*/ic_launcher_foreground.png`, `ic_launcher.png`, `ic_launcher_round.png` |
| 4 | Commit asset + mipmap outputs |

**Files touched:**

- `frontend/assets/images/adaptive-icon-foreground.png`
- `frontend/android/app/src/main/res/mipmap-*/ic_launcher*.png` (×15+)
- `frontend/app.json` — **only if** background hex or path change (paths likely unchanged)

**Do not use:** `leylek-logo-premium.png` directly as adaptive FG (full-bleed dark square).

---

### P1 — iOS icon parity

| Step | Action |
|------|--------|
| 1 | Re-export `ios.premium.logo.png` with safe padding consistent with Android |
| 2 | EAS iOS build / prebuild — verify App Store icon |

**Files:** `frontend/assets/ios.premium.logo.png`

---

### P1 — JS splash visual harmony (optional, no timing change)

Align **chrome** with login without changing `onFinish` / 2500ms:

| Step | Action |
|------|--------|
| 1 | Reduce JS splash halo excess if native already shows premium symbol — cosmetic only |
| 2 | Match `LOGO_BOX` sizing to feel continuous with login 100×100 (scale math only) |

**Files:** `frontend/components/SplashScreen.tsx` (styles only)  
**Risk:** Low if timing untouched.

---

### P2 — Notification icon silhouette

| Step | Action |
|------|--------|
| 1 | Export monochrome white stork silhouette @ 96×96 for `expo-notifications` |
| 2 | Prebuild `drawable-*/notification_icon.png` |

**Files:** new asset + `app.json` plugin icon path if changed

---

## Pre-patch backup (mandatory)

Copy before any swap:

```
frontend/assets/images/_backup-pre-brand-launch-YYYYMMDD/
  adaptive-icon-foreground.png
  leylek-logo-premium.png   (copy only — do not edit in place without backup)
  ios.premium.logo.png

frontend/android/app/src/main/res/_backup-pre-brand-launch-YYYYMMDD/
  drawable-*/splashscreen_logo.png
  mipmap-*/ic_launcher*
```

Existing repo backups: `_backup-pre-b6-2`, `_backup-pre-appicon-20260621`.

---

## Regeneration commands (production patch sprint)

```bash
cd frontend
npx expo prebuild --platform android
# Review diff: only icon + splash resources expected
```

Use EAS for release APK/AAB — do not assume Metro alone updates native res.

---

## Explicit non-goals

| Area | Reason |
|------|--------|
| `SplashScreen.tsx` `onFinish` / 2500ms timers | User rule — splash timing stable |
| `app/index.tsx` splash gate logic | Boot flow |
| Login auth / API | Unrelated |
| LeylekEye / Zeka assets | Separate sprint |
| Light-theme splash | Brand dark-first OK for launch |

---

## Success criteria

- [ ] Cold start: native flash logo matches premium login bird (no wireframe)
- [ ] Launcher: stork not clipped; reads premium at 48dp
- [ ] Login PNG path unchanged (`leylek-logo-premium.png`)
- [ ] `#08111F` consistent splash/login/adaptive BG
- [ ] Rollback folder restores prior APK icons in <5 min

---

## Key references

| Doc | Purpose |
|-----|---------|
| `02_ICON_SCALE_ANALYSIS.md` | Safe zone math |
| `03_SPLASH_DOUBLE_LOGO_ROOT_CAUSE.md` | Why native ≠ JS |
| `design-lab/brand-dna/v8/app-icon/05_PRODUCTION_SWAP_AUDIT.md` | Adaptive pipeline |
| `design-lab/brand-dna/v4/logo-evolution/full-analysis/SPLASH_LOGO_ANALYSIS.md` | P8 splash retire pin |
