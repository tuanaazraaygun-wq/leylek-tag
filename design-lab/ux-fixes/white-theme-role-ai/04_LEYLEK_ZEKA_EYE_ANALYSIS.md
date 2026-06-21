# Leylek Zeka Eye Consistency Analysis

**Sprint:** WHITE-THEME-B3-7A  
**Section:** C — Eye asset / component family  

---

## C1. Eye render paths (production inventory)

| Context | Component | Asset | Size | AI label |
|---------|-----------|-------|------|----------|
| Role select guardian | `LeylekEye` SVG | Inline SVG (`LeylekEye.tsx`) | 49px (`LEYLEK_EYE_ROLE_SELECT_SIZE`) | No |
| Passenger match home guardian | `LeylekEye` SVG | Same | 49px | No |
| Passenger matching chip (map wait) | `LeylekEye` SVG in dark glass chip | Same | ~44px (`LEYLEK_EYE_WATCHING_SIZE`) | No |
| Default FAB (most screens) | `Image` PNG | `assets/images/leylek-zeka-eye.png` | FAB ~56px | **Yes** (`orbAiBadge`) |
| Leylek Zeka modal header | `Image` PNG | Same PNG | 48×48 wrap | **Yes** (`aiBadge` gradient) |
| Driver map header trigger | `LeylekEyeTrigger` | PNG in dark gradient capsule | 26px eye in 42px btn | No |
| Tag match transition | `LeylekEye` SVG | SVG | 66px+ hero | No |
| Rating modal | `LeylekEye` SVG | SVG | 49px | No |

**Brand asset on disk:** `frontend/assets/images/leylek-zeka-eye.png` (single PNG; no light/dark variants in repo).

**Design-lab reference (not wired):** `design-lab/brand-dna/v4/brand-identity-production/svg/leylek-zeka-eye-v1.svg` — production swap not executed.

---

## C2. Why a “round dot” appears instead of the real eye

### Cause 1 — Small guardian + dark capsule on light background

`LeylekZekaWidget` role/match guardian mode:

```typescript
<LeylekEye size={49} chromeTone="subtle" motionProfile="guardian" />
// styles.roleSelectEyeAnchor: opacity: 0.74
// styles.passengerMatchHomeEyeAnchor: opacity: 0.88
```

`LeylekEye` capsule uses **always-dark** gradient:

```typescript
colors={['rgba(18,32,52,0.98)', PREMIUM_NAVY_CARD, 'rgba(8,14,24,0.97)']}
```

On `#F4F7FB` canvas, user sees a **small navy circle** with faint cyan rim — not the detailed PNG eye. At 49px, SVG iris/pupil (`r=20`, pupil `r=8.4`) compresses to ~10px pupil → reads as **dot**.

### Cause 2 — PNG path not used on role/match guardian

FAB and modal use rich PNG artwork; guardian deliberately uses SVG `LeylekEye` for motion (eyelid, look-at). Visual mismatch across screens.

### Cause 3 — Matching chip mode

`passengerWatchGlassChip` background `rgba(5,11,24,0.72)` + eye-only chip → dark blob floating on map; no “AI” badge.

### Cause 4 — No theme variant on SVG

`LeylekEyeSvg` hardcodes:

- Sclera grey-blue gradients (designed for dark chrome)
- Eyelids `rgba(8,17,31,0.94)` — always dark lids
- No `resolvedTheme` prop

---

## C3. AI Control Center (Leylek Zeka modal)

**File:** `frontend/components/LeylekZekaChat.tsx`

Header structure (already correct information architecture):

```
[PNG eye in dark wrap] | eyebrow tagline
                       | "Leylek Zeka" + [AI badge]
                       | subtitle / mode caption
```

**Gaps vs user expectation:**

| Expectation | Current state |
|-------------|---------------|
| Real Leylek Zeka eye near title | PNG present but 26–32px effective inside 48px dark box |
| “AI” clearly visible | Badge exists (`aiBadgeText: 'AI'`) but modal is fully dark — less contrast issue than on light app behind sheet |
| White theme: clean/light eye | Modal ignores theme; `COCKPIT_HERO_GRADIENT`, `BlurView tint="dark"`, backdrop `rgba(2,6,14,0.72)` |
| Dark theme: black/premium eye | Current design target — works |

**Modal heaviness on white theme:** Entire sheet stack is dark navy layers (~6 gradient/blur passes). Opening from light dashboard creates maximum contrast shock.

---

## C4. Unified eye family plan (no asset overwrite without approval)

### Tier 1 — Styles only (B3-7B safe)

1. **`LeylekEye` theme prop:** `variant: 'dark' | 'light'`
   - Light: capsule `#FFFFFF` + `border.emphasis`; SVG sclera lighter; iris saturation +10%; eyelids `rgba(15,23,42,0.12)` not navy
   - Dark: current values unchanged
2. **Guardian widget:** Pass `variant` from `useTheme().resolvedTheme`; bump role-select opacity 0.74 → 0.92 on light; optional `size={52}` on match home only
3. **`LeylekZekaWidget` FAB:** Keep PNG + AI badge; ensure badge uses light-readable rim on light theme (future)
4. **Modal header:** Swap dark `headerLogoWrapCompact` bg for theme-aware surface; keep PNG asset

### Tier 2 — Asset work (needs explicit approval)

| Asset | Purpose |
|-------|---------|
| `leylek-zeka-eye-light.png` | PNG path on white chrome (optional; invert-friendly export from v4 SVG) |
| `leylek-zeka-eye-dark.png` | Rename/current PNG as dark master |
| Wire v4 SVG | Vector master for scalable guardian if PNG/SVG unification desired |

### Tier 3 — Unification decision

**Recommendation:** One **component API** (`LeylekZekaMark`) wrapping:

- `mode: 'guardian-svg' | 'mark-png' | 'trigger-compact'`
- `theme: 'light' | 'dark'`
- `showAiBadge?: boolean`

Implementation can start with thin wrapper over existing `LeylekEye` + PNG without deleting either.

---

## C5. Screen-by-screen target behavior

| Screen | Eye type | Light theme | Dark theme |
|--------|----------|-------------|------------|
| Role select | Guardian SVG | White capsule, teal iris, readable at 49px | Navy capsule (current) |
| Eşleşme kararı | Guardian SVG | Same + align to phase title | Current |
| FAB | PNG + AI | Light ring + AI badge contrast | Current gradient FAB |
| Zeka modal header | PNG + AI | Light header bar; eye on white chip | Dark cockpit header |
| Driver map | Trigger PNG | Light gradient capsule (optional P2) | Dark (current) |

---

## C6. Files involved

| File | Role |
|------|------|
| `design-system/leylek-eye/LeylekEye.tsx` | SVG + capsule — needs theme variant |
| `design-system/leylek-eye/useLeylekEyeMotion.ts` | Unchanged |
| `components/LeylekZekaWidget.tsx` | Guardian anchors, opacity, FAB PNG |
| `components/LeylekZekaChat.tsx` | Modal chrome + header mark |
| `components/superUx/LeylekEyeTrigger.tsx` | Driver compact trigger |
| `assets/images/leylek-zeka-eye.png` | PNG master (Tier 2 only) |
