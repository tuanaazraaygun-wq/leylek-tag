# B3-6 Screen Inventory

**Sprint:** B3-6 — Read-only scan  
**Date:** 2026-06-21

---

## Legend

| LHIS | CockpitBackground / GlassSurface / PremiumText usage |
| Debt | Approx color literal / PREMIUM_* density |
| Risk | P0 critical → P3 low |

---

## Auth / Login (Group 1)

| File | LHIS | Debt | Risk | Notes |
|------|------|------|------|-------|
| `components/auth/LoginScreen.tsx` | ✅ chrome + Glass | Low inline | P2 | B3-6a target |
| `components/auth/OtpVerificationScreen.tsx` | ✅ chrome | Low | P2 | B3-6a |
| `components/auth/premiumAuthChrome.tsx` | ✅ CockpitBackground | Medium pa.* | P2 | Shell SSOT |
| `components/auth/premiumAuthStyles.ts` | N/A (SSOT) | **62 refs** | P1 | Token bridge target |
| `components/auth/LoginBrandHeader.tsx` | Partial | Medium | P2 | Logo on white |
| `components/auth/AnimatedClouds.tsx` | ❌ | Medium rgba | P3 | Decorative |
| `app/index.tsx` (login/register/otp/pin) | Partial | **144 PREMIUM** | **P0** | Inline auth branches |
| `components/SplashScreen.tsx` | ❌ | Hardcoded gradient | P3 | Keep dark? |
| `components/LegalPages.tsx` | ❌ legacy COLORS | Separate palette | P2 | Not PREMIUM_* |
| `components/theme/ThemeChoiceScreen.tsx` | Preview tokens | Low | P3 | Already token preview |

---

## Role Selection (Group 2)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `components/premium/RoleSelectScreen.tsx` | ✅ Strong | ~19 refs | P1 |
| `app/index.tsx` role-select branch | Partial | Inline overlays | P1 |
| `design-system/role-select/*Hero.tsx` | Illustrations | Asset colors | P2 |
| `design-system/role-select/RoleSelectAmbienceBackground.tsx` | Grid | Dark grid lines | P2 |

---

## Passenger (Group 3)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `app/index.tsx` PassengerDashboard | Mixed | Massive inline | **P0** |
| `components/PassengerWaitingScreen.tsx` | Partial | ~53 refs | P1 |
| `components/SearchingMapView.tsx` | Partial | ~9 refs | P1 |
| `components/superUx/QuickMatchPassengerFlow.tsx` | Partial | ~37 refs | P1 |
| `components/superUx/PassengerMatchModeCards.tsx` | Partial | ~15 refs | P1 |
| `components/TagMatchTransitionOverlay.tsx` | Partial | Medium | P2 |

---

## Driver (Group 4)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `components/DriverOfferScreen.tsx` | Partial | **~102 refs** | **P0** |
| `components/DriverDashboardPanel.tsx` | Partial | ~10 refs | P1 |
| `components/superUx/DriverCockpitQuickStrip.tsx` | Partial | Medium | P1 |
| `components/superUx/DriverQuickMatchInviteCard.tsx` | ✅ Glass | ~13 refs | P1 |
| `components/driver/driverWaitingShellStyles.ts` | ❌ | Hardcoded | P1 |

---

## Map / Journey (Group 5)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `components/LiveMapView.tsx` | Partial | **~118 refs** | **P0** |
| `lib/mapNavMarkers.ts` | PNG paths | Theme-agnostic | **P0** |
| `lib/mapMarkerChrome.tsx` | Partial | Medium | P1 |
| `components/LeylekTripLiveRideChrome.tsx` | Partial | Medium | P1 |

---

## QR / Payment / Trust (Group 6)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `components/BoardingScanModal.tsx` | ✅ Strong | Inline rgba camera | P1 |
| `components/DriverBoardingQRModal.tsx` | Partial | Medium | P1 |
| `components/QRTripEndModal.tsx` | Partial | ~5 PREMIUM | P1 |
| `components/TransferPaymentConfirmModal.tsx` | Partial | Medium | P1 |
| `components/RatingModal.tsx` | ✅ primitives | Low | P2 |
| `components/trust/TrustVideoSessionScreen.tsx` | Partial | Low | P2 |
| `components/TrustRequestModal.tsx` | Legacy | Medium | P2 |

---

## Settings / Profile / Legal (Group 7)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `app/settings-hub.tsx` | ✅ Cockpit + Glass | ~11 PREMIUM shell | P2 |
| `components/theme/ThemeSettingsSegment.tsx` | ✅ Full | Token-based | Done |
| `app/profile.tsx` | ❌ legacy shell | ~40 PREMIUM | P2 |
| `components/ProfileScreen.tsx` | Partial | ~36 refs | P2 |
| `app/delete-account.tsx` | Hub clone | ~12 refs | P2 |
| `app/privacy.tsx`, `terms.tsx`, `kvkk.tsx` | Routes | LegalPages | P2 |
| `app/driver-offer-sound-settings.tsx` | ✅ Hub pattern | ~22 refs | P2 |

---

## Admin (Group 8)

| File | LHIS | Debt | Risk |
|------|------|------|------|
| `app/admin.tsx` | ❌ | Legacy | P3 |
| `components/AdminPanel.tsx` | ❌ | ~5 refs | P3 |

---

## Already theme-aware (B3-4)

- `CockpitBackground`, `GlassSurface`, `PremiumText`, `PremiumSelectionCard` — consume `useTheme()`

---

## index.tsx concentration

Single file hosts: login, register, otp, pin, role-select wrapper, theme-choice, dashboard shells. **Phased extraction not in B3-6 scope** — token swap in place only.
