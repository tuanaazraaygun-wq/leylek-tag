# B6-7 — Device QA Plan

**Sprint:** B6-7 — Device QA + RC Build Decision  
**Date:** 2026-06-21  
**Mode:** Read-only planning — **no production changes**  
**Prerequisite:** B6-1…B6-6 migration complete (static audit PASS)

---

## 1. Purpose

Validate B6 brand migration on **real devices** before DNA Freeze EXECUTED (B6-8) or store-facing RC. Static asset sync is complete; this plan covers **what to test**, **how**, and **pass criteria**.

---

## 2. Pre-flight (before flashing build)

| # | Check | How | Expected |
|---|-------|-----|----------|
| PF-01 | Fresh native build required | Android `mipmap-*` + `drawable-*/splashscreen_logo` changed in B6-2/3 | **Must rebuild** — OTA/Metro alone insufficient for icon/splash |
| PF-02 | Build profile | EAS `preview` (internal APK) or `simple` | No theme/LSX env vars set |
| PF-03 | Version bump | `app.json` android.versionCode / ios.buildNumber | Increment before RC tag (ops step, not B6-7 scope) |
| PF-04 | Flags OFF audit | No `EXPO_PUBLIC_FEATURE_LSX*` or `EXPO_PUBLIC_FEATURE_LIGHT*` in build env | All default false |
| PF-05 | Screenshot baseline | Capture pre-B6 device if available | Optional regression compare |

---

## 3. Static readiness (repo audit — 2026-06-21)

| # | Surface | Asset / path | Static | Device required |
|---|---------|--------------|--------|-----------------|
| 1 | Android app icon | `mipmap-*/ic_launcher*.png` (B6-3) | ✅ | ✅ home screen |
| 2 | Android adaptive icon | `ic_launcher_foreground.png` + `#08111F` bg | ✅ | ✅ launcher shapes |
| 3 | Android native splash | `drawable-*/splashscreen_logo.png` (B6-2) | ✅ | ✅ cold start |
| 4 | JS splash | `SplashScreen.tsx` → `leylek-logo-premium.png` | ✅ | ✅ transition |
| 5 | iOS icon | `ios.premium.logo.png` (1024) | ✅ | ✅ squircle |
| 6 | Login logo | `LoginBrandHeader` → premium PNG | ✅ | ✅ |
| 7 | Leylek Zeka mark | `leylek-zeka-eye.png` (FAB, header, trigger) | ✅ | ✅ |
| 8 | Watermark | `leylek-watermark.png` (Muhabbet tabs) | ✅ | ✅ |
| 9 | Passenger marker | `passenger-neutral.png` | ✅ | ✅ gender read |
| 10 | Driver markers | `driver-car.png`, `driver-motor.png` | ✅ | ✅ vehicle read |
| 11 | Pickup/destination | `MapPickupPin` / `MapDestinationFlagPin` (Ionicons) | ⚠️ CANDIDATE | ⚠️ not B5.2 PNG yet |
| 12 | Website logo | `website/public/store/leylektag-icon.png` (B6-1) | ✅ | Browser spot-check |
| 13 | White theme flags | `featureFlags.ts` default OFF | ✅ | N/A (flags OFF) |
| 14 | LSX flags | `lsx/featureFlags.ts` default OFF | ✅ | N/A (flags OFF) |
| 15 | Old logo family in core paths | None in splash/icon/login/map entity | ✅ | Visual confirm |
| 16 | passenger-woman/man | No frontend references | ✅ | N/A |
| 17 | App logic post-B6 | Asset + image path only | ✅ | Smoke flows |

**Static readiness score:** **15/17 PASS · 2 CANDIDATE** (pickup/destination chrome, muhabbet legacy art)

---

## 4. Device matrix

| Tier | Device | OS | Priority |
|------|--------|-----|----------|
| D1 | Pixel 8 / 8a | Android 14+ | P0 — adaptive icon + splash 12 |
| D2 | Samsung Galaxy A54 (or A-series) | Android 13+ | P0 — OEM launcher skin |
| D3 | iPhone 15 / 15 Pro | iOS 17+ | P0 — squircle + TestFlight path |
| D4 | iPad (optional) | iOS 17+ | P2 — tablet login/splash |
| D5 | Expo web (Chrome) | — | P2 — favicon only |

Minimum for **G6-7 PASS:** D1 + D2 + D3.

---

## 5. Test execution order

### Phase A — First boot (brand flash)

1. Cold start ×3 — native splash → JS splash → login  
2. Home screen icon — shape, color, not pin/wireframe  
3. 200 ms recognition — “same LeylekTAG?” (FQA-02)

### Phase B — Auth + role

4. Login brand header logo  
5. OTP / register premium shell (no theme flag)  
6. Role select screen

### Phase C — Passenger journey

7. Dashboard map — passenger + driver entity markers  
8. Searching / waiting map  
9. LiveMap active ride — zoom 16 → 18 → 20  
10. Destination pin (Ionicons flag — document drift if visible)

### Phase D — Driver journey

11. Driver cockpit — LeylekEyeTrigger zeka-eye  
12. Offer map — field markers (Ionicons system — note drift)  
13. Navigation map — rotated driver car/motor PNG

### Phase E — Trust / payment / QR (smoke — no logic change)

14. QR scan modal — camera chrome dark, no logo in QR center  
15. Payment / trust modals — brand colors unchanged  
16. Legal pages (`LegalPages`, terms, KVKK) — readable, no logo regression

### Phase F — Muhabbet + Zeka

17. Leylek Zeka FAB + chat header + empty state logo  
18. Muhabbet watermark visibility (subtle, non-distracting)  
19. Muhabbet hero (`leylek-blue.png`) — **document** legacy art if off-brand

---

## 6. Pass / fail criteria

| ID | Criterion | PASS | FAIL |
|----|-----------|------|------|
| DQA-01 | Native + JS splash same stork family | Same silhouette @ glance | Pin/wireframe flash or mismatch |
| DQA-02 | Android adaptive safe zone | Wing/beak not clipped on circle + squircle OEM | Critical clip |
| DQA-03 | iOS icon squircle | Symbol centered, readable | Clip or wrong family |
| DQA-04 | Login logo = home icon family | Premium stork + arc | Different family |
| DQA-05 | Passenger marker gender-neutral @32px | No gender read | Gendered silhouette |
| DQA-06 | Driver markers not taxi/luxury | Vehicle read OK | Taxi/yellow/luxury read |
| DQA-07 | Marker readable z16/18/20 | Distinct P/D at glance | Illegible or merge |
| DQA-08 | Zeka eye = brand DNA | Cyan ring + dot | Generic eye icon |
| DQA-09 | Watermark non-intrusive | Readable content over watermark | Obscures UI |
| DQA-10 | No sensory regression | Haptic/sound same as pre-B6 (flags OFF) | New sounds/haptics |
| DQA-11 | No theme regression | Dark LHIS baseline | Light surfaces appear |
| DQA-12 | Recognition ≥70% team | “Same LeylekTAG” | Brand confusion |

**G6-7 gate:** DQA-01…DQA-11 PASS on D1+D2+D3; DQA-12 recommended before B6-8.

---

## 7. Evidence capture

| Item | Format |
|------|--------|
| Cold start video | 10s screen record × Android + iOS |
| Home screen icon | Photo + screenshot |
| Map @ z16/18/20 | 3 screenshots per role |
| Zeka FAB + chat | Screenshot |
| Watermark | Muhabbet tab screenshot |
| Failures | Logcat / Xcode console + screenshot |

Store in: `design-lab/brand-dna/v4/design-freeze/evidence/b6-7/` (create at test time).

---

## 8. Out of scope (B6-7)

- White theme device matrix (flags OFF)  
- LSX sensory device matrix (flags OFF)  
- Pickup/destination PNG wiring (B6-5b)  
- Muhabbet legacy art migration (B6-7b)  
- Store submission / legal copy review

---

## 9. Rollback trigger

If **DQA-01, DQA-03, or DQA-05 FAIL:**

1. Stop store RC  
2. Restore from `_backup-pre-b6-n/` per surface  
3. Rebuild internal APK only  
4. Do **not** execute B6-8 DNA Freeze

---

**B6-7 device QA plan:** ✅ **READY FOR EXECUTION**
