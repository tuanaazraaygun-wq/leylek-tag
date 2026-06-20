# Phase 5 Migration Handoff

**From:** Phase 4 `design-lab/brand-dna/v4/exports/`  
**To:** Production wiring (separate approved PRs)  
**Ship:** F1 Meridian Wing — F1 pure for icon, favicon, watch, QR

---

## 1. Source of truth

```
design-lab/brand-dna/v4/exports/
  f1-meridian-wing-master.svg
  svg/f1-meridian-wing-master.svg
  svg/f1-meridian-wing-icon-1024.svg
  png/f1/1024.png
  EXPORT_MANIFEST.json
```

**Do not** copy from `logo-leylek.svg` or `leylek-logo-premium.png`.

---

## 2. PR sequence (recommended)

| PR | Target | Source export | Risk |
|----|--------|---------------|------|
| P5-L0 | Stakeholder sign-off + blind test | QA_REPORT | Low |
| P5-L1 | Website favicon + navbar | `favicon-32.png`, `128.png` | Low |
| P5-L2 | `Logo.tsx` + onboarding | `svg/master` or `256.png` | Med |
| P5-L3 | Boot Lottie + sonic sync | `lottie/f1-boot-presence.json` | Med |
| P5-L4 | Splash + app icon | `1024.png`, android adaptive | High |
| P5-L5 | QR overlay asset | `qr-hc-256.png` | Low |
| P5-L6 | Marker ring shared Lottie | `f1-lock-ring.json` | Med |

---

## 3. Production path mapping (when approved)

| Production path | Export source |
|-----------------|---------------|
| `frontend/assets/images/icon.png` | `png/f1/1024.png` |
| `frontend/assets/images/adaptive-icon.png` | `png/f1/android-adaptive-foreground-432.png` |
| `frontend/assets/images/adaptive-icon-foreground.png` | same |
| `frontend/assets/images/leylek-logo-premium.png` | `png/f1/256.png` or SVG component |
| `website/public/logo-leylek.svg` | `svg/f1-meridian-wing-master.svg` |
| Android `splashscreen_logo.png` | `png/f1/256.png` |
| Favicon | `png/f1/favicon/` |

**Not in Phase 5 without explicit approval:** mass replace all drawable DPI folders.

---

## 4. F1 pure surfaces (mandatory)

- App icon iOS/Android
- Favicon 16/32/48
- Watch complication source
- QR verified overlay
- Widget small/medium

## 5. F2 optional (marketing only)

- Website hero >=128px: optional `f2-horizon-stork-marketing` — **not produced in Phase 4**
- If kör test fails leylek story: produce F2 marketing SVG in Phase 5a before hero swap

## 6. F3 reference only

- Lock ring timing 320ms in `lottie/f1-lock-ring.json`
- Geometry remains F1

---

## 7. Feature flags (recommended)

```text
brandLogoV4Enabled: false (default until P5-L4)
brandBootLottieV4: false
```

Rollback: revert PR + flags off; legacy PNG remains in git history.

---

## 8. QA before each PR

- [ ] `EXPORT_MANIFEST.json` paths match copied files
- [ ] Cyan hex `#00D4AA` on accent pixel sample
- [ ] 29px settings icon test (iOS)
- [ ] Android adaptive safe zone
- [ ] Silent mode boot (motion only)
- [ ] QR lock frame sync ±16ms

---

## 9. Communications

- User message: "Logo yenilendi" — not full rebrand announcement
- Ops: gradual app icon after splash QA

---

## 10. Phase 4 artifacts inventory

See `EXPORT_MANIFEST.json` and `QA_REPORT.md`.

**Commit:** When user requests — scope `design-lab/brand-dna/v4/exports/**` only.

---

**Non-goals:** This handoff does not modify production code.
