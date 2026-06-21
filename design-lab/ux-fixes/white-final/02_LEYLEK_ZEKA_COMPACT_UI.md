# 02 — Leylek Zeka Compact LHS UI

**Sprint:** WHITE-FINAL-1A (read-only)  
**Files:** `LeylekZekaWidget.tsx`, `LeylekZekaChat.tsx`, `LeylekEye.tsx`, `index.tsx` chrome context

---

## Goal recap

Leylek Zeka should feel **compact, professional, LHS-aligned** on both **White** and **Dark** — consistent with guardian eye identity, not a floating dark orb on daylight screens.

---

## Architecture (three surfaces)

| Surface | Component | When shown |
|---------|-----------|------------|
| **Guardian eye** | `LeylekEye` (SVG + capsule) | Role select, passenger match decision, matching/wait map anchors |
| **FAB orb** | Static PNG + navy gradient | Default map/dashboard FAB when guardian modes off |
| **Chat sheet** | `LeylekZekaChat` modal | User opens Zeka |

---

## Guardian eye — strong on light (recent work)

**`LeylekEye.tsx`**

- `themeVariant: 'dark' | 'light'` — same SVG eye; light capsule = white gradient + teal rim.
- Size constants: `LEYLEK_EYE_ROLE_SELECT_SIZE = 49`, hero 66.

**`LeylekZekaWidget.tsx`**

- `eyeThemeVariant = resolvedTheme === 'light' ? 'light' : 'dark'`.
- Anchors:
  - Role select: `roleSelectEyeAnchor` opacity 0.74 dark / **1.0 light**.
  - Match decision: `passengerMatchHomeEyeAnchor` 0.88 dark / **1.0 light**.
- Motion: `motionProfile="guardian"`, `chromeTone="subtle"`.

**Gap:** Match decision guardian sits in global overlay; `passengerMatchGuardianSlot` in index is empty spacer — eye position is computed (`passengerMatchHomeEyeTop`) not inside card deck. **OK for compact** but must stay aligned with header slot on all breakpoints.

---

## FAB orb — light theme gap (main issue)

**Constants:** `FAB_SIZE = 68`, corner 23, bottom inset +14px.

**Dark-only styling (no light branch):**

| Element | Style | Light problem |
|---------|-------|---------------|
| `fabGrad` | `#0B1E33` → `#22A8D8` gradient | Heavy navy on white map/cockpit |
| `logoImage` | `leylek-zeka-eye.png` raster | Not same capsule family as `LeylekEye` SVG |
| `orbAiBadge` | `rgba(5, 18, 32, 0.92)` + cyan border | Dark chip on light UI |
| `orbHintCapsule` | `rgba(8, 18, 32, 0.82)` + cyan rim | Hint bubble always dark HUD |
| `orbHintTail` | Cyan triangle on dark capsule | Same |
| Shadow | `GLOW = Colors.primary` cyan halo | Acceptable on light if opacity reduced |

**No `resolvedTheme` branch** on FAB path except guardian anchors above.

---

## LeylekZekaChat — partial light LHS (good baseline)

**`LeylekZekaChat.tsx`**

- `isLightShell = resolvedTheme === 'light'`.
- Light paths: `sheetLight`, `bubbleAiCardLight`, `bubbleTextAiLight`, `headerLogoWrapCompactLight`.
- Dynamic tokens: `sheetGradient`, `sheetBorderColor`, `backdropBg`, BlurView `tint='light'`, `intensity=28`.
- Header uses compact logo mark + `tokens.accent.primary` eyebrow on light.

**Remaining dark baselines on light shell:**

| Area | Issue |
|------|-------|
| `emptyState` / operation guide | Mostly dark-navy copy colors in base styles |
| Voice status row | `voiceStatusTitle` `#BAE6FD` — low contrast on white sheet header |
| User bubble | Cyan gradient unchanged (acceptable brand) |
| Panel height | `panelMaxHeight = 74%` window — not compact; product may want 62–68% |

---

## Compact / professional targets (LHS constitution cross-ref)

From `white-lhs-master/04_WHITE_LHS_CONSTITUTION.md`:

| Rule | Zeka application |
|------|------------------|
| Surfaces opaque white / frosted | Chat sheet ✓; FAB ✗ |
| Text `text.primary` on light | Chat partial; hint capsule ✗ |
| Teal accent `#00D4AA` not neon cyan fill | Guardian eye ✓; FAB gradient heavy cyan |
| No full-screen navy vignette | FAB + hint violate on light |

**Proposed compact spec (analysis only):**

1. **Unify FAB with `LeylekEye`** at `FAB_SIZE` or reduce to 56–60 for less map occlusion.
2. **Light FAB:** reuse `LeylekEye` `wrapLight` capsule; drop static PNG on guardian-capable screens.
3. **Hint bubble:** token gate `usePassengerTheme` / `useTheme` → white elevated pill + slate text.
4. **Chat:** reduce default panel height on match/wait flow hints; keep full height on explicit open from FAB.

---

## Flow matrix

| Flow | Chrome | Light readiness |
|------|--------|-----------------|
| Role select | Guardian `LeylekEye` | ✅ P0 role patch |
| Match decision | Guardian centered top | ✅ Eye light; cockpit LHS P0 |
| Waiting / searching | Map anchor + optional hint | ⚠️ Hint dark |
| In-trip map | FAB + hint | ⚠️ FAB dark |
| Chat open | Modal sheet | ✅ Mostly light |

---

## index.tsx / context

- `useLeylekZekaChrome()` sets `homeFlowScreen`, `flowHint` — drives which anchor renders.
- `openLeylekZekaFromMap` → `setLeylekZekaChatOpen(true)` — chat only, no FAB restyle.
- No theme hook in chrome context today.

---

## Recommendation (next sprint)

| Priority | Change | Files |
|----------|--------|-------|
| P0 | Light theme FAB + hint tokens | `LeylekZekaWidget.tsx` |
| P1 | Replace FAB PNG with `LeylekEye` size 56–60 | `LeylekZekaWidget.tsx` |
| P1 | Voice/status light text in chat | `LeylekZekaChat.tsx` |
| P2 | Compact panel height by `flowHint` | `LeylekZekaChat.tsx` |

**Do not** change socket, AI backend, or chat logic.
