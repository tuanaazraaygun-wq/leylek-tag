# LeylekTAG Legal Standards v1

**Phase:** P2-L1  
**Version:** v1.0  
**Parent:** `LEGAL_CONSTITUTION_V1.md`

---

## 1. Amaç

Tüm LeylekTAG hukuk belgelerinin SSOT'ta **aynı kalite ve uyum standardına** uymasını sağlar.

---

## 2. Versiyon standardı

| Alan | Format | Örnek |
|------|--------|-------|
| Semantic version | `MAJOR.MINOR.PATCH` | `1.2.0` |
| Effective date | ISO 8601 | `2026-06-01` |
| Display date (TR) | Ay Yıl | `Haziran 2026` |
| Changelog | `CHANGELOG.md` per document | Mandatory on MINOR+ |

| Değişiklik tipi | Version bump | Re-consent |
|-----------------|--------------|------------|
| Typo / clarifying | PATCH | Hayır |
| Yeni section, retention change | MINOR | Değerlendir |
| Veri sorumlusu, amaç değişimi | MAJOR | Evet |

---

## 3. Belge yapı standardı

Her SSOT belgesi:

```markdown
---
id: kvkk
version: 1.0.0
effectiveDate: 2026-06-01
locale: tr
title: KVKK Aydınlatma Metni
category: data-protection
---

# KVKK Aydınlatma Metni

## intro
{intro paragraph}

## section:{slug}
### heading
{heading text}
- bullet
{paragraph}
```

Render pipeline → `LegalSection[]` + metadata.

---

## 4. Zorunlu bölümler (kategori bazlı)

### 4.1 data-protection (KVKK, Gizlilik, Saklama, İmha)

- [ ] Veri sorumlusu iletişim bloğu
- [ ] İşlenen veri kategorileri (yolcu / sürücü / teknik)
- [ ] Amaç ve hukuki sebep
- [ ] Saklama süreleri (LEGAL_DNA matrix)
- [ ] Aktarım (yurt içi/dışı)
- [ ] m.11 hakları + başvuru kanalı
- [ ] Güncelleme tarihi

### 4.2 terms (Kullanıcı, Sürücü, Abonelik)

- [ ] Tanım ve kapsam
- [ ] Platform sorumluluk sınırı
- [ ] Kullanıcı yükümlülükleri
- [ ] Fesih / hesap kapatma
- [ ] Uyuşmazlık / yetkili mahkeme
- [ ] Değişiklik bildirimi

### 4.3 operational (QR, Yolculuk, Güven)

- [ ] Ne zaman geçerli
- [ ] Tarafların yükümlülükleri
- [ ] Platform rolü (aracı)
- [ ] İhlal sonuçları (referans: enforcement)

### 4.4 community (Topluluk, Enforcement, Appeal)

- [ ] İzin verilen / yasak davranış
- [ ] Moderasyon süreci
- [ ] İtiraz hakkı ve süre
- [ ] 5651 bildirim mekanizması referansı

---

## 5. Türkiye mevzuat uyum checklist

| Mevzuat | Uygulama |
|---------|----------|
| **6698 KVKK** | Aydınlatma ayrı; açık rıza ayrı; VERBİS gereksinimleri (danışman) |
| **5651** | İçerik kaldırma — gizlilik + topluluk |
| **6502 Tüketici** | İptal/iade (abonelik gelirse) |
| **TBK / hizmet** | Platform aracılık sınırı |
| **E-Ticaret** | Çerez, mesafeli (web) |
| **App store** | Privacy URL, deletion, data safety |

**Not:** P2-L1 mimari only — nihai uyum **P2-L4 Legal Review** + hukuk danışmanı.

---

## 6. Terminoloji standardı

| Terim | Kullanım | Yasak alternatif |
|-------|----------|------------------|
| Leylek TAG | Marka (boşluklu) | LeylekTag, LEYLEKTAG (legal body) |
| Karekod Teknoloji ve Yazılım A.Ş. | Veri sorumlusu | Leylek Teknoloji |
| Yolculuk paylaşımı | Hizmet tanımı | Taksi hizmeti |
| Masraf paylaşımı | Ödeme modeli | Platform komisyonu (mevcut ürün) |
| Güven ağı | Trust network | Arkadaş listesi |
| Leylek Teklifi | Offer module | — |
| Muhabbet | Chat module | — |

---

## 7. Locale standardı

| Locale | Master | Türev |
|--------|--------|-------|
| `tr` | Evet | — |
| `en` | Hayır | Privacy, delete-account, store metadata |

EN çeviri: hukuk danışmanı veya certified translation — otomatik çeviri yasak (MAJOR belgeler).

---

## 8. Consent UX standardı (P2-L5 hedef)

| Kural | Standard |
|-------|----------|
| Checkbox | Her zorunlu belge ayrı |
| Link | SSOT URL veya in-app rendered version |
| Version display | "Sürüm 1.2 — Haziran 2026" |
| Accept log | docId, version, timestamp, userId |
| Re-consent | Material change banner |

---

## 9. QA standardı (belge başına)

| Test | Kriter |
|------|--------|
| Entity check | Karekod + doğru adres |
| Retention consistency | DNA matrix match |
| Cross-ref | Linked docs exist |
| Payment language | No commission drift |
| Role coverage | Yolcu + sürücü where needed |
| Store URL | Resolvable public URL |
| Mobile render | Section scroll + anchor |

---

## 10. Production etkisi

| Standard | P2-L1 | P2-L3 | P2-L5 |
|----------|-------|-------|-------|
| Version schema | Define | Apply | Enforce |
| Section structure | Define | Apply | Render |
| Terminology | Define | Apply | Lint |
| Mevzuat checklist | Define | Draft review | Sign-off |

---

**İlişkili:** `LEGAL_GUIDELINES_V1.md`, `EVOLUTION_CHECKLIST` (legal QA P2-L4)
