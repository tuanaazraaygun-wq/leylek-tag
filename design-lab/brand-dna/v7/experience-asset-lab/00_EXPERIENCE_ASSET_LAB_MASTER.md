# V7.1 — Experience Asset Lab Master

**Mode:** Read-only analysis  
**Goal:** Asset üretim öncesi tek plan

---

## 1. Executive summary

LeylekTAG marka migrasyonu **B6-2…B6-5** ile production'a girdi ancak **B6-7 human brand QA FAILED** (composite 48). V6 **Meridian Operative (MEX)** deneyim dilini tanımladı. V7.1, gerçek PNG/SVG/Lottie/WAV üretimine geçmeden önce **envanter · ekip · test · zamanlama · risk · yasak** çerçevesini kilitler.

**Kural:** Hiçbir asset V7.1'de üretilmez. Sadece analiz.

---

## 2. Asset üretim fazları (post-V7.1)

| Phase | Sprint | Team lead | Gate |
|-------|--------|-----------|------|
| **0** | G0 emergency | Alpha + Ops | Human overlay + IoU |
| **1** | V7.1 assets | **Alpha** | G1 icon grid |
| **2** | V7.2 assets | **Bravo** (Map) | G2 @90km/h |
| **3** | V7.3 assets | **Charlie** (Triad) | G3 sync ±16ms |
| **4** | V7.4 assets | **Delta** (Zeka/eco) | G4 score ≥95 |
| **5** | V7b | QA all | T1–T9 field |

---

## 3. Hangi assetler üretilecek? (özet)

Tam liste: `02_ASSET_PRODUCTION_INVENTORY.md`

| Domain | Count (est.) | Priority |
|--------|--------------|----------|
| Logo SVG + PNG ladder | ~18 files | P0 |
| App icon + adaptive + favicon | ~20 files | P0 |
| Splash native (5 DPI + iOS) | ~8 files | P0 |
| Markers PNG ×12 | 12+ tiers | P1 |
| Watermark + Zeka eye | 4 files | P1 |
| Sonic WAV (trust.link new) | 1+ files | P2 |
| Lottie motion (marker pulse, splash) | 3–5 files | P2 |
| Website SVG/CSS genom | ~6 files | P2 |

**Toplam tahmini:** ~70–90 production-bound assets (design-lab master → export).

---

## 4. Ekip özeti

| Team | Domain | Doc |
|------|--------|-----|
| **ALPHA** | Premium logo, icon, splash, favicon, notification micro | `01` · `03` |
| **BRAVO** | Map markers, nav chrome, route | `03` |
| **CHARLIE** | Sonic, motion, haptic binding | `03` |
| **DELTA** | Leylek Zeka, watermark, widget, store | `03` |
| **ECHO** | QA, IoU, device matrix, V7b | `04` |

---

## 5. Test kapıları

| Gate | Test | Threshold |
|------|------|-----------|
| **G0** | Human logo blink | ≥70% "aynı logo, daha kaliteli" |
| **G0** | Silhouette IoU | ≥0.98 vs 1254 master |
| **G1** | App Store grid blind | Named LeylekTAG |
| **G2** | Map @0.4s z16 | car≠motor |
| **G3** | Triad sync | ±16ms |
| **G4** | Full scorecard | ≥95 measured |
| **G5** | B5.7 re-jury | PASS |

Detay: `04_TEST_GATE_MATRIX.md`

---

## 6. Production'a ne zaman?

| Milestone | Condition | Earliest |
|-----------|-----------|----------|
| Rollback PNG only | G0 ops decision | Immediate (ops) |
| RC1 (brand assets) | G0 + Phase 1 complete | ~2 hafta post-G0 |
| RC2 (markers) | G1 + Phase 2 | +2–3 hafta |
| RC3 (triad) | G2 + Phase 3 | +1–2 hafta |
| Store RC | G4 + G5 + B6-8 | ~8–9 hafta (V6 est.) |

**Store release:** DNA Freeze EXECUTED sonrası only.

Detay: `05_PRODUCTION_MIGRATION_SEQUENCE.md`

---

## 7. Riskler

P0–P2: `06_RISK_REGISTER.md`

---

## 8. Yasaklar

`07_FORBIDDEN_LIST.md` — V7.1 + tüm önceki sprint yasaklarının birleşimi.

---

## 9. Source lineage (read order)

```
1254 premium PNG (_backup-pre-b6-2)
    → B5.3 candidates A/B/C
    → B5.5 LS-01/29/30 (LC-1/2/3)
    → V6 LC-2 master + LC-3 micro
    → V7.1 Team Alpha export spec (future)
```

**Production today (WRONG identity tier):** `frontend/assets/images/leylek-logo-premium.png` (512 B6-2 export)

---

## 10. V7.1 çıkış kriteri

- [ ] Team Alpha analiz onaylandı (`01`)
- [ ] Asset envanter imzalandı (`02`)
- [ ] Ekip RACI net (`03`)
- [ ] Test kapıları kabul (`04`)
- [ ] Timeline kabul (`05`)
- [ ] Risk sahipleri atandı (`06`)
- [ ] Yasak listesi okundu (`07`)

Sonra: **V7.1b Asset Production** (ayrı sprint — henüz başlamadı).
