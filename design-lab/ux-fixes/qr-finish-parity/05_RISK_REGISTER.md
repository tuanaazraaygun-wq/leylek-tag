# 05 — Risk Register

**Sprint:** UX-P0-QR-3A (read-only)

---

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Default `passenger_payment_method=cash` on QM/TDM misrepresents future card/Havale-only product | Medium | Medium | Default only when unset; gate future payment UI on explicit user choice before accept |
| R2 | Frontend-only patch hides backend 409 on IBAN+null booked | High | High | Ship P0-A with any frontend auto-complete change; add integration test for complete-qr |
| R3 | Loosening `should_reject_complete_qr` allows QR bypass of Havale when passenger intended IBAN | Low | High | Do not loosen guard without QR-path attestation; keep choose-step IBAN branch separate |
| R4 | Trusted QR parity removes driver confirm revenue assurance | Medium | High | Keep trusted on claim flow unless product explicitly approves P1; document legal/settlement impact |
| R5 | Stale `activeTag` without payment method after P0-A until `loadActiveTag` | Medium | Low | P0-B2 client fallback `?? 'cash'` for non-trusted; merge on poll |
| R6 | `isTrustedDirect` false-negative if `match_channel` missing on client | Low | Medium | Verify active-tag always returns `match_channel`; add dev assert |
| R7 | Double rating modal (HTTP onComplete + socket) | Low | Low | Existing `scheduleRatingModalAfterQrDismiss` / modal guards — regression test only |
| R8 | Card payment method on normal match + IBAN snapshot | Low | Medium | Unchanged; card still requires payment step — out of scope |
| R9 | QM accept race: tag loaded before migration backfill | Low | Low | New tags only; optional one-off SQL backfill `UPDATE tags SET passenger_payment_method='cash' WHERE match_channel IN ('quick','trusted') AND passenger_payment_method IS NULL` |
| R10 | Driver without IBAN: QM behaves like normal after fix | Low | Low | Acceptable; confirms fix does not over-reach |

---

## Rollback plan

| Change | Rollback |
|--------|----------|
| P0-A tag default | Remove insert line; redeploy backend |
| P0-B frontend fallback | Revert `bookingPaymentMethod` / `canAutoCompleteCashAfterScan` |
| P1 trusted QR | Revert UI + remove trusted 409 lift |

No schema migration required for P0-A (column already exists).

---

## Open questions for product

1. Should Trusted Direct ever support QR-first finish, or stay claim-only?
2. Should Quick Match expose explicit payment method at request time (now implicit cash)?
3. When IBAN snapshot exists and passenger picks QR, is that legally equivalent to “cash booked” on normal match?

---

## Analysis artifacts

| File | Purpose |
|------|---------|
| `01_NORMAL_VS_QUICK_TRUSTED_FLOW.md` | Channel behavior comparison |
| `02_PAYMENT_METHOD_FIELD_ANALYSIS.md` | Field-level read/write matrix |
| `03_ROOT_CAUSE.md` | Causal chain |
| `04_SAFE_PATCH_PLAN.md` | P0/P1 implementation options |
| `05_RISK_REGISTER.md` | This document |

**Production code:** untouched in UX-P0-QR-3A.
