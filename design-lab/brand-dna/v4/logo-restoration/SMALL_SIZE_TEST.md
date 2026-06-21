# B5.3 — Small Size Test

**Sprint:** B5.3 — Candidate C validation  
**Status:** Automated exports ready · human review pending

---

## 1. Purpose

Verify logo identity survives **favicon / notification / small mark** tiers without becoming a generic bird or dot.

---

## 2. Export matrix (generated)

| Candidate | 24 px | 48 px | 512 px | 1254 px |
|-----------|-------|-------|--------|---------|
| A | `overlay/candidate-a-ultra-faithful-24.png` | `…-48.png` | `…-512.png` | `…-1254.png` |
| B | `overlay/candidate-b-optical-balance-24.png` | `…-48.png` | `…-512.png` | `…-1254.png` |
| C | `overlay/candidate-c-small-size-24.png` | `…-48.png` | `…-512.png` | `…-1254.png` |
| Master | — | — | resize reference | SSOT |

---

## 3. Pass criteria by tier

| Tier | px | Arc visible | Eye dot | Stork profile | Beak read |
|------|-----|-------------|---------|---------------|-----------|
| M0 | 16 | fragment OK | optional | blob OK | N/A |
| M1 | 24 | ✅ required | ✅ required | ✅ required | implied |
| S | 48 | ✅ full swoosh | ✅ | ✅ | ✅ hint |
| L | 512 | ✅ | ✅ | ✅ | ✅ dominant |

---

## 4. Compare A vs C @ small tiers

| Test | Method | PASS |
|------|--------|------|
| 24 px blink | Master ↕ C @24 on `#0D1117` | Same bird read |
| 48 px side-by-side | A vs C | C ≥ A readability; silhouette match |
| 512 px regression | A vs C | **Must be same logo** — if not, reject C as master |

---

## 5. Expected outcome

| Winner @24/48 | Master @512 |
|---------------|-------------|
| **C** (recommended) | **A or B** |

Dual-ladder strategy: one approved full master (A/B) + C-derived small PNG exports.

---

## 6. Human sign-off

| Tester | 24 px C | 48 px C | 512 C vs master | Sign |
|--------|---------|---------|-----------------|------|
| | ☐ | ☐ | ☐ | |

---

**Blocker for production small marks:** C must not ship as 512 master if silhouette diverges from A.
