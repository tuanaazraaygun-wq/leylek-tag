# LeylekTAG Logo Migration Plan

**Version:** Logo Migration v1.0  
**Status:** Analysis only — no production changes  
**Parent:** `LOGO_MASTER_ANALYSIS.md`, `ROADMAP.md`, `LOGO_VARIANTS.md`

---

## 1. Migration Özeti

**Hedef:** İkili logo kimliğini (pin SVG + kuş PNG) tek V4 master geometry'ye birleştirmek. Production dokunma **Phase 5** — bu belge yalnızca plan.

| Karar | Detay |
|-------|-------|
| Retire | `logo-leylek.svg` pin formu |
| Retire | `leylek-logo-premium.png` 3D kuş |
| Retire | Website hero violet+cyan blur wrapper |
| Adopt | Meridian horizon + wing arc + lock ring |
| Renk | `#00D4AA` Meridian Cyan genom |

---

## 2. Mevcut Asset Envanteri

| Asset | Konum | Kullanım | Migration aksiyonu |
|-------|-------|----------|-------------------|
| `logo-leylek.svg` | `website/public/` | Favicon chain, footer fallback | **Replace** Phase 5 |
| `leylek-logo-premium.png` | `frontend/assets/images/` | `Logo.tsx`, onboarding | **Replace** Phase 5 |
| `ios.premium.logo.png` | `frontend/assets/` | iOS spesifik | **Replace** |
| `splashscreen_logo.png` | Android drawable ×5 dpi | Native splash | **Replace** |
| `icon.png` | `frontend/assets/images/` | Expo icon | **Replace** |
| `adaptive-icon.png` | foreground/background | Android | **Replace** |
| `favicon.png` | `frontend/assets/images/` | Web | **Replace** |
| `feature-graphic.png` | `website/public/store/` | Hero horizontal | **Replace** lockup |
| `leylektag-icon.png` | store fallback | Navbar, footer | **Replace** |
| `Logo.tsx` | `frontend/components/` | PNG require | **Wire** Phase 5 — SVG/component |
| `hero-horizontal-logo.tsx` | website | Neon wrapper | **Simplify** Phase 5 |

**Dokunulmayan (Phase 0–4):** Yukarıdaki dosyalar analiz süresince olduğu gibi kalır.

---

## 3. Migration Fazları

### Phase 0 — Analiz (bu patch) ✅

- Logo master analiz belgeleri
- Stakeholder brief paketi
- Red team checklist

### Phase 1 — DNA Onayı

| Aktivite | Gate |
|----------|------|
| `LOGO_CONSTITUTION.md` sign-off | Geometry direction onay |
| Wing arc vs negatif alan kuş sketch seçimi | 1 master direction |
| Renk genom `#00D4AA` onay | Hex locked |
| Pin retire onayı | Yazılı sign-off |
| Sonic boot + logo sync onay | Timeline onay |

**Çıktı:** `LOGO_GEOMETRY.md` final numbers ±0.5 px

### Phase 2 — Sketch Lab

| Aktivite | Çıktı |
|----------|-------|
| 3 wing arc directions | Sketch board |
| 24 px kör test n≥8 | ≥80% LeylekTAG |
| Uber/Google pin yan yana | Fail pin |
| Ring inset QA | Selected inset |
| Wordmark pairing | 3 lockup sketches |

**Çıktı:** 1 selected sketch → Phase 3

### Phase 3 — SVG Üretimi

| Asset | Konum (hedef) |
|-------|---------------|
| `logo-master.svg` | `design-lab/brand-dna/v4/exports/` |
| Varyant exports | `design-lab/brand-dna/v4/exports/svg/` |
| PNG ladder 16–1024 | `design-lab/brand-dna/v4/exports/png/` |
| QA report | `design-lab/brand-dna/v4/exports/LOGO_QA_REPORT.md` |

**Gate:** 16 px, 29 px, monochrome, squircle mask pass

### Phase 4 — Motion

| Asset | Konum |
|-------|-------|
| Boot Lottie 550 ms | `design-lab/brand-dna/v4/exports/lottie/` |
| Lock Lottie 320 ms | aynı |
| Sweep loading | aynı |
| Sonic sync sheet | `LOGO_SONIC_LINK.md` validated |

**Gate:** Frame-accurate marker ring sync

### Phase 5 — Production Migration

Ayrı PR'lar — `ROADMAP.md` Faz 4 PR #5 pattern:

| PR | Kapsam | Risk |
|----|--------|------|
| PR-L1 | `design-lab` exports → staging asset review | Düşük |
| PR-L2 | Website favicon + navbar + hero (no violet) | Orta |
| PR-L3 | `Logo.tsx` + onboarding SVG | Orta |
| PR-L4 | Splash native + Expo icon | Yüksek |
| PR-L5 | Boot Lottie + presence.boot wiring | Orta |
| PR-L6 | Store graphics (Play/App Store) | Orta |

**Her PR:** Red team + 16/29 px QA + blind test.

---

## 4. Rollout Stratejisi

### 4.1 Big-bang vs gradual

**Öneri: Gradual** — app icon değişimi kullanıcı confusion riski yüksek.

| Aşama | Yüzey | Süre |
|-------|-------|------|
| 1 | Website (düşük risk) | Hafta 1 |
| 2 | In-app `Logo.tsx` / onboarding | Hafta 2 |
| 3 | Splash + boot motion | Hafta 3 |
| 4 | App icon (iOS + Android) | Hafta 4 — ops duyuru |
| 5 | Store listing graphics | Icon sonrası |

### 4.2 A/B (opsiyonel)

- App icon A/B 2 hafta — retention / uninstall izleme
- Metric: confusion support ticket spike <5%

### 4.3 İletişim

- Ops: "Yeni marka imzası — aynı güven"
- **Değil:** "Yeni logo kampanyası" hype

---

## 5. Teknik Wiring Notları (Phase 5 referans — kod yok şimdi)

| Yüzey | Değişiklik |
|-------|------------|
| `Logo.tsx` | PNG → SVG veya unified `BrandMark` component |
| `app.json` / Expo | icon paths |
| Android `res/` | mipmaps + splash |
| iOS `Assets.xcassets` | AppIcon set |
| `website/lib/branding-assets.ts` | Path constants |
| `hero-horizontal-logo.tsx` | Remove violet blur; constitution colors |
| Push notification | Monochrome small icon |

**LSX:** Boot → `fireTriad('boot')` logo channel ekleme.

---

## 6. Renk Migration

| Eski | Yeni |
|------|------|
| `#67E8F9`, `#22D3EE`, `#2563EB` | Retire |
| `cyan-400` Tailwind hero | `meridian-cyan` token |
| `violet-400` hero blur | **Remove** |
| UI `Colors` cyan (if mismatched) | Audit Phase 5 — logo lead |

---

## 7. Marker Migration İlişkisi

Logo migration **marker migration ile paralel** ama bağımlı:

```
Logo geometry lock (Phase 1)
        │
        ├── Marker shared ring Lottie (Phase 4)
        └── Logo + marker ship aynı release train tercih
```

**Risk:** Logo yeni, marker eski pin — multimodal kopukluk. **Öneri:** PR-L4 + marker PR #6 aynı sprint.

---

## 8. Rollback Plan

| PR | Rollback |
|----|----------|
| Website | Revert PR — instant |
| Logo component | Revert PNG require |
| App icon | Revert mipmaps — store eski icon kalabilir 1 rev |
| Boot Lottie | Feature flag `brandBootV4` default off |

**Asset arşiv:** Eski logo `design-lab/brand-dna/v4/exports/legacy/` — silinmez.

---

## 9. Başarı Metrikleri

| Metrik | Hedef |
|--------|-------|
| Blind "LeylekTAG" | ≥80% |
| Uber pin confusion | 0 fail |
| 16 px favicon pass | QA pass |
| 29 px settings pass | QA pass |
| Boot sync ±16 ms | Instrumentation |
| Support ticket spike | <5% post icon |
| Hex cyan match | 0 drift |

---

## 10. Risk Matrisi

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| Kullanıcı icon tanımaz | Orta | Orta | Gradual rollout |
| İkili kimlik devam | Yüksek (şimdi) | Yüksek | Bu migration |
| Print reorder eski logo | Düşük | Düşük | Staged print |
| Sonic-logo desync | Orta | Orta | Phase 4 gate |
| Developer fragment assets | Orta | Orta | Single `BRANDING_PATHS` |

---

## 11. Non-Goals (tüm migration)

- Kod yazımı Phase 0–4
- Commit Phase 0–4
- Canlı sistem dokunma Phase 0–4
- Wordmark custom typeface (opsiyonel Phase 3B)

---

## 12. Sign-off Checklist (Phase 1 → 2)

- [ ] Pin retire onaylı
- [ ] Kuş illustrasyon retire onaylı
- [ ] Meridian geometry direction seçildi
- [ ] `#00D4AA` locked
- [ ] Varyant matrisi onaylı
- [ ] Migration PR sırası onaylı
- [ ] Marker paralel plan onaylı

---

**Sonraki adım:** Phase 1 stakeholder oturumu → Sketch Lab başlat.
