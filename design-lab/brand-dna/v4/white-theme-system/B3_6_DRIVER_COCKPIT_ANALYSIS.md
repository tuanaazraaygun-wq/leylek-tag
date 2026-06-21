# B3-6 Driver Cockpit Analysis

**Group:** 4 — Driver Home / Cockpit  
**Patch:** B3-6e

---

## Scope

- `DriverOfferScreen.tsx` (field map + offer list)
- `DriverDashboardPanel.tsx`
- `DriverCockpitQuickStrip.tsx`
- `DriverQuickMatchInviteCard.tsx`, `DriverTrustedDirectInviteCard.tsx`
- `driverWaitingShellStyles.ts`
- index.tsx driver dashboard branch

---

## Current hardcoded colors

| File | Refs | Notes |
|------|------|-------|
| `DriverOfferScreen` | **~102** | COLORS object + PREMIUM mix, map seeking green/orange |
| `DriverDashboardPanel` | ~10 | Panel chrome |
| `driverWaitingShellStyles` | Hardcoded navy | Waiting shell |
| superUx driver cards | 13–17 each | Glass + inline btn |

---

## LHIS primitives

| Component | Primitives |
|-----------|------------|
| DriverOfferScreen | Partial PremiumText/Glass in chrome |
| Invite cards | ✅ GlassSurface |
| Offer list items | Legacy View styles |
| Map field markers | Ionicons + hardcoded green/orange (separate from PNG markers) |

---

## Risk: **P0** | Complexity: **Very High**

Driver offer = map + list + realtime — tri-modal risk (theme + performance + offers).

---

## Tokens needed

- `tokens.map.chrome`
- Seeking states → `tokens.status.warning` / success variants
- Offer row → `tokens.bg.glass`, border card
- Online/offline chip → status tokens
- Quick strip → `tokens.bg.elevated`

---

## Migrate first

1. `driverWaitingShellStyles.ts` → theme hook
2. `DriverCockpitQuickStrip.tsx`
3. `DriverQuickMatchInviteCard.tsx` (already Glass)
4. `DriverOfferScreen` chrome wrapper (not map markers yet)
5. Offer list rows token pass
6. Field map marker colors → marker-evolution alignment

---

## Files affected

```
frontend/components/DriverOfferScreen.tsx
frontend/components/DriverDashboardPanel.tsx
frontend/components/superUx/DriverCockpitQuickStrip.tsx
frontend/components/superUx/DriverQuickMatchInviteCard.tsx
frontend/components/superUx/DriverTrustedDirectInviteCard.tsx
frontend/components/driver/driverWaitingShellStyles.ts
frontend/app/index.tsx (driver dashboard shell)
```

---

## Must NOT change

- Offer polling / sound prefs
- Map fitToCoordinates
- Accept/reject handlers
- Trusted direct session logic

---

## QA

| ID | Test |
|----|------|
| QA-6e-01 | Driver online → offer received dark |
| QA-6e-02 | Light mode offer card contrast |
| QA-6e-03 | Seeking map pins visible on light |
| QA-6e-04 | QM invite card |

---

## Rollback

Flag `driver` off; DriverOfferScreen highest revert priority.
