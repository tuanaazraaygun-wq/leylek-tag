# 08 — Production-Safe Asset Plan

**Sprint:** BRAND-LOGO-EVO-1B  
**Mode:** Analysis only — **no production writes in 1B**  
**Date:** 2026-06-21  
**Principle:** Lab first → golden test → gated swap → surface-by-surface verify

---

## Golden rule

```
design-lab export  →  QA gate  →  frontend/assets  →  app.json / native  →  store
     (v8)              (09)         (1C only)           (1C/1D)            (1D)
```

**1B stops before first arrow.** Production paths listed for traceability only.

---

## Production asset map (read-only inventory)

### Primary master

| Path | Role | Ring refine? |
|------|------|--------------|
| `frontend/assets/images/leylek-logo-premium.png` | SSOT raster — splash config, Expo icon, notification, login, Zeka | **Yes — target** |
| `frontend/assets/images/_backup-pre-b6-2/leylek-logo-premium.png` | Pre-B6-2 backup | **No — read-only archive** |

### Platform derivatives (separate files)

| Path | `app.json` / consumer | Aile | Ring refine sync |
|------|----------------------|------|------------------|
| `frontend/assets/ios.premium.logo.png` | `expo.ios.icon` | A | Re-export from new master @1024 |
| `frontend/assets/images/adaptive-icon-foreground.png` | `android.adaptiveIcon.foregroundImage` | **B wireframe** | **Not auto** — unify sprint |
| `frontend/assets/images/favicon.png` | `expo.web.favicon` | B | Out of 1B scope |
| `frontend/assets/images/adaptive-icon.png` | Orphan | — | No touch |
| `frontend/assets/images/icon.png` | Orphan | — | No touch |
| `website/public/store/leylek-logo-premium.png` | Store / marketing copy | A? | Sync after master gate |
| `frontend/android/.../splashscreen_logo.png` ×5 | Native Android splash | **B pin** | **Separate unify** — not ring refine |
| `frontend/android/.../mipmap-*/ic_launcher*.png` | Native launcher | Mixed | Regenerate from tier-S post-unify |

### `app.json` references (no change in 1B)

```json
"icon": "./assets/images/leylek-logo-premium.png"
"ios.icon": "./assets/ios.premium.logo.png"
"android.adaptiveIcon.foregroundImage": "./assets/images/adaptive-icon-foreground.png"
"splash.image": "./assets/images/leylek-logo-premium.png"
"plugins.expo-notifications.icon": "./assets/images/leylek-logo-premium.png"
```

---

## Code consumers (PNG require — no asset edit in 1B)

| Component | Path | Usage |
|-----------|------|-------|
| Splash (JS) | `frontend/components/SplashScreen.tsx` | `require('../assets/images/leylek-logo-premium.png')` + **extra halo anim** |
| Login | `frontend/components/auth/LoginBrandHeader.tsx` | 100×100 contain |
| Theme | `frontend/components/theme/ThemeChoiceScreen.tsx` | Center logo |
| Zeka | `frontend/components/LeylekZekaChat.tsx` | Header |
| Generic | `frontend/components/Logo.tsx` | 50/100/150 tiers |

**1B:** Kod değişikliği yok. **1C+:** Yalnızca asset swap; Splash halo scale optional follow-up.

---

## Phased rollout (production-safe)

### Phase 0 — 1B (this sprint) ✅

- [x] Direction doc (`06_RING_REFINEMENT_DIRECTION.md`)
- [x] Test plan (`07_RING_SIZE_TEST_PLAN.md`)
- [x] Safe asset plan (this doc)
- [ ] Lab exports in `v8/logo-evolution/lab-exports/` — **1C prep**

### Phase 1 — Lab export (1C-pre)

| Step | Action | Production touch |
|------|--------|------------------|
| 1 | Export R6-G2 @512, 1024, 168, 48 | **None** |
| 2 | Golden test: kuş IoU, side-by-side | **None** |
| 3 | Product + brand sign-off | **None** |
| 4 | Copy winner → `lab-exports/FINAL-ring-refine-master-512.png` | **None** |

### Phase 2 — Master swap (1C — gated)

**Preconditions:**

- Golden test pass (`G-01` IoU ≥98%)
- Blind review V-05 ≥4/5
- Backup verified: `_backup-pre-b6-2/` intact

**Swap sequence (atomic commit):**

1. Copy current → `frontend/assets/images/_backup-pre-ring-refine-YYYYMMDD/leylek-logo-premium.png`
2. Replace `frontend/assets/images/leylek-logo-premium.png` with signed lab export
3. Regenerate `frontend/assets/ios.premium.logo.png` @1024 from same master
4. **Do not** touch `adaptive-icon-foreground.png` in same commit (different scope)
5. Single commit message: `brand(logo): refine orbital ring scale and reduce glow`

**Rollback:** Restore from `_backup-pre-ring-refine-*` or `_backup-pre-b6-2/`

### Phase 3 — Surface verify (1C QA)

| Surface | Verify | Auto-updated by master? |
|---------|--------|-------------------------|
| JS Splash | Visual @168; no double-glow | ✅ same require path |
| Native splash (iOS) | Expo prebuild asset | ✅ if prebuild refresh |
| Native splash (Android pin) | Still B family | ❌ **manual unify later** |
| Login | 100×100 | ✅ |
| Expo APK icon | Rebuild EAS | ✅ |
| iOS App Store icon | `ios.premium.logo.png` regen | ✅ if step 3 done |
| Android adaptive | Wireframe FG | ❌ until unify |
| Notification icon | Mono 24 px test | ✅ with glow fix |
| Leylek Zeka | Header | ✅ |

### Phase 4 — Platform unify (1D — separate sprint)

Required for full consistency (out of ring-only scope):

- Replace `adaptive-icon-foreground.png` with tier-S from refined master
- Replace Android `splashscreen_logo.png` ×5 (pin → kuş A)
- Sync `website/public/store/leylek-logo-premium.png`
- Regenerate mipmap ladder

---

## What 1B explicitly does NOT do

| Forbidden in 1B | Reason |
|-----------------|--------|
| Overwrite `leylek-logo-premium.png` | Analysis-only sprint |
| Change `app.json` icon/splash paths | Production config |
| Edit splash/login PNG in repo | User rule |
| Modify `SplashScreen.tsx` halo code | Timing/UI scope |
| Touch Android/iOS native drawables | Prebuild / unify sprint |
| Backend / socket / QR / payment | Out of scope |
| Change leylek silhouette vectors | Ring-only amendment |

---

## Risk controls

| Risk | Mitigation |
|------|------------|
| Accidental master overwrite | Lab exports only under `design-lab/` until gate |
| iOS/Android icon drift persists | Document in QA; adaptive unify = 1D |
| Double glow (PNG + Splash anim) | S-04 composite test; optional halo scale 1C+ |
| Small-size blob @24 px | G2/G3 glow reduction + I-04 gate |
| Constitution “never replace master” conflict | Amendment record in `06`; council sign-off |
| git add . sweeps design-lab + unrelated | **Stage only** `frontend/assets/images/leylek-logo-premium.png` + ios derivative on ship |

---

## Commit staging guide (future 1C)

```bash
# CORRECT — targeted
git add frontend/assets/images/leylek-logo-premium.png
git add frontend/assets/ios.premium.logo.png

# WRONG — do not use
git add .
git add design-lab/
```

---

## Sign-off checklist (before any production swap)

- [ ] R6-G2 lab PNG approved by product
- [ ] Kuş silhouette IoU ≥98%
- [ ] I-01, I-03, S-01, S-03 pass
- [ ] Backup folder created with date stamp
- [ ] Rollback command documented in PR
- [ ] Android adaptive drift acknowledged in release notes
- [ ] No splash timing (`onFinish`) code changes in same PR

---

## Summary

| Question | Answer |
|----------|--------|
| Production touched in 1B? | **No** |
| First production file to change (1C)? | `leylek-logo-premium.png` |
| App icon auto-fixed? | Partial — Expo/iOS yes; Android adaptive **no** |
| Splash/login safe? | Master swap updates both; JS halo may need tune |
| Leylek changed? | **No** — ring layer only |
