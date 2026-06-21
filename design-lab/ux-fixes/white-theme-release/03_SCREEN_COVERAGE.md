# WHITE-THEME-QA-1A — Screen Coverage

**Sprint:** WHITE-THEME-QA-1A  
**Mode:** Read-only analysis  

---

## Screen ID registry (B3-6)

Per-screen light requires **both**:

1. `isLightThemeScreenEnabled(screenId)` → needs `LIGHT_THEME=true` and id in `SCREENS` (or `*`)
2. `resolvedTheme === 'light'` from `ThemeProvider`

| Screen ID | Hook / entry | Primary surfaces |
|-----------|--------------|------------------|
| `auth` | `premiumAuthChrome.tsx` → `isLightThemeScreenEnabled('auth')` | Login, OTP, register shell, CockpitBackground |
| `role` | `useRoleTheme()` | `RoleSelectScreen` cards, inputs |
| `settings` | `useSettingsTheme('settings')` | Settings hub shell, rows |
| `profile` | `useSettingsTheme('profile')` | `app/profile.tsx` |
| `legal` | `useSettingsTheme('legal')` | LegalPages, privacy/terms/kvkk routes |
| `passenger` | `usePassengerTheme()` | Dashboard shell, waiting, searching, offer cards |
| `driver` | `useDriverTheme()` | Waiting shell, cockpit panel, offer screen chrome |
| `qr` | `useQrPaymentTrustTheme('qr')` | Boarding QR modals (non-camera chrome) |
| `payment` | `useQrPaymentTrustTheme('payment')` | Trip-end QR, rating modal |
| `trust` | `useQrPaymentTrustTheme('trust')` | TrustedNetworkHub |
| `journey` | `useJourneyTheme('journey')` | Trip banners, journey deck chrome |
| `map` | `useJourneyTheme('map')` | LiveMap overlay chrome |
| `*` | All above | Full migrated coverage when flag set |

---

## Composite hooks

| Hook | Logic | Used by |
|------|-------|---------|
| `useLiveMapChromeTheme()` | Light if **`journey` OR `map`** enabled + resolved light | `LiveMapView.tsx` |
| `useJourneyBannerTheme()` | Same OR | Active-trip banners in `index.tsx` |

With `SCREENS=*`, both journey and map scopes enabled.

---

## Consumer map (production)

| Component / route | Theme hook | Screen id |
|-------------------|------------|-----------|
| `LoginScreen` / auth chrome | `premiumAuthChrome` | `auth` |
| `RoleSelectScreen` | `useRoleTheme` | `role` |
| `settings-hub.tsx` | `useSettingsTheme('settings')` | `settings` |
| `ThemeSettingsSegment` | `useTheme` (tokens) | settings (segment) |
| `profile.tsx` | `useSettingsTheme('profile')` | `profile` |
| `privacy/terms/kvkk` | `useSettingsTheme('legal')` | `legal` |
| `PassengerWaitingScreen`, `SearchingMapView` | `usePassengerTheme` | `passenger` |
| `index.tsx` passenger dashboard | `usePassengerTheme` | `passenger` |
| `DriverOfferScreen`, `DriverDashboardPanel` | `useDriverTheme` | `driver` |
| `QRTripEndModal`, `RatingModal` | `useQrPaymentTrustTheme` | `payment` |
| `BoardingScanModal`, `DriverBoardingQRModal` | `useQrPaymentTrustTheme('qr')` | `qr` |
| `TrustedNetworkHub` | `useQrPaymentTrustTheme('trust')` | `trust` |
| `LiveMapView` | `useLiveMapChromeTheme` | `journey` \| `map` |

---

## Not migrated / partial (stay dark or hybrid)

| Area | Status | Notes |
|------|--------|-------|
| `SplashScreen.tsx` | **Dark** | Hardcoded gradient; no theme hook |
| `app/index.tsx` bulk StyleSheet | **Hybrid** | Hooks on some branches; ~144+ PREMIUM inline refs |
| `LiveMapView.tsx` baselines | **Hybrid** | Chrome overlays light; map/markers/polylines dark |
| `DriverOfferScreen.tsx` | **Hybrid** | Hook for surfaces; ~102 PREMIUM refs in baselines |
| `AdminPanel` / `admin.tsx` | **Dark** | Out of B3-6 scope |
| Map marker PNGs | **Unchanged** | Not token-driven |
| QR camera preview | **Dark** | By design |
| `TrustVideoSessionScreen` | **Partial / dark lean** | Low migration priority |
| Chat / Muhabbet routes | **No scope id** | Not in flag matrix |
| `LeylekZekaChat` | **No dedicated scope** | Uses login logo; dark baseline likely |
| `ThemeChoiceScreen` | **Self-preview tokens** | Always shows light/dark preview cards |

---

## Expected user-visible coverage (flags ON, Gündüz, SCREENS=*)

| Flow step | Light expected? |
|-----------|---------------|
| Splash | ❌ Dark |
| Theme choice | ✅ Preview cards (local tokens) |
| Login / OTP | ✅ Auth chrome |
| Role select | ✅ Role cards |
| Passenger home / match cards | ✅ Partial (hook surfaces; some inline dark) |
| Active trip map | ✅ Chrome/banners; ❌ map tiles |
| QR modals | ✅ Sheets; ❌ camera area |
| Settings hub | ✅ Shell + **Görünüm** segment |
| Profile / legal | ✅ Migrated routes |
| Driver cockpit | ✅ Waiting/offer chrome; hybrid baselines |

---

## Coverage gap priority (informational)

From `B3_6_SCREEN_INVENTORY.md` P0 debt:

1. `index.tsx` passenger/driver inline styles  
2. `LiveMapView.tsx` remaining literals  
3. `DriverOfferScreen.tsx` baseline styles  
4. Splash / admin (product decision)

**SCREEN COVERAGE COMPLETE.**
