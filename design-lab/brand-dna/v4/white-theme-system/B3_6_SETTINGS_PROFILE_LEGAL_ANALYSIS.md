# B3-6 Settings / Profile / Legal Analysis

**Group:** 7 — Settings / Profile / Legal  
**Patch:** B3-6c (early — low user traffic, validates settings bridge)

---

## Scope

- `settings-hub.tsx`
- `ThemeSettingsSegment.tsx` ✅ (B3-5 done)
- `profile.tsx`, `ProfileScreen.tsx`
- `delete-account.tsx`
- Legal routes: `privacy.tsx`, `terms.tsx`, `kvkk.tsx` → `LegalPages.tsx`
- `driver-offer-sound-settings.tsx`
- Support links in hub

---

## Current hardcoded colors

| File | Pattern |
|------|---------|
| settings-hub | PREMIUM shell + CockpitBackground ✅ |
| ThemeSettingsSegment | Token-based ✅ |
| profile.tsx | ~40 PREMIUM — legacy hub clone |
| ProfileScreen | Mixed |
| LegalPages | **Separate COLORS** — not PREMIUM |
| delete-account | Hub pattern |

---

## LHIS primitives

| File | Status |
|------|--------|
| settings-hub | ✅ CockpitBackground, GlassSurface cards |
| ThemeSettingsSegment | ✅ Full tokens |
| profile | ❌ Mostly hardcoded |
| LegalPages | ❌ Legacy palette |

**Ideal early patch:** User toggles theme in settings → sees immediate hub/profile feedback.

---

## Risk: **P2** | Complexity: **Medium**

LegalPages dual palette is maintenance debt — migrate to tokens without content change.

---

## Tokens needed

- Hub card → already via GlassSurface
- Profile field labels → `tokens.text.muted`
- Legal body → `tokens.text.primary`, link accent
- Delete account danger → keep semantic red (not theme-inverted)

---

## Migrate first

1. `settings-hub.tsx` shell PREMIUM_* → tokens (cards already Glass)
2. `profile.tsx` + `ProfileScreen.tsx`
3. `delete-account.tsx`
4. `driver-offer-sound-settings.tsx`
5. `LegalPages.tsx` COLORS → token bridge

---

## Files affected

```
frontend/app/settings-hub.tsx
frontend/components/theme/ThemeSettingsSegment.tsx (no change)
frontend/app/profile.tsx
frontend/components/ProfileScreen.tsx
frontend/app/delete-account.tsx
frontend/components/LegalPages.tsx
frontend/app/privacy.tsx
frontend/app/terms.tsx
frontend/app/kvkk.tsx
frontend/app/driver-offer-sound-settings.tsx
```

---

## Must NOT change

- ThemeSettingsSegment behavior (B3-5)
- Profile API calls
- Legal text content
- Delete account confirmation flow
- Navigation stack

---

## QA

| ID | Test |
|----|------|
| QA-6c-01 | Settings toggle → hub reflects mode |
| QA-6c-02 | Profile readable light |
| QA-6c-03 | Legal scroll + links |
| QA-6c-04 | Delete account dark/light |

---

## Rollback

Flag `settings` off; ThemeSettingsSegment still works but preview limited to segment only.

---

**Strategic note:** B3-6c before passenger/driver validates end-to-end theme persistence from settings.
