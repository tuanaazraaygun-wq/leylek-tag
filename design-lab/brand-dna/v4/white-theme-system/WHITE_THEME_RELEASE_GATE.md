# White Theme Release Gate

**Sprint:** B-3-7  
**Date:** 2026-06-21

---

## Release stages

| Stage | Flags | Audience |
|-------|-------|----------|
| **S0** | All OFF | Production — current behavior |
| **S1** | B3-2 only (provider dark) | Production — invisible infra |
| **S2** | Theme choice ON | Internal TestFlight |
| **S3** | + Light primitives ON | Beta cohort 5% |
| **S4** | + Settings ON | Beta 20% |
| **S5** | Screen migration tier 1–3 | Beta 50% |
| **S6** | Full GA | 100% |

---

## Gate checklist — S1 (B3-2 infra)

| ID | Criterion | Required |
|----|-----------|----------|
| G-S1-01 | Dark visual pixel diff = baseline | ✅ |
| G-S1-02 | No new crashes ThemeProvider | ✅ |
| G-S1-03 | Hydrate timeout tested | ✅ |
| G-S1-04 | Performance neutral | ✅ |

---

## Gate checklist — S2 (theme choice)

| ID | Criterion | Required |
|----|-----------|----------|
| G-S2-01 | QA-TC-* all pass | ✅ |
| G-S2-02 | Legal ordering verified | ✅ |
| G-S2-03 | Second login skip verified | ✅ |
| G-S2-04 | Stakeholder UX sign-off | ✅ |
| G-S2-05 | R-W05 closed | ✅ |

---

## Gate checklist — S4 (light theme usable)

| ID | Criterion | Required |
|----|-----------|----------|
| G-S4-01 | QA-V-* pass login + settings + role | ✅ |
| G-S4-02 | WCAG AA light text | ✅ |
| G-S4-03 | R-W09 closed | ✅ |
| G-S4-04 | Dark regression QA-DR-* pass | ✅ |
| G-S4-05 | Marker light map spot check | ✅ |

---

## Gate checklist — S6 (GA)

| ID | Criterion | Required |
|----|-----------|----------|
| G-S6-01 | B3-6 priority screens migrated | ✅ min: login, role, settings, dashboard shell |
| G-S6-02 | Full WHITE_THEME_QA_PLAN executed | ✅ |
| G-S6-03 | Zero open P0 in WHITE_THEME_RISK_REGISTER | ✅ |
| G-S6-04 | Rollback runbook tested | ✅ |
| G-S6-05 | Support docs updated (FAQ tema) | ✅ |
| G-S6-06 | Analytics: theme distribution baseline | Optional |

---

## Abort criteria

| Trigger | Action |
|---------|--------|
| Crash rate +0.5% | Flag off S2+ |
| Flicker reports >10/day | Hotfix hydrate |
| Legal flow regression | Revert B3-3 |
| Contrast failure P0 | Block S4+ |

---

## Sign-off roles

| Role | Approver |
|------|----------|
| Design / LHIS | Chief Visual Identity |
| Engineering | Mobile lead |
| QA | Release QA |
| Legal | Confirm theme screen non-legal |

---

## Post-release monitoring (7 days)

- Theme mode distribution (dark/light/system)
- Theme choice completion rate
- Settings theme change rate
- Crash-free sessions
- App store reviews mentioning "theme" / "bright"

---

**Parent:** `WHITE_THEME_MASTER_ANALYSIS.md`
