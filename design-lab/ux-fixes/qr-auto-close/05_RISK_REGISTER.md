# UX-P0-QR — Risk Register

**Sprint:** UX-P0-QR  
**Status:** Pre-patch analysis

---

## Risk matrix

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Driver boarding modal closes before passenger scan completes | Low | High | Only close on `boarding_confirmed_at` or socket ack for **current** tag |
| R2 | Duplicate boarding close causes navigation glitch | Medium | Low | Keep `driverBoardingRemoteAckTagRef` dedupe |
| R3 | Auto complete-qr while IBAN transfer pending | Medium | High | Respect `showIbanOption` + handle 409; use backend guard |
| R4 | Auto complete with wrong `payment_confirmed_method` | Low | High | Only auto when `booked === confirmed === 'cash'` |
| R5 | Trusted channel accidentally uses complete-qr | Low | Critical | Keep `isTrustedDirect` early returns; backend 409 |
| R6 | iOS double-modal touch freeze | Medium | Medium | Preserve `scheduleRatingModalAfterQrDismiss` double rAF |
| R7 | Rating modal opens twice (HTTP + socket) | Medium | Low | Dedupe rating open by tagId in `index.tsx` (verify existing guards) |
| R8 | Socket delay: driver trip-end QR stays open | Low | Medium | Existing 400ms path OK if complete-qr emits; passenger HTTP triggers backend emit |
| R9 | Offline passenger scan success, complete-qr fails | Medium | Medium | Show error, reset scan state; do not clear activeTag |
| R10 | Copy change implies platform payment collection | Low | Legal | Keep "LeylekTAG tahsil etmez" disclaimer |
| R11 | Quick Match regression on IBAN snapshot trips | Medium | Medium | Test quick + `matched_bank_account_id` matrix |
| R12 | Idempotent re-scan opens rating twice | Low | Medium | Backend returns success on completed tag; frontend guard `processing` |

---

## Idempotency requirements

### Boarding

| Layer | Mechanism |
|-------|-----------|
| Backend | Idempotent verify if already `in_progress` + `boarding_confirmed_at` (`server.py` ~21791–21802, ~21826–21838) |
| Token store | `consume_boarding_token`, purge by tag |
| Frontend | `verifyInFlightRef`, `driverBoardingRemoteAckTagRef`, `closingRef` |

**Patch must not bypass** token consume or duplicate DB updates.

### Trip complete

| Layer | Mechanism |
|-------|-----------|
| Backend | Reject if tag not `matched`/`in_progress`; completed tag should fail gracefully |
| Frontend | `processing` flag, `lastScannedValueRef` cooldown |

**Patch must not** call `submitCompleteQr` in parallel from scan retry.

---

## Duplicate scan prevention

| Component | Guard |
|-----------|-------|
| `BoardingScanModal` | `lastScannedValueRef`, cooldown, `verifyInFlightRef` |
| `QRTripEndModal` | `scanned`, `processing`, `scanSuccessBeat` |
| Driver boarding ack | `driverBoardingRemoteAckTagRef` |

Auto-complete patch: set `processing=true` before `submitCompleteQr` in scan handler (already inside `submitCompleteQr`).

---

## Offline / socket delay

| Scenario | Current | After patch |
|----------|---------|-------------|
| Boarding: socket lost | Driver stuck | Fix 1: `activeTag.boarding_confirmed_at` fallback |
| Boarding: passenger offline during verify | Verify fails, modal stays | Unchanged |
| Trip end: complete-qr OK, socket lost | Passenger rating via HTTP path OK; driver may miss socket | Backend emit best-effort; driver may need tag poll — existing gap, not introduced by P0 |
| Trip end: complete-qr fails | Payment step or scan retry | Show backend detail |

---

## Rollback plan

| Phase | Rollback action | Time |
|-------|-----------------|------|
| Boarding fallback | Revert `index.tsx` useEffect | < 5 min |
| Trip auto-complete | Revert `QRTripEndModal` scan branch | < 5 min |
| Copy | Revert string changes | < 5 min |

No database migration. No feature flags required for P0 (optional: `UX_QR_AUTO_COMPLETE` env for staged rollout).

---

## What must NOT change

1. **Trusted direct** end flow — driver payment confirmation, no QR complete.
2. **IBAN transfer guard** — `should_reject_complete_qr` when transfer unconfirmed (except cash+cash allowed path).
3. **`payment_confirmed_method` API contract** — backend validation at `complete-qr`.
4. **Boarding status machine** — only `matched → in_progress` via verify.
5. **Muhabbet/LeylekTrip QR** — separate modal, out of scope.
6. **iOS modal sequencing helpers** — `scheduleRatingModalAfterQrDismiss`, `schedulePassengerBoardingScanClose`.

---

## Monitoring (post-patch)

| Signal | Where |
|--------|-------|
| `BOARDING_CONFIRMED_SOCKET` logs | Client |
| `BOARDING_SCAN_SUCCESS` | Client |
| `QR_VERIFY_BOARDING_EMIT` | Backend |
| `QR Trip tamamlandı` | Backend |
| Support tickets: "QR kapandı mı" | Ops |

---

## Sign-off gates

- [ ] Manual test matrix (02 + 03 test plans)
- [ ] Quick Match + normal + trusted smoke
- [ ] IBAN snapshot trip — no accidental auto-complete when blocked
- [ ] iOS rating modal opens and accepts touch
- [ ] Copy review for legal tone (katkı vs ücret)
