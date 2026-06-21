# B3-6 Auth / Login Analysis

**Group:** 1 — Auth / Login  
**Patch:** B3-6a (first production patch)

---

## Scope

| Surface | Entry |
|---------|--------|
| Login | `LoginScreen.tsx` + `index.tsx` login branch |
| Register | `index.tsx` register branch |
| OTP | `OtpVerificationScreen.tsx` + `index.tsx` otp |
| PIN set/enter | `index.tsx` set-pin, enter-pin |
| Test password | `index.tsx` test-password |
| Forgot/reset PIN | `index.tsx` forgot-password, reset-pin |
| Legal modal | `LegalPages.tsx` (separate palette) |
| Splash | `SplashScreen.tsx` |
| Theme choice | `ThemeChoiceScreen.tsx` (preview-ready) |

---

## Current hardcoded colors

| Source | Typical values |
|--------|----------------|
| `premiumAuthStyles.ts` | `PREMIUM_NAVY_DEEP`, `PREMIUM_AUTH_CYAN`, glass rgba |
| `premiumAuthChrome` | `pa.root`, CTA body rgba, border selected |
| `index.tsx` inline | `#3FA9F5`, `rgba(148,163,184,0.78)` placeholders |
| `SplashScreen` | `#08111F`, `#22D3EE`, custom glass |
| `LegalPages` COLORS | Legacy blue/green — **not** PREMIUM_* |

---

## LHIS primitive usage

| Component | Primitives |
|-----------|------------|
| LoginScreen | ✅ PremiumAuthScreenShell → CockpitBackground, PremiumGlassShell → GlassSurface |
| OtpVerificationScreen | ✅ Same chrome |
| index.tsx auth branches | ✅ PremiumAuthScreenShell; inline TextInput shells use PREMIUM_* |
| Splash | ❌ Custom LinearGradient |
| Legal modal | ❌ Legacy COLORS object |

**Note:** CockpitBackground/GlassSurface **already theme-aware** (B3-4) — light flag ON'da login chrome otomatik kısmen değişir; inline `pa.*` ve TextInput stilleri dark kalır → **hybrid flicker risk**.

---

## Risk level: **P1** (auth is first impression)

## Migration complexity: **Medium**

| Factor | Detail |
|--------|--------|
| Easy wins | Shell via existing primitives |
| Medium | `premiumAuthStyles` → read from tokens or semantic re-export |
| Hard | index.tsx 6+ auth branches duplicate styles |

---

## Tokens needed

| Token | Use |
|-------|-----|
| `tokens.bg.canvas` | Root, shell |
| `tokens.text.primary/muted` | Labels, placeholders |
| `tokens.border.default/emphasis` | Input borders |
| `tokens.bg.glassMuted` | Input fill |
| `tokens.accent.primary` | Icons, selection, CTA rim |
| `tokens.button.*` | PremiumGradientCtaButton migrate (future) |
| `tokens.gradients.cockpitBase` | Splash decision |

---

## Migrate first (B3-6a)

1. `premiumAuthChrome.tsx` — CTA body colors → `useTheme().tokens`
2. `LoginScreen.tsx` — remove remaining PREMIUM_* inline where not from pa
3. `OtpVerificationScreen.tsx` — same
4. `index.tsx` — auth branch TextInput/icon colors → tokens (minimal diff per branch)

**Defer:** Splash light variant, LegalPages full migrate (B3-6c)

---

## Files likely affected

```
frontend/components/auth/premiumAuthChrome.tsx
frontend/components/auth/premiumAuthStyles.ts  (re-export from semanticTokens — optional)
frontend/components/auth/LoginScreen.tsx
frontend/components/auth/OtpVerificationScreen.tsx
frontend/app/index.tsx  (auth branches only — scoped diff)
```

---

## Must NOT change

- Layout columns, padding, KeyboardAvoidingView
- LoginBrandHeader logo size/position
- OTP digit count, phone validation
- KVKK checkbox flow
- Navigation targets (register, forgot)
- AnimatedClouds motion timing

---

## QA checklist

| ID | Test |
|----|------|
| QA-6a-01 | Flag OFF — login pixel-identical dark |
| QA-6a-02 | Flag ON auth only — light shell + readable inputs |
| QA-6a-03 | OTP/register/pin branches same token source |
| QA-6a-04 | Logo visible on light canvas |
| QA-6a-05 | No hybrid dark inputs on light bg |

---

## Rollback

- `EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS` remove `auth`
- Revert B3-6a file list only

---

**First patch recommendation:** B3-6a — `premiumAuthChrome` + Login + OTP only; index pin/register in B3-6a.2
