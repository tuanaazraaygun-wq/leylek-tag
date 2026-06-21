# LeylekTAG Legal Roadmap — Phase 2

**Phase:** P2 — Legal Constitution System  
**Version:** v1.0  
**Parent:** `design-lab/RELEASE_ROADMAP.md` Phase 2  
**Status:** P2-L1 complete (architecture); P2-L2+ planned

---

## Executive summary

```
P2-L1 Legal Constitution     ✅ (bu patch — mimari only)
P2-L2 Document Architecture  ☐
P2-L3 Document Drafts        ☐
P2-L4 Legal Review Checklist ☐
P2-L5 Production Mapping     ☐
P2-L6 Migration Plan         ☐
P2-L7 Store Compliance       ☐
```

**Çıkış (Phase 2 tamamı):** Single Source of Truth hukuk sistemi — production wire P2-L5/L6 sonrası.

---

## P2-L1 — Legal Constitution ✅

**Amaç:** Hukuk mimarisini kurmak — production'a metin geçmez.

| Aktivite | Çıktı | Durum |
|----------|-------|-------|
| Mevcut envanter taraması | Drift raporu (matrix) | ✅ |
| Legal Constitution | `LEGAL_CONSTITUTION_V1.md` | ✅ |
| Architecture | `LEGAL_ARCHITECTURE_V1.md` | ✅ |
| Legal DNA | `LEGAL_DNA_V1.md` | ✅ |
| Standards | `LEGAL_STANDARDS_V1.md` | ✅ |
| Guidelines | `LEGAL_GUIDELINES_V1.md` | ✅ |
| Dependency graph | `LEGAL_DEPENDENCY_GRAPH.md` | ✅ |
| Document matrix | `DOCUMENT_MATRIX.md` | ✅ |
| SSOT plan | `LEGAL_SSOT_PLAN.md` | ✅ |
| Roadmap | Bu belge | ✅ |

**Exit criteria:**

- [x] 9 master belge `design-lab/legal/`
- [x] 21 belge matrise yerleştirildi
- [x] Mevcut drift dokümante (P0/P1/P2)
- [x] Production dosyası değiştirilmedi

**Süre:** 1 hafta (analiz)

---

## P2-L2 — Document Architecture

**Amaç:** SSOT klasör yapısı, şema, renderer contract.

| Aktivite | Çıktı |
|----------|-------|
| `documents/_schema/` JSON Schema | meta + section |
| Document ID registry | Slug, URL map |
| Locale strategy | tr master, en derivatives |
| Renderer contract | `LegalSection[]` TypeScript type export spec |
| Consent registry schema | docId, version, userId, timestamp |
| Changelog convention | Per-document CHANGELOG |
| Lint rules | Terminology, entity, retention |

**Exit criteria:**

- Schema validated against existing `legal-content.ts`
- URL map: website + mobile + API paths documented
- Engineering feasibility review

**Süre:** 1 hafta  
**Production etkisi:** None

---

## P2-L3 — Document Drafts

**Amaç:** 21 belgenin SSOT draft metinleri — design-lab only.

### Draft sırası

| Sprint | Belgeler |
|--------|----------|
| S1 P0 | `kvkk`, `privacy` (merge), `terms-user`, `explicit-consent` |
| S2 P1 | `terms-driver`, `data-retention`, `data-destruction` |
| S3 P1 | `trust-network`, `trusted-direct`, `qr-usage`, `trust-give-receive`, `trip-rules` |
| S4 P2 | `community-guidelines`, `cookie-policy` |
| S5 P2 | `support-policy`, `community-enforcement`, `appeal-policy`, `kvkk-application` |
| S6 P3 | `subscription-terms`, `cancellation-refund` (placeholder) |

| Aktivite | Detay |
|----------|-------|
| Merge privacy sources | `legal-content` + `privacy-policy-locales` → single TR + EN |
| Fix payment drift | terms-user canonical: platform tahsilat yapmaz |
| Extract sections | community, driver from old kullanim |
| Product mapping | Her modül → belge cross-ref |

**Exit criteria:**

- 21 belge draft in `design-lab/legal/documents/`
- DNA retention matrix satisfied
- No entity/address drift
- Internal product review pass

**Süre:** 3–4 hafta  
**Production etkisi:** None

---

## P2-L4 — Legal Review Checklist

**Amaç:** Hukuk danışmanı review gate.

| Aktivite | Çıktı |
|----------|-------|
| Mevzuat checklist execution | KVKK, 5651, tüketici |
| Cross-doc consistency audit | Retention, payment, entity |
| EN privacy legal review | Translation quality |
| Risk register | Open legal questions |
| Sign-off sheet | Counsel + PO |

**Checklist maddeleri (özet):**

- [ ] Veri sorumlusu bilgileri doğru
- [ ] Aydınlatma / açık rıza ayrımı
- [ ] Saklama süreleri tutarlı
- [ ] Platform aracılık sınırı net
- [ ] QR / güven ağı sorumluluk dağılımı
- [ ] 5651 içerik kaldırma
- [ ] Hesap silme prosedürü
- [ ] Store privacy URL içerik uyumu

**Exit criteria:**

- Zero P0 legal open issues
- P1 issues documented with mitigation plan

**Süre:** 1–2 hafta  
**Production etkisi:** None

---

## P2-L5 — Production Mapping

**Amaç:** SSOT → channel binding spec — **henüz wire opsiyonel staging**.

| Kanal | Mapping aktivitesi |
|-------|-------------------|
| **Website** | Replace `legal-content.ts` import → SSOT loader; unify privacy pages |
| **Mobile** | SSOT component; retire hardcoded routes content |
| **Backend** | Replace `legal.py` strings → SSOT JSON export endpoint |
| **Store** | Verify URLs; data safety form export from matrix |
| **Support** | Support policy page; email templates |
| **Admin** | Enforcement doc links in moderation UI |

| Deliverable | Dosya |
|-------------|-------|
| Channel map | `design-lab/legal/PRODUCTION_CHANNEL_MAP.md` (P2-L5) |
| Consent wire spec | API + AsyncStorage → server log |
| Feature flags | `legal_ssot_enabled` rollout |

**Exit criteria:**

- Staging environment shows SSOT-rendered pages
- Consent version logged
- Rollback plan documented

**Süre:** 2 hafta  
**Production etkisi:** Staging first; prod wire P2-L6

---

## P2-L6 — Migration Plan

**Amaç:** Eski kaynakları emekli et; tek SSOT production.

| Retire | Replace with |
|--------|--------------|
| `backend/routes/legal.py` hardcoded | SSOT `/legal/v2/{id}` |
| `KVKKComponents.tsx` embedded text | SSOT render or WebView |
| `LegalPages.tsx` API fetch | SSOT loader |
| Hardcoded `privacy.tsx`, `terms.tsx`, `kvkk.tsx` body | SSOT sections |
| `backend/templates/*.html` legal | 301 → website URLs |
| `website_files/*.html` | Archive / redirect |
| Duplicate privacy TR | Single SSOT privacy |

| Migration step | Risk |
|----------------|------|
| Dual-run period (old + new URL) | Low |
| Re-consent banner if MAJOR version | Medium |
| Backend template redirect | Low |

**Exit criteria:**

- Zero hardcoded legal strings in production code
- All footer links SSOT-backed
- Drift lint CI pass

**Süre:** 1–2 hafta  
**Production etkisi:** **Full wire**

---

## P2-L7 — Store Compliance

**Amaç:** Google Play + App Store hukuk paketi tam.

| Alan | Aktivite |
|------|----------|
| Privacy Policy URL | Live SSOT TR + EN |
| Account deletion | URL + in-app flow match |
| Data safety (Play) | SSOT data class export |
| App Privacy (Apple) | Label ↔ SSOT inventory |
| Terms of Use | URL live |
| Support URL | `/support` + support-policy |
| IAP (future) | subscription + cancellation linked |

**Exit criteria:**

- Store console forms pre-filled from SSOT export
- No questionnaire answer contradicts SSOT
- Release Phase 5 unblocked

**Süre:** 1 hafta  
**Production etkisi:** Store submission ready

---

## Timeline (öneri)

| Faz | Hafta | Kumulatif |
|-----|-------|-----------|
| P2-L1 | 1 | 1 ✅ |
| P2-L2 | 1 | 2 |
| P2-L3 | 4 | 6 |
| P2-L4 | 2 | 8 |
| P2-L5 | 2 | 10 |
| P2-L6 | 2 | 12 |
| P2-L7 | 1 | 13 |

**Toplam Phase 2:** ~3 ay (hukuk review paralel)

---

## Risk register

| Risk | Faz | Mitigasyon |
|------|-----|------------|
| Privacy dual source merge conflict | L3 | Single editorial owner |
| Payment language contradiction | L3 | Product + legal sign-off |
| Wrong entity in old components | L6 | Retire list + CI grep |
| Re-consent user friction | L6 | Material change only |
| Store rejection (data safety) | L7 | P2-L7 dry run |
| Counsel delay | L4 | Parallel L3 drafts |

---

## Başarı metrikleri

| Metrik | Hedef |
|--------|-------|
| SSOT belge sayısı | 21/21 draft |
| Production hardcoded legal strings | 0 (post L6) |
| Entity drift instances | 0 |
| Retention contradiction | 0 |
| Store privacy URL 200 OK | 100% |
| Consent version logged | 100% new registrations |

---

## Document index (P2-L1 paketi)

| Dosya | Rol |
|-------|-----|
| `LEGAL_CONSTITUTION_V1.md` | Anayasa |
| `LEGAL_ARCHITECTURE_V1.md` | Mimari |
| `LEGAL_DNA_V1.md` | DNA |
| `LEGAL_STANDARDS_V1.md` | Standartlar |
| `LEGAL_GUIDELINES_V1.md` | Rehber |
| `LEGAL_DEPENDENCY_GRAPH.md` | Bağımlılıklar |
| `DOCUMENT_MATRIX.md` | 21 belge |
| `LEGAL_SSOT_PLAN.md` | SSOT uygulama |
| `LEGAL_ROADMAP.md` | Bu belge |

---

**Sonraki adım:** P2-L2 — `documents/_schema/` + URL registry oluştur (design-lab only).
