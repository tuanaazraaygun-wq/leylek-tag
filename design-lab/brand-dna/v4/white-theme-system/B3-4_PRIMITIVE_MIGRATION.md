# B3-4 Primitive Migration — QA & Regression

**Sprint:** B3-4  
**Flag:** `EXPO_PUBLIC_FEATURE_LIGHT_THEME=false` (default)

---

## QA checklist (flag OFF)

| ID | Test | Pass |
|----|------|------|
| QA-B4-01 | Login screen — cockpit + glass identical | ☐ |
| QA-B4-02 | Role select — selection cards identical | ☐ |
| QA-B4-03 | Settings hub — PremiumText/GlassSurface identical | ☐ |
| QA-B4-04 | AppAlert modal — glass panel identical | ☐ |
| QA-B4-05 | Driver offer chrome — no color drift | ☐ |
| QA-B4-06 | `resolvedTheme` always dark | ☐ |
| QA-B4-07 | No new hook errors outside ThemeProvider | ☐ |
| QA-B4-08 | Cold start — no white flash | ☐ |

## QA checklist (flag ON — internal only)

| ID | Test | Pass |
|----|------|------|
| QA-B4-L01 | CockpitBackground light gradients render | ☐ |
| QA-B4-L02 | GlassSurface variants readable on white | ☐ |
| QA-B4-L03 | PremiumText contrast WCAG AA | ☐ |
| QA-B4-L04 | PremiumSelectionCard selection glow visible | ☐ |

---

## Regression risks

| ID | Risk | Sev | Mitigation |
|----|------|-----|------------|
| R-B4-01 | Dark preset drift vs LDS constants | P0 | Dark presets import LDS_GRADIENT_* / LDS_BORDER_COLOR directly |
| R-B4-02 | useTheme() outside provider crash | P1 | Primitives only used under ThemeProvider (_layout wrap) |
| R-B4-03 | PremiumCard elevation spread | P2 | Uses same LDS_ELEVATION.panel reference in dark |
| R-B4-04 | New components unused — dead code | P3 | Exported for B3-5/B3-6; no screen wiring yet |
| R-B4-05 | ThemeChoiceScreen preview vs primitive mismatch | P2 | Preview uses buildThemeTokens; primitives use same resolver |

---

**Next:** B3-5 Settings theme integration
