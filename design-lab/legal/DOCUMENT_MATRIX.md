# LeylekTAG Legal Document Matrix

**Phase:** P2-L1  
**Version:** v1.0  
**Parent:** `LEGAL_CONSTITUTION_V1.md`

---

## 0. Matrix kullanımı

Her satır bir **SSOT belge tanımıdır**. Sütunlar:

- **Mevcut durum** — repo taraması (2026-06-21)
- **Production faz** — hangi P2 alt fazda canlıya geçer
- **Beslediği sistemler** — tüketici kanallar

---

## 1. Master matrix

| # | Belge | SSOT ID | Mevcut durum | Gap / drift | Production faz | Beslediği sistemler |
|---|-------|---------|--------------|-------------|----------------|---------------------|
| 1 | **KVKK** | `kvkk` | ✅ `legal-content.ts`, `kvkk.tsx`, backend API/HTML | API 2025 stale; KVKKComponents wrong entity | **P2-L5** | Website `/kvkk`, mobile `/kvkk`, API `/legal/kvkk`, store data disclosure |
| 2 | **Açık Rıza** | `explicit-consent` | ⚠️ Checkbox only — no standalone doc | Belge yok; consent log versionless | **P2-L5** | Registration, KYC, trust flows |
| 3 | **Gizlilik Politikası** | `privacy` | ⚠️ **Dual source**: `legal-content.ts` TR + `privacy-policy-locales.ts` EN/TR | İki TR gizlilik ailesi; farklı derinlik | **P2-L5** | `/gizlilik-politikasi`, `/privacy`, `app.json` privacyPolicyUrl, store |
| 4 | **Kullanıcı Sözleşmesi** | `terms-user` | ✅ `legal-content.ts` kullanim; `terms.tsx` | Mobile terms §5 payment drift | **P2-L5** | `/kullanim-sartlari`, mobile `/terms`, API `/legal/terms`, consent modal |
| 5 | **Sürücü Sözleşmesi** | `terms-driver` | ⚠️ Section in kullanim + KYC checkbox | Ayrı belge yok | **P2-L5** | Driver KYC, driver onboarding, driver profile |
| 6 | **Güven Ağı** | `trust-network` | ⚠️ UI copy only (`trustedHubCopy.ts`, website topluluk) | Hukuk metni yok | **P2-L5** | Trust hub, invite flow, rating modal |
| 7 | **Sürücülerim (Trusted Direct)** | `trusted-direct` | ⚠️ Product UI (`TrustedDirectWaitingOverlay`, TDM copy) | Sözleşme yok | **P2-L5** | Trusted Direct match, driver offer TDM |
| 8 | **QR Kullanım Kuralları** | `qr-usage` | ⚠️ QR modals UI only; guvenlik marketing | Kurallar belgesi yok | **P2-L5** | QR scan, boarding modal, DriverBoardingQRModal |
| 9 | **Güven Al / Güven Ver** | `trust-give-receive` | ⚠️ `TrustRequestModal` UI | Hukuk metni yok | **P2-L5** | Trust request flow, post-trip trust |
| 10 | **Yolculuk Kuralları** | `trip-rules` | ⚠️ Scattered in kullanim + marketing | Ayrı belge yok | **P2-L5** | Active trip, match, cancel flows |
| 11 | **Topluluk Kuralları** | `community-guidelines` | ⚠️ Section in kullanim; website topluluk copy | Standalone yok | **P2-L5** | Muhabbet, topluluk pages, social templates |
| 12 | **Çerez Politikası** | `cookie-policy` | ❌ Yok | Website analytics/cookies undisclosed | **P2-L5** | Website banner, footer, Meta Pixel context |
| 13 | **Veri Saklama** | `data-retention` | ⚠️ Embedded in KVKK sections | Ayrı retention schedule yok | **P2-L5** | KVKK, privacy, backend retention jobs |
| 14 | **Veri İmha** | `data-destruction` | ✅ `legal-content.ts` hesap-silme | Partial overlap with deletion process | **P2-L5** | `/hesap-silme`, `/delete-account`, `delete-account.tsx` |
| 15 | **KVKK Başvuru Formu** | `kvkk-application` | ⚠️ Contact line only in KVKK | Formal başvuru formu/prosedür yok | **P2-L6** | KVKK page, support, email template |
| 16 | **Abonelik Şartları** | `subscription-terms` | ⚠️ terms.tsx "premium gelebilir" | Ürün ücretsiz — forward-looking only | **P2-L7** | Future IAP, settings |
| 17 | **İptal / İade** | `cancellation-refund` | ❌ Yok | Abonelik yok — placeholder | **P2-L7** | Store subscription, support |
| 18 | **Support Policy** | `support-policy` | ⚠️ `/support` page informal | SLA, scope, escalation yok | **P2-L6** | `/support`, in-app help, admin |
| 19 | **Community Enforcement** | `community-enforcement` | ⚠️ "hesap kapatma hakkı" in kullanim | Moderasyon prosedürü yok | **P2-L6** | Admin moderation, report flow |
| 20 | **Appeal Policy** | `appeal-policy` | ❌ Yok | Ban/suspend appeal yok | **P2-L6** | Admin, support, user notification |
| 21 | **Hesap Silme** (alias) | `account-deletion` | ✅ Same as data-destruction surface | EN route `/delete-account` separate | **P2-L5** | Mobile delete-account, web EN |

---

## 2. Belge detay kartları

Her belge: amaç · bağımlılıklar · production etkisi · faz · sistemler.

---

### 2.1 KVKK

| Alan | Detay |
|------|-------|
| **Amaç** | 6698 sayılı Kanun kapsamında aydınlatma — veri sorumlusu, amaç, haklar |
| **Bağımlılıklar** | `privacy`, `data-retention`, `explicit-consent`, `kvkk-application` |
| **Production etkisi** | Store data safety, kayıt consent, yasal zorunluluk |
| **Faz** | Draft P2-L3 · Review P2-L4 · Wire P2-L5 |
| **Sistemler** | Website, mobile, backend API, store metadata |

**Mevcut kaynaklar:** `website/lib/legal-content.ts` (kvkk), `frontend/app/kvkk.tsx`, `backend/routes/legal.py`, `backend/templates/kvkk.html`

---

### 2.2 Açık Rıza

| Alan | Detay |
|------|-------|
| **Amaç** | KVKK m.5 kapsamında açık rıza — aydınlatmadan ayrı |
| **Bağımlılıklar** | `kvkk`, `privacy` |
| **Production etkisi** | Consent log, registration gate |
| **Faz** | P2-L3 draft · P2-L5 wire (consent registry) |
| **Sistemler** | Mobile registration, driver KYC, optional marketing |

---

### 2.3 Gizlilik Politikası

| Alan | Detay |
|------|-------|
| **Amaç** | Kişisel veri işleme şeffaflığı — kullanıcı dili |
| **Bağımlılıklar** | `kvkk`, `cookie-policy`, `data-retention` |
| **Production etkisi** | `#1 store URL`, GDPR-style EN for App Store |
| **Faz** | Merge dual source P2-L3 · P2-L5 |
| **Sistemler** | Website TR/EN, mobile, `privacyPolicyUrl` |

**Drift:** `privacy-policy-locales.ts` (geniş EN/TR) vs `legal-content.ts` gizlilik (kısa TR)

---

### 2.4 Kullanıcı Sözleşmesi

| Alan | Detay |
|------|-------|
| **Amaç** | Platform kullanım koşulları — tüm kullanıcılar |
| **Bağımlılıklar** | `trip-rules`, `community-guidelines`, `privacy` |
| **Production etkisi** | Consent modal, uyuşmazlık sınırı |
| **Faz** | P2-L3 (fix payment) · P2-L5 |
| **Sistemler** | Website, mobile, API |

**Drift:** `terms.tsx` §5 komisyon vs `legal-content` masraf paylaşımı

---

### 2.5 Sürücü Sözleşmesi

| Alan | Detay |
|------|-------|
| **Amaç** | Sürücüye özel yükümlülükler — ehliyet, sigorta, araç |
| **Bağımlılıklar** | `terms-user`, `kvkk` (driver data) |
| **Production etkisi** | KYC gate, driver liability |
| **Faz** | P2-L3 extract · P2-L5 |
| **Sistemler** | DriverKYCScreen, driver onboarding |

---

### 2.6 Güven Ağı

| Alan | Detay |
|------|-------|
| **Amaç** | Güven ağı davet, revoke, görünürlük kuralları |
| **Bağımlılıklar** | `trust-give-receive`, `terms-user`, `privacy` |
| **Production etkisi** | Trust hub API, invite consent |
| **Faz** | P2-L3 · P2-L5 |
| **Sistemler** | Mobile trust hub, rating modal, website topluluk |

---

### 2.7 Sürücülerim (Trusted Direct)

| Alan | Detay |
|------|-------|
| **Amaç** | Doğrudan eşleşme kanalı — ek yükümlülükler |
| **Bağımlılıklar** | `trust-network`, `trip-rules`, `qr-usage` |
| **Production etkisi** | TDM offer channel, payment UI constraints |
| **Faz** | P2-L3 · P2-L5 |
| **Sistemler** | TrustedDirectWaitingOverlay, driver offer |

---

### 2.8 QR Kullanım Kuralları

| Alan | Detay |
|------|-------|
| **Amaç** | QR boarding doğrulama — tarafların sorumluluğu |
| **Bağımlılıklar** | `trip-rules`, `terms-user` |
| **Production etkisi** | QR modals, guvenlik claims |
| **Faz** | P2-L3 · P2-L5 |
| **Sistemler** | QR scan, DriverBoardingQRModal, website guvenlik |

---

### 2.9 Güven Al / Güven Ver

| Alan | Detay |
|------|-------|
| **Amaç** | Karşılıklı güven sinyali — ne anlama gelir, ne garanti etmez |
| **Bağımlılıklar** | `trust-network`, `community-guidelines` |
| **Production etkisi** | TrustRequestModal, profile trust metrics |
| **Faz** | P2-L3 · P2-L5 |
| **Sistemler** | Mobile trust flow |

---

### 2.10 Yolculuk Kuralları

| Alan | Detay |
|------|-------|
| **Amaç** | Aktif yolculuk davranışı — iptal, no-show, masraf |
| **Bağımlılıklar** | `terms-user`, `qr-usage` |
| **Production etkisi** | Trip lifecycle, dispute support |
| **Faz** | P2-L3 · P2-L5 |
| **Sistemler** | Match, trip end, rating |

---

### 2.11 Topluluk Kuralları

| Alan | Detay |
|------|-------|
| **Amaç** | Muhabbet, teklif, topluluk alanı davranış kuralları |
| **Bağımlılıklar** | `community-enforcement`, `terms-user` |
| **Production etkisi** | Muhabbet moderation, social content |
| **Faz** | P2-L3 extract · P2-L5 |
| **Sistemler** | Muhabbet, website topluluk, social templates |

---

### 2.12 Çerez Politikası

| Alan | Detay |
|------|-------|
| **Amaç** | Web çerezleri, analytics (Meta Pixel), tercih yönetimi |
| **Bağımlılıklar** | `privacy` |
| **Production etkisi** | Cookie banner, e-ticaret uyumu |
| **Faz** | P2-L3 · P2-L5 |
| **Sistemers** | Website (`MetaPixel`, layout) |

---

### 2.13 Veri Saklama

| Alan | Detay |
|------|-------|
| **Amaç** | Retention schedule — tek matris |
| **Bağımlılıklar** | `kvkk`, `privacy`, backend jobs |
| **Production etkisi** | Cron deletion, support answers |
| **Faz** | P2-L3 · P2-L5 backend sync |
| **Sistemler** | Backend retention, legal cross-refs |

---

### 2.14 Veri İmha

| Alan | Detay |
|------|-------|
| **Amaç** | Silme/anonymization prosedürü |
| **Bağımlılıklar** | `data-retention`, `kvkk-application` |
| **Production etkisi** | Account deletion flow |
| **Faz** | P2-L3 refine · P2-L5 |
| **Sistemler** | `/hesap-silme`, delete-account, backend purge |

---

### 2.15 KVKK Başvuru Formu

| Alan | Detay |
|------|-------|
| **Amaç** | m.11 başvuru prosedürü + form alanları |
| **Bağımlılıklar** | `kvkk` |
| **Production etkisi** | Support workflow, KVKK compliance |
| **Faz** | P2-L3 · P2-L6 (form page) |
| **Sistemler** | Website, support email, admin |

---

### 2.16 Abonelik Şartları

| Alan | Detay |
|------|-------|
| **Amaç** | Gelecek premium/IAP koşulları |
| **Bağımlılıklar** | `terms-user`, `cancellation-refund` |
| **Production etkisi** | Store IAP, settings |
| **Faz** | P2-L7 (when product ships paid features) |
| **Sistemler** | Store, in-app purchases |

---

### 2.17 İptal / İade

| Alan | Detay |
|------|-------|
| **Amaç** | Abonelik iptali, iade prosedürü |
| **Bağımlılıklar** | `subscription-terms` |
| **Production etkisi** | Store compliance, support |
| **Faz** | P2-L7 |
| **Sistemler** | Store, support |

---

### 2.18 Support Policy

| Alan | Detay |
|------|-------|
| **Amaç** | Destek kapsamı, SLA, kanallar, escalation |
| **Bağımlılıklar** | `terms-user` |
| **Production etkisi** | Support page, admin SOP |
| **Faz** | P2-L3 · P2-L6 |
| **Sistemler** | `/support`, in-app help, admin |

---

### 2.19 Community Enforcement

| Alan | Detay |
|------|-------|
| **Amaç** | Moderasyon, uyarı, suspend, ban prosedürü |
| **Bağımlılıklar** | `community-guidelines`, `appeal-policy` |
| **Production etkisi** | Admin moderation tools |
| **Faz** | P2-L3 · P2-L6 |
| **Sistemler** | Admin panel, report API |

---

### 2.20 Appeal Policy

| Alan | Detay |
|------|-------|
| **Amaç** | Karar itirazı — süre, kanıt, sonuç |
| **Bağımlılıklar** | `community-enforcement` |
| **Production etkisi** | Ban appeal support flow |
| **Faz** | P2-L3 · P2-L6 |
| **Sistemler** | Support, admin |

---

## 3. Mevcut kaynak → SSOT migration map

| Mevcut dosya | → SSOT belgeler | Aksiyon |
|--------------|-----------------|---------|
| `legal-content.ts` | kvkk, terms-user, privacy (partial), data-destruction | Migrate + merge privacy |
| `privacy-policy-locales.ts` | privacy (en, tr) | Merge to single privacy |
| `backend/routes/legal.py` | kvkk, terms-user, privacy | Replace with SSOT export |
| `frontend/app/*.tsx` legal routes | all wired docs | SSOT loader |
| `KVKKComponents.tsx` | kvkk, explicit-consent | **Retire** |
| `LegalPages.tsx` | API-backed | **Retire API strings** |
| Backend HTML templates | all | Redirect to website or SSOT render |
| `website_files/*` | — | Archive |

---

## 4. Öncelik sırası (P2-L3 draft)

| P | Belge | Gerekçe |
|---|-------|---------|
| P0 | privacy merge, kvkk, terms-user | Store + consent |
| P0 | explicit-consent | KVKK compliance |
| P1 | terms-driver, data-retention, data-destruction | Driver + deletion |
| P1 | trust-network, qr-usage, trip-rules | Core product |
| P2 | community-*, cookie-policy | Platform completeness |
| P3 | subscription, cancellation | Future |
| P3 | support, enforcement, appeal | Ops |

---

**İlişkili:** `LEGAL_SSOT_PLAN.md`, `LEGAL_DEPENDENCY_GRAPH.md`
