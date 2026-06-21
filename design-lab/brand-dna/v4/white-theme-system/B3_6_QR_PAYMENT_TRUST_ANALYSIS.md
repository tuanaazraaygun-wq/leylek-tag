# B3-6 QR / Payment / Trust Analysis

**Group:** 6 — QR / Payment / Trust  
**Patch:** B3-6f

---

## Scope

| Modal / Screen | File |
|----------------|------|
| Boarding scan | `BoardingScanModal.tsx` |
| Driver boarding QR | `DriverBoardingQRModal.tsx` |
| Trip end QR | `QRTripEndModal.tsx` |
| Payment confirm | `TransferPaymentConfirmModal.tsx` |
| Rating | `RatingModal.tsx` |
| Trust video | `TrustVideoSessionScreen.tsx` |
| Trust request | `TrustRequestModal.tsx` |

---

## Current hardcoded colors

| File | Pattern |
|------|---------|
| BoardingScanModal | ✅ Glass + **camera overlay rgba** hardcoded |
| DriverBoardingQRModal | QR frame cyan, dark scrim |
| QRTripEndModal | PREMIUM borders |
| TransferPaymentConfirmModal | Success green inline |
| RatingModal | ✅ PremiumCard pattern |
| Trust screens | Mixed legacy |

---

## LHIS primitives

| Component | Primitives |
|-----------|------------|
| BoardingScanModal | ✅ Strong GlassSurface |
| RatingModal | ✅ PremiumText, Glass |
| Payment modal | Partial |
| Trust | Legacy modals |

---

## Risk: **P1** | Complexity: **Medium**

Camera overlay must stay dark enough for QR scan in **both** themes — special case.

---

## Tokens needed

- `tokens.modal.scrim`
- `tokens.modal.sheet`
- `tokens.qr.frame` (accent border)
- `tokens.qr.scanOverlay` — **fixed dark semi-transparent** (not inverted)
- `tokens.status.success` payment
- `tokens.button.primary` confirm CTAs

---

## Migrate first

1. `RatingModal.tsx` (low risk, primitives ready)
2. `QRTripEndModal.tsx`
3. `TransferPaymentConfirmModal.tsx`
4. `BoardingScanModal` — sheet only; keep scan overlay constant
5. `DriverBoardingQRModal.tsx`
6. Trust modals last

---

## Files affected

```
frontend/components/BoardingScanModal.tsx
frontend/components/DriverBoardingQRModal.tsx
frontend/components/QRTripEndModal.tsx
frontend/components/TransferPaymentConfirmModal.tsx
frontend/components/RatingModal.tsx
frontend/components/trust/TrustVideoSessionScreen.tsx
frontend/components/TrustRequestModal.tsx
```

---

## Must NOT change

- QR parse logic, camera permissions
- Payment amount validation
- Trust WebRTC session
- Modal dismiss guards during active scan

---

## QA

| ID | Test |
|----|------|
| QA-6f-01 | Scan boarding QR dark/light |
| QA-6f-02 | Camera overlay still scannable in light theme |
| QA-6f-03 | Payment confirm readable |
| QA-6f-04 | Rating submit flow |

---

## Rollback

Remove `qr` from screen flags; camera overlay unchanged by rollback.
