# B6 — DNA Freeze Constitution

**Version:** Design DNA Freeze v1.0 (PREPARED)  
**Date:** 2026-06-21  
**Status:** PREPARED — EXECUTED after B6-7 pass  
**Scope:** LeylekTAG Brand DNA v4 — B3 + B4 + B5 consolidated

---

## 1. Purpose

This constitution defines what is **frozen** (immutable without amendment), what may **still change** (under rules), and how **rollback** and **drift detection** work after B6 migration patches complete.

**Freeze states:**

| State | Meaning |
|-------|---------|
| **PREPARED** | B6 analysis complete — current status |
| **EXECUTED** | B6-8 signed after B6-7 QA pass |

---

## 2. What is FROZEN (post EXECUTED)

### 2.1 Brand identity

| Element | Frozen definition | SSOT |
|---------|-------------------|------|
| Logo symbol | Premium leylek profile + orbital arc + cyan eye | `brand-identity-production/svg/leylek-symbol-master-v1.svg` |
| Logo evolution rule | Evolve not replace; no F1; no pin | `02_LOGO_EVOLUTION_PRODUCTION_SPEC.md` |
| Color genom | Meridian Cyan `#00D4AA`, Trust White, Depth Slate, Void Black | `LOGO_COLOR_SYSTEM.md` |
| Marker genom | 12-type family, shared stroke/radius/halo | `03_MARKER_PRODUCTION_SPEC.md` |
| Passenger marker | Gender-neutral figure — **never** gendered silhouette | Constitution §2.1 |
| Driver markers | Vehicle silhouettes only — not taxi, not luxury | Constitution §2.1 |

### 2.2 Theme

| Element | Frozen definition |
|---------|-------------------|
| Dark LHIS baseline | Default production theme when all flags OFF |
| White theme tokens | `WHITE_COLOR_TOKEN_SPEC.md` semantic set |
| Scoped hook pattern | Per-screen `use*Theme()` — no global hardcoded light |
| QR camera | Scanner viewport stays dark in all theme scopes |

### 2.3 Sensory (LSX)

| Element | Frozen definition |
|---------|-------------------|
| Event registry schema | 22 events, triad binding shape |
| Sonic dedupe gates | Production `sonicDedupe.ts` thresholds |
| Haptic semantic map | 13 patterns in `hapticController.ts` |
| Orchestrator API | `playLsxEvent(eventId, options?)` |
| Default production | All LSX flags **OFF** until GA decision |

### 2.4 Forbidden forever (without C-level amendment)

- F1 Meridian Wing as production logo
- Pin teardrop logo family return
- Gendered passenger map marker
- Generic Google map pin as LeylekTAG marker
- Taxi yellow / checker visual language
- New abstract logo unrelated to premium stork

---

## 3. What CAN still change (under rules)

### 3.1 Allowed without amendment

| Change | Rule |
|--------|------|
| PNG export refresh from frozen SVG | Same paths, improved compression |
| Bug fixes in theme hooks | No visual change when flags OFF |
| LSX dedupe threshold tuning | ±20% max; document in changelog |
| New marker state variants | Must use existing 12-type genom |
| Documentation typos | design-lab only |
| White theme screen allowlist expansion | Follow `WHITE_THEME_RELEASE_GATE` stages |

### 3.2 Allowed with design review (DR-1)

| Change | Requires |
|--------|----------|
| New LSX event ID | Registry version bump + matrix update |
| New marker type (#13+) | Marker DNA amendment |
| Logo tier simplification | IoU re-test ≥85% |
| Sonic asset swap (LSDS v2) | A/B listen + peak ≤ −1.4 dBFS |
| Motion token wiring | LDS spec + reduce-motion gate |

### 3.3 Requires constitution amendment (DR-2)

| Change | Process |
|--------|---------|
| New logo family | Brand council + user recognition study |
| Primary color hue shift | Update all DNA docs + migration |
| Remove dark theme default | Product + legal review |
| Enable LSX GA default ON | `B4_RELEASE_GATE` G4-5 + soak |

---

## 4. Rollback rules

### 4.1 Per-patch rollback

| Patch | Rollback action | Max time |
|-------|-----------------|----------|
| B6-1 Website | Restore icon PNG | < 15 min OTA web |
| B6-2 Splash | Restore premium PNG + drawable | Rebuild |
| B6-3 App icon | Restore ios.premium + adaptive | Rebuild |
| B6-4 Zeka | Revert color commits | OTA |
| B6-5 Markers | Restore marker PNG folder | OTA |
| B6-6 Cleanup | Restore from backup | Git revert |

### 4.2 Feature flag rollback

| Flag group | Action |
|------------|--------|
| Theme S2+ | Set all theme flags false |
| LSX G4-3+ | Set `EXPO_PUBLIC_FEATURE_LSX=false` |
| Partial LSX | Per-channel false (sonic/haptic/motion) |

### 4.3 Freeze revocation

Only if P0 brand harm confirmed (wrong logo shipped, gendered marker in production). Requires:
1. Immediate patch rollback
2. Freeze state → REVOKED
3. Root cause doc + re-freeze plan

---

## 5. Feature flag rules

### 5.1 Production default (immutable until GA decision)

```env
# Theme — OFF
EXPO_PUBLIC_FEATURE_LIGHT_THEME=false
EXPO_PUBLIC_FEATURE_LIGHT_THEME_SCREENS=
EXPO_PUBLIC_FEATURE_THEME_CHOICE=false
EXPO_PUBLIC_FEATURE_THEME_SETTINGS=false

# LSX — OFF
EXPO_PUBLIC_FEATURE_LSX=false
EXPO_PUBLIC_FEATURE_LSX_ORCHESTRATOR=false
EXPO_PUBLIC_FEATURE_LSX_MOTION=false
EXPO_PUBLIC_FEATURE_LSX_SONIC=false
EXPO_PUBLIC_FEATURE_LSX_HAPTIC=false
```

### 5.2 Enablement order (post-freeze)

1. Theme S1 (infra) — already in tree, OFF
2. Theme S2 (choice) — internal TF
3. B6 logo/marker migration complete
4. LSX internal TF (orchestrator ON scoped)
5. Theme S4–S6 gradual
6. LSX GA — product decision

**Rule:** Never enable LSX sonic+haptic ON without dedupe call-site migration complete.

---

## 6. Drift rules

### 6.1 Brand drift

| Drift signal | Action |
|--------------|--------|
| New logo PNG outside design-lab export | Block PR — require SSOT SVG |
| Hardcoded `#22D3EE` in new brand surfaces | Migrate to `#00D4AA` |
| Third logo family asset in repo | P0 — reject |
| pin SVG referenced in app/website | Reject |

### 6.2 Marker drift

| Drift signal | Action |
|--------------|--------|
| Gendered passenger asset filename | Reject — use passenger-neutral |
| Ionicons-only field driver marker | Migrate to PNG genom |
| Taxi yellow in marker | Reject |
| Generic pin teardrop | Reject |

### 6.3 Sonic / motion drift

| Drift signal | Action |
|--------------|--------|
| Mixkit URI in new code | Reject |
| New sound without dedupe gate | Reject |
| Motion on map tile layer | Reject |
| LSX haptic during CallScreenV2 | Reject until LsxSessionGuard |
| Double sonic (direct + orchestrator) | Reject — single path |

---

## 7. SSOT hierarchy

```
1. B6_DNA_FREEZE_CONSTITUTION.md (this document, post EXECUTED)
2. brand-identity-production/manifest/brand-identity-manifest.json
3. frontend/lib/lsx/manifest.ts + eventRegistry.ts
4. frontend/lib/theme/semanticTokens.ts + WHITE_COLOR_TOKEN_SPEC.md
5. design-lab brand-dna/v4/*.md (analysis + spec)
6. Production assets (derived from 2–4, not authoritative for shape)
```

---

## 8. Amendment process

1. Proposal in design-lab with impact matrix  
2. Design QA against this constitution  
3. Update affected SSOT docs  
4. Version bump in freeze manifest  
5. Re-run B6-7 subset QA  
6. Sign amendment log entry  

---

## 9. Sign-off (EXECUTED state)

| Role | PREPARED | EXECUTED |
|------|----------|----------|
| Design QA | ✅ B6 analysis | ⏸ After B6-7 |
| Product | ⏸ | ⏸ |
| Engineering | ⏸ | ⏸ |

**Current state:** **PREPARED** — 2026-06-21

---

**Parent:** `B6_FINAL_DESIGN_QA_MASTER_REPORT.md`, `BRAND_CONSTITUTION_V4.md`
