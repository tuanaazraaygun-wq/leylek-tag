# WHITE-RELEASE-QA-2A — Device Findings Master

**Sprint:** WHITE-RELEASE-QA-2A  
**Mode:** Read-only analysis  
**Branch:** `working-final` (production untouched)  
**Date:** 2026-06-21

---

## Git status (start)

```
On branch working-final
Your branch is up to date with 'origin/working-final'.
Untracked: design-lab/ux-fixes/white-final/
```

No production files modified during this sprint.

---

## Findings summary

| # | Area | User report | Root cause (analysis) | Severity | Patch type |
|---|------|-------------|------------------------|----------|------------|
| 1 | Match card | Sürücülerim görünmüyor / küçük / kaymış | Solo secondary at **48% width**; empty guardian slot; light contrast; 8px driver CTA pill | P1 | Style/layout |
| 2 | Quick Match request | Rota kartı büyük; CTA altta | ScrollView stack, no sticky footer; 2-line addresses; dark contribution card on light | P1 | Layout + theme |
| 3 | Driver cockpit White | Yazılar belirsiz; Teklif bekleniyor / field intel bar okunmuyor | Hardcoded dark HUD styles; incomplete `osLt` coverage | P1 | Theme tokens |
| 4 | Leylek Zeka eye | Göz tutarsız; chat/kontrol merkezi zayıf | PNG vs SVG split; `LeylekEyeTrigger` always dark; chat shell partial light | P1 | Component unify |
| 5 | Map loading | Teklif sonrası harita geç/boş | 3s transition + 2.8s overlay stack; cold MapView remount; QM `loadActiveTag` gap | P0–P1 | Perf/UX |
| 6 | Navigation arrow | Ok belirsiz; White’da görünür olmalı | Fixed cyan neon; no `isScopeLight` branch; 60px pointer | P2 | Visual-only |

---

## Scope boundaries (unchanged)

- Backend / socket / payment / QR logic — **out of scope**
- Route polyline / camera / GPS / bearing / TTS — **out of scope** for items 1–4; item 6 is **overlay-only**
- Marker PNG assets — **out of scope** (WHITE-FINAL-1C already shipped scale/chrome)
- Yerime Al (proxy) — **stays hidden** (`RENDER_PROXY_MATCH_CARD = false`)

---

## Cross-cutting themes

1. **Light theme is partial** — shell surfaces tokenized; inner HUD blocks (field intel, chat list, QM contribution) still use dark `PREMIUM_*` baselines.
2. **Layout not responsive** — match deck and QM modal lack compact breakpoints used elsewhere (`PassengerMatchModeCards` has them; QM does not).
3. **Intentional delays stack** — match transition overlay + map loading overlay can sum to ~5.8s perceived blank.
4. **Visual identity split** — `LeylekEye` SVG vs `leylek-zeka-eye.png` on three high-traffic surfaces.

---

## Deliverables index

| Doc | Topic |
|-----|-------|
| [02_MATCH_CARD_VISIBILITY.md](./02_MATCH_CARD_VISIBILITY.md) | Finding #1 |
| [03_QUICK_MATCH_RESPONSIVE_PLAN.md](./03_QUICK_MATCH_RESPONSIVE_PLAN.md) | Finding #2 |
| [04_DRIVER_COCKPIT_WHITE_PLAN.md](./04_DRIVER_COCKPIT_WHITE_PLAN.md) | Finding #3 |
| [05_LEYLEK_ZEKA_SINGLE_EYE_PLAN.md](./05_LEYLEK_ZEKA_SINGLE_EYE_PLAN.md) | Finding #4 |
| [06_MAP_LOADING_ANALYSIS.md](./06_MAP_LOADING_ANALYSIS.md) | Finding #5 |
| [07_NAVIGATION_ARROW_PREMIUM_PLAN.md](./07_NAVIGATION_ARROW_PREMIUM_PLAN.md) | Finding #6 |
| [08_PATCH_ORDER.md](./08_PATCH_ORDER.md) | Recommended sprint sequence |
| [09_RISK_REGISTER.md](./09_RISK_REGISTER.md) | Risks and regression gates |

---

## APK QA matrix (post-patch)

| Scenario | Light | Dark | Devices |
|----------|-------|------|---------|
| Passenger match — Sürücülerim visible, symmetric | ✓ | ✓ | 360×640, 390×844, 430×932 |
| Driver in passenger mode — Yolcularım + panel CTA | ✓ | ✓ | Same |
| Yerime Al absent | ✓ | ✓ | Same |
| QM request — CTA visible without excessive scroll | ✓ | ✓ | SE + Pro Max |
| Driver idle cockpit — Teklif bekleniyor readable | ✓ | ✓ | Same |
| Field intelligence bar — metrics readable | ✓ | ✓ | Collapsed + expanded |
| Leylek eye — header/FAB/chat match | ✓ | ✓ | Driver + passenger |
| Map after accept — tiles within 3s target | ✓ | ✓ | Android mid-range |
| Nav arrow — visible on light map tiles | ✓ | ✓ | Driver nav immersive |
