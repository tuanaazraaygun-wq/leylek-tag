# B6-7 — Test Matrix

**Sprint:** B6-7 — Device QA  
**Date:** 2026-06-21  
**Legend:** ☐ = execute on device · ✅ = static pass · ⚠️ = known candidate · N/A = not in build scope

---

## Android matrix

| ID | Area | Steps | Asset / consumer | z16 | z18 | z20 | Pass ☐ |
|----|------|-------|------------------|-----|-----|-----|--------|
| AND-01 | Cold start | Kill app → launch | `splashscreen_logo` + `SplashScreen` | — | — | — | ☐ |
| AND-02 | Splash transition | Native → JS splash handoff | Same `leylek-logo-premium` family | — | — | — | ☐ |
| AND-03 | Home icon | Launcher grid | `mipmap/ic_launcher` | — | — | — | ☐ |
| AND-04 | Adaptive icon | Circle + squircle OEM | `ic_launcher_foreground` @432 | — | — | — | ☐ |
| AND-05 | Round icon | Long-press shortcut | `ic_launcher_round` | — | — | — | ☐ |
| AND-06 | Login | Phone entry screen | `LoginBrandHeader` premium | — | — | — | ☐ |
| AND-07 | Role select | Passenger / driver | `useRoleTheme` dark | — | — | — | ☐ |
| AND-08 | Passenger dashboard | Map idle | Entity markers PNG | ☐ | ☐ | ☐ | ☐ |
| AND-09 | Searching map | Driver search | `getPassengerMarkerImage` | ☐ | ☐ | ☐ | ☐ |
| AND-10 | Waiting screen | Pre-match | Passenger marker | ☐ | ☐ | ☐ | ☐ |
| AND-11 | LiveMap ride | Active journey | Driver car/motor + passenger | ☐ | ☐ | ☐ | ☐ |
| AND-12 | Destination pin | En route | `MapDestinationFlagPin` ⚠️ Ionicons | ☐ | ☐ | ☐ | ☐ |
| AND-13 | Pickup pin | Trip preview | `MapPickupPin` ⚠️ Ionicons | ☐ | ☐ | ☐ | ☐ |
| AND-14 | Driver cockpit | Header | `LeylekEyeTrigger` zeka-eye | — | — | — | ☐ |
| AND-15 | Driver offer map | Field markers | Ionicons ⚠️ System B | ☐ | ☐ | ☐ | ☐ |
| AND-16 | QR modal | Scan flow | Dark camera chrome | — | — | — | ☐ |
| AND-17 | Payment modal | Smoke open | No brand regression | — | — | — | ☐ |
| AND-18 | Trust modal | Smoke open | No brand regression | — | — | — | ☐ |
| AND-19 | Muhabbet watermark | Teklif tab | `leylek-watermark.png` | — | — | — | ☐ |
| AND-20 | Leylek Zeka FAB | Global chrome | `leylek-zeka-eye.png` | — | — | — | ☐ |
| AND-21 | Notification icon | Push (if testable) | `app.json` expo-notifications icon | — | — | — | ☐ |

---

## iOS matrix

| ID | Area | Steps | Asset / consumer | Pass ☐ |
|----|------|-------|------------------|--------|
| IOS-01 | Home screen icon | Springboard | `ios.premium.logo.png` | ☐ |
| IOS-02 | Squircle clip | Settings → icon | 1024 safe zone | ☐ |
| IOS-03 | Splash | Cold start | `app.json` splash + `SplashScreen` | ☐ |
| IOS-04 | Login | Auth flow | `LoginBrandHeader` | ☐ |
| IOS-05 | Role select | Dark shell | Role theme | ☐ |
| IOS-06 | Passenger map | Dashboard | Entity markers | ☐ |
| IOS-07 | Driver map | Cockpit + offer | Driver PNG + zeka-eye | ☐ |
| IOS-08 | Marker zoom | z16 / z18 / z20 | Passenger neutral read | ☐ |
| IOS-09 | Legal pages | KVKK / terms | `LegalPages` — no logo break | ☐ |
| IOS-10 | Leylek Zeka | Chat open | Header zeka-eye + empty premium | ☐ |
| IOS-11 | Watermark | Muhabbet | Subtle 12% watermark | ☐ |
| IOS-12 | LiveMap | Active ride | Same as AND-11 | ☐ |

---

## Cross-platform checks

| ID | Check | Android | iOS | Web | Static |
|----|-------|---------|-----|-----|--------|
| X-01 | Website logo | Browser | Browser | ✅ `leylektag-icon.png` | ✅ |
| X-02 | White theme OFF | Dark UI | Dark UI | N/A | ✅ flags |
| X-03 | LSX OFF | No new haptic/sound | Same | N/A | ✅ flags |
| X-04 | No passenger-woman | N/A | N/A | N/A | ✅ |
| X-05 | No F1 / pin family in core | Visual | Visual | N/A | ✅ |
| X-06 | Marker pack size | N/A | N/A | N/A | ✅ ~31 KB |
| X-07 | App logic unchanged | Smoke QR/pay/trust | Same | N/A | ✅ |

---

## Known candidates (do not auto-fail RC internal QA)

| ID | Item | Location | Action if visible off-brand |
|----|------|----------|----------------------------|
| C-01 | Pickup/destination Ionicons | `mapMarkerChrome.tsx` | Log → B6-5b backlog |
| C-02 | Driver offer field icons | `DriverOfferScreen.tsx` | Log → marker wiring backlog |
| C-03 | Muhabbet legacy art | `leylek-header.png`, `leylek-blue.png` | Log → B6-7b backlog |
| C-04 | Glow `#22D3EE` vs `#00D4AA` | `mapMarkerChrome.tsx` | Log → post-freeze token sync |
| C-05 | `Logo.tsx` dead component | Unused | Ignore in device QA |

---

## Result summary (fill after test run)

| Platform | Total | Pass | Fail | Blocked |
|----------|-------|------|------|---------|
| Android | 21 | — | — | — |
| iOS | 12 | — | — | — |
| Cross | 7 | 5 static | — | — |

**Tester:** _______________  
**Build ID / version:** _______________  
**Date executed:** _______________
