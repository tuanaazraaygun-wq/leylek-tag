# V7.1b — Risk Register (Team Alpha)

**Team:** ALPHA — Premium Logo  
**Mode:** Analysis only  
**Scale:** P0 ship blocker · P1 brand integrity · P2 execution  
**Sources:** V7.1 `06_RISK_REGISTER.md` · B5.6 CF-* · B5.3 blockers · Team Alpha RA-*

---

## Risk heat map (logo lane)

| Area | Pre-rollback | Current (master restored) | Post-G0 target |
|------|--------------|---------------------------|----------------|
| User perception | 🔴 Critical | 🟡 Medium | 🟢 Low |
| Vector SSOT | 🔴 Critical | 🔴 Critical (v1 B5.2 still in manifest) | 🟡 Medium |
| Small-size ladder | 🔴 Critical | 🟡 Medium | 🟢 Low |
| OEM masks | 🔴 Critical | 🔴 Critical | 🟡 Medium |
| Governance | 🔴 Critical | 🟡 Medium | 🟢 Low |

---

## P0 — Ship blockers

| ID | Risk | L | I | Evidence | Mitigation | Owner |
|----|------|---|---|----------|------------|-------|
| **RA-P0-01** | Human panel rejects LC-2 optical nudge | M | C | Purists may see translate(4,6) as drift | **LC-1 fallback** · A/B blind overlay | Brand |
| **RA-P0-02** | IoU <0.98 on signed candidate | M | C | Script not run · B5.2 was ~0.91–0.94 | Path tuning only — no redesign | Alpha + Echo |
| **RA-P0-03** | B5.2 assets resurrected in export | L | C | Manifest still points v1 SVG | Filename gate · manifest v2 · code review | Eng |
| **RA-P0-04** | LC-3 shipped as 512 master | M | C | B5.6: "brand disaster" | Dual ladder manifest · CI block | Alpha |
| **RA-P0-05** | Wrong SSOT (512 flat PNG) in production | Was **Current** | C | CF-02 · B6-2 | ✅ Rollback to 1254 (project status) | Ops |
| **RA-P0-06** | Human panel never convened | H | C | `RESTORATION_DECISION.md` PENDING | Schedule 5 reviewers within 5 days | Product |
| **RA-P0-07** | Constitution v1 conflicts with 1254 | H | C | 11px arc vs 20px restoration | Amend v2 before any export | Alpha |
| **RA-P0-08** | Store RC before G0–G5 | M | C | B5.6 denied · CF-08 | Product gate policy | Product |

---

## P1 — Brand integrity

| ID | Risk | L | I | Mitigation | Owner |
|----|------|---|---|------------|-------|
| **RA-P1-01** | Flat vector feels cheap on splash | H | M | **1254 raster hero tier** mandatory | Alpha |
| **RA-P1-02** | `app.json` uses premium PNG as app icon | H | M | Fix in Phase 1.8 — 1024 icon tier | Eng |
| **RA-P1-03** | Optical nudge double-applied in export | M | M | Document transform once in v2 constitution | Alpha |
| **RA-P1-04** | OEM mask clips arc/beak | H | M | Echo 12-device matrix T-A3/T-A4 | Echo |
| **RA-P1-05** | Master shrink to favicon | M | H | LC-3 only @≤48 — never master downscale | Alpha |
| **RA-P1-06** | Metallic expectation on vector tiers | H | M | Comms: silhouette contract + raster hero | Brand |
| **RA-P1-07** | LC-1 vs LC-2 council split | M | M | Vote · document winner · loser archived | Brand council |
| **RA-P1-08** | B5.5 sketches human-unscored | M | M | Score during G0 panel | Brand |

---

## P2 — Execution

| ID | Risk | Mitigation | Owner |
|----|------|------------|-------|
| **RA-P2-01** | resvg export drift vs design | Golden PNG hash per tier | Echo |
| **RA-P2-02** | Android DPI splash manual error | Scripted export ladder | Eng |
| **RA-P2-03** | Parallel team export fork | Alpha frozen SVG first — others derive | Alpha |
| **RA-P2-04** | Marketing announces "rebrand" | Comms: **restoration** language | Product |
| **RA-P2-05** | Embroidery/laser attempted from 3D PNG | Scope flat mono lockup first | Delta |
| **RA-P2-06** | Light theme white variant untested | Audit before website swap | Alpha |

---

## Contingency playbooks

### G0 fail (human or IoU)

1. **Do not** start V7.1b asset production  
2. Iterate B5.3 paths in design-lab only  
3. Reconvene human panel within **5 days**  
4. Keep **1254 rollback PNG** on user-facing builds  
5. If LC-2 fails → **LC-1** path  
6. If both fail → extend A paths only (beak X, arc width) — **no new concepts**

### LC-3 regression @512

1. Block C from master path immediately  
2. Re-verify IoU C vs A @512  
3. Keep C on 16–48 ladder only  

### B5.2 file detected in production PR

1. **Auto-reject** PR  
2. Reference `03_FAILURE_ANALYSIS.md`  
3. Alert brand council  

---

## Open questions (decision required)

| # | Question | Decision by | Recommendation |
|---|----------|-------------|----------------|
| Q1 | Rollback PNG before G0? | Product/Ops | ✅ Done per project status |
| Q2 | LC-1 vs LC-2 if panel split? | Brand council | LC-2 if ≥3/5 prefer icon balance; else LC-1 |
| Q3 | Raster 1254 hero mandatory? | Jury | **Mandatory** for splash/login |
| Q4 | When to open V7.1b export? | Alpha lead | Day after G0 all-green |

---

## Risk → gate mapping

| Risk ID | Blocks gate |
|---------|-------------|
| RA-P0-01, 02, 06, 07 | **G0** |
| RA-P1-04, 05 | **G1** |
| RA-P1-02 | **G1** + RC1 |
| RA-P0-08 | **G5** + store |
| RA-P2-03 | All parallel exports |

---

## Review cadence

| Phase | Frequency |
|-------|-----------|
| V7.1b analysis | Once — this document |
| G0 panel week | Daily standup |
| V7.1b export sprint | Per-tier QA before next tier |
| Pre-RC1 | Full gate matrix re-read |

---

**Risk register status:** ACTIVE  
**Parent:** `V7.1/experience-asset-lab/06_RISK_REGISTER.md` · `07_RISK_REGISTER.md` (this file, Alpha scope)
