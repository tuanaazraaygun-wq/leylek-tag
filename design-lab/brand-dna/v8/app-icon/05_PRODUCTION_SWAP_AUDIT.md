# BRAND-APPICON-1C — Production Swap Readiness Audit

**Sprint:** BRAND-APPICON-1C-AUDIT  
**Mode:** Read-only analysis  
**Date:** 2026-06-21  
**Candidate:** `design-lab/brand-dna/v8/app-icon/candidates/candidate-r6.png`  
**Production:** Untouched

---

## Executive verdict

| Question | Answer |
|----------|--------|
| **Can candidate-r6 replace the APK wireframe icon safely?** | **Yes — gated.** Visual master is approved for Family A parity with login. |
| **Can candidate-r6 be copied as-is to production?** | **No.** Lab file is **1024×1024 RGB** with `#08111F` baked in. Android adaptive FG needs a **transparent RGBA** export. |
| **Is backend / app logic involved?** | **No.** Asset + native res swap only. |
| **Ship blocker before 1C execute?** | Transparent FG export + mipmap regen + iOS parity file + backup + APK QA. |

**Recommendation:** Proceed to **BRAND-APPICON-1C-EXECUTE** after one lab export step (FG alpha) and product sign-off on 48 px legibility previews (`candidates/48px-preview.png`).

---

## Visual comparison (observed)

| Asset | Family | Stork | Ring | Background |
|-------|--------|-------|------|------------|
| `leylek-logo-premium.png` (login) | **A** | 3D metal premium | Full glow arc | Black in PNG |
| `candidate-r6.png` (lab) | **A′** | Same silhouette | R6 −6%, glow −50% | `#08111F` baked |
| `adaptive-icon-foreground.png` (APK) | **B** | Wireframe white stick | Thin teal U-stroke | Pure `#000000` baked |
| `ios.premium.logo.png` (iOS) | **B** | Wireframe (flat export) | Teal arc | Dark baked |

candidate-r6 closes the **Family A vs B** gap reported in APPICON-1A. Ring is intentionally tighter than login (launcher-safe per R6 spec).

---

## 1. Android launcher icon — full production pipeline

### Config entry (prebuild input)

```json
// frontend/app.json
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon-foreground.png",
    "backgroundColor": "#08111F"
  }
}
```

`expo.icon` → `leylek-logo-premium.png` is **not** used for Android home screen when `adaptiveIcon` is set.

### Native runtime chain (API 26+)

```
AndroidManifest.xml
  android:icon="@mipmap/ic_launcher"
  android:roundIcon="@mipmap/ic_launcher_round"
        │
        ▼
mipmap-anydpi-v26/ic_launcher.xml (+ ic_launcher_round.xml)
  <background android:drawable="@color/iconBackground"/>      → #08111F
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
        │
        ▼
mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher_foreground.png
mipmap-*/ic_launcher.png          (legacy / pre-26 fallback)
mipmap-*/ic_launcher_round.png    (round launcher)
```

### Supporting color resource

```xml
<!-- frontend/android/app/src/main/res/values/colors.xml -->
<color name="iconBackground">#08111F</color>
```

### Build path (EAS)

`frontend/eas.json` profiles (`simple`, `preview`, `production`) → standard Expo prebuild + Gradle. **No EAS env icon override.** Committed `android/app/src/main/res/mipmap-*` is what ships unless prebuild regenerates them.

### What does NOT drive launcher icon

| Source | Role |
|--------|------|
| `leylek-logo-premium.png` | Login, JS splash, notifications — not launcher FG |
| `expo.splash.image` | Expo splash config — not launcher |
| `drawable-*/splashscreen_logo.png` | Native splash only |

---

## 2. candidate-r6 → production export targets

| Production file | Export from R6 | Spec |
|-----------------|----------------|------|
| **`frontend/assets/images/adaptive-icon-foreground.png`** | **New lab export required** | 1024×1024 **RGBA**, symbol only, **transparent** outside safe zone; no `#08111F` in FG layer |
| **`frontend/assets/ios.premium.logo.png`** | candidate-r6 (or identical 1024 export) | 1024×1024 **RGB** full bleed, `#08111F` background OK |
| **`mipmap-*/ic_launcher_foreground.png`** ×5 | Regenerated from new adaptive FG | mdpi 108 → xxxhdpi 432 px |
| **`mipmap-*/ic_launcher.png`** ×5 | Regenerated | Legacy launcher raster |
| **`mipmap-*/ic_launcher_round.png`** ×5 | Regenerated | Round icon raster |

**Do not overwrite in minimal icon swap (unless separate sprint):**

| File | Reason |
|------|--------|
| `leylek-logo-premium.png` | Login SSOT — R6 is icon-optimized derivative, not login replacement |
| `drawable-*/splashscreen_logo.png` | Still Family B wireframe — SPLASH-UNIFY follow-up |
| `favicon.png` | Web Family B — separate |
| `app.json` paths | Can stay unchanged if filenames unchanged |

---

## 3. Adaptive icon foreground / background spec

### Background layer

- **Keep** `app.json` `backgroundColor: "#08111F"`
- **Keep** `colors.xml` `iconBackground` `#08111F` (already aligned with R6 lab token)
- No change required unless brand chooses `#0B1220` alternate (optional QA)

### Foreground layer (correct composition)

```
┌────────────── 1024 px ──────────────┐
│  transparent margin (mask safe)      │
│     ╭── premium stork + R6 arc ──╮   │  ← ~66% diameter safe zone
│     │  (alpha PNG, no flat black)  │   │
│     ╰──────────────────────────────╯   │
└──────────────────────────────────────┘
        +
Background: solid #08111F (app.json / colors.xml)
```

**Current production FG mistake:** Wireframe PNG bakes **pure black** into FG while BG is `#08111F` — subtle halo on OEM masks.

**candidate-r6 lab mistake for direct copy:** Full-bleed RGB — would **double-paint** background if pasted into FG slot without alpha separation.

**1C execute fix:** Extend `generate_candidates.py` (or one-off export) to emit `adaptive-icon-foreground-r6.png` as RGBA centered symbol @1024 without background fill.

---

## 4. Native mipmap regenerate — required?

**Yes.** Repo commits native mipmaps under `frontend/android/app/src/main/res/mipmap-*`. EAS `assembleRelease` uses committed files.

| Option | When |
|--------|------|
| **`npx expo prebuild --platform android`** (from `frontend/`) | Recommended — regenerates all launcher + splash drawables from `app.json` |
| Manual 5-DPI ladder copy | Fallback if prebuild diff too noisy — higher error risk |

**Regenerate set after FG swap:**

- `ic_launcher_foreground.png` (all densities)
- `ic_launcher.png`
- `ic_launcher_round.png`

**Keep unchanged (unless prebuild overwrites — review diff):**

- `mipmap-anydpi-v26/ic_launcher.xml`
- `mipmap-anydpi-v26/ic_launcher_round.xml`

---

## 5. iOS — change at same time?

**Yes — same sprint strongly recommended.**

| Config | File |
|--------|------|
| `app.json` → `ios.icon` | `./assets/ios.premium.logo.png` |

Current iOS asset is **Family B wireframe** (same wrong family as Android). AC-08 requires platform parity.

**Export:** Use candidate-r6 full-bleed 1024 RGB → replace `frontend/assets/ios.premium.logo.png`.

iOS does not use Android mipmaps; single asset swap + iOS rebuild/TestFlight.

---

## 6. Splash / login impact

| Surface | Asset today | Affected by icon swap? |
|---------|-------------|------------------------|
| **Login** (`LoginBrandHeader.tsx`) | `leylek-logo-premium.png` | **No** (unless login master updated separately) |
| **JS Splash** (`SplashScreen.tsx`) | `leylek-logo-premium.png` | **No** |
| **expo.splash** (`app.json`) | `leylek-logo-premium.png` | **No** |
| **Native Android splash** | `drawable-*/splashscreen_logo.png` (wireframe B) | **No** in minimal 1C — user may still see wireframe on cold start until SPLASH-UNIFY |
| **Notifications** | `leylek-logo-premium.png` | **No** — tray icon stays Family A |

**User expectation:** Launcher matches login family; native splash may still differ until follow-up PR.

---

## 7. Rollback files

See `07_ROLLBACK_PLAN.md`. Minimum backup before swap:

- `adaptive-icon-foreground.png`
- `ios.premium.logo.png`
- Full `mipmap-*/ic_launcher*` snapshot

Existing archives: `_backup-pre-b6-3/` under assets and android res (wireframe era).

---

## 8. Minimal patch file list (1C execute)

| Priority | Path |
|----------|------|
| P0 | `frontend/assets/images/adaptive-icon-foreground.png` (new RGBA export) |
| P0 | `frontend/assets/ios.premium.logo.png` |
| P0 | `frontend/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` |
| P0 | `frontend/android/app/src/main/res/mipmap-*/ic_launcher.png` |
| P0 | `frontend/android/app/src/main/res/mipmap-*/ic_launcher_round.png` |
| P1 | `frontend/assets/images/_backup-pre-appicon-YYYYMMDD/` (backup copies) |
| P2 | `frontend/app.json` — **optional** (paths unchanged; BG already `#08111F`) |
| P2 | `frontend/android/.../values/colors.xml` — **optional** sync only |

**No TS/TSX changes required** for launcher fix.

---

## 9. APK verification checklist

| # | Test | Pass |
|---|------|------|
| 1 | Fresh install `eas build --profile preview` (or `simple` APK) | New icon on home screen |
| 2 | Side-by-side: login logo vs launcher | Same premium stork family (not wireframe) |
| 3 | 48 px visual | Stork + arc readable; no gray blob (use lab `48px-preview.png` as reference) |
| 4 | Pixel circle mask | No beak/wing clip |
| 5 | Samsung squircle (if available) | No clip |
| 6 | App drawer vs home | Same icon |
| 7 | Long-press app info | System icon matches |
| 8 | iOS home (TestFlight) | Matches Android symbol (AC-08) |
| 9 | Notification shade | Still premium bird (unchanged asset) — sanity check |
| 10 | Cold start native splash | May still show wireframe — document as known |

**Screenshot evidence for PR:** Login @100px + launcher + 48px crop.

---

## Readiness gates

| Gate | Status |
|------|--------|
| Visual master (R6) approved | ✅ Lab candidate matches login family |
| Transparent FG export exists | ❌ **Blocker** — script outputs RGB only |
| Product sign-off | Pending |
| Backup plan documented | ✅ `07_ROLLBACK_PLAN.md` |
| Acceptance criteria | ✅ `04_ACCEPTANCE_CRITERIA.md` |
| Native mipmap regen plan | ✅ prebuild documented |

---

## Related docs

- `01_APP_ICON_INVENTORY.md` — root cause
- `03_SAFE_APP_ICON_PLAN.md` — phased swap
- `04_ACCEPTANCE_CRITERIA.md` — QA matrix
- `06_EXPORT_FILE_MAP.md` — file-by-file map
- `candidates/README.md` — R6 parameters

**BRAND-APPICON-1C AUDIT COMPLETE — Production untouched.**
