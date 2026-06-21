# UX-P1-ROLECARD-1A — Risk Register

**Sprint:** UX-P1-ROLECARD-1A  
**Mode:** Read-only analysis  

---

## R1 — Aggregate summary counts (High)

**Risk:** `/trusted/summary` `active_count` includes **all** trusted peers. A user with both trusted drivers and trusted passengers may see wrong «X güvenilir yolcu» if passenger formatter or unfiltered counts are reused.

**Mitigation:** Filter `/trusted/connections` where `item.role === 'passenger'` for driver-branch subtitle; or extend backend summary with role-scoped fields.

**Test:** User with 2 driver peers + 3 passenger peers → card must show 3, not 5.

---

## R2 — Role switch during active passenger tag (High)

**Risk:** Option A (`setScreen('dashboard')` driver) while `activeTag` exists could strand journey state or show wrong cockpit.

**Mitigation:** Hard gate: if passenger `activeTag` resumable, disable card or show informative alert; do not switch role.

**Test:** Mid-trip passenger → tap card → must not enter driver offer deck.

---

## R3 — Vehicle kind / 403 on set-ride-vehicle-kind (Medium)

**Risk:** Driver switch POST returns 403 (vehicle not approved for kind).

**Mitigation:** Reuse `alertVehicleRegistrationRequired` + KYC navigation from existing role-select path.

**Test:** Approved motorcycle only, stale car kind in cache.

---

## R4 — Stale local `user.driver_details` (Medium)

**Risk:** Card shows driver branch but server rejects driver mode.

**Mitigation:** Same as existing TDM guard; on 403 fall back to role-select or KYC.

---

## R5 — Double entry to TDM (Low)

**Risk:** Deep link or legacy path opens TDM despite card fix.

**Mitigation:** Keep destination-confirm guard until TDM entry points are audited.

---

## R6 — Accessibility / copy confusion (Low)

**Risk:** «Yolcularım» on passenger home confuses users who are riding as passengers today.

**Mitigation:** Subtitle clarifies driver-network context; a11y label includes «Sürücü paneline git». Card only appears for approved drivers.

---

## R7 — Extra API load (Low)

**Risk:** Fetching full connections list for count on every passenger home mount.

**Mitigation:** Cache alongside summary; or accept aggregate count with «·» pending breakdown only when role-filtered data exists.

---

## R8 — TrustedNetworkHub subtitle inconsistency (Info)

**Risk:** Hub uses `connections.length` for header subtitle, not role-filtered — pre-existing; out of 1B scope but same count semantics as R1.

---

## R9 — Online presence line (Low)

**Risk:** Accidentally using `formatPassengerTrustedCardSubtitle` on driver branch adds «X sürücün şu anda müsait».

**Mitigation:** Use `formatDriverTrustedHeaderSubtitle` only (no online append).

---

## Rollback

Single-feature flag not required for 1B: revert prop branch in `PassengerMatchModeCards` + handler in `index.tsx`. No schema migration.
