# Theme Settings Release Gate

**Sprint:** B3-5  
**Branch target:** `working-final`

---

## Release stages

| Stage | Flags | Audience |
|-------|-------|----------|
| **S0** | All OFF | Production — current |
| **S1** | `themeSettingsEnabled` ON, `lightThemeEnabled` OFF | Internal — UI only |
| **S2** | + `lightThemeEnabled` ON | TestFlight 10% |
| **S3** | + `themeChoiceEnabled` ON | TestFlight 50% |
| **S4** | All ON | GA mobile |

---

## Gate S0 — Pre-patch baseline

| ID | Criterion | Required |
|----|-----------|----------|
| G-S0-01 | B3-4 committed; primitives theme-ready | ✅ |
| G-S0-02 | No Görünüm card in production | ✅ |
| G-S0-03 | Dark regression QA-B4 pass | ✅ |

---

## Gate S1 — Settings UI (dark only)

| ID | Criterion | Required |
|----|-----------|----------|
| G-S1-01 | Görünüm card renders when flag ON | ☐ |
| G-S1-02 | Segment selection persists `lh_theme_mode_v1` | ☐ |
| G-S1-03 | Visual dark unchanged when light OFF | ☐ |
| G-S1-04 | QA-S5-R* regression pass | ☐ |
| G-S1-05 | Flag OFF → zero UI delta | ☐ |

---

## Gate S2 — Light theme via settings

| ID | Criterion | Required |
|----|-----------|----------|
| G-S2-01 | Gündüz → light render on settings + hub | ☐ |
| G-S2-02 | WCAG AA on settings light mode | ☐ |
| G-S2-03 | QA-S5-03..05 pass | ☐ |
| G-S2-04 | No map/dashboard regression (known inline debt OK) | ☐ |
| G-S2-05 | Crash-free 7 days TestFlight | ☐ |

---

## Gate S3 — Full theme product

| ID | Criterion | Required |
|----|-----------|----------|
| G-S3-01 | Theme Choice + Settings sync QA-S5-S* | ☐ |
| G-S3-02 | System theme OS follow QA-S5-Y* | ☐ |
| G-S3-03 | Stakeholder sign-off LHIS Görünüm | ☐ |

---

## Gate S4 — GA

| ID | Criterion | Required |
|----|-----------|----------|
| G-S4-01 | All theme flags ON production | ☐ |
| G-S4-02 | Support FAQ updated (tema, çoklu hesap) | ☐ |
| G-S4-03 | Rollback tested (flags OFF) | ☐ |
| G-S4-04 | Zero open P0 in regression register | ☐ |

---

## Abort criteria

| Trigger | Action |
|---------|--------|
| Settings crash +0.3% | Flag OFF settings |
| Light contrast failure | Block S2+ |
| Theme desync reports | Hotfix storage SSOT |
| Login flow regression | Revert settings-hub section |

---

## Sign-off

| Role | Approver |
|------|----------|
| Design / LHIS | Visual lead |
| Mobile eng | Theme owner |
| QA | Release QA |

---

## Post-release monitoring (14 days)

- Settings theme change rate
- Mode distribution (dark/light/system)
- Theme choice skip vs complete rate
- Support tickets "tema" / "bright" / "dark"

---

**Parent:** `B3_5_SETTINGS_ANALYSIS.md`
