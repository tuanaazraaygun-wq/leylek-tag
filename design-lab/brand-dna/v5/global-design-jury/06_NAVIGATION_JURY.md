# B5.6 — Navigation Jury

**Scope:** Map nav markers · field pins · destination picker · driver nav pointer · website map CSS  
**Verdict:** **FAIL** (dual language system)

---

## Production navigation symbols

| Surface | Asset | Verdict |
|---------|-------|---------|
| LiveMapView entity PNGs | B6-5 set | **FAIL** |
| DriverOfferScreen field | View/Ionicons | **FAIL** |
| OfferMapScreen | Generic circles | **FAIL** |
| index.tsx destination picker | Custom rings | **CONDITIONAL PASS** |
| DriverNavDirectionPointer | Nav chrome | **FAIL** — unreviewed vs DNA |
| Website `.leylek-marker-*` | CSS divIcon | **FAIL** — third language |

---

## Scoring — unified nav system (production)

| Dimension | Score | Why below 9 |
|-----------|-------|-------------|
| Recognition | **3** | Three dialects on one product. |
| Memorability | **4** | — |
| Trust | **5** | Inconsistency erodes trust. |
| Premium | **3** | Ionicons = **amateur hour**. |
| Technology | **5** | — |
| Map visibility | **4** | z16 fail per marker jury. |
| Brand uniqueness | **3** | — |
| Production readiness | **4** | Partial migration worst state. |

**Composite: 41 · FAIL**

---

## Quick Match identity (navigation context)

| Dimension | Score | Why below 9 |
|-----------|-------|-------------|
| Recognition | **2** | **No map marker** — UI chip only. |
| Brand uniqueness | **3** | Invisible on map where ops happen. |
| Map visibility | **0** | Doesn't exist on map. |

**Composite: 38 · FAIL**

**Brutal:** Quick Match is **strategically core** and **visually absent**. Collins would **stop the meeting**.

---

## Trust identity (navigation context)

| Dimension | Score | Why below 9 |
|-----------|-------|-------------|
| Recognition | **6** | TrustedAddButton chip — not map-native. |
| Trust | **7** | Warm resolve spec good — **not on map pin**. |
| Map visibility | **4** | MK-15 lab only. |

**Composite: 58 · CONDITIONAL PASS** (UI overlay) · **FAIL** (map)

---

## Leylek Zeka identity (map adjacency)

| Dimension | Score | Why below 9 |
|-----------|-------|-------------|
| Recognition | **6** | Eye derivative OK; **two companions** (eye FAB + watermark) split focus. |
| Brand uniqueness | **7** | Eye-from-logo smart — **under-refined**. |
| Premium | **6** | Ionicons replaced — good; PNG eye **not jury-tested @ small**. |

**Composite: 62 · CONDITIONAL PASS**

---

## Watermark (Muhabbet + brand)

| Dimension | Score | Why below 9 |
|-----------|-------|-------------|
| Recognition | **4** | Full premium PNG @ low opacity — **wrong asset tier**. |
| Premium | **3** | Should be mono stroke L — **using color logo reads muddy**. |
| Production readiness | **4** | Opacity fix applied; **asset choice wrong**. |

**Composite: 44 · FAIL**

---

## Brutal failures

| Failure | Detail |
|---------|--------|
| **Dual marker language** | PNG vs Ionicons — **pick one or FAIL** |
| **Pickup/destination** | Generic green/orange — **ClipArt** |
| **Heading rotation** | Car/motor offset exists — art doesn't exploit wedge |
| **Website map** | Fourth dialect — **brand bankruptcy** |

**Navigation production approval: FAIL**
