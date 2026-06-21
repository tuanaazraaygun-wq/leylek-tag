# Finalist Comparison & Production Ship Recommendation

**Phase:** 3 — decision spec for Phase 4  
**Status:** Analysis only — no ship to production

---

## 1. Evolution question

> Bugünkü kullanıcı bu logoyu görünce LeylekTAG olduğunu anlıyor mu?

| Finalist | Cevap | Algı cümlesi |
|----------|-------|--------------|
| **F1 Meridian Wing** | **Evet — en yüksek** | "Aynı kanat ve halka; daha temiz" |
| **F2 Horizon Stork** | Evet | "Leylek daha net; aile aynı" |
| **F3 Orbital Seal** | Evet, arc tanınır | "Halka aynı; iç sade" |

Hiçbiri "başka uygulama" algısı üretmez. F1 **"değişmiş"** riski en düşük.

---

## 2. Score matrix (0–100)

| Kriter | F1 | F2 | F3 |
|--------|----|----|-----|
| Tanınırlık | 92 | 88 | 86 |
| Premium | 90 | 91 | 88 |
| Trust | 88 | 86 | 92 |
| Longevity | 91 | 90 | 84 |
| Favicon | 85 | 72 | 80 |
| Watch | 84 | 78 | 86 |
| Website | 89 | 93 | 85 |
| Motion | 93 | 86 | 94 |
| Marker uyumu | 92 | 90 | 84 |
| LSDS uyumu | 92 | 94 | 90 |
| LSX uyumu | 91 | 90 | 92 |
| **Ortalama** | **89.5** | **86.9** | **87.2** |

### Weighted (evrim öncelikli)

| Kriter | Ağırlık | F1 | F2 | F3 |
|--------|---------|----|----|-----|
| Tanınırlık | 25% | 92 | 88 | 86 |
| Premium+Trust | 20% | 89 | 88.5 | 90 |
| Favicon+Watch+Icon | 20% | 84.7 | 75 | 83 |
| Motion+Sonic+LSX | 20% | 92.3 | 90 | 92 |
| Longevity | 15% | 91 | 90 | 84 |
| **Weighted** | | **89.4** | **86.1** | **86.8** |

---

## 3. Neden seçilmeli / seçilmemeli

### F1 — Meridian Wing

| Seçilmeli | Seçilmemeli |
|-----------|-------------|
| En yüksek evrim tanınırlığı (kanat+arc) | Leylek literal okuma F2'den düşük |
| Constitution default; Phase 0–2 consensus | Arc soyut — wordmark bağımlılığı |
| En dengeli min yüzey (fav+watch+icon) | |
| Marker genom tam; ring+horizon | |
| Tek master SVG pipeline basit | |
| "Yenilenmiş" not "değişmiş" | |

### F2 — Horizon Stork

| Seçilmeli | Seçilmemeli |
|-----------|-------------|
| En yüksek leylek storytelling | Favicon/watch zayıf without filled |
| Website hero showcase | İki path + compound QA yüksek |
| LSDS gap metaforu en zengin | Küçük boyut karmaşıklığı |
| Premium clever mark | Ship tek başına riskli |

### F3 — Orbital Seal

| Seçilmeli | Seçilmemeli |
|-----------|-------------|
| QR/lock multimodal champion | Generic circle app riski |
| PNG arc en doğrudan evrim | Leylek metaforu en zayıf |
| Trust kapalı form max | 10 yıl seal logoları çok |
| Watch ring okunurluğu iyi | Marker ring görsel karışma riski |

---

## 4. Head-to-head

| Matchup | Kazanan | Nedeni |
|---------|---------|--------|
| F1 vs F2 evrim | **F1** | Tanınırlık + min size |
| F2 vs F3 leylek | **F2** | Gap stork |
| F1 vs F3 lock/QR | **F3** | Ring-native |
| F1 vs F3 favicon | **F1** | Pin/circle red team |
| F2 vs F3 website | **F2** | Hero story |
| F1 vs F2 vs F3 ship | **F1** | Weighted + evrim |

---

## 5. Tek production önerisi

### Primary ship: **F1 Meridian Wing (S07)**

Phase 4'te **tek master mark** olarak üretilir:

- `f1-meridian-wing-master.svg`
- PNG ladder 24–1024
- Boot + lock Lottie
- App icon / splash / favicon **F1 tier rules**

**Gerekçe:** En yüksek evrim tanınırlığı + en dengeli yüzey ortalaması + en basit production pipeline + constitution uyumu.

---

## 6. Hibrit öneri — **F1 + F2 "Meridian Stork"**

F2 tek başına ship riskli; F1 leylek literal okuması F2'den düşük. **Hibrit = F1 geometry + F2 gap at large tier only.**

### Hibrit spec (Phase 4 variant — not second master)

| Katman | Kaynak |
|--------|--------|
| horizon, wing arc, ring, accent | **F1** master paths |
| gap negatif hint | **F2** — yalnızca `logo.tier.full` @ ≥128 px |
| ≤64 px exports | **F1 only** — gap layer hidden |
| filled fallback ≤24 | F1 `filled` tier (not F2 compound) |

### Hibrit dosyalar (Phase 4)

```
f1-meridian-wing-master.svg          ← ship default
f1-meridian-wing-marketing.svg       ← F1 + gap layer visible @128+
```

**Kullanım:**

| Yüzey | Variant |
|-------|---------|
| App icon, favicon, watch | F1 pure |
| Website hero @128+ | marketing variant optional |
| Investor deck | marketing variant |
| Login, widget, QR | F1 pure |

**Hibrit seçilmemeli eğer:** stakeholder kör test F1 pure ≥80% LeylekTAG **ve** leylek okuma sorulmazsa — pure F1 yeter.

### F3 rolü

**Ship değil.** F3 ring close timing ve chevron ingress **motion reference** olarak kalır; F1 ring anim F3 ile aynı 320ms spec (zaten shared genom).

---

## 7. Phase 4 decision gate

| Step | Action |
|------|--------|
| 1 | Produce F1 master SVG + PNG ladder |
| 2 | Kör test F1 pure @24px n≥8 |
| 3 | If leylek story <80% → add marketing variant gap |
| 4 | Produce Lottie boot+lock |
| 5 | QA matrix `PHASE4_HANDOFF.md` |
| 6 | Stakeholder sign-off → Phase 5 production PR (ayrı program) |

---

## 8. Retire list (all finalists)

Mevcut production assets retire when Phase 5 ships — not Phase 4:

- `logo-leylek.svg` (pin)
- `leylek-logo-premium.png` (3D kuş)
- hero violet wrapper

---

**Non-goals:** Production deploy, commit, frontend paths — Phase 5 only.
