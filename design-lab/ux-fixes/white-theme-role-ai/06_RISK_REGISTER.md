# Risk Register — WHITE-THEME-B3-7A / B3-7B

**Sprint:** WHITE-THEME-B3-7A (analysis)  
**Production:** Untouched  

---

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Dark theme regression on role/match cards | Medium | High | Palette branch defaults to current dark values; screenshot QA both themes before merge |
| R2 | `index.tsx` StyleSheet partial fix leaves hybrid artifacts | High | Medium | Cap index changes; prefer `useRoleTheme` / `usePassengerTheme` surface builders |
| R3 | Blueprint light palette too strong (looks “harsh”) | Medium | Low | Tune stroke opacity in design-lab preview; A/B on device |
| R4 | LeylekEye light capsule loses premium dark identity | Low | Medium | Keep dark path untouched; light variant opt-in via `resolvedTheme` only |
| R5 | LeylekZeka modal light shell breaks readability of existing message styles | Medium | Medium | Phase 5: header/sheet first; bubble colors in follow-up; test long AI replies |
| R6 | Guardian eye size bump (49→52) overlaps match title on small phones | Low | Medium | Test `usableHeight < 650`; keep slot minHeight in sync |
| R7 | PNG vs SVG eye unification scope creep | High | Low | Defer Tier 2 assets; document dual-path in code comments only |
| R8 | `PassengerMatchModeCards` token refactor touches disabled card a11y labels | Low | Low | Preserve `accessibilityLabel` strings; visual-only diff |
| R9 | Performance: `useMemo` style objects in match cards | Low | Low | Pattern already used in theme hooks; memoize per `isScopeLight` |
| R10 | User device still on pre-FIX-1 APK (flags off) | Medium | High | Confirm build includes `a257371c+`; document rebuild in QA |
| R11 | Brand asset swap (v4 SVG) without QA at 24/48px | Medium | High | **Do not** swap production PNG until readability matrix signed off |
| R12 | Driver `LeylekEyeTrigger` light pass inconsistent with passenger guardian | Medium | Low | P2 optional; track as B3-7C if needed |

---

## Rollback strategy

| Phase | Rollback |
|-------|----------|
| Blueprint palette | Revert single file; heroes auto-revert |
| Match cards | Revert `PassengerMatchModeCards.tsx` + optional theme extension |
| Role wash | Revert `useRoleTheme.ts` overrides |
| LeylekEye variant | Revert `LeylekEye.tsx` prop; widget passes nothing |
| Modal light | Revert `LeylekZekaChat.tsx` theme branch; modal returns all-dark |

No migrations, no feature flags required for rollback.

---

## Dependencies

| Dependency | Status |
|------------|--------|
| WHITE-THEME-FIX-1 (flags default ON) | ✅ Shipped (`a257371c`) |
| B3-6 screen gates (`role`, `passenger`) | ✅ In production code |
| Brand v4 eye SVG export | 📋 Lab only — not blocking styles-only path |

---

## Sign-off gates (before B3-7B merge)

1. Device QA on **local Gradle release** APK (no env).
2. EAS preview smoke (regression).
3. Dark theme parity sign-off on role + match + Zeka open/close.
4. No changes to match acceptance, QR, or chat send paths in diff stat.
