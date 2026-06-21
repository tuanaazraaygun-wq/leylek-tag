# 02 — Payment Method Field Analysis

**Sprint:** UX-P0-QR-3A (read-only)

---

## Fields in scope

| Field | Storage | Set at | Consumed by |
|-------|---------|--------|-------------|
| `tags.passenger_payment_method` | Supabase `tags` | Offer / ride create | `QRTripEndModal.bookingPaymentMethod`, `/trip/complete-qr` as `booked_pm` |
| `payment_confirmed_method` (request body) | Ephemeral | Passenger on finish | `/trip/complete-qr` as `confirmed_pm` |
| `tags.matched_bank_account_id` | UUID snapshot | Match accept (QM/TDM/normal enrich) | `canOpenDriverPaymentDetails`, `should_reject_complete_qr` |
| `tags.transfer_payment` | JSONB | `claim_transfer_payment` | Havale/cash claim flow, driver confirm |
| `tags.match_channel` | `normal \| quick \| trusted` | Tag insert per channel | `isTrustedDirect`, backend trusted 409 |

There is **no** separate `confirmed_payment_method` column on `tags` for QR finish — confirmation is request-scoped on `complete-qr`.

---

## Normal match — `passenger_payment_method`

**Write path**

- `POST /ride/create` (`server.py`): `_canonical_passenger_payment_method(payload.passenger_payment_method)` → stored when valid (`cash` \| `card`).
- Frontend offer send (`index.tsx`): defaults merged tag with `?? 'cash'`; socket emit hardcodes `'cash'` on create.

**Read path**

- `GET /passenger/active-tag`: `select("*")` — includes field when present.
- `QRTripEndModal`: `normalizePassengerPaymentMethod(activeTag?.passenger_payment_method)`.

**Typical value:** `'cash'` (explicit or defaulted).

---

## Quick Match — `passenger_payment_method`

**Write path**

- `accept_quick_match_invite` builds `tag_row` with route, price, vehicle, `match_channel: 'quick'`.
- **No assignment of `passenger_payment_method`** in `quick_match.py` (grep: zero hits).

**Read path**

- Same as normal via `loadActiveTag()` after `handleQuickMatchMatched`.

**Typical value:** `null` / undefined in DB and on `activeTag`.

**Impact**

```typescript
// QRTripEndModal.tsx
const canAutoCompleteCashAfterScan =
  !isTrustedDirect && effectiveBookingPaymentMethod === 'cash';
```

With null booking method → always false after scan → payment step.

---

## Trusted Direct — `passenger_payment_method`

**Write path**

- `relationship_match_engine.accept_invite` — same omission as quick match.
- `match_channel: 'trusted'` always set.

**Read path**

- `registerTrustedDirectBootstrapHandler` → `loadActiveTag()`.

**Typical value:** `null`.

**Additional UI effect**

```typescript
const isTrustedDirect =
  String(matchChannel || '').trim().toLowerCase() === 'trusted';
const effectiveBookingPaymentMethod =
  isTrustedDirect && bookingPaymentMethod === 'card' ? null : bookingPaymentMethod;
```

Trusted strips card only; null stays null. Trusted UI does not use QR auto-complete at all.

---

## `effectiveBookingPaymentMethod` — when null?

| Condition | Result |
|-----------|--------|
| DB `passenger_payment_method` missing | `null` |
| Trusted + booked `card` | forced `null` (card not offered on trusted) |
| Normalized unknown string | `normalizePassengerPaymentMethod` may pass through non-cash/card raw or null |

**UI copy when null (non-trusted payment step):**

- Title: **“Katkı payını nasıl ilettiğinizi seçin”**
- Subtitle: “Bu yolculuk için teklifte katkı tercihi kayıtlı değil…”

This matches the reported bug screen.

---

## Backend `booked_pm` vs `confirmed_pm` on `/trip/complete-qr`

```python
booked_pm = _canonical_passenger_payment_method(tag.get("passenger_payment_method"))
confirmed_pm = _canonical_passenger_payment_method(
    body.get("payment_confirmed_method") or body.get("payment_confirmed")
)

if booked_pm in ("cash", "card"):
    # requires confirmed_pm match booked_pm

reject_msg = should_reject_complete_qr(tag, booked_pm, confirmed_pm)
```

| booked_pm | confirmed_pm | IBAN snapshot | Result |
|-----------|--------------|---------------|--------|
| `cash` | `cash` | yes | **Allowed** (`is_cash_qr_complete_allowed`) |
| `null` | `cash` | yes | **409** — Havale guard message |
| `null` | `cash` | no | Allowed (guard skipped) |
| any | any | trusted channel | **409** trusted_direct_requires_driver_payment_confirmation |

**Tests:** `backend/tests/test_transfer_payment_service.py` — `test_should_reject_complete_qr_blocks_iban_snapshot` documents null booked + cash confirmed + snapshot = block.

---

## `showIbanOption` / choose step trigger

```typescript
// index.tsx
const canOpenDriverPaymentDetails =
  boarding_confirmed_at &&
  matched_bank_account_id &&
  status matched|in_progress;

// QRTripEndModal
setPassengerStep(!isDriver && (isTrustedDirect || showIbanOption) ? 'choose' : 'scan');
```

Quick/trusted accepts often attach IBAN snapshot → choose step before scan → extra friction vs normal-without-IBAN.

---

## Field parity matrix

| Field | normal | quick | trusted |
|-------|--------|-------|---------|
| `match_channel` | normal | quick | trusted |
| `passenger_payment_method` at insert | usually cash | **null** | **null** |
| `matched_bank_account_id` | optional | often set | often set |
| QR auto-complete gate | passes (cash) | **fails** | N/A (no QR UI) |
| Backend QR complete with snapshot | passes if cash booked | **409 if null booked** | blocked (trusted) |
