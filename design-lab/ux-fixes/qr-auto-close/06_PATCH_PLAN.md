# UX-P0-QR — Patch Plan

**Sprint:** UX-P0-QR  
**Goal:** QR success auto-close (boarding) + scan-to-rating (trip finish) + copy alignment  
**Production code:** Not modified in analysis phase; this document is the implementation blueprint.

---

## Phased delivery

### Phase 1 — P0 functional (ship first)

| # | Change | File | Backend | Socket |
|---|--------|------|---------|--------|
| 1.1 | Driver boarding modal fallback close when `activeTag.boarding_confirmed_at` set while QR visible | `frontend/app/index.tsx` | No | No |
| 1.2 | After end QR scan, auto `submitCompleteQr('cash', driverId)` when cash booked + `!showIbanOption` | `frontend/components/QRTripEndModal.tsx` | No | No |
| 1.3 | On complete-qr 409, fall back to payment step + show backend message | `frontend/components/QRTripEndModal.tsx` | No | No |

**Estimated diff:** ~50–70 lines across 2 files.

### Phase 2 — P0 copy (same release or immediate follow)

| # | Change | File |
|---|--------|------|
| 2.1 | Replace "nakit ödeme" framing with "katkı payı" strings | `QRTripEndModal.tsx` |
| 2.2 | Update scan hint if auto-complete removes payment step | `QRTripEndModal.tsx` |
| 2.3 | Align `TRUSTED_PAYMENT_PENDING_ALERT` tone | `index.tsx` |

**Estimated diff:** ~15–25 lines, strings only.

### Phase 3 — P0.1 hardening (optional)

| # | Change | File |
|---|--------|------|
| 3.1 | Auto cash complete when IBAN snapshot but choose-step = cash | `QRTripEndModal.tsx` |
| 3.2 | `DriverBoardingQRModal` `remoteSuccess` → `onClose` defense | `DriverBoardingQRModal.tsx` |
| 3.3 | Rating open dedupe by tagId (if double-open observed) | `index.tsx` |

---

## Safest minimal patch (recommended for first PR)

```
PR-1: Boarding driver auto-close fallback (index.tsx only)
PR-2: Trip end scan → auto complete-qr for cash without IBAN (QRTripEndModal.tsx)
PR-3: Copy pass (QRTripEndModal.tsx + index.tsx alerts)
```

Keep PRs separable for bisect; PR-2 depends on PR-1 only logically for sprint theme, not technically.

---

## File change checklist

| File | Phase | Change type |
|------|-------|-------------|
| `frontend/app/index.tsx` | 1.1, 2.3, 3.3 | Logic + copy |
| `frontend/components/QRTripEndModal.tsx` | 1.2, 1.3, 2.x, 3.1 | Logic + copy |
| `frontend/components/DriverBoardingQRModal.tsx` | 3.2 optional | Logic |
| `frontend/components/BoardingScanModal.tsx` | — | **No change** (passenger path OK) |
| `backend/server.py` | — | **No change** |
| `backend/services/transfer_payment_service.py` | — | **No change** |
| `app.json` / assets | — | **No change** |

---

## Implementation snippets (reference)

### 1.1 Boarding fallback (index.tsx)

```typescript
useEffect(() => {
  const tid = String(activeTag?.id ?? '').trim();
  const confirmed = activeTag?.boarding_confirmed_at;
  if (!tid || !confirmed || !driverBoardingQrModalVisible) return;
  if (driverBoardingRemoteAckTagRef.current === tid) return;

  driverBoardingRemoteAckTagRef.current = tid;
  setDriverBoardingRemoteSuccess(true);
  // reuse existing timer ref pattern → setDriverBoardingQrModalVisible(false)
}, [activeTag?.id, activeTag?.boarding_confirmed_at, driverBoardingQrModalVisible]);
```

Coordinate with socket handler to share timer helper — avoid duplicate timers.

### 1.2 Auto complete (QRTripEndModal.tsx)

In `handleBarCodeScanned`, after success beat:

```typescript
if (!isTrustedDirect && effectiveBookingPaymentMethod === 'cash' && !showIbanOption) {
  await submitCompleteQr('cash', driverUserId);
  return;
}
setPendingDriverId(driverUserId);
setPassengerStep('payment');
```

---

## QA matrix (condensed)

| Channel | IBAN | Booked PM | Expected after patch |
|---------|------|-----------|----------------------|
| quick | no | cash | scan → rating |
| normal | no | cash | scan → rating |
| normal | yes | cash | scan → payment OR auto if 3.1 |
| normal | yes | cash + iban choose | choose → scan → claim/confirm |
| trusted | * | * | unchanged (no QR complete) |
| any | no | card | payment step (card yakında) |

---

## Backend needed?

**No** for Phase 1–2.

Existing endpoints sufficient:

- `POST /qr/verify-boarding`
- `POST /trip/complete-qr`

## Socket needed?

**No new events.**

Existing:

- `boarding_confirmed`
- `show_rating_modal`

Phase 1 adds client-side fallback when socket slow.

---

## Production touched?

**Yes**, when patch is applied — frontend only:

- `frontend/app/index.tsx`
- `frontend/components/QRTripEndModal.tsx`
- (optional) `frontend/components/DriverBoardingQRModal.tsx`

**Not touched in this analysis sprint** — all production files remain unchanged until patch PR.

---

## Definition of done

- [ ] Driver boarding QR closes within 800ms of passenger success without manual X (happy path)
- [ ] Quick Match cash trip end: passenger scan → rating without intermediate payment tap
- [ ] IBAN/trusted flows unchanged and still pass manual QA
- [ ] Copy uses "katkı payı" not "nakit ödedim" semantics
- [ ] No new backend deploy required for P0

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `01_QR_FLOW_CURRENT_ANALYSIS.md` | As-is flows |
| `02_BOARDING_AUTO_CLOSE_PLAN.md` | Boarding fix detail |
| `03_TRIP_FINISH_AUTO_COMPLETE_PLAN.md` | Trip end fix detail |
| `04_PAYMENT_COPY_ANALYSIS.md` | String inventory |
| `05_RISK_REGISTER.md` | Risks and rollback |
