# B5.6 — Critical Failures

**Severity:** P0 = ship blocker · P1 = brand integrity · P2 = polish

---

## P0 — Ship blockers

| ID | Failure | Evidence | Fix direction |
|----|---------|----------|---------------|
| **CF-01** | **Human brand QA failed** | B6-7 · “logo değişmiş” | Sign B5.3 overlay · rollback production PNG |
| **CF-02** | **Wrong logo master in production** | 512 B6-2 export replaced 1254 premium | Restore `_backup-pre-b6-2` until LC-2 approved |
| **CF-03** | **No golden IoU executed** | GOLDEN_TEST pending | Pixel script ≥0.98 vs 1254 |
| **CF-04** | **Map test FAIL @ 0.4s** | z16 car/motor merge | MC-1 refined + device proof |
| **CF-05** | **App Store recognition FAIL** | Icon grid invisible | LC-2 + IC-3 + cyan arc mass |
| **CF-06** | **Dual marker language** | PNG + Ionicons field | Kill Ionicons on pickup/destination |
| **CF-07** | **Zero device matrix evidence** | B6-7 DQA 0% | Run AND/IOS matrix before any store RC |
| **CF-08** | **Nothing scores 95+** | Full scorecard | Complete restoration pipeline |

---

## P1 — Brand integrity failures

| ID | Failure | Why brutal |
|----|---------|------------|
| **CF-09** | B5.2 trace shipped before human sign-off | Process violation — **amateur governance** |
| **CF-10** | Glow `#22D3EE` ≠ `#00D4AA` | **Sloppy token discipline** — Collins fires for this |
| **CF-11** | Quick Match invisible on map | **Strategy/brain disconnect** |
| **CF-12** | Watermark uses full color premium PNG | **Muddy · cheap** at 6% opacity |
| **CF-13** | Notification icon not eye-only tier | **Illegible** — Apple HIG fail |
| **CF-14** | Website map CSS markers — 4th dialect | **Brand broken at marketing layer** |
| **CF-15** | Metallic premium memory abandoned | Users feel **downgrade** not upgrade |
| **CF-16** | Muhabbet legacy art (`leylek-blue`, header) | **Two brands in one app** |

---

## P2 — Polish failures

| ID | Failure |
|----|---------|
| **CF-17** | Splash static — motion spec ignored |
| **CF-18** | Markers static — pulse spec ignored |
| **CF-19** | Trust has no map-native pin |
| **CF-20** | Nav prompts not sonic-branded |
| **CF-21** | B5.5 sketches never human-scored |
| **CF-22** | Adaptive icon OEM matrix empty |
| **CF-23** | Cluster marker spec only — no implementation |
| **CF-24** | Offline driver invisible on map |

---

## Failure mode taxonomy

| Label | Manifestation in LeylekTAG |
|-------|---------------------------|
| **ClipArt** | Ionicons pickup/destination · flat bird |
| **AI** | Over-smooth Beziers · no material truth |
| **Startup** | Dark bg + centered logo splash · glow blobs |
| **Generic** | Car/motor same blob · bird like 40 apps |
| **Cheap** | Lost chrome · wrong watermark tier |
| **Unbalanced** | Bird high in adaptive circle · thin arc |
| **Dead @24px** | Arc smudge · beak gone · leg gone |
| **Dead on Maps** | z16 discrimination fail · satellite noise |

---

## What disappears @24px (production)

- Orbital arc **mass**
- Beak **authority**
- Tucked leg **mnemonic**
- Wing **energy**
- **Brand name association** — becomes “bird dot”

---

## What disappears on Google Maps (production)

- Car vs motor **without zooming**
- Trust / QM / cluster **entirely**
- Cyan glow **washes out** on light tiles
- Pickup vs destination **different language** than entity map

---

## Five-year outdated guarantee (if shipped as-is)

| Element | Outdated by |
|---------|-------------|
| Glow-only markers | 2027 — reads Uber 2018 |
| Flat splash logo | Immediate — reads Expo template |
| Ionicons field pins | Already outdated — 2014 |
| Undocumented motion | 2026 — devs pick random springs |

---

**These failures must be closed before jury reconvenes.**
