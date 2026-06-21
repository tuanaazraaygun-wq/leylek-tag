# UX-P0-QR — Trip Finish Auto-Complete Plan

**Target bugs:** #2 Quick Match end friction, #3 scan → complete → rating without extra prompts  
**Principle:** Auto-submit `complete-qr` when payment method is already known; preserve IBAN/trusted guards

---

## Problem statement

After passenger scans driver's end QR, code **always** transitions to payment confirmation UI:

```typescript
// QRTripEndModal.tsx ~267-268
setPendingDriverId(driverUserId);
setPassengerStep('payment');
```

User expectation: scan = trip complete + rating (especially when cash was chosen at booking / Quick Match).

---

## Desired behavior

| Condition | After scan |
|-----------|------------|
| `bookingPaymentMethod === 'cash'` AND NOT IBAN-blocked | Auto `submitCompleteQr('cash', driverId)` → close → rating |
| `bookingPaymentMethod === 'card'` | Keep payment step OR auto with card (product decision; card is "yakında") |
| IBAN snapshot + transfer not confirmed | Keep choose/claim flow; do NOT auto complete |
| `match_channel === 'trusted'` | No change — QR complete disabled; use claim flow |
| Missing `bookingPaymentMethod` | Keep legacy picker |

---

## Proposed fix — Auto-complete after scan beat

**Where:** `frontend/components/QRTripEndModal.tsx` — `handleBarCodeScanned`

After validation + success beat, replace unconditional `setPassengerStep('payment')` with:

```typescript
const booked = effectiveBookingPaymentMethod; // 'cash' | 'card' | undefined

if (booked === 'cash' && !showIbanOption) {
  // Quick Match / normal cash without IBAN snapshot guard
  await submitCompleteQr('cash', driverUserId);
  return;
}

if (booked === 'cash' && showIbanOption) {
  // IBAN snapshot exists — check if cash QR complete allowed
  // Backend: is_cash_qr_complete_allowed(booked, 'cash') when transfer pending blocks
  // If passenger chose cash at choose step already, still may need transfer confirm
  // SAFEST: auto only when !showIbanOption OR transfer already confirmed
  setPendingDriverId(driverUserId);
  setPassengerStep('payment'); // or auto if product confirms cash+IBAN OK
  return;
}

// card, unknown, legacy
setPendingDriverId(driverUserId);
setPassengerStep('payment');
```

### Recommended P0 rule (safest)

**Auto-complete when ALL true:**

1. `!isTrustedDirect`
2. `effectiveBookingPaymentMethod === 'cash'`
3. `!showIbanOption` (no `matched_bank_account_id` on tag)

This covers Quick Match cash without driver IBAN snapshot — primary user report.

**When `showIbanOption`:**

- If passenger selected **cash** at `choose` step: consider auto `submitCompleteQr('cash')` — backend `should_reject_complete_qr` returns None when `booked_pm === confirmed_pm === 'cash'` even with IBAN snapshot (`transfer_payment_service.py` ~153–168).
- If passenger selected **iban** at choose: do NOT auto complete; require transfer claim + driver confirm path.

Enhancement for P0.1:

```typescript
if (booked === 'cash' && ( !showIbanOption || chosenEndMethod === 'cash' )) {
  await submitCompleteQr('cash', driverUserId);
}
```

Track `chosenEndMethod` from existing choose-step state.

---

## Driver side (no change required)

Driver already auto-closes on `show_rating_modal` socket + 400ms (`index.tsx` ~16490–16502).

Ensure passenger auto `submitCompleteQr` still triggers backend socket emit → driver path unchanged.

---

## Rating path (already wired)

Passenger:

```
submitCompleteQr success
  → onComplete(true, driverId, name)
  → handlePassengerTripEndComplete
  → scheduleRatingModalAfterQrDismiss → RatingModal
```

Driver:

```
show_rating_modal socket
  → driverTripEndRemoteSuccess
  → close QR + scheduleDriverRating
```

No new rating wiring needed if `complete-qr` succeeds.

---

## Backend changes

**Not required for P0 cash auto-complete.**

Backend already:

- Accepts `payment_confirmed_method: 'cash'` when booked cash.
- Emits `show_rating_modal` on success.
- Returns 409 when IBAN transfer guard blocks (`should_reject_complete_qr`).

Frontend must handle 409 gracefully (fall back to payment/IBAN UI, show backend message).

---

## Quick Match specifics

- `match_channel: 'quick'` — same `QRTripEndModal`.
- Quick Match typically sets `passenger_payment_method: 'cash'` (~10954, ~11041 in `index.tsx`).
- No separate end modal; fix in `QRTripEndModal` applies to Quick Match automatically.

---

## Edge cases

| Case | Behavior |
|------|----------|
| Double scan | `scanned` / `processing` guards + backend idempotency on completed tag |
| Scan then network fail on complete-qr | Stay on scan step, show error alert, reset scanned |
| IBAN trip, transfer pending | 409 → show message, open payment/claim UI |
| Trusted direct | `isTrustedDirect` — no scanner; use `onTrustedPaymentClaim` |
| Driver QR modal closed early | Passenger complete still works via API |

---

## Test plan

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Quick Match, cash, no IBAN | Scan → rating in one flow, no payment tap |
| 2 | Normal match, cash, no IBAN | Same |
| 3 | Match with IBAN snapshot, cash booked | Auto complete if backend allows; else 409 → UI |
| 4 | IBAN chosen at choose step | No auto complete until transfer confirmed |
| 5 | Trusted channel | Unchanged claim flow |
| 6 | Driver receives rating | Socket + modal close within 400ms |

---

## Rollback

Revert `handleBarCodeScanned` branch in `QRTripEndModal.tsx` to always `setPassengerStep('payment')`.

---

## Effort

| Item | Size |
|------|------|
| Auto submit branch in scan handler | ~20–35 lines |
| 409 fallback handling | ~10 lines |
| chosenEndMethod wiring (optional) | ~15 lines |

**Socket needed:** No (existing emit sufficient)  
**Production touched:** `frontend/components/QRTripEndModal.tsx` (+ possibly minor `index.tsx` props if passing transfer status)
