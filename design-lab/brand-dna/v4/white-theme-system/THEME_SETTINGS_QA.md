# Theme Settings QA Plan

**Sprint:** B3-5  
**Execution:** Pre-release + staged flag rollout

---

## QA phases

| Phase | Flags | Scope |
|-------|-------|-------|
| Q5-0 | all OFF | Regression — no Görünüm card |
| Q5-1 | settings ON, light OFF | UI visible; dark render |
| Q5-2 | settings ON, light ON | Full theme switch |
| Q5-3 | choice + settings ON | End-to-end sync |

---

## Settings UI QA

| ID | Test | Pass |
|----|------|------|
| QA-S5-01 | `themeSettingsEnabled=false` → no Görünüm card | ☐ |
| QA-S5-02 | Görünüm card after Profil, before Sürücü | ☐ |
| QA-S5-03 | Gece segment → instant dark | ☐ |
| QA-S5-04 | Gündüz segment → instant light (light flag ON) | ☐ |
| QA-S5-05 | Sistem segment → follows device | ☐ |
| QA-S5-06 | Selected segment visual matches themeMode | ☐ |
| QA-S5-07 | Hydrating → segments disabled | ☐ |
| QA-S5-08 | VoiceOver radiogroup | ☐ |
| QA-S5-09 | Selection haptic on change | ☐ |

---

## Persistence QA

| ID | Test | Pass |
|----|------|------|
| QA-S5-P01 | Change to Gündüz → kill app → still Gündüz | ☐ |
| QA-S5-P02 | `lh_theme_mode_v1` matches UI selection | ☐ |
| QA-S5-P03 | Logout/login → mode restored from device key | ☐ |
| QA-S5-P04 | Settings change does not clear choice_done | ☐ |
| QA-S5-P05 | Offline change persists locally | ☐ |

---

## Sync with Theme Choice QA

| ID | Test | Pass |
|----|------|------|
| QA-S5-S01 | Complete Theme Choice Gece → Settings shows Gece | ☐ |
| QA-S5-S02 | Theme Choice Gündüz → Settings shows Gündüz | ☐ |
| QA-S5-S03 | Settings change after choice → no theme choice re-show | ☐ |
| QA-S5-S04 | Theme Choice + Settings use same resolved theme on role select | ☐ |

---

## System theme QA

| ID | Test | Pass |
|----|------|------|
| QA-S5-Y01 | Sistem + OS dark → app dark | ☐ |
| QA-S5-Y02 | Sistem + OS light → app light (light flag ON) | ☐ |
| QA-S5-Y03 | OS toggle while app foreground → updates within 1s | ☐ |
| QA-S5-Y04 | Sistem selected while OS toggles → segment stays Sistem | ☐ |

---

## Regression QA (flag OFF)

| ID | Test | Pass |
|----|------|------|
| QA-S5-R01 | Settings hub layout unchanged vs pre-B3-5 | ☐ |
| QA-S5-R02 | Driver sound settings unchanged | ☐ |
| QA-S5-R03 | Logout flow unchanged | ☐ |
| QA-S5-R04 | Dark primitives pixel-stable | ☐ |
| QA-S5-R05 | Login / legal / role flow unchanged | ☐ |

---

## Screen migration QA (B3-5c optional)

| ID | Test | Pass |
|----|------|------|
| QA-S5-M01 | Settings hub shell uses tokens (not PREMIUM_* inline) | ☐ |
| QA-S5-M02 | Light mode settings readable WCAG AA | ☐ |

---

## Platform QA

| ID | iOS | Android |
|----|-----|---------|
| QA-S5-PL-01 Safe area | ☐ | ☐ |
| QA-S5-PL-02 Segment touch targets 44pt | ☐ | ☐ |
| QA-S5-PL-03 OS theme follow | ☐ | ☐ |

---

**Gate reference:** `THEME_SETTINGS_RELEASE_GATE.md`
