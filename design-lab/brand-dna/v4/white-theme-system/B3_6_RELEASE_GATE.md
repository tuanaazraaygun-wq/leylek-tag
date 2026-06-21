# B3-6 Release Gate

**Sprint:** B3-6 — White theme screen migration rollout gates  
**Date:** 2026-06-21

---

## Gate levels

| Gate | Audience | Flags |
|------|----------|-------|
| G0 | Local dev | Per-developer `.env` |
| G1 | Internal TestFlight | Screen-scoped ON |
| G2 | Beta cohort | Multi-screen ON |
| G3 | Production | Global light ON |
| G4 | Default light | Product decision (post-B3) |

---

## G0 — Dev gate (per patch)

**Before PR merge:**

- [ ] `lightThemeEnabled=false` default in repo
- [ ] Dark screenshot parity flag OFF
- [ ] ESLint/TS pass on touched files
- [ ] No new hardcoded hex in touched files (prefer tokens)
- [ ] Analysis doc updated for patch id

---

## G1 — TestFlight (B3-6a first)

**B3-6a auth only:**

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=true
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=auth
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=false
EXPO_PUBLIC_FEATURE_THEME_CHOICE=false
```

**Criteria:**

- [ ] QA-6a checklist pass
- [ ] No crash login → OTP → role (role may still dark — expected)
- [ ] 48h soak no auth regressions

---

## G2 — Beta expansion

Enable phases sequentially:

```
auth → role → settings → passenger → driver → qr → map
```

**Each addition requires:**

- [ ] Prior phase QA sign-off
- [ ] Risk register item mitigated
- [ ] Rollback tested (flag off)

**Map addition (B3-6g) extra gates:**

- [ ] Light marker PNG in production bundle
- [ ] QA-6g full pass
- [ ] Design sign-off marker visibility

---

## G3 — Production light theme

**All screen groups migrated:**

- [ ] B3-6h cleanup complete
- [ ] PREMIUM_* grep below agreed threshold
- [ ] Full QA-6h E2E
- [ ] `themeSettingsEnabled` ON
- [ ] `themeChoiceEnabled` ON (if product ready)

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=true
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=*
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=true
```

---

## G4 — Future (out of B3-6)

- Default mode light for new users
- Splash themed
- Website parity

---

## Blockers (hard stop)

| Blocker | Blocks gate |
|---------|-------------|
| No light markers | G2 map, G3 |
| Hybrid auth inputs | G1 extension |
| Payment modal unreadable | G2 qr |
| index.tsx conflict unresolved | Any index patch |

---

## Rollback procedure

1. Set `EXPO_PUBLIC_FEATURE_LIGHT_THEME=false` in EAS env
2. OTA or store build per release policy
3. Revert last screen patch if isolated
4. Post-mortem in risk register

**SLA:** Flag OFF effective < 1h for P0 visual/crash

---

## Sign-off matrix

| Phase | Eng | Design | QA | Product |
|-------|-----|--------|-----|---------|
| B3-6a | ☐ | ☐ | ☐ | ☐ |
| B3-6b | ☐ | ☐ | ☐ | — |
| B3-6c | ☐ | ☐ | ☐ | — |
| B3-6d–e | ☐ | ☐ | ☐ | ☐ |
| B3-6f | ☐ | ☐ | ☐ | — |
| B3-6g | ☐ | ☐ | ☐ | ☐ |
| G3 prod | ☐ | ☐ | ☐ | ☐ |

---

## Production untouched (B3-6 analysis)

This document is design-lab only. No production files modified during B3-6 analysis sprint.
