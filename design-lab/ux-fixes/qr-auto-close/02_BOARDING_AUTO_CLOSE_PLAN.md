# UX-P0-QR — Boarding Auto-Close Plan

**Target bug:** #1 — Driver must tap X after passenger scan succeeds  
**Principle:** Frontend-only, minimal diff, preserve idempotency and iOS modal safety

---

## Problem statement

Passenger boarding scan succeeds (HTTP 200 + local state update), but **driver QR modal stays open** until manual dismiss. Root cause: driver close path is exclusively `onBoardingConfirmed` socket + 400ms timer when `driverBoardingQrModalVisibleRef` is true.

Passenger modal close works via `onVerified → true → onClose()` and socket backup.

---

## Desired behavior

1. Passenger scans → both sides see brief success feedback → modals auto-close within ~400–800ms.
2. No manual X required on happy path.
3. Socket loss must not strand driver UI.

---

## Proposed fixes (ordered by safety)

### Fix 1 — Driver fallback from `activeTag.boarding_confirmed_at` (recommended)

**Where:** `frontend/app/index.tsx` (driver branch)

Add `useEffect` watching:

```typescript
activeTag?.boarding_confirmed_at
&& driverBoardingQrModalVisible
&& !driverBoardingRemoteAckTagRef.current
```

When set for current tag:

- Mirror existing socket handler: `setDriverBoardingRemoteSuccess(true)` → 400ms → `setDriverBoardingQrModalVisible(false)`.
- Reuse `driverBoardingRemoteAckTagRef` dedupe key = `activeTag.id`.

**Why safe:** State already committed by passenger verify or socket; idempotent overlay + close. No extra API call.

**Triggers when:** Socket delayed but passenger verify updated tag via shared realtime/polling; or driver receives tag refresh from `loadActiveTag`.

### Fix 2 — Optional: close inside `DriverBoardingQRModal` on `remoteSuccess`

**Where:** `frontend/components/DriverBoardingQRModal.tsx`

```typescript
useEffect(() => {
  if (!remoteSuccess || !visible) return;
  const t = setTimeout(onClose, BOARDING_REMOTE_ACK_MS);
  return () => clearTimeout(t);
}, [remoteSuccess, visible, onClose]);
```

**Note:** Parent already closes via timer; this is defense-in-depth if parent timer fails. Coordinate to avoid double-close race (parent should remain source of truth OR component owns close — pick one).

### Fix 3 — Passenger: reduce alert friction (optional, lower priority)

**Where:** `handlePassengerBoardingVerified` (~9852)

`appAlert('Biniş onaylandı', ...)` runs before modal close completes. Alert does not block `onClose()`, but may feel like "screen didn't close" if user focuses on toast.

Options:

- Move alert to **after** `onClose()` via short delay, or
- Replace with inline success beat only (BoardingScanModal already has success beat).

**Not root cause of driver X bug** — include only if UX polish pass.

---

## What NOT to do

| Avoid | Reason |
|-------|--------|
| New backend endpoint for driver close | Unnecessary; boarding already confirmed server-side |
| Close driver modal on QR fetch success | Wrong event |
| Remove `driverBoardingRemoteAckTagRef` dedupe | Risk duplicate haptic/sound loops on socket retry |
| Skip success overlay entirely | User needs confirmation scan registered |

---

## Socket changes

**Not required** for Fix 1. Backend already emits `boarding_confirmed` to driver room (`server.py` ~21891–21892).

Optional hardening (future):

- Re-emit on driver reconnect if tag already `in_progress` with `boarding_confirmed_at` (backend) — out of scope for P0 frontend patch.

---

## Test plan

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Normal boarding, socket OK | Driver overlay 400ms → modal closed |
| 2 | Airplane mode driver after passenger scan, then reconnect | Fallback effect OR tag refresh closes modal |
| 3 | Duplicate scan (idempotent verify) | No double modal flicker; ack ref blocks |
| 4 | Wrong tag QR | Passenger alert, driver modal unchanged |
| 5 | Driver closes modal before scan | No crash; passenger scan still works |
| 6 | iOS + Android | No double-modal touch freeze on subsequent screens |

---

## Rollback

Single-file revert in `index.tsx` (remove `useEffect` fallback). No migration, no backend rollback.

---

## Effort

| Item | Size |
|------|------|
| Fix 1 activeTag fallback | ~25 lines in `index.tsx` |
| Fix 2 component onClose | ~10 lines optional |
| Fix 3 alert timing | ~5 lines optional |

**Backend needed:** No  
**Production touched in patch:** Yes — `frontend/app/index.tsx` (+ optional `DriverBoardingQRModal.tsx`)
