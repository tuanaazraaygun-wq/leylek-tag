# UX-P1-ROLECARD-1B — Patch Plan (proposed)

**Sprint:** UX-P1-ROLECARD-1A analysis → UX-P1-ROLECARD-1B implementation  
**Goal:** Driver-reg users in passenger mode see **Yolcularım** card and safely reach **driver cockpit**  
**Constraint:** No backend/socket/payment/QR/match changes in minimal hotfix; normal passenger flow unchanged

---

## Files to touch (minimal)

| Priority | File | Change |
|----------|------|--------|
| P0 | `frontend/components/superUx/PassengerMatchModeCards.tsx` | Accept `viewerHasDriverRegistration?: boolean`; branch trusted card title/subtitle/formatter |
| P0 | `frontend/app/index.tsx` | Pass flag; replace driver-reg `onTrustedPress` with `switchToDriverDashboardSafely` |
| P1 | `frontend/lib/trustedSummaryCopy.ts` | Optional `formatDriverTrustedCardSubtitle` (dashboard context, no online line) — or reuse `formatDriverTrustedHeaderSubtitle` |
| P2 | `frontend/lib/userDriverRegistration.ts` (new) | Extract `userHasDriverRegistration` + helpers from `index.tsx` for testability |
| P2 | `frontend/hooks/useTrustedPassengerPeerCount.ts` (new, optional) | Soft-load connections; count `role === 'passenger'` for accurate subtitle |

**Do not touch:** `QRTripEndModal`, socket handlers, match APIs, `TrustedNetworkHub` (unless follow-up for R1/R8).

---

## Patch 1 — Card copy branch (`PassengerMatchModeCards.tsx`)

**Add prop:**

```typescript
viewerHasDriverRegistration?: boolean;
```

**In `renderSecondaryHero` for `id === 'trusted'`:**

```typescript
const isDriverViewer = viewerHasDriverRegistration === true;
const displayTitle = isDriverViewer ? 'Yolcularım' : card.title;
const trustedSubtitle = trustedReady && summary
  ? isDriverViewer
    ? formatDriverTrustedHeaderSubtitle(summary) // or filtered count helper
    : formatPassengerTrustedCardSubtitle(summary)
  : null;
const fallbackSubtitle = isDriverViewer
  ? 'Güvenilir yolcularınız'
  : card.subtitle;
```

**Accessibility:** When driver viewer, `accessibilityLabel` suffix «Sürücü paneline git».

---

## Patch 2 — Tap handler (`index.tsx`)

**Replace driver-reg block inside `onTrustedPress`:**

```typescript
onTrustedPress={() => {
  playTapSound();
  if (userHasDriverRegistration(user)) {
    void switchToDriverDashboardSafely({
      user,
      activeTag,
      saveUser,
      setUser,
      setSelectedRole,
      setRideVehicleKind,
      setScreen,
      requestLocationPermission,
      openDriverVehicleUpgradeKyc: (kind) => { ... },
    });
    return;
  }
  // existing TDM route picker (unchanged)
}}
```

**Implement `switchToDriverDashboardSafely`:**

Extract from existing `tryDriverResumeFromActiveTagAfterPrimaryFailure` success path (~520–561):

1. If `activeTag` && passenger resumable → alert, return
2. Pick `vk` from approved kinds / driver_details
3. POST `set-ride-vehicle-kind` role=driver
4. Merge user, persist, `setScreen('dashboard')`

**Remove** card-tap call to `alertTrustedDirectPassengerOnlyBlocked` for driver-reg users.

---

## Patch 3 — Accurate count (optional P1)

If R1 unacceptable in QA:

```typescript
// useTrustedPassengerPeerCount.ts
const { connections } = await getTrustedConnections();
const activePassengers = connections.filter(c => c.role === 'passenger').length;
```

Use in driver-branch subtitle instead of `summary.active_count`.

Pending counts: filter pending APIs by counterparty role if backend exposes role on pending rows; else show aggregate pending only with copy «davet» lines from summary (document imperfection) or defer.

---

## Patch 4 — Defense in depth (keep)

Leave existing guard at destination confirm for `trusted_direct` (~11681) until all TDM entry points gated.

---

## Test plan

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Passenger-only user | «Sürücülerim», TDM picker, passenger subtitle |
| 2 | Approved driver, no active tag | «Yolcularım», driver subtitle, tap → driver dashboard |
| 3 | Approved driver, active passenger tag | Tap blocked or alert; no driver dashboard |
| 4 | Driver reg, zero trusted passengers | «Güven ağınızı oluşturun» |
| 5 | Summary API fail | Static driver fallback; tap still switches if registration valid |
| 6 | Mixed trust graph (QA account) | Subtitle count matches passenger peers only (if Patch 3) |
| 7 | set-ride-vehicle-kind 403 | KYC alert, stay on passenger home |

---

## Backend follow-up (optional, not blocking 1B)

Extend `GET /trusted/summary` response:

```json
{
  "active_driver_peers": 2,
  "active_passenger_peers": 5,
  "incoming_pending_driver_peers": 0,
  ...
}
```

Removes need for connections fetch on home deck.

---

## Effort estimate

| Scope | Size |
|-------|------|
| Copy branch + routing only (aggregate counts) | ~80–120 LOC, 2 files |
| + extracted switch helper | +60 LOC |
| + connections-filtered count | +1 hook, +40 LOC |

Recommended ship: **P0 + Patch 2** first; Patch 3 if QA hits R1.
