# Area 12 — DNA Freeze Gate

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Governance specification  
**Date:** 2026-06-21  
**Parent:** `LOGO_EVOLUTION_CONSTITUTION.md`, `EVOLUTION_ROADMAP.md` P1

---

## Executive summary

DNA Freeze, logo evrim programının **P1 çıkış kapısıdır**. Freeze sonrası anchor geometry, siluet ve Never Change listesi kilitlenir; production migration yalnızca P7 QA + P8 onayı ile. F1/F2/F3 production'a geçmez.

---

## Freeze edilecek kararlar

| ID | Karar | Değer |
|----|-------|-------|
| FRZ-01 | Canonical master raster | `leylek-logo-premium.png` |
| FRZ-02 | Master siluet | Profil leylek + orbital arc |
| FRZ-03 | F1 Meridian Wing production | **RED** |
| FRZ-04 | F2 Horizon Stork production | **RED** |
| FRZ-05 | F3 Orbital Seal production | **RED** |
| FRZ-06 | Pin SVG master | **RETIRE** |
| FRZ-07 | Tier ladder M0→L | Constitution §5 |
| FRZ-08 | Never Change listesi | `CURRENT_DNA_ANALYSIS.md` §2 |
| FRZ-09 | Renk genom hedefi | `#00D4AA`, `#F5F7FA`, `#0D1117` |
| FRZ-10 | Evolution ≠ rebrand mesajı | Stakeholder comms |
| FRZ-11 | Wordmark hiyerarşi | "Leylek" + "TAG" |
| FRZ-12 | LeylekEye companion | Korunur; iris hizası later |

---

## Production'a kadar değişebilecek kararlar

| ID | Karar | Faz limiti |
|----|-------|------------|
| VAR-01 | Stroke px @512 (2 vs 2.5) | P2–P3 |
| VAR-02 | Emboss depth L-tier | P3 |
| VAR-03 | Horizon y konumu ±8px | P2 |
| VAR-04 | M0 arc sweep açısı ±15° | P4 |
| VAR-05 | Splash zemin `#08111F` vs `#0D1117` | P3 |
| VAR-06 | Notification tint exact hex | P8 |
| VAR-07 | Web hero violet retire timing | P8 |
| VAR-08 | Watermark ayrı asset vs premium PNG | P8 opsiyonel |
| VAR-09 | Export script tooling | P2–P5 |
| VAR-10 | Backend static logo format | P8 |

**Kural:** VAR-* değişiklikleri anchor silueti etkilemez.

---

## Kimlik kırılımı nasıl engellenir

| Mekanizma | Açıklama |
|-----------|----------|
| Tek master SVG | Tüm tier'lar aynı anchor |
| Aile birleştirme | B/C → A türevi; paralel aile yasak |
| Platform unify gate | iOS = Android = favicon P7 |
| `ban.f1Ship` | Sketch lab form production'a sızmaz |
| IoU ≥85% | Geometry değişim sınırı |
| Blind ≥85% | Algısal süreklilik |
| Orphan retire | `logo-leylek.svg`, dead components |
| SSOT path | `branding-assets.ts` tek web mapping |
| Prebuild hash | Android res stale önleme |

---

## F1 / F2 / F3 neden production değildir

| Finalist | Neden ship yok |
|----------|----------------|
| **F1 Meridian Wing** | Yeni wing geometry; mevcut kuş siluetinden farklı; kullanıcı rebrand algılar |
| **F2 Horizon Stork** | Alternatif siluet; premium kuş anchor değil |
| **F3 Orbital Seal** | Seal/emblem formu; profil leylek metaforu zayıflar |

**İzinli:** F1'den **süreç** fikirleri — tier ladder, glow restraint, export pipeline. **Form alınmaz.**

Kaynak: `design-lab/brand-dna/v4/logo-sketch-lab/`, `LOGO_EVOLUTION_CONSTITUTION.md` §4.4.

---

## Premium kuş canonical master nasıl olur

```
1. Raster SSOT: frontend/assets/images/leylek-logo-premium.png
2. P2 trace → design-lab/vector-master/leylek-symbol-master-v1.svg
3. IoU ≥85% vs raster
4. Tier exports türetilir (M0→L)
5. P7 QA pass
6. P8 PNG swap — aynı path, yeni export
7. manifest.json version freeze
```

**Kullanıcı algısı:** "Aynı kuş, daha net."

---

## Freeze sonrası migration kuralları

| Kural | Açıklama |
|-------|----------|
| P8-only production | P1–P7 production asset yok |
| Checklist gate | `EVOLUTION_CHECKLIST.md` zero P0 |
| Backup zorunlu | `_backup-pre-evolution/` |
| Staged rollout | TestFlight → internal → production |
| Amendment | MAJOR geometry → Constitution v2 + sign-off |
| No big bang wordmark | feature-graphic refine, not replace |
| Sonic/motion | P6 spec; P8 logic optional |
| Marker program | Logo evolution ayrı; token paylaşımı only |

---

## Freeze gate checklist

| ID | Check | P1-1 status |
|----|-------|-------------|
| G-01 | Full analysis 12 area complete | ✅ |
| G-02 | Production untouched | ✅ |
| G-03 | Stakeholder sign-off FRZ-* | ☐ pending |
| G-04 | F1 ship red onay | ☐ pending |
| G-05 | Never Change imza | ☐ pending |
| G-06 | P2 vector-master klasör planı | ✅ spec ready |

**Exit:** G-03..G-05 imza → P2 başlar.

---

## Sorunlar

| ID | Sorun |
|----|-------|
| DF-01 | Stakeholder sign-off bekliyor |
| DF-02 | Üç aile hâlâ production'da (freeze sonrası P8 çözülür) |

---

## Marka riski

- Freeze atlanırsa → scope creep → F1 veya pin master sızıntısı.
- Freeze sonrası VAR-* ihlali → sessiz anchor drift.

---

## Teknik risk

- Freeze belgeleri ile export uyumsuzluğu → manifest version disiplini.

---

## İleride değişebilecek dosyalar

| Dosya | Ne zaman |
|-------|----------|
| `LOGO_EVOLUTION_CONSTITUTION.md` | v2 — anchor değişirse |
| `DNA_FREEZE_GATE.md` | Freeze tarih + imza ekleme |
| `vector-master/manifest.json` | P2 freeze timestamp |

---

## Kesinlikle dokunulmamalı (post-freeze)

- FRZ-01..FRZ-11 kararları (amendment olmadan)
- F1 production path mapping
- Profil leylek posture / wing yönü

---

## Önerilen üretim stratejisi

1. P1-1 analiz tamamlandı → stakeholder review.
2. FRZ-* imza → `DNA_FREEZE_GATE.md` tarih damgası.
3. P2 Patch 1: `vector-master/` klasör + manifest şablonu.
4. Git tag: `logo-evolution-p1-freeze`.

---

## Rollback planı

- Freeze öncesi: N/A (analiz only).
- Freeze sonrası yanlış karar: Constitution amendment process; P2 durdur.

---

## QA kriterleri

| Test | Pass |
|------|------|
| Tüm FRZ checklist imzalı | ✅ |
| Production diff empty P1 | ✅ |
| F1 path production'da referans yok (mevcut) | ✅ design-lab only |

---

## Production migration sırası

DNA Freeze **migration değildir**. Sıra:

1. DNA Freeze sign-off (bu gate)
2. P2–P7 design-lab
3. P7 QA
4. P8 migration (`EVOLUTION_ROADMAP.md`)

---

**İlişkili:** `P1_1_LOGO_EVOLUTION_FULL_ANALYSIS.md`
