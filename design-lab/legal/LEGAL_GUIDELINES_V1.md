# LeylekTAG Legal Guidelines v1

**Phase:** P2-L1  
**Version:** v1.0  
**Parent:** `LEGAL_CONSTITUTION_V1.md`

---

## 1. Amaç

Hukuk belgelerinin **draft, review, publish ve maintain** sürecini tanımlar. P2-L1'de süreç kuralları yazılır; uygulama P2-L3+.

---

## 2. Roller

| Rol | Sorumluluk |
|-----|------------|
| **Legal counsel** | Mevzuat uyum, nihai onay |
| **Product Owner** | Ürün gerçeği ↔ belge eşleşmesi |
| **Engineering** | SSOT render, consent log, URL routing |
| **Design / Content** | Okunabilirlik, LHIS/website tone uyumu |
| **Support lead** | Support Policy, appeal workflow |

---

## 3. Draft workflow (P2-L3)

```
1. Product brief (modül değişikliği)
      ↓
2. Legal DNA check (LEGAL_DNA_V1.md)
      ↓
3. Draft in design-lab/legal/documents/{id}/
      ↓
4. Internal review (PRODUCT + LEGAL)
      ↓
5. Version bump + changelog
      ↓
6. P2-L4 checklist
      ↓
7. P2-L5 production mapping (no wire until gate)
```

---

## 4. Ne zaman yeni belge gerekir?

| Tetikleyici | Aksiyon |
|-------------|---------|
| Yeni veri işleme | KVKK + privacy + retention update |
| Yeni ürün modülü | Operational belge (QR, trust, vb.) |
| Ödeme modeli değişimi | terms-user + subscription + cancellation |
| Yeni üçüncü taraf | Privacy aktarım + DPA appendix |
| Moderasyon kural değişimi | community + enforcement |
| Store policy change | P2-L7 store compliance pass |

---

## 5. Mevcut drift giderme önceliği (guideline)

| Öncelik | Aksiyon | Faz |
|---------|---------|-----|
| P0 | Retire `KVKKComponents` stale entity | P2-L5 |
| P0 | Replace `backend/routes/legal.py` strings | P2-L5 |
| P0 | Unify privacy TR (legal-content vs privacy-locales) | P2-L3 |
| P1 | Fix terms payment contradiction | P2-L3 |
| P1 | Extract community + driver from terms-user | P2-L3 |
| P2 | Retire backend HTML templates → redirect | P2-L6 |
| P2 | Archive website_files | P2-L6 |

---

## 6. In-app vs web guideline

| Belge | Web URL | In-app |
|-------|---------|--------|
| KVKK | `/kvkk` | Route + modal |
| Gizlilik TR | `/gizlilik-politikasi` | `/privacy` route |
| Gizlilik EN | `/privacy` | Link out (store) |
| Kullanım | `/kullanim-sartlari` | `/terms` |
| Hesap silme | `/hesap-silme` | `/delete-account` |
| Güven ağı | `/guvenlik` (info) + future `/guven-agi` | In-flow consent |
| QR | In QR modal footer | SSOT snippet |

**Kural:** In-app body = web body (same version). WebView veya native render — içerik aynı.

---

## 7. Marketing copy vs legal guideline

| Yüzey | Tip | SSOT? |
|-------|-----|-------|
| `/guvenlik` hero | Marketing | Hayır — legal link zorunlu |
| FAQ, topluluk page | Informational | Hayır — must not contradict SSOT |
| Footer | Navigation | Generated from matrix |
| App Store description | Marketing | Must match SSOT claims |

**Kural:** "QR ile güvenli" marketing ifadesi — `qr-usage` ile çelişemez.

---

## 8. Consent guideline

### 8.1 Kayıt (mevcut + hedef)

Mevcut `LegalConsentModal`:

- Gizlilik ✓
- Kullanım ✓
- KVKK ✓
- 18 yaş ✓

Hedef P2-L5:

- + `explicit-consent` ayrı belge
- + version stamp
- + server log

### 8.2 Sürücü KYC

Mevcut: `termsAccepted` checkbox — generic.

Hedef: `terms-driver` + timestamp `kyc_terms_accepted_at` (mevcut field) + doc version.

### 8.3 Güven ağı

Mevcut: UI copy only (`trustedHubCopy.ts`).

Hedef: `trust-network` onay before first invite accept.

---

## 9. Changelog guideline

Her belge `CHANGELOG.md`:

```markdown
## [1.1.0] - 2026-07-01
### Changed
- Muhabbet retention 7 → 14 gün (DNA matrix sync)

### Legal review
- Approved by: [counsel name]
- Ticket: LEG-042
```

Material change → `RELEASE_ROADMAP` Phase 2 gate.

---

## 10. Yasaklar (operasyon)

- Production'a doğrudan metin edit (SSOT bypass)
- Hukuk danışmanı onaysız MAJOR bump
- API'de string embed (legal.py pattern)
- Farklı retention süreleri farklı kanallarda
- İngilizce privacy'yi otomatik çeviri ile güncelleme

---

## 11. P2 alt faz guideline map

| Faz | Guideline focus |
|-----|-----------------|
| P2-L1 | Constitution + architecture ✅ |
| P2-L2 | Folder schema + renderer contract |
| P2-L3 | Draft all matrix docs |
| P2-L4 | Review checklist execution |
| P2-L5 | Channel binding spec |
| P2-L6 | Cutover + redirect plan |
| P2-L7 | Play/App Store data safety mapping |

---

**İlişkili:** `LEGAL_ROADMAP.md`, `LEGAL_SSOT_PLAN.md`
