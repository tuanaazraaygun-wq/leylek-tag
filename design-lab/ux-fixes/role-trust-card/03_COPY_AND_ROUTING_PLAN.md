# UX-P1-ROLECARD-1A — Copy and Routing Plan

**Sprint:** UX-P1-ROLECARD-1A  
**Mode:** Read-only analysis (proposed UX for 1B)

---

## Should the card change?

**Yes** — for users where `userHasDriverRegistration(user) === true` and the app is showing **passenger idle home**.

Rationale:

1. TDM («Sürücülerim» → route → direct request) is **intentionally blocked** for registered drivers (product rule in `TDM_DRIVER_ROLE_BLOCK_*`).
2. Showing «Sürücülerim» promises a flow that always ends in an error alert — poor trust UX.
3. Driver-side trust management already exists (`DriverCockpitQuickStrip`, `/trusted-network?role=driver`); the card should **bridge** to that world.

Normal passengers (no driver registration) keep today's card unchanged.

---

## Proposed copy matrix

| Element | Passenger only | Driver-reg in passenger mode |
|---------|----------------|------------------------------|
| **Title** | Sürücülerim | **Yolcularım** |
| **Subtitle (has active peers)** | `{n} güvenilir sürücü` (+ optional online line) | **`{n} güvenilir yolcu`** |
| **Subtitle (pending mix)** | `{a} sürücü · {inc} gelen davet` … | `{a} yolcu · {inc} gelen · {out} giden davet` |
| **Subtitle (empty)** | Henüz güvenilir sürücünüz yok | **Güven ağınızı oluşturun** |
| **Subtitle (loading)** | Güvendiğiniz sürücüler (static fallback) | **Güvenilir yolcularınız** or reuse driver stub |
| **Subtitle (API down)** | Güvendiğiniz sürücüler | **Güven ağı ve direkt eşleşme yakında** (match `DriverCockpitQuickStrip` stub) or static driver empty hint |
| **Tap CTA (a11y)** | Sürücülerim. {subtitle}. Rota seç | **Yolcularım. {subtitle}. Sürücü paneline git** |
| **Badge / pill** | None (enabled) | None — card remains tappable |

Copy sources already in repo:

- Title: `hubTitle('driver')` → «Yolcularım» (`trustedHubCopy.ts`)
- Subtitle structure: `formatTrustStructuralSubtitle('driver', counts, 'dashboard')` via `formatDriverTrustedHeaderSubtitle`
- Empty: `formatTrustStructuralSubtitle` driver branch when all counts zero

**Do not** append `online_trusted_count` on the driver-branch card — that field is passenger→driver radar only.

---

## Routing options (safest first)

### Option A — Full driver cockpit switch (recommended primary CTA)

Mirror the **approved driver resume** path in `index.tsx` (~542–561):

1. Guard: `userHasDriverRegistration(user)` && **no resumable passenger `activeTag`**
2. Resolve vehicle kind: `_pickDriverVehicleKindForResume` / approved kinds
3. `POST /user/set-ride-vehicle-kind?role=driver&vehicle_kind=…`
4. `saveUser({ …user, role: 'driver', driver_details.vehicle_kind })`
5. `setSelectedRole('driver')`, `setRideVehicleKind(vk)`
6. `AsyncStorage.setItem(last_role_*, 'driver')`
7. `setScreen('dashboard')` → driver cockpit

**Pros:** Matches «Sürücü Paneline Git» literally; same path as role-select continue.  
**Cons:** Must block or warn if passenger active tag exists; needs 403 → KYC handling (already patterned).

### Option B — Trusted hub driver role (secondary / insufficient alone)

`router.push('/trusted-network?role=driver')`

**Pros:** Zero role mutation; read-only trust list.  
**Cons:** **Not** the driver panel — user still in passenger session; does not satisfy stated CTA.

### Option C — Alert bridge (status quo+, not recommended as final)

Keep alert but fix card copy only; alert button runs Option A instead of `setScreen('role-select')`.

**Use:** Transitional only if Option A needs extra QA time.

---

## Recommended tap flow (1B)

```
onTrustedCardPress
  if !userHasDriverRegistration(user)
    → existing TDM route picker flow (unchanged)
  else if activeTag (passenger journey active)
    → appAlert: «Aktif yolculuğunuz varken sürücü paneline geçemezsiniz» (or finish trip first)
  else
    → switchToDriverDashboardSafely()  // Option A
```

Remove `alertTrustedDirectPassengerOnlyBlocked` from the **card tap** path for driver-reg users (alert becomes unnecessary if card never promises TDM).

Keep TDM guard on **route confirm** as defense-in-depth until TDM entry is fully unreachable for drivers.

---

## Fallback when count unavailable

| Condition | Subtitle |
|-----------|----------|
| `useTrustedSummary` loading | Static: «Güvenilir yolcularınız» |
| `status === 'unavailable'` | «Güven ağınızı oluşturun» or driver stub line |
| `active_count === 0` (driver-filtered) | «Güven ağınızı oluşturun» |
| Mixed graph / aggregate summary | Prefer connections-filtered count; if unavailable show structural line without number: «Güvenilir yolcularınız» |

Never show «X güvenilir sürücü» on the driver-reg branch.

---

## Normal passenger regression check

| Check | Expected |
|-------|----------|
| No `driver_details` / not approved | Card title «Sürücülerim», TDM route picker on tap |
| Subtitle | Passenger formatter + online line |
| Quick / Normal cards | Unchanged |
| Driver cockpit strip | Unchanged |

Branch predicate must be **`userHasDriverRegistration(user)` only**, not `user.role === 'driver'`.
