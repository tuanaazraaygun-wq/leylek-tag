# LeylekTAG Logo Constitution V1

**Version:** Logo Constitution v1.0  
**Status:** Immutable rules for logo layer — analysis only  
**Scope:** `design-lab/brand-dna/v4/logo-master/`  
**Parent:** `BRAND_CONSTITUTION_V4.md`, `NORTH_STAR.md`  
**Governance:** Chief Brand Architect + Chief Visual Identity Designer sign-off for any amendment  
**Amendment rule:** Geometry or color genom change → v2 constitution + v5 brand gate

---

## 0. Purpose

Bu belge LeylekTAG logosunun **değişmeyecek kurallarını** tanımlar. Sketch, SVG, motion, production migration — tüm üretim bu constitution'a tabidir. İhlal = design review red.

---

## 1. North Star Bağlantısı

Logo, North Star'ı görsel olarak taşır:

> *Yolculuğun her anında sessizce nefes alan ve güvenle kapanan bir operasyon sistemi.*

| North Star kelimesi | Logo kuralı |
|---------------------|-------------|
| sessizce | Idle'da glow off; statik mark |
| nefes alan | `presence.pulse` ±2% scale only |
| güvenle kapanan | `lock.ringClose` ring element zorunlu |
| operasyon sistemi | Meridian horizon çizgisi zorunlu |
| yolculuğun her anı | Aynı symbol boot'tan payment'a |

---

## 2. Master Form (değişmez)

### 2.1 Zorunlu geometrik öğeler

| Öğe | Kural | ID |
|-----|-------|-----|
| **Meridian horizon** | Yatay çizgi veya implicit zemin — A3 sonic metaforu | `geo.horizon` |
| **Leylek kanat arc** | Tek sürekli stroke veya dolu siluet — tam kuş illustrasyon yok | `geo.wingArc` |
| **Lock ring** (symbol içinde veya overlay) | QR/payment animasyonu için — stroke tabanlı | `geo.lockRing` |
| **Negatif alan** | ≥30% canvas boşluk | `geo.breathSpace` |

### 2.2 Yasak formlar (master mark)

| Yasak | ID |
|-------|-----|
| Harita damla pini | `ban.mapPin` |
| Tam kuş illustrasyon (gaga, bacak, göz detayı) | `ban.fullBird` |
| Cartoon / mascot yüz | `ban.mascot` |
| Taksi, korna, checker | `ban.taxi` |
| Rakip siluet kopyası | `ban.competitorClone` |

### 2.3 Anchor geometry kuralı

Tüm varyantlar **aynı anchor geometry** kullanır. İzin verilen transform: **uniform scale, rotation ≤4°**. Yasak: path deformasyon, stroke kalınlık değişimi varyantlar arasında, ayrı “marketing logo” formu.

---

## 3. Renk Genom (değişmez)

| Token | Hex | Logo kullanımı |
|-------|-----|----------------|
| Meridian Cyan | `#00D4AA` | Accent nokta, lock ring peak — **gradient yok** |
| Trust White | `#F5F7FA` | Symbol primary on dark |
| Depth Slate | `#1A2332` | Symbol on light; app icon ground alt |
| Void Black | `#0D1117` | App icon primary ground |
| Warm Resolve | `#C8E6D0` @ ≤40% | Match overlay only — logo idle yok |

### 3.1 Renk yasakları

- Çoklu cyan-mavi gradient (`#67E8F9` → `#2563EB` ailesi) — **yasak**
- AI moru, violet hero glow — **yasak**
- Neon tam opacity cyan — **yasak**
- Sarı taksi, kırmızı acil — **yasak**
- Rainbow, seasonal campaign override — **yasak**

---

## 4. Malzeme ve Işık

| Malzeme | Digital | Fiziksel |
|---------|---------|----------|
| Flat | Birincil | — |
| Mat | UI default | Sticker, tişört |
| Emboss / deboss | — | Kartvizit, tabela |
| Metal accent | — | Tek cyan veya monochrome |
| Glass / frost | AI orb, modal edge only | — |
| Glow | Boot max 0.25; lock peak 0.50 | **Yok** |

**Kural:** Logo okunurluğu glow olmadan sağlanmalı (`ban.glowDependency`).

---

## 5. Boyut ve Okunurluk

| Test | Kriter | ID |
|------|--------|-----|
| 16 px favicon | Siluet veya cyan dot tanınır | `qa.favicon16` |
| 29 px iOS settings | Tam symbol | `qa.icon29` |
| 48 px | Horizon görünür | `qa.icon48` |
| 512 px master | Tüm detay | `qa.master512` |
| 15 mm print | Monochrome geçer | `qa.print15mm` |
| 10 m billboard | Siluet only | `qa.billboard` |

Boyut testi geçmeyen form **ship edilmez**.

---

## 6. Motion Constitution

| Kural | Değer |
|-------|-------|
| Boot total | ≤550 ms |
| Lock ring | 320 ms — marker ile aynı token |
| Idle breathe | ±2% scale; glow off |
| Max overshoot | 1.06 — yalnızca lock |
| Yasak motion | bounce, spin, particle, elastic default |

Detay: `LOGO_MOTION.md`

---

## 7. Sonic Constitution

| Kural | Değer |
|-------|-------|
| Anchor | A3 = 220 Hz |
| Boot sound lead | Logo motion'dan **önce başlamaz** — +40 ms offset |
| 200 ms commit | Görsel + ses aynı olay |
| Lock peak | A4 @ ring close frame |

Detay: `LOGO_SONIC_LINK.md`

---

## 8. Marker ve AI Bağlantısı

| Kural | Açıklama |
|-------|----------|
| Shared genom | Stroke, radius, cyan accent, lock ring animasyonu |
| Logo ≠ marker kopyası | Logo arc; marker role siluet |
| AI orb core | Logo symbol — robot yüz yok |
| Destination | Meridian dot — logo pin değil |

Detay: `LOGO_MARKER_LINK.md`

---

## 9. Wordmark (LeylekTAG)

| Kural | Değer |
|-------|-------|
| Tipografi | Geometric sans — neutral premium |
| Leylek / TAG | Aynı ağırlık; TAG renk patlaması yok |
| Min width | 80 px okunur |
| Symbol ilişkisi | Symbol solda veya üstte; aynı baseline grid |

Wordmark formu evrilebilir (custom type Phase 3); **symbol geometry değişmez**.

---

## 10. Platform Unity

iOS, Android, Watch, Web, Widget, Notification, CarPlay, Android Auto — **aynı symbol geometry, aynı hex, aynı motion timing**. Platform sadece density ve primary channel değiştirir (`CROSS_PLATFORM_DNA.md`).

---

## 11. Red Team (ship öncesi zorunlu)

- [ ] Uber / Google pin yan yana — fark ≥ blind 80%
- [ ] Taksi sarısı sıfır
- [ ] iOS tri-tone benzerliği sıfır
- [ ] Tron / cyberpunk / AI mor sıfır
- [ ] Monochrome print pass
- [ ] `prefers-reduced-motion` static fallback
- [ ] İkili logo konsepti sıfır — tek master

---

## 12. Governance

| Rol | Yetki |
|-----|-------|
| Chief Brand Architect | Constitution amend |
| Chief Identity Designer | Geometry QA |
| Chief Motion Director | Motion timing amend (minor) |
| Chief Sonic Architect | Sonic sync amend (minor) |
| CPO | Ship gate |

**Minor amend (v1.x):** Timing ±20 ms, wordmark kerning.  
**Major amend (v2):** Master form, renk genom, yeni zorunlu öğe → stakeholder + v5 gate.

---

## 13. İlişkili Belgeler

| Belge | Rol |
|-------|-----|
| `LOGO_MASTER_ANALYSIS.md` | Gerekçe ve mevcut durum |
| `LOGO_GEOMETRY.md` | Sayısal spec |
| `LOGO_COLOR_SYSTEM.md` | Renk matrisi |
| `LOGO_VARIANTS.md` | Varyant ailesi |
| `LOGO_MIGRATION_PLAN.md` | Production geçiş |
| `ROADMAP.md` | Faz planı |

---

**Non-goals:** Asset üretimi, kod, production değişikliği yok.
