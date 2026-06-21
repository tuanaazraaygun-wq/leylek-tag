# P1-1 — Logo Evolution Full Analysis (Master)

**Phase:** P1-1 — Logo Evolution Full Analysis  
**Mode:** Read-only analysis — **production untouched**  
**Date:** 2026-06-21  
**Scope:** `design-lab/brand-dna/v4/logo-evolution/full-analysis/`  
**Governance:** `LOGO_EVOLUTION_CONSTITUTION.md`

---

## 0. Mission statement

LeylekTAG mevcut **premium kuş** logosunu koruyarak profesyonel logo evolution seviyesine taşımak. Bu program **yeni logo tasarımı değildir**. F1 Meridian Wing production'a geçirilmez. Canonical master: `frontend/assets/images/leylek-logo-premium.png`.

---

## 1. Executive summary

Production'da **üç logo ailesi** paralel yaşar:

| Aile | Form | Birincil dosya | Ana yüzeyler |
|------|------|----------------|--------------|
| **A — Premium kuş** | 3D metal leylek + orbital arc | `leylek-logo-premium.png` | Splash JS, login, iOS icon, Zeka, watermark |
| **B — Pin / wireframe** | Arc + dot / gradient pin | `leylektag-icon.png`, `logo-leylek.svg` | Favicon, navbar, Android adaptive, native splash |
| **C — Wordmark** | Yatay banner | `feature-graphic.png` | Hero, OG |

**P0 bulgular:** iOS (A) ≠ Android (B); JS splash (A) ≠ native Android splash (B); app icon ≠ favicon; tek vector master yok; backend `leylek-logo.png` eksik.

**Evrim stratejisi:** Aile A canonical; B/C → A tier türevleri (M0→L). P1 analiz tamamlandı; production değişmedi.

---

## 2. Area özetleri

| # | Area | Belge | Özet |
|---|------|-------|------|
| 1 | Geometry Evolution | `GEOMETRY_EVOLUTION_ANALYSIS.md` | Premium kuş silueti korunur; pin/wireframe trace ile birleştirilir; IoU ≥85% gate |
| 2 | Vector Master | `VECTOR_MASTER_SPEC.md` | 512 viewBox, layer naming, gradient yasağı, versioning — P2 üretim |
| 3 | Small Size System | `SMALL_SIZE_SYSTEM_SPEC.md` | M0@16 → L@1024 tier ladder; favicon/notification/marker hizası |
| 4 | App Icon System | `APP_ICON_SYSTEM_SPEC.md` | Tek master tier S; iOS+Android+favicon unify |
| 5 | Android Adaptive | `ANDROID_ADAPTIVE_ANALYSIS.md` | mipmap + splash stale; prebuild risk |
| 6 | iOS AppIcon | `IOS_APPICON_ANALYSIS.md` | Doğru aile (A); squircle + 1024 QA |
| 7 | Website Logo | `WEBSITE_LOGO_ANALYSIS.md` | Navbar/favicon B; hero/OG C; mapping SSOT `branding-assets.ts` |
| 8 | Splash Logo | `SPLASH_LOGO_ANALYSIS.md` | Çift kimlik native vs JS; timing dokunulmaz |
| 9 | Leylek Zeka | `LEYLEK_ZEKA_LOGO_ANALYSIS.md` | PNG + LeylekEye dual mark; iris token hizası |
| 10 | Watermark | `WATERMARK_SYSTEM_ANALYSIS.md` | Muhabbet %6 opacity; monochrome export opsiyonel |
| 11 | QA | `LOGO_QA_PLAN.md` | 16–1024, platform, blind, regression matrix |
| 12 | DNA Freeze | `DNA_FREEZE_GATE.md` | FRZ-* kararlar; F1/F2/F3 red; P2 gate |

---

## 3. Önerilen sıra (P1→P8)

```
P1-1 Analysis ✅ (bu paket)
    ↓ stakeholder DNA Freeze sign-off
P2 Geometry + vector-master (design-lab)
    ↓
P3 Premium polish (renk, emboss, violet retire spec)
    ↓
P4 Micro icon tier M0/M1 + PNG ladder
    ↓
P5 App icon tier S + splash export
    ↓
P6 Motion spec (LSX/LSDS sync) — logic minimal
    ↓
P7 Full QA (LOGO_QA_PLAN.md)
    ↓
P8 Production migration (asset swap only)
```

**Paralel izin yok:** P8, P7 zero-P0 olmadan başlamaz.

---

## 4. Risk tablosu

| ID | Risk | Severity | Faz | Mitigasyon |
|----|------|----------|-----|------------|
| R-01 | iOS ≠ Android icon ailesi | P0 | P5/P8 | Tier S unify |
| R-02 | Native Android splash ≠ JS splash | P0 | P8 | splashscreen_logo swap |
| R-03 | Favicon ≠ app icon | P0 | P4/P8 | M0/M1 aynı aileden |
| R-04 | Vector master yok | P0 | P2 | vector-master trace |
| R-05 | Backend legal broken image | P0 | P8 | static asset deploy |
| R-06 | Rebrand algısı | P1 | P3–P8 | IoU + blind test |
| R-07 | Squircle clip bacak/gaga | P1 | P5 | Safe zone spec |
| R-08 | prebuild res stale | P1 | P8 | prebuild + hash QA |
| R-09 | F1 scope creep | P1 | P2 | `ban.f1Ship` |
| R-10 | Violet hero constitution | P1 | P8 | CSS retire |
| R-11 | Renk genom drift | P2 | P3 | `#00D4AA` unify |
| R-12 | LeylekEye iris drift | P2 | P8-2 | Token swap |
| R-13 | 16px premium blob | P1 | P4 | M0 tier |
| R-14 | Orphan assets confusion | P3 | P8 | Retire list |
| R-15 | Wordmark unutulması | P2 | P8 | feature-graphic refine |

---

## 5. Patch planı (planlama only — uygulama yok)

### Patch tier tanımı

| Patch | Kapsam | Production |
|-------|--------|------------|
| **Patch 0** (önerilen ilk) | design-lab hazırlık | ❌ |
| Patch 1 | vector-master klasör + manifest şablonu | ❌ |
| Patch 2 | Website path matrix + orphan raporu | ❌ |
| Patch 3 | P2 geometry trace başlangıç | ❌ |
| … | P4–P7 design-lab exports | ❌ |
| **Patch N** | P8 asset swap | ✅ |

### Önerilen ilk patch (Patch 0)

**Büyük logo değiştirme değil.** Üç parçalı design-lab hazırlık:

1. **`vector-master/` klasörü** — `VECTOR_MASTER_SPEC.md` + boş `manifest.json` şablonu
2. **`ORPHAN_LOGO_REFERENCES.md`** — kırık/orphan/stale referans raporu (aşağıda özet)
3. **`WEBSITE_LOGO_PATH_MATRIX.md`** — `branding-assets.ts` → production dosya eşlemesi + hedef tier mapping

**Gerekçe:** P0 blocker'ların çoğu envanter/mapping; production riski sıfır; P2'ye doğrudan giriş.

### Orphan / stale referans özeti (Patch 0 içeriği)

| Asset / kod | Durum | Önerilen aksiyon (P8) |
|-------------|-------|------------------------|
| `website/public/logo-leylek.svg` | Orphan | Retire |
| `frontend/components/Logo.tsx` | Dead import | Remove veya wire |
| `frontend/assets/images/login-brand.png` | Unused | Remove |
| `frontend/assets/images/icon.png` | Orphan | Remove |
| `frontend/assets/images/adaptive-icon.png` | Orphan | Remove |
| `website/public/app-icon.png` | Legacy fallback only | Replace chain |
| `website/public/branding/leylektag-icon.png` | Duplicate | Consolidate |
| `backend/templates/*.html` → `leylek-logo.png` | **Missing file** | Create + deploy P8 |
| premium PNG ×2 (frontend + website) | Duplicate | SSOT hash sync |

---

## 6. Production migration planı (P8)

### Faz P8-0 — Hazırlık

- [ ] `_backup-pre-evolution/` tüm değişecek PNG'ler
- [ ] manifest.json version + checksums
- [ ] P7 QA report signed

### Faz P8-1 — P0 assets (mobil + web icon)

| Sıra | Dosya | Tier |
|------|-------|------|
| 1 | `frontend/assets/ios.premium.logo.png` | S/L |
| 2 | `frontend/assets/images/adaptive-icon-foreground.png` | S |
| 3 | `frontend/assets/images/leylek-logo-premium.png` | L |
| 4 | `website/public/store/leylektag-icon.png` | M0/M1 |
| 5 | `frontend/assets/images/favicon.png` | M0 |
| 6 | `expo-notifications` icon | M0 mono |

### Faz P8-2 — Android native

| Sıra | Dosya |
|------|-------|
| 7 | `npx expo prebuild --clean` |
| 8 | Verify `mipmap-*/ic_launcher_foreground.png` |
| 9 | `drawable-*dpi/splashscreen_logo.png` ×5 |
| 10 | `values/colors.xml` token |

### Faz P8-3 — Website marketing

| Sıra | Dosya |
|------|-------|
| 11 | `website/public/store/feature-graphic.png` refine |
| 12 | `website/public/store/leylek-logo-premium.png` sync |
| 13 | Hero violet CSS retire |
| 14 | `layout.tsx` themeColor (opsiyonel) |

### Faz P8-4 — Cleanup + backend

| Sıra | Aksiyon |
|------|---------|
| 15 | Orphan retire |
| 16 | `backend/static/images/leylek-logo.png` |
| 17 | LeylekEye iris token |
| 18 | Post-audit `PRODUCTION_LOGO_AUDIT.md` re-run |

---

## 7. Rollback planı (master)

| Seviye | Trigger | Aksiyon |
|--------|---------|---------|
| L1 design-lab | P2–P7 iterate fail | Git revert design-lab only |
| L2 staging | P8 smoke fail | Restore `_backup-pre-evolution/` |
| L3 production | User reports / QA regression | EAS rebuild önceki versionCode/buildNumber |
| L4 store | App Store icon rejection | Önceki 1024 + metadata revert |
| L5 governance | Anchor geometry değişikliği | Constitution v2; full re-QA |

**Kural:** P8 staged rollout — TestFlight → % internal → full.

---

## 8. Website logo path matrix (özet)

| `BRANDING_PATHS` key | Mevcut path | Aile | Hedef tier (P8) |
|----------------------|-------------|------|-----------------|
| `logoMark` | `/store/leylektag-icon.png` | B | M1/S |
| `logoHorizontal` | `/store/feature-graphic.png` | C | C refine |
| `favicon` | `/store/leylektag-icon.png` | B | M0 |
| `icon192/512` | `/store/leylektag-icon.png` | B | S/L |
| `appleTouch` | `/store/leylektag-icon.png` | B | S |
| `ogImage` | `/store/feature-graphic.png` | C | C refine |
| `LEGACY_FALLBACK_ICON` | `/app-icon.png` | legacy | M1 veya retire |

---

## 9. Multimodal hizalama notları

| Katman | Belge | Logo evolution bağlantısı |
|--------|-------|---------------------------|
| Motion | `design-lab/lsx/LSX_MOTION_LANGUAGE.md` | Splash breathe, lock ring |
| Sonic | `design-lab/sonic/SONIC_DNA.md` | Boot peak @ arc |
| Marker | `design-lab/markers/constitution.md` | Stroke/radius/cyan paylaşımı |
| AI | `design-lab/brand-dna/v4/AI_DNA.md` | LeylekEye companion |

---

## 10. Production untouched confirmation

| Alan | P1-1 durumu |
|------|-------------|
| `frontend/` assets | ❌ değiştirilmedi |
| `frontend/app.json` | ❌ değiştirilmedi |
| `frontend/android/res/` | ❌ değiştirilmedi |
| `website/` | ❌ değiştirilmedi |
| `backend/` | ❌ değiştirilmedi |
| SVG/PNG üretimi | ❌ yapılmadı |
| Git commit / push | ❌ yapılmadı |

**Yalnızca oluşturulan:** `design-lab/brand-dna/v4/logo-evolution/full-analysis/*.md`

---

## 11. Recommended next patch

### Patch 0 — design-lab bootstrap (önerilen)

**Yapılacaklar (bir sonraki PR/patch):**

1. Oluştur: `design-lab/brand-dna/v4/logo-evolution/vector-master/README.md`
2. Oluştur: `design-lab/brand-dna/v4/logo-evolution/vector-master/manifest.json` (şablon)
3. Oluştur: `design-lab/brand-dna/v4/logo-evolution/full-analysis/ORPHAN_LOGO_REFERENCES.md` (bu master §5 tablosu genişletilmiş)
4. Oluştur: `design-lab/brand-dna/v4/logo-evolution/full-analysis/WEBSITE_LOGO_PATH_MATRIX.md` (§8 genişletilmiş)
5. Stakeholder: `DNA_FREEZE_GATE.md` FRZ-* sign-off toplantısı

**Yapılmayacaklar:**

- Production PNG/SVG swap
- `app.json` değişikliği
- F1 asset kopyalama
- `SplashScreen.tsx` timing değişikliği

---

## 12. Belge indeksi

| Dosya | Area |
|-------|------|
| `GEOMETRY_EVOLUTION_ANALYSIS.md` | 1 |
| `VECTOR_MASTER_SPEC.md` | 2 |
| `SMALL_SIZE_SYSTEM_SPEC.md` | 3 |
| `APP_ICON_SYSTEM_SPEC.md` | 4 |
| `ANDROID_ADAPTIVE_ANALYSIS.md` | 5 |
| `IOS_APPICON_ANALYSIS.md` | 6 |
| `WEBSITE_LOGO_ANALYSIS.md` | 7 |
| `SPLASH_LOGO_ANALYSIS.md` | 8 |
| `LEYLEK_ZEKA_LOGO_ANALYSIS.md` | 9 |
| `WATERMARK_SYSTEM_ANALYSIS.md` | 10 |
| `LOGO_QA_PLAN.md` | 11 |
| `DNA_FREEZE_GATE.md` | 12 |
| `P1_1_LOGO_EVOLUTION_FULL_ANALYSIS.md` | Master (bu belge) |

**Upstream:** `design-lab/brand-dna/v4/logo-evolution/PRODUCTION_LOGO_AUDIT.md`, `LOGO_SURFACE_MAP.md`, `EVOLUTION_ROADMAP.md`

---

**P1-1 Status:** Analysis complete — awaiting DNA Freeze stakeholder sign-off → P2.
