# 04 — Safe Patch Plan

**Sprint:** UX-P0-QR-3A (read-only)  
**Goal:** Quick Match (+ optional trusted QR if product-approved) finish like normal cash QR, without breaking Havale/EFT driver confirmation.

---

## Recommended approach — layered (P0)

### P0-A — Backend tag defaults (highest leverage)

**Files:** `backend/services/quick_match.py`, `backend/services/relationship_match_engine.py`

On tag insert at accept:

```python
tag_row["passenger_payment_method"] = "cash"  # default until QM/TDM expose payment choice
```

**Why safe**

- Matches normal ride/create default behavior.
- Unlocks `is_cash_qr_complete_allowed` when IBAN snapshot exists.
- No change to Havale path — passenger must still explicitly choose IBAN UI → `claimTransferPayment(iban)`.

**Optional:** Only default when not already set; allow future payment picker on QM request.

---

### P0-B — Frontend auto-complete parity

**Files:** `frontend/components/QRTripEndModal.tsx`, optionally `frontend/app/index.tsx`

**Option B1 (modal-local, minimal):**

```typescript
const bookedCash =
  effectiveBookingPaymentMethod === 'cash' ||
  (effectiveBookingPaymentMethod == null && !isTrustedDirect);

const canAutoCompleteCashAfterScan =
  !isTrustedDirect && bookedCash;
```

**Option B2 (index wiring — clearer intent):**

```typescript
bookingPaymentMethod={
  normalizePassengerPaymentMethod(activeTag?.passenger_payment_method)
  ?? (activeTag?.match_channel !== 'trusted' ? 'cash' : null)
}
```

Prefer **P0-A + B2** together: server truth + client resilience after stale cache.

**Do not** apply B2 when `isTrustedDirect` without product sign-off on trusted QR.

---

### P0-C — Preserve Havale/EFT path

No change required if:

- Choose step keeps **Havale / EFT** first option.
- `onChooseDriverIban` → `handleOpenTripEndDriverIban` → `claimTransferPayment(..., iban)` unchanged.
- QR path never calls `claimTransferPayment` before `complete-qr`.

**Guard rule:** Auto `submitCompleteQr('cash')` only when:

- User entered from **scan** step (already true post-scan), and
- Did **not** open IBAN sheet in same modal session, and
- `match_channel !== 'trusted'`.

---

## When is `submitCompleteQr('cash')` safe?

| Condition | Safe? |
|-----------|-------|
| `match_channel=trusted` | **No** — API 409 by design today |
| `booked_pm=cash`, `confirmed_pm=cash`, IBAN snapshot | **Yes** — tested bypass |
| `booked_pm=null`, `confirmed_pm=cash`, IBAN snapshot | **No** until P0-A or guard change |
| `booked_pm=null`, no IBAN snapshot | **Yes** — guard skipped |
| User chose Havale in choose step | **No** — must use claim flow, not QR cash |
| User chose QR scan explicitly | **Yes** (product intent = cash handoff) — requires P0-A or guard tweak |

---

## Trusted Direct QR parity (P1 — product gate)

Only if Sürücülerim must mirror normal QR:

1. **UI:** Add third choose option “Sürücü QR kodunu tara” on trusted panel OR re-use non-trusted choose layout when QR selected.
2. **Frontend:** Remove `isTrustedDirect` early-return in `handleBarCodeScanned`.
3. **Backend:** Remove or narrow trusted 409 in `complete-qr` (lines 22206–22213 `server.py`).
4. **Conflict resolution:** Define interaction with `claim_transfer_payment` cash path — QR complete vs cash claim should be mutually exclusive.

**Risk:** Bypasses driver payment confirmation that trusted cash/IBAN flow was built for. Requires explicit product/legal sign-off.

**Lower-risk alternative:** Keep trusted on claim-only; fix QM only (matches majority of reported scans).

---

## Backend guard change (only if P0-A rejected)

**File:** `backend/services/transfer_payment_service.py`

Extend `is_cash_qr_complete_allowed`:

```python
def is_cash_qr_complete_allowed(booked_pm, confirmed_pm) -> bool:
    return confirmed_pm == "cash" and booked_pm in (None, "cash")
```

**Risk:** Weakens IBAN enforcement for any tag with snapshot where passenger never chose Havale but also lacks booked cash — mitigated if QR scan is treated as explicit cash attestation.

Prefer **setting `passenger_payment_method=cash` at match** over loosening guard.

---

## Rating trigger paths (verify after patch)

| Path | Passenger rating | Driver rating |
|------|------------------|---------------|
| QR `complete-qr` success | `QRTripEndModal.onComplete` → `handlePassengerTripEndComplete` → `RatingModal` | Socket `show_rating_modal` → `scheduleRatingModalAfterQrDismiss` |
| Socket duplicate | `onShowRatingModal` (passenger hook) closes QR modal + rating | Driver `remoteSuccess` timer then rating |
| Havale claim | No immediate rating — after driver `respond_transfer_payment(approved=True)` → `show_rating: true` in response + socket |

Patch must not alter driver remote success / rating scheduling.

---

## Test plan (post-patch)

1. **Normal cash + QR** — regression: scan → instant complete → both ratings.
2. **Normal + IBAN snapshot + QR path** — choose QR → scan → instant complete (cash booked).
3. **Quick Match + IBAN snapshot** — choose QR → scan → instant complete (not payment picker).
4. **Quick Match + Havale** — choose Havale → IBAN sheet → claim → driver confirm → complete, no QR auto-complete.
5. **Quick Match, driver no IBAN** — direct scan → instant complete.
6. **Trusted direct** — unchanged cash/IBAN unless P1 approved.
7. **Backend 409** — QM tag with snapshot: complete-qr cash succeeds after P0-A.

---

## Effort estimate

| Item | Scope | Risk |
|------|-------|------|
| P0-A backend default cash | ~2 lines × 2 files | Low |
| P0-B frontend default/fallback | 1–2 files | Low |
| P0-C regression tests (manual APK) | QA checklist | — |
| P1 trusted QR parity | UI + API + product | High |

**Frontend-only:** Partial fix (UI auto-complete) — still fails backend 409 with IBAN snapshot until tag has `passenger_payment_method=cash` or guard updated.

**Minimum production fix:** P0-A + P0-B2.
