# RC-BRAND-V11 QA Report

Generated: 2026-06-24T16:49:43.780004+00:00

## Spec applied
- Ring R6 scale: 0.94
- Glow: 0.5 (50%)
- Metal boost: 1.1
- Sharpen: True

## Automated checks
- G-GEO-01 bird IoU: **0.9940** (PASS ≥ 0.98)
- G-GEO-01 bird IoU: **0.9940** (PASS ≥ 0.98)
- Export 24px: generated OK
- Export 32px: generated OK
- Export 48px: generated OK
- Export 1024px: generated OK
- G-MAT-01 glow 50%: applied (Preview B)
- G-MAT-03 SVG: no blur filters in LC-2/LC-3 exports
- Family B wireframe splash: **replaced** with Family A V2
- adaptive-icon-foreground: **replaced** with transparent V2
- G-CON-01 Family A unified: splash + adaptive + premium master
- Export ladder: Hero 1254–128 + Micro 96–24 generated in lab
- Variants: dark, light, transparent, mono white/black in lab/variants

## Production files updated
- `frontend/assets/images/leylek-logo-premium.png`
- `frontend/assets/images/adaptive-icon-foreground.png`
- `frontend/assets/ios.premium.logo.png`
- `frontend/android/app/src/main/res/drawable-*/splashscreen_logo.png` (×5)
- `frontend/android/app/src/main/res/mipmap-*/ic_launcher_foreground.png` (×5)
- `website/public/store/leylek-logo-premium.png`

## Backup
- `design-lab\brand-dna\v10\_backup-pre-v11\leylek-logo-premium-v1-20260624.png`

## Obsolete removed
- (already removed on prior run)

## Legacy assets NOT in scope (report only)
- website_files/*.html → `leylek-logo.png` (legacy static — NOT updated)
- website/public/logo-leylek.svg (pin family SVG — NOT updated)
- frontend/assets/images/favicon.png (orphan — NOT updated)
- frontend/assets/images/splash-icon.png (orphan — NOT updated)
- frontend/assets/images/adaptive-icon.png (orphan — NOT updated)

## QA checklist (automated / structural)
| Check | Status |
|-------|--------|
| Bird IoU ≥ 0.98 | PASS (0.9940) |
| R6 ring + glow 50% | PASS |
| Retina 1254 hero | PASS |
| 1024 iOS / adaptive | PASS |
| 24–1024 export ladder | PASS |
| Android splash ×5 | PASS |
| Android mipmap FG ×5 | PASS |
| Android legacy launcher ×10 | PASS |
| White theme asset (light variant) | Lab only (`symbol-light-1024.png`) |
| Black background | PASS (`#08111F`) |
| Transparent adaptive FG | PASS |
| No UI/code changes | PASS (filenames unchanged) |
| Human panel G-HUMAN-01 | **Manual** |
| Device OEM mask clip | **Manual** |
