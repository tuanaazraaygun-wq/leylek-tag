# B4 — Release Gate

**Sprint:** B4 Motion + Sonic + Haptic  
**Prerequisite:** B3 White Theme complete (G0 passed)  
**Default production:** `EXPO_PUBLIC_FEATURE_LSX=false`

---

## Gate levels

| Gate | Name | Audience | LSX flag |
|------|------|----------|----------|
| **G4-0** | Manifest only (B4-1) | Dev merge | OFF |
| **G4-1** | Sonic cleanup soak (B4-2) | Internal TF | OFF (internal env optional) |
| **G4-2** | Haptic registry (B4-3) | Internal TF | OFF |
| **G4-3** | Orchestrator beta (B4-4) | Internal TF | ON scoped |
| **G4-4** | Journey sync (B4-5) | Beta cohort | ON |
| **G4-5** | LSX GA | Production | ON (product decision) |

---

## G4-0 — B4-1 merge gate

| ID | Criterion | Required |
|----|-----------|----------|
| G4-0-01 | New files under `lib/lsx/` only | ✅ |
| G4-0-02 | Zero production behaviour change | ✅ |
| G4-0-03 | Manifest matches binding matrix | ✅ |
| G4-0-04 | TS/ESLint pass | ✅ |

---

## G4-1 — B4-2 sonic gate

| ID | Criterion | Required |
|----|-----------|----------|
| G4-1-01 | QA-S-01…S-12 pass | ✅ |
| G4-1-02 | Mixkit removed from call graph | ✅ |
| G4-1-03 | No volume regression (A/B listen) | ✅ |
| G4-1-04 | Rollback: flag OFF = byte-identical sonic | ✅ |

---

## G4-2 — B4-3 haptic gate

| ID | Criterion | Required |
|----|-----------|----------|
| G4-2-01 | QA-H-01…H-09 pass | ✅ |
| G4-2-02 | Pattern distinctness sign-off | ✅ |
| G4-2-03 | Android 15 fallback verified | ✅ |

---

## G4-3 — B4-4 orchestrator gate

| ID | Criterion | Required |
|----|-----------|----------|
| G4-3-01 | QA-L-01 match triad | ✅ |
| G4-3-02 | QA-DR-01 dark regression | ✅ |
| G4-3-03 | No global tap haptic spam | ✅ |
| G4-3-04 | 48h internal soak | ✅ |

**Env:**

```env
EXPO_PUBLIC_FEATURE_LSX=true
EXPO_PUBLIC_FEATURE_LSX_SOUNDS=true
EXPO_PUBLIC_FEATURE_LSX_HAPTICS=true
EXPO_PUBLIC_FEATURE_LSX_MOTION=true
```

---

## G4-4 — B4-5 journey sync gate (critical)

| ID | Criterion | Required |
|----|-----------|----------|
| G4-4-01 | QA-L-03 qr.remote.ack driver | ✅ |
| G4-4-02 | QA-F-03 boarding flow E2E | ✅ |
| G4-4-03 | QA-F-07 trust call + QR | ✅ |
| G4-4-04 | R-B4-03, R-B4-08 closed | ✅ |
| G4-4-05 | QR camera overlay unchanged | ✅ |
| G4-4-06 | Socket/journey logic diff = zero | ✅ |

---

## G4-5 — B4-6 GA gate

| ID | Criterion | Required |
|----|-----------|----------|
| G4-5-01 | Full `B4_QA_PLAN.md` executed | ✅ |
| G4-5-02 | Zero open P0 in `B4_RISK_REGISTER.md` | ✅ |
| G4-5-03 | LSDS v2 assets promoted or waived | ✅ |
| G4-5-04 | Rollback runbook tested | ✅ |
| G4-5-05 | B3 white theme + LSX ON regression | ✅ |
| G4-5-06 | Support FAQ (ses/titreşim) | Optional |

---

## Rollback runbook

| Step | Action |
|------|--------|
| 1 | Set `EXPO_PUBLIC_FEATURE_LSX=false` |
| 2 | Ship OTA/build |
| 3 | Verify pre-B4 sonic/haptic behaviour |
| 4 | If sonic regression: revert B4-2 bundle swap only |

**Partial rollback:**

- `EXPO_PUBLIC_FEATURE_LSX_MOTION=false` — disable motion orchestration only
- `EXPO_PUBLIC_FEATURE_LSX_SOUNDS=false` — haptic+motion remain

---

## Abort criteria

| Trigger | Action |
|---------|--------|
| Crash rate +0.3% after G4-3 | LSX flag off |
| Driver QR ack still silent at G4-4 | Block release |
| Trust call regression | Revert B4-5 haptic |
| User reports “phone keeps buzzing” | Disable Tier B haptics |

---

## Sign-off roles

| Role | Approver |
|------|----------|
| Sonic / LSDS | Design-lab sonic owner |
| Motion / LHIS | Brand DNA v4 |
| Mobile engineering | App lead |
| QA | Release QA |
| Product | LSX GA decision |

---

## Relationship to B3

| Layer | Gate doc |
|-------|----------|
| White theme | `B3_WHITE_THEME_RELEASE_GATE.md` |
| LSX sensory | This doc |

**Independence:** B3 and B4 flags orthogonal. B4-6 must pass with B3 OFF and B3 white ON (scoped).

---

## Post-release monitoring (7 days)

- lsx_event_fired counts by eventId
- Crash-free sessions
- “sound” / “vibration” app store mentions
- Driver boarding ack latency (socket → sensory)

---

**Parent:** `B4_MOTION_SONIC_MASTER_ANALYSIS.md`, `B4_QA_PLAN.md`  
**Next patch:** **B4-1** — Manifest only
