# 03 — Root Cause

**Sprint:** UX-P0-QR-3A (read-only)  
**Symptom:** After scanning driver QR on Quick Match (and similar non-normal flows), passenger lands on “Katkı payını nasıl ilettiğinizi seçin” instead of immediate complete + rating.

---

## Primary root cause (Quick Match — confirmed in code)

**Missing `passenger_payment_method` on tag at match time** combined with **strict frontend auto-complete gate**.

1. Quick Match tag insert (`quick_match.py:1473–1527`) never writes `passenger_payment_method`.
2. Normal flow writes it at `ride/create` (default `cash`).
3. `QRTripEndModal` only auto-calls `submitCompleteQr('cash')` when:
   ```typescript
   canAutoCompleteCashAfterScan = !isTrustedDirect && effectiveBookingPaymentMethod === 'cash';
   ```
4. With null method, scan success sets `passengerStep = 'payment'` → legacy picker UI.

This is a **data + UI gate mismatch**, not a broken QR decoder or wrong tag id.

---

## Amplifying factor — IBAN snapshot on match

Quick/trusted accept calls `build_snapshot_fields_for_tag_update` → often sets `matched_bank_account_id`.

Effects:

1. **UI:** `showIbanOption=true` → user must pick Havale vs QR first (normal-with-IBAN also does this — OK).
2. **Backend:** Even if frontend were patched to auto-submit `cash` after scan, **`should_reject_complete_qr`** blocks when:
   - `IBAN_TRANSFER_CONFIRM_REQUIRED` enabled
   - snapshot present
   - `booked_pm !== 'cash'` (including null)

So Quick Match has a **second-layer block** on complete-qr unless tag records cash booking.

Normal match avoids this because `passenger_payment_method='cash'` satisfies `is_cash_qr_complete_allowed`.

---

## Trusted / Sürücülerim — separate product path (not same bug mechanism)

For `match_channel=trusted`:

| Layer | Behavior |
|-------|----------|
| Frontend | `isTrustedDirect` → no QR scan option; cash claim + IBAN only |
| Scan handler | Early return if trusted |
| Backend | Hard 409 on any `complete-qr` |

**Parity gap:** Trusted is **intentionally** not QR-first today. Reported “scan then payment picker” aligns with **quick + IBAN choose + null payment method**, not trusted direct UI.

If stakeholders want trusted QR parity, that is a **new product decision** (UI + backend 409 removal + claim flow interaction), not a one-line fix.

---

## Why normal match works

```text
ride/create → passenger_payment_method=cash
           → (optional IBAN snapshot)
QR scan    → canAutoCompleteCashAfterScan=true
           → submitCompleteQr('cash')
           → should_reject_complete_qr bypass via is_cash_qr_complete_allowed
           → status=completed, show_rating_modal ×2
```

---

## `isTrustedDirect` scope

```typescript
isTrustedDirect = matchChannel === 'trusted'  // exact, case-insensitive
```

**Covers:** Trusted Direct accept (`relationship_match_engine`), RME `match_channel=trusted` tags.

**Does not cover:** `quick`, `normal`, null/legacy, Muhabbet product line (separate type).

**Does not cover:** Trusted Network hub navigation alone — only the tag’s stored channel matters.

---

## Failure chain (Quick Match repro)

```text
QM accept → tag { match_channel: quick, passenger_payment_method: ∅, matched_bank_account_id: ✓ }
    ↓
Passenger finish → QRTripEndModal choose → “Sürücü QR kodunu tara”
    ↓
Scan OK → canAutoCompleteCashAfterScan=false
    ↓
payment step → “Katkı payını nasıl ilettiğinizi seçin”  ← BUG
    ↓
(if user picks cash and confirms)
    ↓
complete-qr → should_reject_complete_qr → 409 (IBAN guard)  ← latent second failure
```

---

## Not root cause (ruled out)

- QR payload format (`leylektag://end?u=&t=`) — same across channels
- Driver QR generation — same `QRTripEndModal` driver branch for non-trusted
- Rating modal wiring — works on successful `complete-qr` (passenger `onComplete` + socket)
- `mergeTripTagState` stripping payment fields — preserves incoming when present; problem is absent at source

---

## Conclusion

| Issue | Root cause |
|-------|------------|
| Payment picker after QR scan (QM) | Null `passenger_payment_method` + `canAutoCompleteCashAfterScan` requires `'cash'` |
| Possible 409 after manual cash confirm | IBAN guard with null booked_pm |
| Trusted QR parity | By design: UI excludes QR; API rejects complete-qr |

**Fix direction:** Align QM/TDM tag data and QR auto-complete rules with normal cash booking, while preserving explicit Havale/EFT choose path.
