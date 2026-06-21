# LeylekTAG Legal Constitution v1

**Phase:** P2-L1 — Legal Constitution System  
**Version:** Legal Constitution v1.0  
**Status:** Architecture only — no production legal text  
**Date:** 2026-06-21  
**Scope:** `design-lab/legal/`  
**Governance:** Legal counsel + Product Owner sign-off for amendment  
**Parent program:** `design-lab/RELEASE_ROADMAP.md` Phase 2

---

## 0. Purpose

Bu belge LeylekTAG **hukuk sisteminin anayasasıdır**. Brand Constitution (`BRAND_CONSTITUTION_V4.md`) marka kimliğini kilitlediği gibi, Legal Constitution:

- Hangi hukuk belgelerinin **zorunlu** olduğunu,
- Tek kaynak (SSOT) ilkesini,
- Türkiye mevzuatına uyum çerçevesini,
- Production'a geçiş **öncesi** değişmez kuralları

tanımlar.

**P2-L1 kuralı:** Bu fazda hiçbir hukuki metin production'a geçirilmez. Yalnızca mimari kurulur.

---

## 1. North Star (hukuk)

> **LeylekTAG kullanıcısı, hangi kanaldan girerse girsin, aynı hukuki gerçeği okur.**

| İlke | Anlam |
|------|-------|
| **Tek gerçek** | Bir belge = bir SSOT kaynağı |
| **Şeffaflık** | Veri işleme, sorumluluk sınırı, topluluk kuralları açık |
| **Uyum** | KVKK, 5651, tüketici ve platform sorumluluğu çerçevesi |
| **Operasyonel** | QR, güven ağı, teklif — ürün akışına map edilmiş kurallar |
| **Güncellenebilir** | Versiyon + tarih + changelog — gizli değişiklik yok |

---

## 2. Veri sorumlusu (canonical — SSOT hedefi)

Mevcut production'da **drift** var; SSOT onayı sonrası tek değer:

| Alan | Canonical (hedef) | Not |
|------|---------------------|-----|
| Unvan | Karekod Teknoloji ve Yazılım A.Ş. | `legal-content.ts` ile hizalı |
| Adres | Meşrutiyet Mah. Konur Sk. Özsoy İş Hanı No: 25 İç Kapı No: 13 Çankaya / Ankara | KVKK sayfası ile hizalı |
| E-posta | info@karekodteknoloji.com | Birincil KVKK başvuru |
| Destek | support@leylektag.com | Ürün desteği (ayrı lane) |
| Telefon | 0850 307 80 29 | |
| Vergi No | 52441642657 | Backend template'te mevcut |

**Retire edilecek (drift):**

- `KVKKComponents.tsx` — "Leylek Teknoloji A.Ş.", leylekapp.com, Aralık 2024
- `backend/routes/legal.py` — Karanfil Mah. Konur 23, Ocak 2025
- Eski şirket unvanları ve adresler

---

## 3. Belge taksonomisi

### 3.1 Katman A — Anayasa (design-lab)

| Belge | Rol |
|-------|-----|
| `LEGAL_CONSTITUTION_V1.md` | Değişmez kurallar |
| `LEGAL_ARCHITECTURE_V1.md` | Sistem mimarisi |
| `LEGAL_DNA_V1.md` | Hukuk DNA — ilkeler, veri sınıfları |
| `LEGAL_STANDARDS_V1.md` | Yazım ve uyum standartları |
| `LEGAL_GUIDELINES_V1.md` | Operasyon rehberi |

### 3.2 Katman B — Kullanıcıya dönük belgeler (SSOT draft — P2-L3)

| Grup | Belgeler |
|------|----------|
| **Veri koruma** | KVKK, Açık Rıza, Gizlilik, Veri Saklama, Veri İmha, KVKK Başvuru |
| **Sözleşmeler** | Kullanıcı, Sürücü, Güven Ağı, Sürücülerim (Trusted Direct) |
| **Operasyon** | QR Kuralları, Yolculuk Kuralları, Güven Al/Ver |
| **Topluluk** | Topluluk Kuralları, Community Enforcement, Appeal |
| **Platform** | Çerez, Abonelik, İptal/İade, Support Policy |

### 3.3 Katman C — Production tüketici (P2-L5+)

Website, mobile, backend API, store, admin — hepsi Katman B SSOT'tan türetilir.

---

## 4. Değişmez kurallar

### 4.1 SSOT

| Kural ID | Kural |
|----------|-------|
| `legal.ssot.oneSource` | Her belge tek master dosyada yaşar |
| `legal.ssot.noDuplicate` | Aynı metin iki yerde hardcode edilmez |
| `legal.ssot.versioned` | Her belge `version` + `effectiveDate` taşır |
| `legal.ssot.localeFork` | TR master; EN türevi açık locale tag ile |

### 4.2 Platform sorumluluğu

| Kural ID | Kural |
|----------|-------|
| `legal.platform.intermediary` | LeylekTAG aracı platform — taşımacılık hizmeti sunmaz |
| `legal.platform.noPaymentProcessor` | Uygulama ödeme kuruluşu değil (mevcut ürün gerçeği) |
| `legal.platform.userDisputes` | Yolculuk uyuşmazlıkları taraflar arası (net ifade) |

### 4.3 Veri koruma

| Kural ID | Kural |
|----------|-------|
| `legal.kvkk.aydinlatma` | Aydınlatma metni ayrı belge — gizlilik ile karıştırılmaz |
| `legal.kvkk.consent` | Açık rıza ayrı belge + kayıt (timestamp, version) |
| `legal.kvkk.retention` | Saklama süreleri tek matris — belgeler arası çelişki yok |
| `legal.kvkk.rights` | m.11 hakları + başvuru kanalı her belgede tutarlı |

### 4.4 Ürün eşlemesi

| Kural ID | Kural |
|----------|-------|
| `legal.product.qr` | QR boarding kuralları ayrı belge |
| `legal.product.trust` | Güven ağı + Trusted Direct ayrı sözleşme dilimi |
| `legal.product.community` | Topluluk + enforcement + appeal üçlüsü |
| `legal.product.driver` | Sürücü yükümlülükleri ayrı sözleşme — kullanıcı sözleşmesine gömülmez |

### 4.5 Yasaklar

| Yasak ID | Açıklama |
|----------|----------|
| `ban.staleEmbed` | Eski metin component içine gömme |
| `ban.apiHardcode` | Backend route içinde uzun string constitution |
| `ban.silentChange` | Tarih/version güncellemeden metin değişimi |
| `ban.conflictTerms` | Ödeme/komisyon ifadesi belgeler arası çelişki |
| `ban.wrongEntity` | Yanlış şirket unvanı / adres |

---

## 5. Mevcut production drift (P2-L1 tespiti)

| Kaynak | Sorun | Severity |
|--------|-------|----------|
| `backend/routes/legal.py` | Ocak 2025, eski adres, mobil consent besler | **P0** |
| `KVKKComponents.tsx` | Leylek Teknoloji, 2024, farklı içerik | **P0** |
| `LegalPages.tsx` | API'den eski JSON çeker | **P0** |
| `privacy-policy-locales.ts` vs `legal-content.ts` | İki ayrı gizlilik ailesi TR/EN | **P1** |
| `frontend/app/terms.tsx` vs `legal-content.ts` | Komisyon/üyelik vs ödeme tahsilatı yok | **P1** |
| `backend/templates/*.html` | HTML duplicate, static logo broken | **P1** |
| `website_files/*.html` | Stale mirror | **P2** |

Detay: `DOCUMENT_MATRIX.md`, `LEGAL_SSOT_PLAN.md`

---

## 6. Amendment rule

- Yeni zorunlu belge → Constitution v1.1 + matrix update
- Veri sorumlusu değişikliği → tüm Katman B + store metadata
- Saklama süresi değişikliği → KVKK + Gizlilik + Veri Saklama + backend retention policy sync
- Production wire → yalnızca P2-L5 gate sonrası

---

## 7. Belge indeksi (P2-L1 paketi)

| Dosya | Rol |
|-------|-----|
| `LEGAL_ARCHITECTURE_V1.md` | Mimari katmanlar |
| `LEGAL_DNA_V1.md` | Hukuk DNA |
| `LEGAL_STANDARDS_V1.md` | Standartlar |
| `LEGAL_GUIDELINES_V1.md` | Rehber |
| `LEGAL_DEPENDENCY_GRAPH.md` | Bağımlılıklar |
| `LEGAL_ROADMAP.md` | P2-L1–L7 |
| `DOCUMENT_MATRIX.md` | 21 belge matrisi |
| `LEGAL_SSOT_PLAN.md` | SSOT uygulama planı |

---

## Analysis gate (P2-L1)

| Check | Status |
|-------|--------|
| Production değiştirildi | ❌ HAYIR |
| Hukuki metin draft (Katman B) | ❌ HAYIR — P2-L3 |
| Mimari belgeler | ✅ |
| Mevcut envanter tarandı | ✅ |

**Sonraki:** P2-L2 Document Architecture — SSOT şema + klasör yapısı.
