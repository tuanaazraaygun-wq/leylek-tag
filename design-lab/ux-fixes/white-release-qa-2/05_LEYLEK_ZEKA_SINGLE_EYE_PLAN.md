# 05 — Leylek Zeka Single-Eye Architecture Plan

**Finding:** Göz her yerde aynı olmalı. Driver cockpit header eye farklı. LeylekZekaChat eye farklı. AI Kontrol Merkezi White’da profesyonel değil. Sesli cevap state net değil.

---

## Current eye inventory

### Canonical: `LeylekEye` (SVG + capsule)

`frontend/design-system/leylek-eye/LeylekEye.tsx`

| Prop | Role |
|------|------|
| `size` | 49 / 66 / 68 / ~44 |
| `chromeTone` | `default` \| `subtle` |
| `themeVariant` | `light` \| `dark` |
| `motionProfile` | `fab` (gaze) \| `guardian` (calm) |

**Uses LeylekEye (correct path):**

| Surface | File | Size | themeVariant |
|---------|------|------|--------------|
| Role select guardian | `LeylekZekaWidget.tsx:1018` | 49 | from theme |
| Match decision guardian | `LeylekZekaWidget.tsx:1038` | 49 | from theme |
| Matching chip | `LeylekZekaWidget.tsx:1077` | ~44 | from theme |
| **Light FAB** | `LeylekZekaWidget.tsx:1157` | 68 | hardcoded `light` |
| Tag match overlay | `TagMatchTransitionOverlay.tsx:94` | 66 | default dark |
| Rating modal | `RatingModal.tsx:220` | 49 | default dark |

### Legacy PNG (inconsistent)

| Surface | Component | Asset | Issue |
|---------|-----------|-------|-------|
| **Driver cockpit header** | `LeylekEyeTrigger` | `leylek-zeka-eye.png` | Always dark navy; no motion |
| **Dark FAB** | `LeylekZekaWidget.tsx:1166` | PNG + gradient | Duplicate animation |
| **Chat header** | `HeaderLogoMark` in `LeylekZekaChat.tsx:316` | PNG 30×30 | Pulse only, no SVG blink |
| Chat empty | `EmptyWelcome` | `leylek-logo-premium.png` | Different asset entirely |

**Driver header call site:** `index.tsx:19088` — `<LeylekEyeTrigger />`

**Dead import:** `LeylekZekaWidget.tsx:45` imports `LeylekEyeTrigger` but never renders it.

---

## Size token drift

| Surface | Size |
|---------|------|
| `LEYLEK_EYE_FAB_SIZE` | 68 |
| `LEYLEK_EYE_ROLE_SELECT_SIZE` | 49 |
| `LeylekEyeTrigger` | 42 (hardcoded) |
| Chat `HeaderLogoMark` wrapper | 48 |
| Header action buttons | 40×40 |

Recommend unified `sizes.ts` export: `HEADER = 42`, `CHAT_HEADER = 48`, `FAB = 68`, `GUARDIAN = 49`.

---

## AI Kontrol Merkezi — light gaps

`LeylekZekaChat.tsx` — `isLightShell = resolvedTheme === 'light'` (~377)

**Partial light:** sheet gradient, title/subtitle, AI bubbles, composer input.

**Still dark HUD on white:**

| Area | Lines (approx) |
|------|----------------|
| Header glow overlay | 1340–1345 |
| Speech toggle chip | 1378–1397, 1972–2000 |
| Durdur / Tekrar oku mini controls | 1399–1428 |
| Beta / error banners | 1447–1461 |
| Message list container | 1464–1522, 2089–2098 |
| Empty welcome | 1490–1500 |
| Typing indicator | 1502–1520 |
| Voice hold zone (PTT) idle | 1541–1650 |
| Header eye PNG | 1349 |

---

## Sesli cevap (TTS) state clarity

**Default:** `speechEnabled = true` (`LeylekZekaChat.tsx:380`)

| State | UI |
|-------|-----|
| On/Off | Header pill: icon + “Sesli cevap açık/kapalı” (~1378–1397) |
| Speaking | Ephemeral “Durdur” (~1399–1414) |
| Replay | “Tekrar oku” when speakable (~1416–1428) |

**Issues:**
- Toggle chip uses dark navy styling on light shell — open vs closed hard to distinguish.
- No composer-level indicator when speech disabled.
- No persistent “speaking now” affordance beyond small Durdur chip.

**PTT (separate system):** “Basılı tut ve konuş” — listening state clearer; idle zone still dark on light.

---

## Single-eye architecture (target)

```
frontend/design-system/leylek-eye/
  LeylekEye.tsx           ← sole renderer
  useLeylekEyeMotion.ts   ← shared motion
  sizes.ts                ← all size tokens (new)
```

### Migration map

| Replace | With |
|---------|------|
| `LeylekEyeTrigger` | `LeylekEye size={42} chromeTone="subtle" themeVariant={isScopeLight?'light':'dark'} motionProfile="guardian"` |
| `HeaderLogoMark` PNG | `LeylekEye size={48} ... motionProfile="guardian"` |
| Dark FAB PNG path | `LeylekEye size={68} themeVariant="dark" motionProfile="fab"` |
| Overlay/Rating defaults | Pass `themeVariant` from `useTheme()` |

### Deprecate

- `frontend/components/superUx/LeylekEyeTrigger.tsx`
- Direct `leylek-zeka-eye.png` in Zeka surfaces (keep PNG for app icon/marketing only)

### Chat light follow-up

Extend `isLightShell` to: `listWrap`, `EmptyWelcome`, speech controls, voice zone idle, typing bubble, beta banner; replace dark `headerBarGlow` with light veil.

---

## Recommended patch order (within Zeka sprint)

1. Add `sizes.ts` + export constants from `LeylekEye.tsx`
2. Replace `LeylekEyeTrigger` in driver header (`index.tsx:19088`)
3. Replace `HeaderLogoMark` in chat
4. Unify dark FAB to SVG (remove PNG animation block)
5. Light shell pass on chat subcomponents
6. Speech toggle — segmented control or switch with filled/unfilled states + composer hint

**Out of scope:** TTS engine, speech API, chat message logic, backend AI routes.

---

## Verification checklist

- [ ] Driver header eye matches passenger FAB eye (SVG, motion, capsule)
- [ ] Chat header eye identical at 48dp
- [ ] Light theme: AI Kontrol Merkezi no dark slabs on white
- [ ] Sesli cevap: open/closed distinguishable at glance
- [ ] Dark theme: no regression on FAB/guardian
- [ ] `LeylekEyeTrigger.tsx` removed or thin re-export only
