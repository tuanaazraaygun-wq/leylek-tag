# White Theme QA Plan

**Sprint:** B-3  
**Execution:** Per patch gate + B3-7 full regression

---

## QA phases

| Phase | Patch | Scope |
|-------|-------|-------|
| Q1 | B3-2 | Provider hydrate, dark unchanged |
| Q2 | B3-3 | Theme choice flow |
| Q3 | B3-4 | Primitives light render |
| Q4 | B3-5 | Settings persistence |
| Q5 | B3-6 | Screen migration sample |
| Q6 | B3-7 | Full release matrix |

---

## Theme choice QA

| ID | Test | Pass |
|----|------|------|
| QA-TC-01 | First login shows theme choice after legal | ✅ |
| QA-TC-02 | Second login skips theme choice | ✅ |
| QA-TC-03 | Tap Gece — background instant dark | ✅ |
| QA-TC-04 | Tap Gündüz — background instant light | ✅ |
| QA-TC-05 | Tap Sistem — follows device | ✅ |
| QA-TC-06 | CTA persists — kill app — theme kept | ✅ |
| QA-TC-07 | No skip button present | ✅ |
| QA-TC-08 | VoiceOver radio group | ✅ |
| QA-TC-09 | iPhone SE layout — no clip | ✅ |
| QA-TC-10 | Feature flag OFF — no screen | ✅ |

---

## Hydration / flicker QA

| ID | Test | Pass |
|----|------|------|
| QA-HY-01 | Cold start dark user — no white flash | ✅ |
| QA-HY-02 | Cold start light user — max 1 frame neutral | ✅ |
| QA-HY-03 | Hydrate timeout 120ms → dark | ✅ |
| QA-HY-04 | AsyncStorage clear → dark default | ✅ |

---

## Settings QA

| ID | Test | Pass |
|----|------|------|
| QA-ST-01 | Settings segment dark→light instant | ✅ |
| QA-ST-02 | system + device toggle updates app | ✅ |
| QA-ST-03 | Logout/login preserves per user | ✅ |

---

## Visual / contrast QA (light)

| Screen | ID | Pass |
|--------|-----|------|
| Login | QA-V-01 | 4.5:1 body text |
| Role select | QA-V-02 | Cards readable |
| Settings hub | QA-V-03 | Rows readable |
| Driver offer | QA-V-04 | List + map chrome |
| Passenger waiting | QA-V-05 | Map overlay |
| QR modal | QA-V-06 | Frame contrast |
| Leylek Zeka | QA-V-07 | FAB visible |
| GlassSurface variants | QA-V-08 | All 4 variants |

---

## Dark regression QA

| ID | Test | Pass |
|----|------|------|
| QA-DR-01 | Pixel diff login dark vs pre-B3-2 | Identical |
| QA-DR-02 | PREMIUM_* mapped tokens match hex | ✅ |
| QA-DR-03 | Splash unchanged | ✅ |

---

## Platform QA

| ID | iOS | Android |
|----|-----|---------|
| QA-PL-01 StatusBar | ✅ | ✅ |
| QA-PL-02 Safe area | ✅ | ✅ |
| QA-PL-03 Nav bar | — | ✅ |
| QA-PL-04 Reduce transparency | ✅ fallback | — |

---

## Flow integration QA

| ID | Test |
|----|------|
| QA-FL-01 | Splash → login → OTP → legal → theme → role |
| QA-FL-02 | Resume active tag skips theme if done |
| QA-FL-03 | Legal decline still blocks — no theme before legal |
| QA-FL-04 | KVKK login checkbox independent |

---

## Performance QA

| ID | Test | Pass |
|----|------|------|
| QA-PF-01 | Theme switch < 16ms perceived | ✅ |
| QA-PF-02 | No full app remount on switch | ✅ |
| QA-PF-03 | Memory leak Appearance listener | None |

---

## Accessibility QA

| ID | Test |
|----|------|
| QA-A11Y-01 | WCAG AA light mode text |
| QA-A11Y-02 | Focus order theme cards |
| QA-A11Y-03 | Reduce transparency solid fallback |
| QA-A11Y-04 | Color not sole state indicator in settings |

---

## Release gate reference

See `WHITE_THEME_RELEASE_GATE.md` — all P0 QA must pass.

---

**Sonraki:** `WHITE_THEME_PATCH_PLAN.md`
