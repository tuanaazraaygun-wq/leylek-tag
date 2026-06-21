# V7 — User Test Results

**Mode:** Design-lab protocol + **projected results for MEX v1** vs **recorded failures for production**  
**Status:** Production tests **FAILED** (B5.6) · MEX design **PENDING live execution**

---

## Test battery

| ID | Test | Method |
|----|------|--------|
| T1 | 3-meter recognition | Print mockup A4 · 10 participants |
| T2 | 24px visibility | Notification mock scaled |
| T3 | Night mode | `#0D1117` map chrome |
| T4 | Day mode | Light tiles `#E8ECF0` |
| T5 | Driving @ speed | Video 0.4s exposure · 5 drivers |
| T6 | One-hand | Offer accept thumb zone |
| T7 | Color blindness | Deuteranopia sim |
| T8 | Outdoor sunlight | 1000 nit screen photo |
| T9 | Low brightness | 15% OLED |

---

## Production (current B6) — ACTUAL / B5.6 jury

| ID | Result | Evidence |
|----|--------|----------|
| T1 | **FAIL** | B6-7 human · "logo değişmiş" |
| T2 | **FAIL** | Notification full bird illegible |
| T3 | **PASS** | Dark theme native |
| T4 | **CONDITIONAL** | Glow washes on light tiles |
| T5 | **FAIL** | z16 car/motor merge · 0.4s |
| T6 | **PASS** | CTA sizes generally OK |
| T7 | **FAIL** | Relies on cyan hue not form |
| T8 | **FAIL** | Glow-only markers |
| T9 | **CONDITIONAL** | Silhouette weak |

**Production user test summary: 2 PASS · 2 COND · 5 FAIL**

---

## MEX v1 (designed system) — PROJECTED post-implementation

| ID | Projected | Rationale |
|----|-----------|-----------|
| T1 | **PASS** | LC-2 + arc mass · store mock distinguishes |
| T2 | **PASS** | Eye+arc notification icon |
| T3 | **PASS** | Slate+cyan contrast locked |
| T4 | **PASS** | Marker outline stroke on light tiles |
| T5 | **PASS** | Car wedge 1.35× motor · device proof required |
| T6 | **PASS** | 48pt accept unchanged |
| T7 | **PASS** | Form-primary markers |
| T8 | **PASS** | Edge stroke + reduced glow max |
| T9 | **PASS** | LC-3 micro ladder |

**MEX projected: 9 PASS · 0 FAIL** — **must be validated in V7b field sprint**

---

## Concept-level simulation (design-lab · today)

Design team walkthrough of `mockups/` @3m:

| Mockup | Named LeylekTAG? | Notes |
|--------|------------------|-------|
| android-home | 7/10 yes | Cyan arc helps |
| notification | 8/10 yes | Eye+arc works @24px |
| google-maps-journey | 6/10 yes | Needs real tiles |
| offer-screen | 5/10 | Brand secondary to UX — OK |
| app-store-listing | 8/10 yes | Stands out vs gray |

**Not a substitute for field tests.**

---

## Sign-off block (empty)

| Tester | Role | T1–T9 PASS? | Date |
|--------|------|-------------|------|
| | Driver | | |
| | Passenger | | |
| | Brand | | |
| | QA | | |

---

## V7b required

1. 10 drivers · dashboard mount · z16 video  
2. 20 users · App Store grid blind test  
3. 5 deuteranopia sims on map  
4. Sunlight photo suite  

**Until V7b executes, MEX user tests remain PROJECTED.**
