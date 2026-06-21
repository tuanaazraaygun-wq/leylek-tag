# B6-7 — RC Build Decision

**Sprint:** B6-7 — Device QA + RC Build Decision  
**Date:** 2026-06-21  
**Mode:** Read-only analysis — **no production changes**  
**App version (current):** 1.0.38 · Android `versionCode` 40 · iOS `buildNumber` 46

---

## 1. Executive decision

| Question | Recommendation |
|----------|----------------|
| **RC build now?** | ✅ **YES — internal QA RC only** |
| **Wait until legal?** | ❌ **No block for internal QA** · ⚠️ **Store RC requires existing legal/KVKK unchanged review** |
| **DNA Freeze EXECUTED (B6-8)?** | ⏸ **After** device matrix PASS |
| **Production store release?** | ⏸ **After** B6-7 PASS + B6-8 sign-off |

---

## 2. Rationale

### Why build now (internal)

1. **Native assets changed** — B6-2 (`splashscreen_logo` ×5 DPI) and B6-3 (`mipmap-*` ×15 files) are **not verifiable** via Metro/dev-client alone; require **release-grade APK/IPA**.  
2. **Static audit PASS** — 15/17 checks green; remaining 2 are cosmetic candidates, not migration blockers.  
3. **Flags OFF confirmed** — `eas.json` profiles do not set `EXPO_PUBLIC_FEATURE_LSX*` or `EXPO_PUBLIC_FEATURE_LIGHT*`.  
4. **Core journey unified** — splash, icon, login, entity markers, Zeka, watermark on B5.2 Family A.

### Why not store RC yet

1. **Zero device evidence** — DQA-01…12 not executed.  
2. **Human recognition test pending** — FQA-02 / IoU not recorded.  
3. **Adaptive + squircle** — Android OEM + iOS clip untested.  
4. **Marker zoom matrix** — z16/18/20 unreadable risk unvalidated.

### Legal / KVKK

- App already ships KVKK consent, terms, privacy routes (`LegalPages`, `terms.tsx`, `delete-account.tsx`).  
- B6 migration **did not change** legal copy, routes, or consent logic.  
- **Internal QA RC:** legal review **not a gate**.  
- **Public Play/App Store RC:** confirm no marketing screenshot / store listing still shows pre-B6 pin art (ops checklist, not code).

---

## 3. Recommended build types

| Build type | Profile (EAS) | Platform | Purpose | Recommend now? |
|------------|---------------|----------|---------|----------------|
| **Internal QA APK** | `preview` or `simple` | Android | Brand device matrix AND-* | ✅ **Primary** |
| **TestFlight** | `production` or `preview` + iOS | iOS | Brand matrix IOS-* | ✅ **Primary** |
| **Play Internal** | `production` (AAB) | Android | Post-QA stakeholder | ⏸ After AND pass |
| **Play Production** | `production` | Android | Store | ⏸ After B6-8 |
| **App Store** | `production` | iOS | Store | ⏸ After B6-8 |

### Suggested commands (ops — not executed in B6-7)

```bash
# Android internal QA APK (native res included)
cd frontend
eas build --profile preview --platform android

# iOS TestFlight candidate (after Android spot-check optional)
eas build --profile production --platform ios
```

**Note:** Bump `versionCode` / `buildNumber` before tagging RC. B6-7 does not modify `app.json`.

---

## 4. QA readiness

| Domain | Readiness | Blocker |
|--------|-----------|---------|
| Asset migration B6-1…6 | **95%** | None for internal RC |
| Static brand unity | **88%** | Muhabbet legacy art (secondary) |
| Device verification | **0%** | **Must run B6-7 matrix** |
| LSX / white theme | **100%** infra OFF | N/A this RC |
| DNA Freeze EXECUTED | **0%** | G6-7 device PASS |

**Overall RC readiness:** **READY FOR INTERNAL QA BUILD · NOT READY FOR STORE**

---

## 5. Blockers

| ID | Blocker | Severity | Gate |
|----|---------|----------|------|
| BLK-B7-01 | No device test results | **P0** | B6-8 |
| BLK-B7-02 | Human logo recognition ≥70% | **P1** | B6-8 |
| BLK-B7-03 | Android splash flash mismatch (risk) | **P0** if FAIL | Rollback B6-2 |
| BLK-B7-04 | iOS squircle clip (risk) | **P0** if FAIL | SVG safe-zone tweak (design-lab) |
| BLK-B7-05 | Passenger gender read @32px (risk) | **P0** if FAIL | Rollback B6-5 |
| BLK-B7-06 | Pickup/destination Ionicons drift | **P2** | B6-5b backlog |
| BLK-B7-07 | Muhabbet legacy illustrations | **P2** | B6-7b backlog |
| BLK-B7-08 | Store listing assets stale | **P2** | Ops/marketing |

**No P0 code blockers** for cutting internal RC — only **missing device proof**.

---

## 6. Production touched?

**No.** B6-7 is documentation + decision only. All migration landed in B6-1…B6-6.

---

## 7. Decision tree

```
Internal QA APK / TestFlight build
        │
        ▼
Run B6-7_TEST_MATRIX (D1+D2+D3)
        │
   ┌────┴────┐
   FAIL      PASS (DQA-01…11)
   │              │
   ▼              ▼
Rollback      Play Internal + stakeholder
per surface        │
                   ▼
              B6-8 DNA Freeze EXECUTED
                   │
                   ▼
              Store RC (legal/listing check)
```

---

## 8. Next steps

| # | Action | Owner |
|---|--------|-------|
| 1 | Cut **preview** Android APK | Mobile ops |
| 2 | Execute `B6-7_TEST_MATRIX.md` | QA |
| 3 | File evidence under `design-freeze/evidence/b6-7/` | QA |
| 4 | If PASS → **B6-8 DNA Freeze EXECUTED** | Brand + eng |
| 5 | If FAIL → rollback matrix per `B6_DNA_FREEZE_EXECUTION.md` | Eng |

---

## 9. Sign-off placeholders

| Role | RC internal build approved | Date |
|------|---------------------------|------|
| Mobile lead | ☐ | |
| Brand / design | ☐ | |
| QA lead | ☐ | |

---

**SPRINT B6-7 DECISION:** ✅ **Internal QA RC — GO · Store RC — NO-GO until device PASS**

**Ready for:** B6-8 DNA Freeze Execution **or** immediate internal RC build (parallel)
