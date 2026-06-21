# V7.1 — Asset Production Inventory

**Mode:** Read-only · planned outputs for V7.1b–V7.4  
**Rule:** Nothing in this list is produced during V7.1 analysis

---

## ALPHA — Brand / Logo

| Asset ID | Description | Source | Tiers | Production path (future) |
|----------|-------------|--------|-------|--------------------------|
| A-01 | Symbol master v2 SVG | LC-2 | 512 vb | design-lab → production/svg |
| A-02 | Symbol small SVG | LC-3 | micro | design-lab/svg |
| A-03 | Premium PNG hero | LC-2 export | 1254 | frontend/assets/images/ |
| A-04 | Premium PNG UI | LC-2 | 512 | frontend/assets/images/ |
| A-05 | App icon SVG | LC-2 | 1024 | brand-identity-production/app-icons/ |
| A-06 | Adaptive foreground SVG | LC-2 | 432 | brand-identity-production/app-icons/ |
| A-07 | App icon PNG | export | 1024 | frontend/assets/images/ |
| A-08 | Adaptive foreground PNG | export | 432, 1024 | frontend/assets/images/ |
| A-09 | Favicon PNG | LC-3 | 16, 32 | frontend/assets/images/ |
| A-10 | Notification icon PNG | LC-3 eye+arc | 24, 48 | drawable / assets |
| A-11 | iOS premium logo PNG | LC-2 | 1024 | frontend/assets/ios.premium.logo.png |
| A-12 | Splash SVG artboard | LC-2 + SP-10 | 1920×1080 | splash/ |
| A-13 | Android splash ×5 DPI | export | mdpi–xxxhdpi | android/res/ |
| A-14 | Symbol dark/white SVG | LC-2 variants | 512 | svg/ |
| A-15 | Wordmark lockup | separate | — | website (if scoped) |

---

## BRAVO — Map / Markers

| Asset ID | Description | Source | Production path (future) |
|----------|-------------|--------|--------------------------|
| B-01…12 | Marker SVG ×12 types | MEX-M / B5.5 MC | design-lab/markers/svg |
| B-13…24 | Marker PNG @48 | export | frontend/assets/markers/ |
| B-25 | QM lock ring Lottie | V6 spec | assets/lottie/ |
| B-26 | Searching pulse Lottie | MK-19 | assets/lottie/ |
| B-27 | Route line style spec | MEX nav | code tokens only |

---

## CHARLIE — Triad

| Asset ID | Description | Production path (future) |
|----------|-------------|--------------------------|
| C-01 | sonic.trust.link WAV | frontend/assets/sounds/ |
| C-02 | Offer sonic polish | replace driver-offer-classic.wav |
| C-03 | Boot sonic align | leylektag-luxury-tone.wav review |
| C-04 | Splash Lottie presence.pulse | optional native |
| C-05 | Motion token lint config | frontend/eslint or CI |

---

## DELTA — Zeka / Ecosystem

| Asset ID | Description | Production path (future) |
|----------|-------------|--------------------------|
| D-01 | Zeka eye SVG v2 | 5 states |
| D-02 | Zeka eye PNG | 28, 64, 128 |
| D-03 | Watermark mono SVG | stroke-only |
| D-04 | Watermark PNG | 512 @ export |
| D-05 | Widget preview assets | store only |
| D-06 | Website header mark | website/public/ |
| D-07 | Store screenshots | marketing |

---

## ECHO — QA artifacts (not user-facing assets)

| Asset ID | Description |
|----------|-------------|
| E-01 | IoU report JSON |
| E-02 | Human panel scorecard PDF |
| E-03 | z16/z18/z20 video suite |
| E-04 | App Store grid blind test raw |
| E-05 | OEM mask matrix captures |

---

## Priority summary

| Priority | Count | Team |
|----------|-------|------|
| P0 — block store | ~25 | Alpha |
| P1 — map identity | ~15 | Bravo |
| P2 — triad + zeka | ~15 | Charlie + Delta |
| QA | ~5 | Echo |

**Total planned:** ~60 production assets + ~5 QA artifacts

---

## Not in scope (explicit)

- Backend email template images  
- Muhabbet legacy `leylek-blue.png` / `leylek-header.png` (separate cleanup)  
- LSX white theme UI (flags OFF)  
- New logo concepts beyond LC-2/LC-3  
