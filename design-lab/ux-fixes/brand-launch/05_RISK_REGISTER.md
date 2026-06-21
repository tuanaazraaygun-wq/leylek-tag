# 05 — Risk Register

**Sprint:** BRAND-LAUNCH-2A (read-only)

---

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | **Prebuild overwrites unrelated native files** | Medium | High | Run prebuild on branch; review diff; scope commit to `res/mipmap-*`, `res/drawable-*`, assets only |
| R2 | **Transparent FG shows wrong on OEM themes** | Low | Medium | Test circle + squircle on Samsung/Pixel; keep `#08111F` BG |
| R3 | **Splash still flashes if hideAsync races** | Low | Low | Native drawable unify fixes visual; timing change is separate decision |
| R4 | **iOS/Android skew remains** | Medium | Medium | Patch both `splashscreen_logo` (Android) and iOS prebuild assets in same release |
| R5 | **Over-shrinking symbol looks timid on splash** | Medium | Low | Splash native icon can be larger % than launcher; separate exports |
| R6 | **Accidental edit to `leylek-logo-premium.png`** | Low | High | Backup copy; evolve via layered export; user rule: no unapproved overwrite |
| R7 | **Notification icon still busy** | High | Low | P2 follow-up; document as known if not in same sprint |
| R8 | **Legacy `ic_launcher.png` out of sync** | Medium | Medium | Always regenerate full mipmap set from prebuild |
| R9 | **Play Store / App Store icon reject** | Low | High | 1024 master QA; no alpha in iOS final if guidelines require |
| R10 | **JS splash feels redundant post-native fix** | Medium | Low | Product may later shorten JS splash — **do not** combine with asset sprint without explicit ask |

---

## Rollback procedure

1. Restore from `_backup-pre-brand-launch-YYYYMMDD/` or existing `_backup-pre-appicon-20260621/`.
2. Replace `drawable-*/splashscreen_logo.png` and `mipmap-*/ic_launcher*` from backup.
3. Restore `adaptive-icon-foreground.png` from backup.
4. Rebuild APK — no JS changes required for icon/splash rollback.

**Files that must exist in rollback bundle:**

- All 5 `splashscreen_logo.png` densities
- All 5 `ic_launcher_foreground.png` densities
- All 5 `ic_launcher.png` + `ic_launcher_round.png`
- `adaptive-icon-foreground.png`
- Optional: `ios.premium.logo.png`

---

## QA matrix (post-patch)

| Case | Platform | Pass |
|------|----------|------|
| Cold start logo family | Android | Native = JS = login |
| Launcher clip | Android 12+ | Beak/leg inside mask |
| Login unchanged path | Both | Still `leylek-logo-premium.png` |
| Splash BG color | Both | `#08111F` |
| Dark theme login | Both | Premium header intact |
| EAS vs local build | CI | Same committed `res/` |

---

## Dependencies

- Design export tooling (Figma/AI SVG → PNG ladder) — outside repo
- EAS build for store validation
- No backend / API / socket dependency

---

## Open questions (product)

1. Should JS splash duration shorten after native unify? (timing change)
2. Single 1024 master for icon + splash center, or two padded exports?
3. Light-theme splash for future LHS release?

---

**BRAND-LAUNCH-2A ANALYSIS COMPLETE — Production untouched.**
