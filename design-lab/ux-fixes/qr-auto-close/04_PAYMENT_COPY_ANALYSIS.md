# UX-P0-QR — Payment Copy Analysis

**Target bug:** #4 — Replace "Nakit ödedim" framing with katkı payı / IBAN / "ödemeyi yaptım" language  
**Mode:** Copy-only changes; no payment logic changes in this document

---

## Findings: "Nakit ödedim" search

**Exact string `"Nakit ödedim"` — not found** in frontend production grep.

User likely refers to **semantic equivalent** in trip-end payment step:

| Current string | File | Line context |
|----------------|------|--------------|
| `Ücreti nakit olarak ödediğinizi onaylayın.` | `QRTripEndModal.tsx` | Legacy payment subtitle |
| `Nakit katkı` | `QRTripEndModal.tsx` | Payment title when booked cash |
| `Nakit katkıyı ilettiğimi onayla` | `QRTripEndModal.tsx` | Confirm button |
| `Yol paylaşım katkısını nakit olarak ilettim` | `QRTripEndModal.tsx` | Trusted choose option |
| `Yol paylaşım katkısını Havale/EFT ile ilettim` | `QRTripEndModal.tsx` | IBAN choose option |
| `Nakit katkı ile tamamla` | `QRTripEndModal.tsx` | Button label |
| `Teklifinizde nakit seçmiştiniz...` | `QRTripEndModal.tsx` | Payment subtitle |

---

## Passenger-facing vs driver-facing

### Passenger-facing (trip end)

**Primary:** `frontend/components/QRTripEndModal.tsx`

- Scan instructions: "Ardından katkı yöntemini onaylayacaksın"
- Payment titles/subtitles/buttons (table above)
- Choose step: nakit vs Havale/EFT options
- Trusted cash claim copy

**Secondary:**

| File | Audience | Notes |
|------|----------|-------|
| `frontend/app/index.tsx` | Passenger | `TRUSTED_PAYMENT_PENDING_ALERT`, trip end banners |
| `frontend/components/superUx/QuickMatchPassengerFlow.tsx` | Passenger | Already uses **"katkı payı"** — good reference tone |
| `frontend/components/LeylekTripScreen.tsx` | Muhabbet | "Nakit" payment choice — separate product surface |
| `frontend/lib/leylekZekaUxCopy.ts` | AI assistant | "katkı tutarı" language |

### Driver-facing

| File | Copy |
|------|------|
| `QRTripEndModal.tsx` (driver mode) | "Yolcu katkı bildirimi bekleniyor", "{name} nakit veya havale katkısı bildirecek" |
| `frontend/app/driver-bank-accounts.tsx` | IBAN management (not trip-end) |
| `TransferPaymentConfirmModal` (if used) | Driver confirms passenger transfer claim |

---

## IBAN / havale text locations

| Location | Text |
|----------|------|
| `QRTripEndModal.tsx` | Havale/EFT choose + confirm paths |
| `backend/services/transfer_payment_service.py` | `"Havale/EFT ile iletilen yol paylaşım katkısı sürücü onayı ile tamamlanır."` |
| `backend/server.py` complete-qr | 409 messages for trusted / transfer guard |
| `index.tsx` | `TRUSTED_PAYMENT_PENDING_ALERT` |

Backend strings should stay **legally aligned** with transfer confirmation flow; frontend can soften passenger tone independently.

---

## Recommended copy direction (P0)

Align trip-end passenger copy with Quick Match and brand DNA (**yol paylaşım katkısı**, not **ücret ödeme**):

| Current | Proposed (passenger) | Rationale |
|---------|----------------------|-----------|
| `Nakit katkı` | `Katkı payı` | Matches Quick Match |
| `Ücreti nakit olarak ödediğinizi onaylayın` | `Katkı payını sürücüye ilettiğinizi onaylayın` | Peer sharing, not taxi fare |
| `Nakit katkıyı ilettiğimi onayla` | `Katkı payını ilettim — yolculuğu tamamla` | Action-oriented; avoids "nakit ödedim" |
| `Teklifinizde nakit seçmiştiniz...` | `Teklifte katkı payı nakit olarak belirlenmişti. İlettiğinizi onaylayın.` | Consistent terminology |
| `Katkı yöntemini seç` | `Katkı payını nasıl ilettiğinizi seçin` | Clearer |
| Scan hint: `katkı yöntemini onaylayacaksın` | **Remove or replace** if auto-complete ships: `Yolculuk tamamlanacak` | Avoid promising extra step |

### IBAN path (keep explicit)

| Current | Proposed |
|---------|----------|
| `Yol paylaşım katkısını Havale/EFT ile ilettim` | `Katkı payını sürücünün IBAN'ına Havale/EFT ile ilettim` |
| Driver wait: `nakit veya havale katkısı bildirecek` | `katkı payını nakit veya IBAN ile bildirecek` |

---

## What can change without breaking legal/payment logic

| Safe (copy only) | Do NOT change without legal review |
|------------------|-------------------------------------|
| Button labels, titles, subtitles in `QRTripEndModal` | Backend 409 error semantics |
| Alert messages in `index.tsx` (passenger banners) | Transfer confirm API contract |
| Accessibility labels on payment buttons | Wording implying platform collects payment |
| Remove payment step UI when auto-complete (UX) | `payment_confirmed_method` field semantics |

**Keep disclaimer pattern** from Quick Match:

> "LeylekTAG katkı payını tahsil etmez."

Already present in `QuickMatchPassengerFlow.tsx` — consider one line in trip-end auto-complete success state.

---

## If auto-complete removes payment step

Many payment strings become **dead code** for cash/no-IBAN path. Options:

1. Leave strings for IBAN/legacy paths only.
2. Consolidate copy in shared module (future refactor — not P0).

---

## Files to touch in copy patch

| Priority | File |
|----------|------|
| P0 | `frontend/components/QRTripEndModal.tsx` |
| P1 | `frontend/app/index.tsx` (TRUSTED_PAYMENT_PENDING_ALERT, trip banners) |
| P2 | `frontend/components/TransferPaymentConfirmModal.tsx` (if present in trip end) |
| Skip P0 | `LeylekTripScreen.tsx`, `driver-bank-accounts.tsx` (different surfaces) |

**Backend:** Optional message polish in `transfer_payment_service.py` — coordinate with legal; not required for passenger tone fix.

---

## Acceptance criteria (copy)

- [ ] No passenger-facing "ücreti ödedim" / "nakit ödedim" phrasing in trip-end QR flow
- [ ] "Katkı payı" used consistently with Quick Match
- [ ] IBAN path explicitly mentions sürücü IBAN / Havale-EFT
- [ ] Driver-facing text still distinguishes pending confirmation vs completed
- [ ] Disclaimer that platform does not collect contribution remains visible where payment is discussed
