# White Theme Risk Register

**Sprint:** B-3  
**Date:** 2026-06-21

---

| ID | Risk | Sev | Likelihood | Impact | Mitigation |
|----|------|-----|------------|--------|------------|
| R-W01 | Mevcut kullanıcı teması bozulur | P0 | Med | High | Default dark; B3-2 zero UI change until flags |
| R-W02 | App açılış flicker | P1 | Med | Med | Hydrate gate + resolved cache + 120ms timeout |
| R-W03 | AsyncStorage hydrate gecikmesi | P1 | Med | Med | Sync read resolved cache; optional MMKV later |
| R-W04 | Login flow bozulur | P1 | Low | High | Theme choice after auth only; feature flag off default |
| R-W05 | Legal consent flow bozulur | P0 | Low | High | Theme after legal; no legal copy on theme screen |
| R-W06 | Role select / map UI bozulur | P1 | Med | High | B3-6 gradual migration; primitives first |
| R-W07 | Dark theme regressions | P1 | Med | High | Dark token alias = existing PREMIUM_* exact match |
| R-W08 | iOS/Android StatusBar farkı | P2 | Med | Low | Central StatusBar effect in ThemeProvider |
| R-W09 | Düşük kontrast white mode | P1 | Med | High | WCAG matrix in QA; token spec min ratios |
| R-W10 | index.tsx inline colors unmigrated | P2 | High | Med | Screen-by-screen checklist; accept hybrid interim |
| R-W11 | Map readability light tiles | P1 | Med | Med | Map overlay tokens; marker evolution light exports |
| R-W12 | Role illustrations dark-only | P2 | Med | Low | Overlay dim 12% or light asset B3-6 |
| R-W13 | Logo low contrast on white | P2 | Med | Med | Logo evolution light variant dependency |
| R-W14 | Theme choice fatigue | P3 | Low | Low | One-time; smart default; single CTA |
| R-W15 | Multi-device sync conflict | P3 | Low | Low | Defer backend to B3-5; local authoritative |
| R-W16 | System theme oscillation | P2 | Low | Med | Debounce Appearance listener 100ms |
| R-W17 | Splash always dark + app light jarring | P2 | Med | Low | Accept phase 1; optional light splash B3+ |
| R-W18 | LeylekEye / Zeka orb contrast | P2 | Med | Med | Component spec socket shade bump |
| R-W19 | QR camera modal mixed theme | P2 | Low | Low | Viewfinder stays dark; chrome themed |
| R-W20 | Feature flag mis-config prod | P1 | Low | High | Explicit env defaults false; release gate |

---

## Risk heat map

```
Impact ↑
High   | R-W01 R-W05 R-W07 R-W09
       | R-W04 R-W06 R-W11
Med    | R-W02 R-W03 R-W08 R-W10
Low    | R-W14 R-W17
       └────────────────→ Likelihood
```

---

## P0 gate (release blockers)

- [ ] R-W01 verified — existing users see identical dark UI pre-flag
- [ ] R-W05 legal ordering tested
- [ ] R-W07 dark snapshot visual diff pass

---

**Sonraki:** `WHITE_THEME_QA_PLAN.md`, `WHITE_THEME_PATCH_PLAN.md`
