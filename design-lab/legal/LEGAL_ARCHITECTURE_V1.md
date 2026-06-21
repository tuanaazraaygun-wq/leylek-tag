# LeylekTAG Legal Architecture v1

**Phase:** P2-L1  
**Version:** v1.0  
**Status:** Architecture only  
**Parent:** `LEGAL_CONSTITUTION_V1.md`

---

## 1. Mimari özet

LeylekTAG hukuk sistemi **dört katmanlı** mimari kullanır:

```
┌─────────────────────────────────────────────────────────────┐
│  L4 — CHANNEL RENDERERS                                     │
│  Website · Mobile · Backend API · Store · Support · Admin     │
└───────────────────────────┬─────────────────────────────────┘
                            │ read-only bind
┌───────────────────────────▼─────────────────────────────────┐
│  L3 — LEGAL RUNTIME (P2-L5)                                   │
│  Loader · Locale resolver · Version gate · Consent registry   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  L2 — SSOT DOCUMENT STORE (P2-L3)                             │
│  design-lab/legal/documents/{id}/{locale}.md                  │
│  + machine schema (JSON metadata)                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  L1 — CONSTITUTION & DNA (P2-L1) ✅                           │
│  Constitution · Architecture · DNA · Standards · Matrix     │
└─────────────────────────────────────────────────────────────┘
```

**P2-L1:** Yalnızca L1 tamamlanır. L2–L4 planlanır; production dokunulmaz.

---

## 2. Katman L1 — Constitution & DNA

| Bileşen | Dosya | Amaç |
|---------|-------|------|
| Anayasa | `LEGAL_CONSTITUTION_V1.md` | Değişmez kurallar |
| Mimari | `LEGAL_ARCHITECTURE_V1.md` | Bu belge |
| DNA | `LEGAL_DNA_V1.md` | İlkeler, veri sınıfları, roller |
| Standartlar | `LEGAL_STANDARDS_V1.md` | Yazım, versiyon, uyum |
| Rehber | `LEGAL_GUIDELINES_V1.md` | Draft/review süreci |
| Matris | `DOCUMENT_MATRIX.md` | 21 belge envanter |
| SSOT plan | `LEGAL_SSOT_PLAN.md` | Migration hedefi |
| Bağımlılık | `LEGAL_DEPENDENCY_GRAPH.md` | Cross-doc graph |
| Yol haritası | `LEGAL_ROADMAP.md` | P2 alt fazlar |

---

## 3. Katman L2 — SSOT Document Store (P2-L2/L3 hedef)

### 3.1 Klasör yapısı (plan — henüz oluşturulmadı)

```
design-lab/legal/documents/
├── _schema/
│   ├── document.meta.schema.json
│   └── section.schema.json
├── kvkk/
│   ├── tr.md
│   ├── meta.json
│   └── en.md                    # opsiyonel
├── privacy/
├── explicit-consent/
├── terms-user/
├── terms-driver/
├── trust-network/
├── trusted-direct/
├── qr-usage/
├── trust-give-receive/
├── trip-rules/
├── community-guidelines/
├── cookie-policy/
├── data-retention/
├── data-destruction/
├── kvkk-application-form/
├── subscription-terms/
├── cancellation-refund/
├── support-policy/
├── community-enforcement/
└── appeal-policy/
```

### 3.2 Belge metadata şeması (hedef)

```json
{
  "id": "kvkk",
  "slug": "kvkk",
  "version": "1.0.0",
  "effectiveDate": "2026-06-01",
  "locale": "tr",
  "title": "KVKK Aydınlatma Metni",
  "category": "data-protection",
  "mandatoryConsent": false,
  "consentSurface": ["registration"],
  "productionPhase": "P2-L5",
  "channels": ["website", "mobile", "backend-api", "store"],
  "dependencies": ["privacy", "data-retention"],
  "supersedes": []
}
```

### 3.3 Section model (website uyumlu)

Mevcut `LegalSection` tipi SSOT hedef format:

```typescript
type LegalSection = {
  id: string;           // anchor slug
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};
```

Kaynak: `website/lib/legal-content.ts` — **renderer uyumlu** kalacak; içerik SSOT'tan gelecek.

---

## 4. Katman L3 — Legal Runtime (P2-L5)

| Servis | Görev |
|--------|-------|
| **Document loader** | SSOT → structured JSON |
| **Locale resolver** | tr default; en fallback chain |
| **Version gate** | Kullanıcı consent version vs current |
| **Consent registry** | Hangi belge, hangi sürüm, hangi timestamp |
| **Changelog emitter** | Material change → re-consent flag |

### 4.1 Consent model (hedef)

| Olay | Kayıt |
|------|-------|
| Kayıt | privacy + terms + kvkk + explicit-consent + age |
| Sürücü KYC | terms-driver + explicit-consent (driver) |
| Güven ağı daveti | trust-network |
| Trusted Direct | trusted-direct |
| QR boarding | qr-usage (bilgilendirme + onay) |

Mevcut: `LegalConsentModal`, `legal_accepted` AsyncStorage, `kvkk_accepted_phone` — **versionless** (P2-L5'te genişletilecek).

---

## 5. Katman L4 — Channel Renderers

### 5.1 Website (Next.js)

| Yüzey | Mevcut | SSOT hedef |
|-------|--------|------------|
| `/gizlilik-politikasi` | `privacy-policy-locales.ts` TR | SSOT `privacy/tr` |
| `/privacy` | `privacy-policy-locales.ts` EN | SSOT `privacy/en` |
| `/kvkk` | `legal-content.ts` | SSOT `kvkk/tr` |
| `/kullanim-sartlari` | `legal-content.ts` | SSOT `terms-user/tr` |
| `/hesap-silme` | `legal-content.ts` | SSOT `data-destruction/tr` |
| Footer links | `footer.tsx` | Generated from matrix |
| `/guvenlik` | Marketing copy | Link to legal docs — not SSOT body |
| Store privacy URL | `app.json` → gizlilik-politikasi | SSOT canonical URL |

### 5.2 Mobile (React Native / Expo)

| Yüzey | Mevcut | SSOT hedef |
|-------|--------|------------|
| `/privacy`, `/terms`, `/kvkk` routes | Hardcoded TSX | SSOT loader component |
| `LegalConsentModal` | Checkbox + API fetch | SSOT + version |
| `LegalPages.tsx` | `GET /legal/*` | Deprecate API strings |
| `KVKKComponents.tsx` | Embedded stale text | Retire → SSOT |
| `profile.tsx` links | Local routes | Unchanged paths |
| `settings-hub.tsx` | Legal row links | SSOT URLs |
| Driver KYC terms | Inline checkbox | SSOT `terms-driver` |

### 5.3 Backend (FastAPI)

| Yüzey | Mevcut | SSOT hedef |
|-------|--------|------------|
| `GET /legal/privacy` | Hardcoded 2025 string | SSOT JSON export |
| `GET /legal/terms` | Hardcoded | SSOT |
| `GET /legal/kvkk` | Hardcoded | SSOT |
| `templates/*.html` | Duplicate HTML | Redirect or SSOT render |
| Consent audit DB | Partial (`kyc_terms_accepted_at`) | Full consent log |

### 5.4 Store (Play / App Store)

| Alan | Kaynak |
|------|--------|
| Privacy Policy URL | `https://leylektag.com/gizlilik-politikasi` |
| Terms URL | `/kullanim-sartlari` |
| Data safety form | SSOT data inventory export |
| Account deletion | `/hesap-silme` |

### 5.5 Support

| Kanal | SSOT beslemesi |
|-------|----------------|
| `/support` | Support Policy link |
| E-posta şablonları | Retention + deletion refs |
| Admin panel | Enforcement + appeal policies |

### 5.6 Admin Panel

| Modül | Belgeler |
|-------|----------|
| Moderation | community-enforcement, appeal-policy |
| Trust ops | trust-network, trusted-direct |
| Legal export | SSOT version dashboard |

---

## 6. Mevcut sistem envanteri (read-only scan)

### 6.1 Website — aktif kaynaklar

| Dosya | Belgeler | Güncelleme |
|-------|----------|------------|
| `website/lib/legal-content.ts` | Gizlilik TR, Kullanım, KVKK, Hesap silme | Mayıs 2026 |
| `website/lib/privacy-policy-locales.ts` | Gizlilik EN + TR (geniş) | May 2026 |
| `website/components/legal-page.tsx` | Renderer | — |
| `website/components/privacy-policy-view.tsx` | EN/TR privacy renderer | — |

### 6.2 Mobile — aktif kaynaklar

| Dosya | Tip | Drift |
|-------|-----|-------|
| `frontend/app/privacy.tsx` | Hardcoded | ~legal-content TR |
| `frontend/app/terms.tsx` | Hardcoded | **Ödeme ifadesi çelişkisi** |
| `frontend/app/kvkk.tsx` | Hardcoded | ~legal-content |
| `frontend/components/LegalPages.tsx` | API modal | **backend 2025** |
| `frontend/components/KVKKComponents.tsx` | Embedded | **Leylek Teknoloji 2024** |

### 6.3 Backend — aktif kaynaklar

| Dosya | Tip | Drift |
|-------|-----|-------|
| `backend/routes/legal.py` | JSON API | 2025, eski adres |
| `backend/templates/kvkk.html` | HTML | Aralık 2025, ayrı kopya |
| `backend/templates/gizlilik-politikasi.html` | HTML | Duplicate |
| `backend/templates/kullanim-sartlari.html` | HTML | Duplicate |
| `backend/templates/hesap-silme.html` | HTML | Duplicate |
| `backend/templates/landing.html` | Marketing + legal links | — |

### 6.4 Legacy

| Dosya | Durum |
|-------|-------|
| `website_files/*.html` | Stale static mirror |
| `backend/static/images/leylek-logo.png` | Missing from repo |

---

## 7. Classification — mevcut belgeler

| Mevcut artifact | SSOT hedef belge | Sınıf |
|-----------------|------------------|-------|
| `legal-content.ts` → gizlilik | `privacy` (TR kısa) | **Merge** → tek privacy master |
| `privacy-policy-locales.ts` | `privacy` (EN + TR geniş) | **Merge** |
| `legal-content.ts` → kvkk | `kvkk` | **Migrate** |
| `legal-content.ts` → kullanim | `terms-user` | **Migrate** + fix payment drift |
| `legal-content.ts` → hesap-silme | `data-destruction` + link `kvkk-application` | **Split/refine** |
| `legal.py` privacy/terms/kvkk | Same IDs | **Retire strings** |
| KVKKComponents AYDINLATMA | `kvkk` | **Retire** |
| kullanim → Topluluk Kuralları section | `community-guidelines` | **Extract** P2-L3 |
| kullanim → Sürücü Sorumluluğu | `terms-driver` | **Extract** P2-L3 |
| — | `explicit-consent` | **New** P2-L3 |
| — | `trust-network`, `trusted-direct` | **New** P2-L3 |
| — | `qr-usage`, `trust-give-receive` | **New** P2-L3 |
| — | `cookie-policy` | **New** P2-L3 |
| guvenlik page copy | Marketing | **Not legal SSOT** |

---

## 8. Production impact by layer

| Katman | P2-L1 | P2-L5 | P2-L6 |
|--------|-------|-------|-------|
| L1 Constitution | ✅ Write | Read | Read |
| L2 SSOT docs | Plan | Draft | Freeze |
| L3 Runtime | Plan | Implement | Deploy |
| L4 Channels | **None** | Map | **Wire** |

---

## 9. Security & compliance architecture

| Konu | Mimari karar |
|------|--------------|
| PII in legal docs | Örnek veri yok; generic category lists |
| Consent proof | Server-side log: userId, docId, version, timestamp, ip hash |
| 5651 | Ayrı section in terms-user + community-enforcement |
| Cross-border | KVKK + privacy — Supabase/Google Maps disclosure (mevcut) |
| Minors | Age gate 18+ — explicit-consent + terms-user |
| Account deletion | data-destruction + backend job spec link |

---

## 10. İlişkili belgeler

| Belge | Bağımlılık |
|-------|------------|
| `LEGAL_DNA_V1.md` | DNA → document categories |
| `DOCUMENT_MATRIX.md` | Full 21-doc mapping |
| `LEGAL_SSOT_PLAN.md` | Migration steps |
| `LEGAL_DEPENDENCY_GRAPH.md` | Doc ↔ doc ↔ system |
