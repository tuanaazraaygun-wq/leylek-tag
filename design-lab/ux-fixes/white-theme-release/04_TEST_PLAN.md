# WHITE-THEME-QA-1A — APK Test Plan

**Sprint:** WHITE-THEME-QA-1A  
**Mode:** Read-only test plan (no execution in this sprint)  

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| Build | `eas build --profile preview --platform android` (or `simple`) |
| **Not** | Local `assembleRelease` without `EXPO_PUBLIC_*` env |
| Device | Physical Android preferred (Pixel + Samsung if possible) |
| Account | Fresh test user **or** cleared app storage for theme-choice test |

---

## Phase A — Flag presence (smoke)

| ID | Step | Pass |
|----|------|------|
| A-01 | Fresh install APK from EAS `preview` | Installs |
| A-02 | First login after legal accept | **Theme choice** screen appears ("LeylekTAG görünümünü seç") |
| A-03 | Complete theme choice → role select | Navigates without crash |
| A-04 | Open Ayarlar (settings hub) | **Görünüm** segment with Gece / Gündüz / Sistem |
| A-05 | Re-login same user | Theme choice **does not** reappear |

If A-02 or A-04 fail → **suspect bundle built without theme env** (rebuild via EAS, not local Gradle-only).

---

## Phase B — Light rendering (`SCREENS=*`, Gündüz)

| ID | Screen | Action | Pass criteria |
|----|--------|--------|---------------|
| B-01 | Login | Logout → login | Light cockpit background / glass (not navy-only dark) |
| B-02 | Role select | Open role screen | Card shells use light tokens |
| B-03 | Passenger home | Idle dashboard | Match decision cockpit light overlay |
| B-04 | Settings | Open `/settings-hub` | Light hub shell; Görünüm visible |
| B-05 | Profile | Profilim row | Profile route light chrome |
| B-06 | Driver | Switch to driver mode | Waiting shell / cockpit light chrome |
| B-07 | Active trip | Start or simulate trip | Map **chrome** light; map **tiles** unchanged |
| B-08 | QR trip end | Open payment modal | Sheet light; camera N/A |
| B-09 | Trusted hub | Open güven ağı | Hub light surfaces |

---

## Phase C — Dark regression (Gece mode)

| ID | Step | Pass |
|----|------|------|
| C-01 | Settings → Görünüm → Gece | Immediate dark resolved theme |
| C-02 | Revisit login, role, dashboard | Matches pre-B3 dark LHIS (no broken layouts) |
| C-03 | Kill app → reopen | Stays Gece (persisted `lh_theme_mode_v1`) |

---

## Phase D — System mode

| ID | Step | Pass |
|----|------|------|
| D-01 | Görünüm → Sistem | Follows OS theme |
| D-02 | Toggle device dark/light | App resolves within ~1s after hydrate |

---

## Phase E — Negative controls (optional)

Build a **local** release **without** env to confirm false-negative behavior:

| ID | Expected |
|----|----------|
| E-01 | No theme choice on first login |
| E-02 | No Görünüm segment |
| E-03 | App dark regardless of old AsyncStorage light mode |

Confirms QA discipline: **never sign off white theme from local Gradle-only APK.**

---

## Phase F — iOS parity (if TestFlight available)

Same A/B/C matrix on `eas build --profile preview --platform ios`. Theme flags identical in `eas.json`.

---

## Evidence to capture

| Artifact | Purpose |
|----------|---------|
| Screenshot theme choice | A-02 |
| Screenshot Görünüm segment | A-04 |
| Login light vs dark side-by-side | B-01 / C-02 |
| LiveMap chrome light, tiles dark | B-07 |
| Build profile + commit SHA in test notes | Traceability |

---

## Fail triage

| Symptom | Likely cause |
|---------|--------------|
| No theme choice, no Görünüm | Flags not in bundle (local build) |
| Görünüm visible, app stays dark | `LIGHT_THEME=false` only, or user on Gece |
| Some screens light, map not | Expected — map tiles not themed; check **chrome** only |
| Choice every login | `lh_theme_choice_done_*` not persisting / new user id |
| Choice never appears | `THEME_CHOICE=false` or resumed active trip on login |

---

## Sign-off rubric

| Role | Approves |
|------|----------|
| QA | Phases A + B on EAS preview APK |
| Product | Theme choice copy + settings discoverability |
| Engineering | No crash on theme switch; AsyncStorage persist |

**TEST PLAN COMPLETE — Production untouched.**
