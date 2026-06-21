# LeylekTAG Logo Master — Roadmap

**Version:** Logo Roadmap v1.0  
**Status:** Design-lab plan — no code, no commits  
**Scope:** `design-lab/brand-dna/v4/logo-master/`  
**Parent:** `design-lab/brand-dna/v4/ROADMAP.md`, `LOGO_MIGRATION_PLAN.md`

---

## 1. Roadmap Özeti

```
Phase 0          Phase 1           Phase 2          Phase 3           Phase 4          Phase 5
ANALİZ           DNA ONAYI         SKETCH LAB         SVG ÜRETİMİ       MOTION           PRODUCTION
(bu patch)       stakeholder       3 directions     master SVG        Lottie 550/320    ayrı PR'lar
11 belgeler      constitution      kör test         PNG ladder        sonic sync       frontend/website
                 sign-off          sketch winner    varyant export    marker ring      app icon
```

**Horizon:** Phase 0 tamamlandı → Phase 1 başlar stakeholder onayı ile.  
**Production kod:** Phase 5'e kadar **yok**.

---

## 2. Phase 0 — Analiz ✅

### Deliverables

| Dosya | Durum |
|-------|-------|
| `LOGO_MASTER_ANALYSIS.md` | ✅ |
| `LOGO_CONSTITUTION.md` | ✅ |
| `LOGO_GEOMETRY.md` | ✅ |
| `LOGO_COLOR_SYSTEM.md` | ✅ |
| `LOGO_MOTION.md` | ✅ |
| `LOGO_SONIC_LINK.md` | ✅ |
| `LOGO_MARKER_LINK.md` | ✅ |
| `LOGO_VARIANTS.md` | ✅ |
| `LOGO_MIGRATION_PLAN.md` | ✅ |
| `ROADMAP.md` | ✅ |

### Phase 0 Bulguları (özet)

1. İkili logo kimliği — pin SVG vs kuş PNG
2. Renk genom kopukluğu — gradient vs `#00D4AA`
3. Pin form retire; Meridian geometry adopt
4. 12+ varyant ailesi spec
5. Motion/sonic/marker sync spec hazır

### Dokunulmayan

- `frontend/`, `backend/`, production assets
- Git commit (kullanıcı talebi)

---

## 3. Phase 1 — DNA Onayı (1–2 hafta)

### 3.1 Stakeholder paketi

| # | Belge / aktivite | Çıktı |
|---|------------------|-------|
| 1 | `LOGO_MASTER_ANALYSIS.md` walkthrough | Anlayış |
| 2 | `LOGO_CONSTITUTION.md` sign-off | v1 locked |
| 3 | `NORTH_STAR.md` logo testi 5 soru | Pass |
| 4 | Pin retire kararı | Yazılı onay |
| 5 | `LOGO_COLOR_SYSTEM.md` hex onay | `#00D4AA` locked |
| 6 | `LOGO_SONIC_LINK.md` boot timeline | Sync onay |
| 7 | `COMPETITOR_ANALYSIS.md` red team | Checklist |
| 8 | `LOGO_MIGRATION_PLAN.md` rollout | PR sırası onay |

### 3.2 Tasarım kararları (gate)

| Karar | Seçenekler | Default öneri |
|-------|------------|---------------|
| Leylek form | Kanat arc vs negatif alan kuş | Kanat arc |
| Ring inset | 10% / 12% / 14% | 12% |
| Accent | Dot vs line segment | Dot |
| Wordmark | Inter vs custom geometric | Inter Phase 3; custom Phase 3B opsiyonel |
| Hero website | Motion boot vs static | Motion + reduced-motion fallback |

### 3.3 Çıktı

- `LOGO_GEOMETRY.md` final numeric spec (±0.5 px)
- Phase 2 Sketch Lab brief
- Signed `LOGO_CONSTITUTION.md` v1

---

## 4. Phase 2 — Sketch Lab (2–3 hafta)

### 4.1 Aktiviteler

| Aktivite | Detay |
|----------|-------|
| 3 wing arc explorations | Ascend 2°, 3°, 4° |
| Horizon placement | y=66% vs 62% |
| Ring + accent studies | 9 kombinasyon max |
| Negatif alan kuş (opsiyonel) | 1 sketch — karşılaştırma |
| Wordmark lockup | Horizontal 4:1 |
| Kör test | n≥8, 24 px, yan yana Uber/Google pin |
| Marker parite sketch | Logo + car marker + destination |

### 4.2 Araçlar

- `design-lab/brand-dna/v4/logo-master/sketches/` (Phase 2 oluşturulacak)
- Paper + Figma — **production export yok**

### 4.3 Gate

| Kriter | Hedef |
|--------|-------|
| Blind LeylekTAG | ≥80% |
| Pin confusion | 0 |
| 24 px okunurluk | Panel pass |
| Constitution check | 0 violation |
| 1 selected direction | Sketch winner |

---

## 5. Phase 3 — SVG Üretimi (2–3 hafta)

### 5.1 Assets (`design-lab/brand-dna/v4/exports/`)

| Asset | Spec kaynağı |
|-------|--------------|
| `logo-master.svg` | `LOGO_GEOMETRY.md` final |
| SVG varyant 12 | `LOGO_VARIANTS.md` |
| PNG ladder 16–1024 | Tier M0–F |
| `LOGO_QA_REPORT.md` | QA matrix |
| Favicon multi | M0/M1 |
| Store 1024 icon | Tier F |

### 5.2 QA zorunlu

- 16, 29, 48, 512 px
- iOS squircle mask
- Android adaptive safe zone 80%
- Monochrome print 15 mm proof
- SVG path count ≤12
- Glow filter yok — flat paths

### 5.3 Gate

QA report pass → Phase 4

---

## 6. Phase 4 — Motion (1–2 hafta)

### 6.1 Assets

| Asset | Token | Süre |
|-------|-------|------|
| `logo-boot-presence.lottie` | presence.pulse | 550 ms |
| `logo-lock-ring.lottie` | lock.ringClose | 320 ms |
| `logo-sweep-loading.lottie` | loading.indeterminate | 1500 ms loop |

### 6.2 Sync validation

| Sync | Belge |
|------|-------|
| Sonic boot | `LOGO_SONIC_LINK.md` |
| Marker ring | `LOGO_MARKER_LINK.md` |
| Glow | `LOGO_COLOR_SYSTEM.md` |

### 6.3 Dinleme oturumu

- Boot Lottie + `presence.boot` v2/v3 WAV
- Lock Lottie + `qr.success`
- Panel: motion lead doğru mu?

### 6.4 Gate

Frame sync ±16 ms → Phase 5 plan onay

---

## 7. Phase 5 — Production Migration (ayrı program)

Detay: `LOGO_MIGRATION_PLAN.md`

| Sprint | PR | Yüzey |
|--------|-----|-------|
| S1 | PR-L2 | Website |
| S2 | PR-L3 | Logo component, onboarding |
| S3 | PR-L5 | Boot motion + sonic |
| S4 | PR-L4 | Splash + app icon |
| S5 | PR-L6 | Store graphics |
| Paralel | Marker PR #6 | Harita marker v4 |

**Her PR:** Red team + rollback plan + feature flag.

---

## 8. Bağımlılık Grafi

```
LOGO_MASTER_ANALYSIS
        │
        ├── LOGO_CONSTITUTION (gate)
        ├── LOGO_GEOMETRY ──────► Phase 2 sketch
        ├── LOGO_COLOR_SYSTEM
        ├── LOGO_MOTION ────────► Phase 4 Lottie
        ├── LOGO_SONIC_LINK ────► Phase 4 sync
        ├── LOGO_MARKER_LINK ───► Marker Phase 2 parallel
        ├── LOGO_VARIANTS ──────► Phase 3 export matrix
        └── LOGO_MIGRATION_PLAN ► Phase 5 PRs
```

**Paralel yollar:**

- Sonic v3 `presence.boot` generate — Phase 4 sonic lab
- Marker v4 SVG — Phase 2–3 marker lab (shared ring)

---

## 9. Başarı Metrikleri

| Metrik | Hedef | Phase |
|--------|-------|-------|
| Constitution sign-off | 100% | 1 |
| Sketch blind test | ≥80% | 2 |
| 16 px QA | Pass | 3 |
| 29 px QA | Pass | 3 |
| Boot sync | ±16 ms | 4 |
| Production blind | ≥80% | 5 |
| Uber pin red team | 0 fail | 2–5 |
| Tek logo konsepti | 1 master | 3+ |

---

## 10. Riskler

| Risk | Phase | Azaltma |
|------|-------|---------|
| Stakeholder pin'de ısrar | 1 | Analysis §5 pin analizi |
| Sketch lab scope creep | 2 | 3 direction max |
| SVG over-detail | 3 | Constitution stroke limit |
| Lottie path drift | 4 | SVG source paths |
| Icon user confusion | 5 | Gradual rollout |
| Marker-logo desync | 4–5 | Shared Lottie component |

---

## 11. V4 Master Roadmap İlişkisi

| `design-lab/brand-dna/v4/ROADMAP.md` | Logo Master |
|--------------------------------------|-------------|
| Faz 0 V4 docs | Logo Phase 0 ✅ |
| Faz 1 stakeholder | Logo Phase 1 |
| Faz 2 asset lab | Logo Phase 2–4 |
| Faz 4 PR #5 icon swap | Logo Phase 5 PR-L4 |
| Faz 5 website | Logo Phase 5 PR-L2 |

**Logo Master = V4 logo vertical** — dikey derinlik; V4 ROADMAP yatay platform.

---

## 12. Sonraki Adım

**Phase 1 — Stakeholder sign-off oturumu:**

1. `LOGO_MASTER_ANALYSIS.md` §1–5 sunum (30 dk)
2. Pin retire vote
3. `LOGO_CONSTITUTION.md` v1 onay
4. Phase 2 Sketch Lab tarih kilidi
5. Sonic boot dinleme — `design-lab/sonic/v2/output/wav/brand_signature_v2a.wav`

Kod, asset, commit **Phase 3 başlangıcına kadar yok**.

---

## 13. Document Index

| Dosya | Rol |
|-------|-----|
| `LOGO_MASTER_ANALYSIS.md` | Ana analiz 15 başlık |
| `LOGO_CONSTITUTION.md` | Değişmez kurallar |
| `LOGO_GEOMETRY.md` | Sayısal spec |
| `LOGO_COLOR_SYSTEM.md` | Renk |
| `LOGO_MOTION.md` | Hareket |
| `LOGO_SONIC_LINK.md` | Ses |
| `LOGO_MARKER_LINK.md` | Marker |
| `LOGO_VARIANTS.md` | Varyantlar |
| `LOGO_MIGRATION_PLAN.md` | Production geçiş |
| `ROADMAP.md` | Bu belge |

---

**Non-goals:** Kod, PNG/SVG/Lottie üretimi, `frontend/` / `backend/` dokunma, git commit.

**V4 Logo Production** bu roadmap Phase 3 onayı sonrası başlar.
