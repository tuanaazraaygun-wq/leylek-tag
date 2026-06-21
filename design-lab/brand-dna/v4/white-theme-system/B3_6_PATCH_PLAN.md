# B3-6 Patch Plan

**Sprint:** B3-6 — Implementation patches (design only)  
**Date:** 2026-06-21

---

## Patch overview

| Patch | PR scope | Max files | Flag |
|-------|----------|-----------|------|
| **B3-6a.1** | Auth chrome | 3 | OFF prod |
| B3-6a.2 | index auth inputs | 1 | OFF prod |
| B3-6b | Role select | 3 | TestFlight |
| B3-6c | Settings/profile/legal | 8 | TestFlight |
| B3-6d.* | Passenger (split) | 3–4 each | TestFlight |
| B3-6e.* | Driver (split) | 3–4 each | TestFlight |
| B3-6f | QR modals | 7 | TestFlight |
| B3-6g | Map | 5+ | **Gated** |
| B3-6h | Cleanup | TBD | Staged |

---

## B3-6a.1 — First patch (RECOMMENDED)

**Title:** `feat(theme): migrate auth shell to theme tokens (B3-6a.1)`

### Files

```
frontend/components/auth/premiumAuthChrome.tsx
frontend/components/auth/LoginScreen.tsx
frontend/components/auth/OtpVerificationScreen.tsx
```

### Changes (token-only)

| File | Change |
|------|--------|
| premiumAuthChrome | Replace `pa.ctaBody*`, border selected rgba → `tokens.button.*`, `tokens.border.*` |
| LoginScreen | Icon colors, helper text → `tokens.text.muted`, `tokens.accent.primary` |
| OtpVerificationScreen | Same pattern |

### Pattern

```tsx
const { tokens } = useTheme();
// style={{ color: tokens.text.primary }}
// NOT: color: PREMIUM_TEXT_SOFT
```

### Flags

```env
EXPO_PUBLIC_FEATURE_LIGHT_THEME=false
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=auth  # TestFlight only
```

### Acceptance

- [ ] Flag OFF — zero visual delta
- [ ] Flag ON + auth screen — coherent light login
- [ ] No spacing/layout diff
- [ ] Typecheck pass

### Est. diff size: **~80–150 lines**

---

## B3-6a.2 — index auth branches

**Title:** `feat(theme): auth input colors in index (B3-6a.2)`

### File

```
frontend/app/index.tsx  (register, otp, pin, forgot branches ONLY)
```

### Scope guard

Use comment markers:

```tsx
// B3-6a-THEME: auth input colors
```

### Est. diff: **~100–200 lines** (high conflict risk — ship after 6a.1 stable)

---

## Feature flag addition (if not present)

```ts
// frontend/lib/featureFlags.ts
export const lightThemeScreensEnabled = parseScreenList(
  process.env.EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS ?? ''
);
```

Resolver checks screen id before applying light resolve override.

---

## Token gaps to add (design-lab → semanticTokens)

| Token | Phase |
|-------|-------|
| `tokens.chip.*` | B3-6d |
| `tokens.map.*` | B3-6g |
| `tokens.qr.scanOverlay` | B3-6f |
| `tokens.overlay.roleCinematic` | B3-6b |

---

## What each patch must NOT touch

- Business logic handlers
- Navigation params
- Socket/API calls
- Spacing constants (LDS_SPACING, padding numbers)
- Icon names/sizes
- Map camera/marker coordinates

---

## Rollback per patch

| Patch | Revert |
|-------|--------|
| B3-6a.1 | 3 files |
| B3-6a.2 | index auth sections |
| B3-6b–f | Group file list in each analysis doc |
| B3-6g | LiveMapView + mapNavMarkers |

---

## Commit strategy

- One patch = one commit
- Never `git add .`
- Exclude design-lab from production commits

---

**Start here:** B3-6a.1 only — smallest, safest, validates pipeline.
