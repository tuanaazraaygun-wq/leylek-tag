# V7.1 — Risk Register

**Mode:** Read-only  
**Scale:** P0 ship blocker · P1 brand · P2 polish

---

## P0 — Ship blockers

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| R-P0-01 | Human panel fails LC-2 | Medium | Critical | LC-1 fallback · extend iteration | Brand |
| R-P0-02 | IoU <0.98 | Medium | Critical | Path tuning only · no redesign | Alpha |
| R-P0-03 | Ship B5.2 assets again | Low | Critical | Filename gate · manifest v2 · code review | Eng |
| R-P0-04 | Dual marker language persists | High | Critical | Bravo + grep gate G4-3 | Eng |
| R-P0-05 | Store RC before G4 | Medium | Critical | Product gate policy | Product |
| R-P0-06 | LC-3 as 512 master | Medium | Critical | Dual ladder manifest | Alpha |
| R-P0-07 | Wrong SSOT (512 prod PNG) | **Current** | Critical | Rollback + 1254 reference | Ops |

---

## P1 — Brand integrity

| ID | Risk | Mitigation |
|----|------|------------|
| R-P1-01 | Flat vector feels cheap on splash | Raster 1254 hero tier |
| R-P1-02 | app.json uses premium as icon | Fix Phase 1.8 |
| R-P1-03 | Constitution v1 conflicts with 1254 SSOT | Amend v2 in Alpha |
| R-P1-04 | Optical nudge double-applied in export | Document transform once |
| R-P1-05 | OEM mask clip arc | Echo matrix 12 devices |
| R-P1-06 | Watermark full-color muddy | Delta mono stroke |
| R-P1-07 | Muhabbet legacy art drift | Separate cleanup sprint |
| R-P1-08 | `#22D3EE` glow remains | G4-4 grep gate |

---

## P2 — Execution

| ID | Risk | Mitigation |
|----|------|------------|
| R-P2-01 | resvg export drift vs Figma | Golden PNG hash per tier |
| R-P2-02 | Android DPI manual error | Script export ladder |
| R-P2-03 | Sonic traffic test skipped | G3-4 mandatory |
| R-P2-04 | Lottie perf on low-end Android | Static PNG fallback tier |
| R-P2-05 | Team parallel export fork | Alpha frozen SVG first |
| R-P2-06 | Marketing "rebrand" messaging | Comms guide: restoration |

---

## Risk heat map

| Area | Current risk | Post-V7.1b (if G0 pass) |
|------|--------------|-------------------------|
| Logo | 🔴 Critical | 🟡 Medium |
| Markers | 🔴 Critical | 🟡 Medium |
| Icon | 🔴 Critical | 🟡 Medium |
| Sonic | 🟡 Medium | 🟢 Low |
| Motion | 🟡 Medium | 🟡 Medium |
| Store timing | 🔴 Critical | 🟡 Medium |

---

## Contingency: G0 fail

1. Do **not** start V7.1b asset production  
2. Iterate B5.3 paths in design-lab only  
3. Reconvene human panel within 5 days  
4. Keep rollback PNG on user-facing builds  

---

## Contingency: G2 fail (map)

1. Block marker production swap  
2. Widen car wedge · narrow motor (Bravo)  
3. Re-test z16 only before full ladder re-export  

---

## Open questions

| # | Question | Decision by |
|---|----------|-------------|
| Q1 | Rollback PNG before G0? | Product/Ops |
| Q2 | LC-1 vs LC-2 if panel split? | Brand council vote |
| Q3 | Raster hero mandatory or optional? | Jury recommends mandatory |

---

**Review cadence:** Weekly during V7.1b–V7.4 · each gate before proceed
