# LeylekTAG Logo Evolution Principles

**Phase:** P1 — Logo Evolution Analysis  
**Version:** Evolution Principles v1.0  
**Parent:** `LOGO_EVOLUTION_CONSTITUTION.md`  
**Date:** 2026-06-21

---

## 0. Purpose

Bu belge Logo Evolution programının **operasyonel prensiplerini** tanımlar. Her prensip QA checklist'e ve roadmap gate'lerine bağlanır. İhlal = design review red.

---

## 1. Tanınırlık prensipleri

### P-REC-01 — DNA korunacak

Evrim, mevcut premium kuş + orbital arc siluetinin **rafine edilmiş** halidir. Metafor (leylek, göç, yol, güven) değişmez.

**Test:** Side-by-side eski/yeni — kullanıcı aynı kuşu tanır.

### P-REC-02 — Siluet korunacak

Profil leylek + alt arc birleşimi anchor geometry'dir. Path deformasyonu, ayna alma veya farklı kuş türü yasaktır.

**Test:** Siluet overlay — IoU ≥85% (design-lab QA).

### P-REC-03 — İlk bakışta tanınacak

≤200 ms içinde "LeylekTAG" algısı oluşmalı. Wordmark olmadan bile L/M tier'da kuş okunmalı.

**Test:** 200 ms flash test ≥85% recall.

---

## 2. Okunabilirlik prensipleri

### P-READ-01 — Küçük boyutta okunacak

16 px'de accent dot + arc hint (M0 tier). 29 px'de tier S tam symbol. Raster küçültme ile favicon üretilmez.

**Test:** `qa.favicon16`, `qa.icon29` — `EVOLUTION_CHECKLIST.md`

### P-READ-02 — Glow bağımlılığı yok

Logo okunurluğu glow/filter olmadan sağlanır. Idle statik mark glow off (max 0.25 boot anında).

**Test:** Glow filter kapalı PNG export — hâlâ tanınır.

### P-READ-03 — Retina ve vector-first

Master vector (design-lab P2+) → PNG export ladder. Tek raster master yasak.

---

## 3. Platform prensipleri

### P-PLAT-01 — Tek logo ailesi

iOS icon, Android adaptive, favicon, splash, navbar **aynı tier ailesinden**. Üç paralel aile (kuş/pin/wireframe) P8 sonunda kalmaz.

### P-PLAT-02 — Adaptive icon uyumu

Android foreground safe zone %80; wing apex squircle clip testi zorunlu. Bacak/gaga S-tier'da sadeleştirilir — clip değil.

### P-PLAT-03 — Digital-first tier ladder

En küçük format (16 px) önce tasarlanır; büyük tier detay ekler. Büyükten küçüğe shrink yasak.

| Tier | Boyut | İçerik |
|------|-------|--------|
| M0 | 16 px | Dot + arc |
| M1 | 24 px | + horizon |
| S | 32–48 px | Sadeleşmiş kuş |
| M | 64–128 px | Profil + gaga |
| L | ≥128 px | Full premium |

---

## 4. Multimodal dil prensipleri

### P-MM-01 — Marker ile aynı dili konuşacak

Logo stroke kalınlığı, corner radius, Meridian Cyan accent marker genomu ile paylaşılır. Logo **harita pini değildir**; marker role siluet ayrı kalır.

**Ref:** `MARKER_DNA.md`, `LOGO_MARKER_SHARED_GENOM.md`

### P-MM-02 — LHIS ile aynı dili konuşacak

LoginBrandHeader, splash tagline ve logo cluster aynı premium navy zemin + restraint glow. Logo raster değişince LHIS token'ları sync.

### P-MM-03 — LSX Motion ile aynı dili konuşacak

| Olay | Token | Logo |
|------|-------|------|
| Boot | `presence.pulse` | scale 0.96→1.03→1.0, ≤550 ms |
| QR lock | `lock.ringClose` | ring stroke 100%→0, 320 ms |
| Match | `pulse.journey` | breathe 480 ms |

**Yasak:** bounce, spin, particle.

**Ref:** `LSX_MOTION_LANGUAGE.md`, `LSX_JOURNEY_MAP.md`

### P-MM-04 — Sonic ile aynı dili konuşacak

Boot görsel peak @ 160 ms = LSDS v2 `presence.boot` faz 2 öncesi. Lock peak = A4 magnetic.

**Ref:** `SONIC_DNA.md`, `SONIC_GENOME_V2.md`

### P-MM-05 — Haptic ile sync

Lock anında `lsx.haptic.lock.confirm` — görsel ring close ile ±20 ms.

**Ref:** `LSX_HAPTIC_LANGUAGE.md`, `HAPTIC_DNA.md`

### P-MM-06 — LeylekEye companion hizası

Eye iris cyan → `#00D4AA`. Eye logo yerine geçmez; accent DNA paylaşır.

---

## 5. Premium ve güven prensipleri

### P-TRUST-01 — Trust hissini artıracak

Restraint > bağırmak. Violet hero, neon gradient, pin genericliği azaltılır. Koyu zemin + sakin form korunur.

### P-TRUST-02 — Premium hissi güçlenecek

3D metal shader → controlled flat + light emboss. Kalite sinyali **netlik ve tutarlılık** ile taşınır.

### P-TRUST-03 — Operasyon ciddiyeti

Logo taksi, oyun, cyberpunk diline kaymaz. Horizon/arc operasyon metaforunu taşır.

---

## 6. Renk prensipleri

### P-COL-01 — Meridian genom

Accent tek nokta: `#00D4AA`. Form: Trust White `#F5F7FA`. Zemin: Void `#0D1117`.

### P-COL-02 — Gradient yasağı

Logo içi `#67E8F9→#2563EB` gradient yeni yüzeylerde kullanılmaz.

### P-COL-03 — Violet / AI moru yasağı

Website hero, modal, orb — violet ambient yasak.

---

## 7. Wordmark prensipleri

### P-WM-01 — Hiyerarşi sabit

"Leylek" sakin + "TAG" vurgulu — font devrimi yok.

### P-WM-02 — Lockup zorunluluğu

M0/M1 arc-only tier navbar/hero'da wordmark ile birlikte.

### P-WM-03 — feature-graphic evrimi

Yatay lockup korunur; kompozit refine edilir — hikâye anlatımı kaybolmaz.

---

## 8. Yasaklar (özet)

| ID | Yasak |
|----|-------|
| `ban.newBrand` | Tanınamayan yeni sembol |
| `ban.f1Ship` | F1 Meridian Wing production |
| `ban.mapPinMaster` | Pin master mark |
| `ban.rebrandLaunch` | Big bang kimlik değişimi |
| `ban.glowDependency` | Glow olmadan okunamaz logo |
| `ban.platformSplit` | iOS ≠ Android farklı aile |
| `ban.rasterOnly` | Vector master olmadan ship |

---

## 9. Prensip → faz eşlemesi

| Prensip grubu | Roadmap fazı |
|---------------|--------------|
| DNA / Never Change | P1 DNA Freeze |
| Geometry / stroke / radius | P2 Geometry Evolution |
| Restraint / emboss / glow | P3 Premium Polish |
| M0–M1 tier | P4 Micro Icon |
| App icon / adaptive | P5 App Icon |
| LSX / sonic / motion | P6 Motion Integration |
| QA gates | P7 QA |
| Production swap | P8 Production Migration |

---

## 10. Governance

| Rol | Sorumluluk |
|-----|------------|
| Chief Brand Architect | DNA freeze, Never Change onayı |
| Chief Identity Designer | Geometry + tier QA |
| Chief Motion Director | P6 token sync |
| Engineering | P8 migration only |

Amendment: prensip değişikliği → constitution v2.

---

**İlişkili belgeler:** `LOGO_EVOLUTION_CONSTITUTION.md`, `EVOLUTION_ROADMAP.md`, `EVOLUTION_CHECKLIST.md`
