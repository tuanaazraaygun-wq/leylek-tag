# Marker Evolution Master Analysis

**Sprint:** B-2 — Marker Evolution System (Full Analysis)  
**Mode:** Read-only — **production untouched**  
**Date:** 2026-06-21  
**Scope:** `design-lab/brand-dna/v4/marker-evolution/`  
**Governance:** `MARKER_DNA.md`, `design-lab/markers/constitution.md`, logo evolution constitution

---

## 0. Mission

LeylekTAG harita marker sistemi **tek DNA** altında birleşecek. Yeni stil icat etmek değil — **premium kuş logosu ile %100 uyumlu** profesyonel marker ailesi. Logo ile aynı stroke, radius, accent, glow restraint dili.

---

## 1. Executive summary

Production'da **üç marker dili**:

| Sistem | Yüzeyler | Sorun |
|--------|---------|-------|
| **A — PNG entity** | LiveMapView, waiting, searching | Logo genom dışı PNG; glow `#22D3EE` drift |
| **B — View/Ionicons field** | DriverOfferScreen, OfferMapScreen, index destination | Yeşil/turuncu/mavi generic — **P0** |
| **C — Website CSS** | real-city-map, intercity | Marketing-only; token drift OK scope |

**P0 bulgular:**

1. Trip map (A) ≠ field dispatch map (B) — aynı yolcu/sürücü farklı görünür  
2. Destination 3 implementasyon (flag / circle / red dropoff)  
3. Cluster marker yok — dense city overlap  
4. QM / Trust / Offline overlay DNA spec var, production yok  
5. Marker PNG assets referenced but repo folder empty — verify before migration  
6. Logo genom `#00D4AA` uygulanmıyor  

**design-lab/markers/exports/** boş — production marker lab hazır değil.

---

## 2. Marker özetleri (12 tip)

| # | Marker | Belge | Production | P0? |
|---|--------|-------|------------|-----|
| 1 | Passenger | `markers/MARKER_01_PASSENGER.md` | PNG 32px + glow | Unify field |
| 2 | Driver Car | `markers/MARKER_02_DRIVER_CAR.md` | PNG + field icon split | **Yes** |
| 3 | Motorcycle | `markers/MARKER_03_MOTORCYCLE.md` | PNG + field icon split | **Yes** |
| 4 | Quick Match | `markers/MARKER_04_QUICK_MATCH.md` | Overlay yok | Spec gap |
| 5 | Trusted Driver | `markers/MARKER_05_TRUSTED_DRIVER.md` | Chip only, ring yok | Spec gap |
| 6 | Trust Network | `markers/MARKER_06_TRUST_NETWORK.md` | Hub UI — not map | N/A |
| 7 | Destination | `markers/MARKER_07_DESTINATION.md` | 3 farklı UI | **Yes** |
| 8 | Pickup | `markers/MARKER_08_PICKUP.md` | PickupPin vs green | Unify |
| 9 | Journey Active | `markers/MARKER_09_JOURNEY_ACTIVE.md` | Polylines + nav | Token unify |
| 10 | Cluster | `markers/MARKER_10_CLUSTER.md` | Not implemented | Urban P1 |
| 11 | Offline Driver | `markers/MARKER_11_OFFLINE_DRIVER.md` | No visual | Future |
| 12 | Searching Animation | `markers/MARKER_12_SEARCHING_ANIMATION.md` | Green/orange Views | **Yes** |

---

## 3. Destekleyici analizler

| Belge | İçerik |
|-------|--------|
| `PRODUCTION_MARKER_INVENTORY.md` | Dosya envanteri, sistem A/B/C |
| `MAP_BEHAVIOR_ANALYSIS.md` | Zoom, overlap, clustering, geo, gece/gündüz |
| `PERFORMANCE_ANALYSIS.md` | Bitmap, memory, tracksViewChanges, GPU |
| `WHITE_THEME_STRATEGY.md` | Light theme token swap — üretim yok |
| `MARKER_QA_PLAN.md` | Full QA matrix |
| `MARKER_DNA_FREEZE_GATE.md` | Freeze kararları + logo dependency |

---

## 4. Risk tablosu

| ID | Risk | Sev | Mitigasyon |
|----|------|-----|------------|
| R-M01 | Trip vs field marker split | P0 | B-5 unify DriverOfferScreen → PNG A |
| R-M02 | Destination 3 UI | P0 | B-5 meridian stem+dot single component |
| R-M03 | Seeking green/orange off-brand | P0 | B-5 passenger PNG + state rings |
| R-M04 | Logo/marker accent drift | P1 | `#00D4AA` shared manifest |
| R-M05 | PNG assets missing in repo | P1 | Pre-migration asset verify |
| R-M06 | No cluster dense Ankara | P1 | B-7 cluster pilot |
| R-M07 | tracksViewChanges perf | P1 | Timed toggle policy |
| R-M08 | QM/trust overlays missing | P2 | B-6 overlay components |
| R-M09 | White map unreadable | P2 | WHITE_THEME_STRATEGY exports |
| R-M10 | Logo P2 blocker | P0 | Marker export after vector master |
| R-M11 | Heat amber hue inconsistency | P2 | Cyan intensity scale |
| R-M12 | Website CSS drift | P3 | Token sync optional |

---

## 5. Production migration sırası (B-8 — plan only)

**Önkoşul:** Logo evolution P2 vector master + Marker DNA freeze sign-off.

| Sıra | Aksiyon | Dosyalar |
|------|---------|----------|
| 1 | Glow token `#00D4AA` | `mapMarkerChrome.tsx` |
| 2 | Entity PNG swap | `assets/markers/*.png`, `mapNavMarkers.ts` |
| 3 | Field map unify | `DriverOfferScreen.tsx` seeking → PNG+overlay |
| 4 | Destination unify | `MapDestinationFlagPin` → meridian pin; `index.tsx` styles |
| 5 | Pickup unify | `OfferMapScreen.tsx` → `MapPickupPin` |
| 6 | QM/trust overlays | `mapMarkerChrome.tsx` ring components |
| 7 | Journey stroke tokens | `LiveMapView.tsx` polyline colors |
| 8 | Cluster (optional) | New dependency + DriverOfferScreen |
| 9 | Offline wrapper | `MapEntityMarkerImage` opacity prop |
| 10 | QA regression | `MARKER_QA_PLAN.md` full |

---

## 6. Migration faz planı (design-lab → prod)

```
B-2 Analysis ✅ (this sprint)
    ↓ stakeholder marker DNA freeze
Logo P2 vector master (dependency)
    ↓
B-3 Marker SVG trace + PNG ladder (design-lab/markers/exports/)
    ↓
B-4 Overlay specs (QM, trust, destination, pickup)
    ↓
B-5 Chrome token unify spec + component API
    ↓
B-6 Multimodal sync doc (LSX/LSDS/haptic)
    ↓
B-7 Cluster spike + perf budget
    ↓
B-8 Production asset swap (minimal code)
```

---

## 7. Rollback planı

| Seviye | Trigger | Aksiyon |
|--------|---------|---------|
| L1 design-lab | Export QA fail | Git revert `design-lab/markers/exports/` |
| L2 staging | Visual regression | Restore `_backup-pre-marker-evolution/` PNG |
| L3 production | Driver field map confusion | Revert DriverOfferScreen marker JSX only |
| L4 perf | FPS drop >10% | Disable cluster + reduce animated heat |
| L5 governance | MFRZ amendment | MARKER_DNA v4.1 + re-freeze |

**Kural:** Entity PNG rollback independent from overlay flags.

---

## 8. Logo DNA uyumu özeti

| Logo DNA | Marker uygulama |
|----------|-----------------|
| Meridian Cyan `#00D4AA` | Glow, rings, accent dot |
| Trust White `#F5F7FA` | Stroke edge |
| Depth Slate `#1A2332` | Body fill |
| Orbital arc | State rings (QM lock, trust, QR) — not teardrop pin |
| Horizon line | Destination/pickup stem |
| M0/M1 tier | Seeking light dot, cluster badge |
| Glow max 0.25 idle | MapEntityMarkerImage 0.12 → calibrate |
| Pin teardrop yasak | ✅ no map pin master |

**Dependency:** Logo `VECTOR_MASTER_SPEC.md` stroke 2.5px @512 → marker 2px @48.

---

## 9. Multimodal hizalama

| Katman | Belge | Marker bağlantı |
|--------|-------|-----------------|
| LSX | `LSX_MOTION_LANGUAGE.md` | waiting.breathe, relay.ingress, lock.ringClose |
| Haptic | `LSX_HAPTIC_LANGUAGE.md` | match, lock, trust — marker visual sync |
| Sonic | `design-lab/sonic/v2/SONIC_TOKENS_V2.md` | offer, QM, match — not marker sound |
| LHIS | LeylekEye | Accent hue align only |
| LIGHT | `LIGHT_DNA.md` | glow.marker.idle token |

---

## 10. Production untouched confirmation

| Alan | B-2 durumu |
|------|------------|
| `frontend/` | ❌ değiştirilmedi |
| `backend/` | ❌ değiştirilmedi |
| `website/` | ❌ değiştirilmedi |
| `android/` / `ios/` | ❌ değiştirilmedi |
| SVG/PNG üretimi | ❌ yapılmadı |
| commit / push | ❌ yapılmadı |

**Oluşturulan:** yalnızca `design-lab/brand-dna/v4/marker-evolution/**`

---

## 11. Recommended Patch B2-1 (ilk patch)

**Production'a dosya taşınmaz.** Küçük design-lab bootstrap:

### Patch B2-1 içeriği

1. **`design-lab/markers/GENOM_TOKEN_BRIDGE.md`** — Logo ↔ marker shared token JSON schema (logo `GENOM_TOKENS_SPEC` crosswalk)
2. **`design-lab/markers/exports/README.md`** — export ladder naming: `{type}-{theme}-{size}.png`
3. **`design-lab/brand-dna/v4/marker-evolution/MARKER_SURFACE_MATRIX.md`** — component → marker type → target asset path tablosu
4. **`design-lab/markers/drafts/.gitkeep`** — confirm pipeline folder
5. Stakeholder review: `MARKER_DNA_FREEZE_GATE.md` MFRZ-* (logo P2 dependency ack)

### B2-1 yapılmayacaklar

- `frontend/assets/markers/` swap  
- DriverOfferScreen style changes  
- PNG/SVG generation  
- Cluster library install  

---

## 12. Patch öncelik sırası (B-2 sonrası)

| Öncelik | Patch | Açıklama | Prod? |
|---------|-------|----------|-------|
| **1** | **B2-1** | design-lab bootstrap + surface matrix | ❌ |
| 2 | Logo P2 | Vector master (blocker) | ❌ |
| 3 | B-3 | Marker SVG trace + PNG ladder design-lab | ❌ |
| 4 | B-4 | Overlay + destination/pickup unified spec SVG | ❌ |
| 5 | B-5 | `mapMarkerChrome` API + token doc | ❌ |
| 6 | B-6 | LSX multimodal marker event map | ❌ |
| 7 | B-7 | Cluster spike + perf test | ❌ |
| 8 | **B-8** | Production PNG swap + field unify | ✅ |
| 9 | B-9 | White theme PNG pair + QA | ✅ |

**İlk production dokunuş:** B-8 — önce **glow token + entity PNG + DriverOfferScreen seeking unify** (en yüksek P0 ROI).

---

## 13. Belge indeksi

```
marker-evolution/
├── MARKER_EVOLUTION_MASTER_ANALYSIS.md  (bu belge)
├── PRODUCTION_MARKER_INVENTORY.md
├── MAP_BEHAVIOR_ANALYSIS.md
├── PERFORMANCE_ANALYSIS.md
├── WHITE_THEME_STRATEGY.md
├── MARKER_QA_PLAN.md
├── MARKER_DNA_FREEZE_GATE.md
└── markers/
    ├── MARKER_01_PASSENGER.md
    ├── MARKER_02_DRIVER_CAR.md
    ├── MARKER_03_MOTORCYCLE.md
    ├── MARKER_04_QUICK_MATCH.md
    ├── MARKER_05_TRUSTED_DRIVER.md
    ├── MARKER_06_TRUST_NETWORK.md
    ├── MARKER_07_DESTINATION.md
    ├── MARKER_08_PICKUP.md
    ├── MARKER_09_JOURNEY_ACTIVE.md
    ├── MARKER_10_CLUSTER.md
    ├── MARKER_11_OFFLINE_DRIVER.md
    └── MARKER_12_SEARCHING_ANIMATION.md
```

**Upstream:** `design-lab/brand-dna/v4/MARKER_DNA.md`, `design-lab/markers/`, logo evolution `full-analysis/`

---

**B-2 Status:** Analysis complete — awaiting Marker DNA freeze + Logo P2 vector master → B2-1 bootstrap.
