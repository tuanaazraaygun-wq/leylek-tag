# LeylekTAG Legal SSOT Plan

**Phase:** P2-L1  
**Version:** v1.0  
**Parent:** `LEGAL_ARCHITECTURE_V1.md`, `DOCUMENT_MATRIX.md`

---

## 1. SSOT tanımı

**Single Source of Truth (SSOT):** Her hukuk belgesinin yalnızca bir master kaynağı vardır. Tüm kanallar (website, mobile, backend, store, support, admin) bu kaynaktan **okur**; kopyalamaz, embed etmez.

```
                    ┌─────────────────────┐
                    │  SSOT Master Store   │
                    │ design-lab/legal/    │
                    │ documents/{id}/      │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │  Website  │       │  Mobile   │       │  Backend  │
   │  Next.js  │       │  Expo RN  │       │  FastAPI  │
   └───────────┘       └───────────┘       └───────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │ Store · Support ·   │
                    │ Admin               │
                    └─────────────────────┘
```

**P2-L1:** Plan only. Master store klasörü P2-L2'de oluşturulur.

---

## 2. Mevcut durum — anti-SSOT envanter

### 2.1 Kaç kaynak var?

| Belge | Kaynak sayısı | Kaynaklar |
|-------|---------------|-----------|
| KVKK | **5+** | legal-content, kvkk.tsx, legal.py, kvkk.html, KVKKComponents |
| Gizlilik | **4+** | legal-content, privacy-locales EN/TR, privacy.tsx, legal.py |
| Kullanım | **4+** | legal-content, terms.tsx, legal.py, kullanim HTML |
| Hesap silme | **3+** | legal-content, hesap-silme pages, delete-account |
| Diğer 17 belge | **0** | Henüz yok |

### 2.2 Kritik drift tablosu

| Alan | Canonical (hedef) | legal-content | legal.py | KVKKComponents |
|------|-------------------|---------------|----------|----------------|
| Şirket | Karekod Teknoloji | ✅ | ✅ | ❌ Leylek Teknoloji |
| Adres | Meşrutiyet Mah. Özsoy | ✅ | ❌ Karanfil 23 | ❌ Ankara generic |
| Güncelleme | Mayıs 2026 | ✅ | ❌ Ocak 2025 | ❌ Aralık 2024 |
| E-posta | info@karekodteknoloji.com | ✅ | ✅ | ❌ leylekapp.com |
| Ödeme modeli | Platform tahsilat yapmaz | ✅ | N/A | N/A |
| Komisyon | Yok (mevcut) | ✅ | N/A | N/A |

### 2.3 Mobile consent akışı

```
LoginScreen / LegalConsentModal
        │
        ├── Checkbox: privacy, terms, kvkk, age
        │
        └── LegalPage modal ──fetch──► GET /api/legal/{privacy|terms|kvkk}
                                              │
                                              └── legal.py HARDCODED 2025 ❌
```

**SSOT hedef:** Modal → SSOT loader (local bundle or `/legal/v2/{id}?locale=tr`)

---

## 3. Hedef SSOT mimarisi

### 3.1 Master store (P2-L2)

```
design-lab/legal/documents/
├── kvkk/
│   ├── meta.json
│   ├── tr.md
│   └── CHANGELOG.md
├── privacy/
│   ├── meta.json
│   ├── tr.md
│   ├── en.md
│   └── CHANGELOG.md
└── ...
```

### 3.2 Build pipeline (P2-L5)

```
SSOT markdown + meta
        │
        ▼
  build-legal.ts (design-lab script)
        │
        ├──► legal.bundle.json (mobile offline)
        ├──► legal.export/ (backend static)
        └──► legal.types.ts (shared LegalSection[])
        │
        ▼
  Channel consumers (read-only)
```

**Not:** Build script P2-L5'te design-lab'da; production import P2-L6.

### 3.3 Runtime API (P2-L5 hedef)

| Endpoint | Açıklama |
|----------|----------|
| `GET /legal/v2/documents` | Id list + version |
| `GET /legal/v2/{id}` | `{ locale, version, title, sections[] }` |
| `POST /legal/v2/consent` | Log consent event |

Mevcut `/legal/privacy|terms|kvkk` → deprecated → redirect v2.

---

## 4. Kanal bazlı SSOT planı

### 4.1 Website

| Mevcut | SSOT geçiş | Faz |
|--------|------------|-----|
| `legal-content.ts` | Generated from SSOT | P2-L5 |
| `privacy-policy-locales.ts` | Merged into SSOT privacy | P2-L3 |
| `legal-page.tsx` | Unchanged renderer | — |
| `footer.tsx` links | Generated from URL registry | P2-L5 |
| `app.json` privacy URL | Points to SSOT-rendered page | P2-L6 |

**Public URL map (canonical):**

| SSOT ID | TR URL | EN URL |
|---------|--------|--------|
| privacy | `/gizlilik-politikasi` | `/privacy` |
| kvkk | `/kvkk` | — |
| terms-user | `/kullanim-sartlari` | — |
| data-destruction | `/hesap-silme` | `/delete-account` |
| cookie-policy | `/cerez-politikasi` | `/cookie-policy` (future) |
| support-policy | `/support` (section) | — |

### 4.2 Frontend (mobile)

| Mevcut | SSOT geçiş | Faz |
|--------|------------|-----|
| `app/privacy.tsx` body | `<LegalDocument id="privacy" />` | P2-L6 |
| `app/terms.tsx` body | `<LegalDocument id="terms-user" />` | P2-L6 |
| `app/kvkk.tsx` body | `<LegalDocument id="kvkk" />` | P2-L6 |
| `LegalPages.tsx` | SSOT loader; remove API | P2-L6 |
| `KVKKComponents.tsx` | **Delete** or SSOT WebView | P2-L6 |
| `LegalConsentModal` | Version-aware checkboxes | P2-L5 |
| `AsyncStorage legal_accepted` | + doc versions JSON | P2-L5 |
| `DriverKYCScreen` | terms-driver SSOT link | P2-L5 |

### 4.3 Backend

| Mevcut | SSOT geçiş | Faz |
|--------|------------|-----|
| `routes/legal.py` strings | Import SSOT JSON | P2-L5 |
| `templates/*.html` | HTTP 301 → website | P2-L6 |
| Consent DB | New `legal_consents` table | P2-L5 |
| Retention cron | Align with data-retention SSOT | P2-L6 |

### 4.4 Store

| Alan | SSOT kaynağı | Faz |
|------|--------------|-----|
| Privacy Policy URL | meta.canonicalUrl privacy TR | P2-L7 |
| Apple Privacy Nutrition | SSOT data class export | P2-L7 |
| Google Data Safety | SSOT JSON questionnaire | P2-L7 |
| Account deletion | data-destruction URL | P2-L7 |

### 4.5 Support

| Alan | SSOT kaynağı | Faz |
|------|--------------|-----|
| Support scope | support-policy | P2-L6 |
| KVKK başvuru | kvkk-application procedure | P2-L6 |
| Ban appeal | appeal-policy | P2-L6 |
| Email templates | Snippets from SSOT | P2-L6 |

### 4.6 Admin Panel

| Modül | SSOT kaynağı | Faz |
|-------|--------------|-----|
| User ban | community-enforcement | P2-L6 |
| Appeal queue | appeal-policy | P2-L6 |
| Trust moderation | trust-network | P2-L5 |
| Legal version dashboard | All meta.json | P2-L5 |

---

## 5. Consent SSOT planı

### 5.1 Zorunlu consent setleri

| Surface | Documents | Log fields |
|---------|-----------|------------|
| Registration | privacy, terms-user, kvkk, explicit-consent, age | userId, phone, versions[], timestamp |
| Driver KYC | + terms-driver | + kyc_terms_accepted_at, version |
| Trust invite accept | trust-network | inviteId, version |
| Trusted Direct enable | trusted-direct | channel, version |
| QR first use | qr-usage (ack) | tripId optional |

### 5.2 Re-consent trigger

| Change type | Action |
|-------------|--------|
| PATCH typo | No re-consent |
| Retention increase | Banner + re-consent |
| New data category | MAJOR + re-consent |
| New mandatory doc | Block feature until accept |

---

## 6. Migration phases (SSOT cutover)

### Phase A — Shadow (P2-L5 staging)

- SSOT renders on staging URLs `/legal-preview/{id}`
- Production unchanged
- Diff tool: SSOT vs legal-content

### Phase B — Dual publish (P2-L6 week 1)

- Website switches to SSOT
- Mobile bundle includes SSOT JSON
- Backend v2 API live; v1 deprecated

### Phase C — Retire (P2-L6 week 2)

- Remove hardcoded TSX bodies
- Remove legal.py strings
- Remove KVKKComponents embedded text
- Backend HTML → redirect

### Phase D — Verify (P2-L7)

- Store forms match SSOT
- Crawler: all public legal URLs 200
- CI: grep ban for `LEYLEK TAG GİZLİLİK` in production code

---

## 7. CI / drift prevention (P2-L6)

| Guard | Açıklama |
|-------|----------|
| `legal:lint` | Entity name, address in code |
| `legal:sync-check` | SSOT version = deployed bundle version |
| `legal:retention-test` | DNA matrix ↔ SSOT sections |
| PR block | New legal string outside design-lab |

---

## 8. P2-L1 çıkış checklist

| # | Item | Status |
|---|------|--------|
| 1 | SSOT principle documented | ✅ |
| 2 | Anti-SSOT inventory complete | ✅ |
| 3 | 21-doc matrix with phases | ✅ |
| 4 | Channel plan per surface | ✅ |
| 5 | Consent model designed | ✅ |
| 6 | Migration A→D defined | ✅ |
| 7 | Production untouched | ✅ |
| 8 | No legal drafts in P2-L1 | ✅ |

---

## 9. İlk SSOT oluşturma sırası (P2-L3)

1. **Merge privacy** — en kritik drift
2. **kvkk** — from legal-content (closest to canonical)
3. **terms-user** — fix payment language
4. **explicit-consent** — new
5. **data-retention** + **data-destruction** — extract
6. Operational bundle (trust, QR, trip)
7. Community + cookie + ops

---

## 10. Referans — mevcut dosya yolları

| Path | Rol | SSOT fate |
|------|-----|-----------|
| `website/lib/legal-content.ts` | TR structured legal | → generated |
| `website/lib/privacy-policy-locales.ts` | EN/TR privacy | → merged |
| `website/components/legal-page.tsx` | Renderer | keep |
| `frontend/components/LegalPages.tsx` | API modal | refactor |
| `frontend/components/KVKKComponents.tsx` | Stale embed | retire |
| `backend/routes/legal.py` | API strings | replace |
| `backend/templates/*.html` | Legacy HTML | redirect |
| `frontend/app.json` | privacyPolicyUrl | keep URL |

---

**Sonraki:** P2-L2 — create `documents/_schema/` and URL registry in design-lab.
