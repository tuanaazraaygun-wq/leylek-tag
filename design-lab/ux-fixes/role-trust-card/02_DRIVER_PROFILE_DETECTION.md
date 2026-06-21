# UX-P1-ROLECARD-1A — Driver Profile Detection

**Sprint:** UX-P1-ROLECARD-1A  
**Mode:** Read-only analysis  

---

## Detection function

**Location:** `frontend/app/index.tsx` (module-level helper, not exported)

```388:403:frontend/app/index.tsx
/** Onaylı sürücü kaydı (yolcu modunda TDM «Sürücülerim» kartı guard). */
function userHasDriverRegistration(user: User | null | undefined): boolean {
  const dd = user?.driver_details;
  if (!dd || typeof dd !== 'object' || Array.isArray(dd)) return false;
  const d = dd as Record<string, unknown>;

  if (_approvedVehicleKindsFromDriverDetails(d).length > 0) return true;

  const kycStatus = String(d.kyc_status ?? '').trim().toLowerCase();
  if (kycStatus !== 'approved' || d.is_verified !== true) return false;

  const kycVk = _canonicalDriverVehicleKindForGuard(d.kyc_vehicle_kind);
  if (kycVk) return true;

  return _canonicalDriverVehicleKindForGuard(d.vehicle_kind) != null;
}
```

---

## Decision tree

```
user.driver_details exists and is object?
  NO → not registered driver
  YES → approved_vehicle_kinds[] non-empty?
          YES → registered driver ✓
          NO → kyc_status === 'approved' AND is_verified === true?
                  NO → not registered driver
                  YES → kyc_vehicle_kind or vehicle_kind canonical (car|motorcycle)?
                          YES → registered driver ✓
                          NO → not registered driver
```

---

## Inputs on `User`

| Field | Purpose |
|-------|---------|
| `user.driver_details.approved_vehicle_kinds` | Primary signal — server-approved vehicle list (JSON array or string) |
| `user.driver_details.kyc_status` | Fallback path requires `'approved'` |
| `user.driver_details.is_verified` | Must be `true` with approved KYC |
| `user.driver_details.kyc_vehicle_kind` | Canonical car / motorcycle |
| `user.driver_details.vehicle_kind` | Last-resort vehicle kind |

**Not used for this guard:** `user.role`, `selectedRole`, `last_role_*` AsyncStorage. A user can be in **passenger UI** (`selectedRole === 'passenger'`, `screen === 'dashboard'`, passenger branch) while `userHasDriverRegistration` is true.

---

## Where guard is applied today

| Call site | Behavior |
|-----------|----------|
| `PassengerMatchModeCards` `onTrustedPress` | Alert + abort TDM |
| Destination confirm `routePickerIntent === 'trusted_direct'` | Alert + reset intent |

No guard on card **render** — only on **action**.

---

## Trust count source

### API

`GET /trusted/summary` — JWT actor, no `role` query (`trustedNetworkApi.ts`).

Returns:

```typescript
{
  active_count: number;
  incoming_pending_count: number;
  outgoing_pending_count: number;
  online_trusted_count: number; // passenger→driver peers only (radar)
}
```

### Backend semantics (`_trusted_summary_for_actor`)

- Counts **all** active / pending trusted peers (both directions)
- Does **not** split «counterparty is driver» vs «counterparty is passenger»
- `online_trusted_count` counts only connections where **actor was passenger** and counterparty is driver (TDM readiness)

### Connection list (role-aware per row)

`GET /trusted/connections` returns each item with:

```typescript
connection.role  // counterparty's role: 'driver' | 'passenger'
```

- `role === 'driver'` → trusted **sürücü** (passenger perspective)
- `role === 'passenger'` → trusted **yolcu** (driver perspective)

**Implication:** For «X güvenilir yolcu» on the passenger-home card, **`/trusted/summary.active_count` is not reliably correct** if the user has both driver-side and passenger-side trust links. Accurate count requires either:

1. **Frontend:** derive from `/trusted/connections` — `connections.filter(c => c.role === 'passenger').length` (+ pending semantics), or  
2. **Backend (optional):** extend summary with `active_passenger_peers` / `active_driver_peers`

---

## Recommended detection for patch (1B)

| Signal | Use |
|--------|-----|
| `userHasDriverRegistration(user)` | Branch card title, subtitle formatter, tap handler |
| `useTrustedSummary()` | Keep for normal passengers |
| Driver-branch subtitle | Prefer `formatDriverTrustedHeaderSubtitle(summary)` **with documented aggregate-count caveat**, or connections-derived count for accuracy |

---

## False positives / negatives

| Case | `userHasDriverRegistration` | Notes |
|------|----------------------------|-------|
| KYC pending, no approved kinds | `false` | Card stays passenger TDM |
| Approved car only | `true` | Driver branch |
| Passenger-only account | `false` | Unchanged |
| Stale `driver_details` in local user cache | May drift | Same risk as existing TDM guard; refresh on login/resume |

---

## Backend required?

**For detection:** No — existing `user.driver_details` is sufficient.

**For accurate «güvenilir yolcu» count with mixed trust graph:** Optional backend improvement; frontend-only workaround via `/trusted/connections` filter is viable for 1B.
